//
//  AppDelegate.m
//  FrameTVScreenSaverRig
//
//  Created by Alastair Tse on 26/04/2015.
//
//  Copyright 2015 Alastair Tse.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//  http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
//

#import "AppDelegate.h"
#import "FrameTVConfigController.h"
#import "FrameTVScreenSaverView.h"
#import "WVSSAddress.h"
#import <ScreenSaver/ScreenSaver.h>

// Module name the installed FrameTVScreenSaver.saver uses for its prefs
// domain — must match kScreenSaverName in FrameTVScreenSaverView.m.
static NSString *const kScreenSaverModuleName = @"FrameTVScreenSaver";
// Must match the same keys in FrameTVConfigController.m — both write into
// the same ScreenSaverDefaults domain.
static NSString *const kDeviceTokenDefaultsKey = @"FrameTVDeviceToken";
static NSString *const kOriginDefaultsKey = @"FrameTVOrigin";

@interface AppDelegate () <FrameTVConfigControllerDelegate>

@property(weak) IBOutlet NSWindow *window;
@property(strong) FrameTVConfigController *configController;
@end

@implementation AppDelegate {
  WVSSConfig *_config;
}

- (void)applicationDidFinishLaunching:(NSNotification *)aNotification {
  // Read/write the *installed* screensaver's own prefs domain, not this
  // app's private defaults — so changes here (and via deep link) actually
  // configure the real FrameTVScreenSaver.saver running in System Settings.
  NSUserDefaults *screenSaverDefaults =
      [ScreenSaverDefaults defaultsForModuleWithName:kScreenSaverModuleName];
  _config = [[WVSSConfig alloc] initWithUserDefaults:screenSaverDefaults];

  [self reloadWebView];
  [self.window makeKeyWindow];

  // Only pop the config sheet automatically on first run (not yet
  // connected) or when launched via a connect:// deep link that needs to
  // show its confirmation. Once already connected, launching the app
  // should just show the live preview — not re-surface the sheet (and the
  // account's display URL in it) on every single open.
  NSArray<NSString *> *launchArgs = [[NSProcessInfo processInfo] arguments];
  BOOL launchedViaURL = launchArgs.count > 1 && [launchArgs[1] hasPrefix:@"frametvscreensaver://"];
  BOOL alreadyConnected = [FrameTVConfigController isConfigConnected:_config];
  if (launchedViaURL || !alreadyConnected) {
    [self performSelector:@selector(showPreferences:) withObject:nil afterDelay:0];
  }
}

#pragma mark - Deep link handling

// AppKit hands off custom URL scheme launches (frametvscreensaver://...) here.
- (void)application:(NSApplication *)application openURLs:(NSArray<NSURL *> *)urls {
  for (NSURL *url in urls) {
    if (![url.scheme isEqualToString:@"frametvscreensaver"]) continue;
    if (![url.host isEqualToString:@"connect"]) continue;

    NSURLComponents *components = [NSURLComponents componentsWithURL:url resolvingAgainstBaseURL:NO];
    NSString *token = nil;
    NSString *origin = nil;
    NSString *deviceToken = nil;
    for (NSURLQueryItem *item in components.queryItems) {
      if ([item.name isEqualToString:@"token"]) token = item.value;
      if ([item.name isEqualToString:@"origin"]) origin = item.value;
      if ([item.name isEqualToString:@"deviceToken"]) deviceToken = item.value;
    }

    if (token.length && origin.length) {
      [self connectWithToken:token origin:origin deviceToken:deviceToken];
    }
  }
}

- (void)connectWithToken:(NSString *)token origin:(NSString *)origin deviceToken:(NSString *)deviceToken {
  NSString *shareUrl = [NSString stringWithFormat:@"%@/s/%@", origin, token];

  [_config.addresses removeAllObjects];
  [_config.addresses addObject:[WVSSAddress addressWithURL:shareUrl duration:-1]];
  _config.shouldFetchAddressList = NO;
  [_config synchronize];

  NSUserDefaults *screenSaverDefaults = [ScreenSaverDefaults defaultsForModuleWithName:kScreenSaverModuleName];
  [screenSaverDefaults setObject:origin forKey:kOriginDefaultsKey];
  if (deviceToken.length) {
    [screenSaverDefaults setObject:deviceToken forKey:kDeviceTokenDefaultsKey];
  }
  [screenSaverDefaults synchronize];

  [self reloadWebView];
  [NSApp activateIgnoringOtherApps:YES];
  [self.window makeKeyAndOrderFront:nil];

  NSAlert *alert = [[NSAlert alloc] init];
  alert.messageText = @"FrameTV Screensaver Connected";
  alert.informativeText = [NSString stringWithFormat:
      @"Your screensaver is now configured to show:\n%@\n\n"
       "Open System Settings → Screen Saver → FrameTVScreenSaver to activate it.",
      shareUrl];
  [alert addButtonWithTitle:@"Open Screen Saver Settings"];
  [alert addButtonWithTitle:@"Done"];
  NSModalResponse response = [alert runModal];
  if (response == NSAlertFirstButtonReturn) {
    NSURL *settingsUrl = [NSURL URLWithString:@"x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension"];
    [[NSWorkspace sharedWorkspace] openURL:settingsUrl];
  }
}

- (void)applicationWillTerminate:(NSNotification *)aNotification {
  // Insert code here to tear down your application
}

- (void)configController:(FrameTVConfigController *)configController
      dismissConfigSheet:(NSWindow *)sheet {
  [self reloadWebView];
  [sheet close];
  self.configController = nil;
}

- (IBAction)showPreferences:(id)sender {
  self.configController = [[FrameTVConfigController alloc] initWithConfig:_config];
  self.configController.delegate = self;
  [self.window beginSheet:self.configController.sheet completionHandler:nil];
}

- (IBAction)reloadWebView {
  FrameTVScreenSaverView *wvsv;

  // Remove the older webview
  if ([self.window.contentView subviews]) {
    wvsv = (FrameTVScreenSaverView *)[[self.window.contentView subviews] firstObject];
    [wvsv stopAnimation];
    [wvsv removeFromSuperview];
  }

  // Recreate the subview.
  NSUserDefaults *userDefaults = [ScreenSaverDefaults defaultsForModuleWithName:kScreenSaverModuleName];
  NSRect bounds = [self.window.contentView bounds];
  wvsv = [[FrameTVScreenSaverView alloc] initWithFrame:bounds isPreview:NO prefsStore:userDefaults];
  wvsv.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
  [self.window.contentView addSubview:wvsv];
  [wvsv startAnimation];
}

@end
