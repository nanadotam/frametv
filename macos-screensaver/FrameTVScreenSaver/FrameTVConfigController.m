//
//  FrameTVConfigController.m
//  FrameTVScreenSaver
//

#import "FrameTVConfigController.h"
#import "WVSSAddress.h"
#import <WebKit/WebKit.h>
#import <ScreenSaver/ScreenSaver.h>

static NSString *const kFrameTVBaseURL = @"https://frametv.vercel.app";
static NSString *const kFrameTVAuthorizePath = @"/screensaver/authorize";
static NSString *const kFrameTVURLScheme = @"frametvscreensaver";
static NSString *const kScreenSaverModuleName = @"FrameTVScreenSaver";
static NSString *const kRigBundleIdentifier = @"com.frametv.FrameTVScreenSaverRig";
static NSString *const kDeviceTokenDefaultsKey = @"FrameTVDeviceToken";
static NSString *const kOriginDefaultsKey = @"FrameTVOrigin";

@interface FrameTVConfigController () <WKNavigationDelegate>

@property(nonatomic, strong) WVSSConfig *config;

@property(nonatomic, strong) NSWindow *sheetWindow;
@property(nonatomic, strong) NSTextField *statusLabel;
@property(nonatomic, strong) NSButton *primaryButton;
@property(nonatomic, strong) NSPopUpButton *modePopup;
@property(nonatomic, strong) NSTextField *modeLabel;
@property(nonatomic, strong) NSArray<NSDictionary *> *modes;

@property(nonatomic, strong) NSWindow *signInWindow;
@property(nonatomic, strong) WKWebView *signInWebView;

@end

@implementation FrameTVConfigController

- (instancetype)initWithConfig:(WVSSConfig *)config {
  self = [super init];
  if (self) {
    _config = config;
    [self buildSheetWindow];
  }
  return self;
}

- (NSWindow *)sheet {
  return self.sheetWindow;
}

#pragma mark - Connection state

// WVSSConfig auto-fills an "about:blank" placeholder address (from
// WVSSAddress.defaultAddress) whenever the list is empty — addresses.count
// alone is never 0 after init, so a real connection means "there's an
// address, and it's an actual http(s) FrameTV link, not the placeholder."
+ (BOOL)isConfigConnected:(WVSSConfig *)config {
  NSString *url = config.addresses.count > 0 ? [(WVSSAddress *)config.addresses.firstObject url] : nil;
  return url.length > 0 && [url hasPrefix:@"http"];
}

- (BOOL)isConnected {
  return [FrameTVConfigController isConfigConnected:self.config];
}

// The "Uninstall Everything" action deletes the installed .saver bundle —
// only safe to offer when we're *not* that bundle's own hosted process
// (System Settings' Options sheet runs inside the .saver itself). Only the
// standalone companion app can safely delete it.
- (BOOL)isRunningAsStandaloneApp {
  return [[[NSBundle mainBundle] bundleIdentifier] isEqualToString:kRigBundleIdentifier];
}

- (NSString *)connectedURL {
  if (!self.isConnected) return nil;
  return [(WVSSAddress *)self.config.addresses.firstObject url];
}

// Device token + origin live in the same ScreenSaverDefaults domain as the
// address WVSSConfig manages, just under their own keys — WVSSConfig's
// public API only models the address list, so we go straight to a fresh
// ScreenSaverDefaults instance for the same module (resolves to the same
// on-disk domain regardless of which instance created it).
- (NSUserDefaults *)rawDefaults {
  return [ScreenSaverDefaults defaultsForModuleWithName:kScreenSaverModuleName];
}

- (NSString *)deviceToken {
  return [self.rawDefaults stringForKey:kDeviceTokenDefaultsKey];
}

- (NSString *)connectedOrigin {
  return [self.rawDefaults stringForKey:kOriginDefaultsKey];
}

- (BOOL)hasModeAccess {
  return self.isConnected && self.deviceToken.length > 0 && self.connectedOrigin.length > 0;
}

- (NSString *)statusText {
  if (self.isConnected) {
    return [NSString stringWithFormat:
        @"Connected — this screensaver shows your live FrameTV display.\n\n%@\n\n"
         "Change what's shown any time from the FrameTV app or web dashboard — "
         "no need to come back here.",
        self.connectedURL];
  }
  return @"Sign in to point this screensaver at your FrameTV display. "
          "Once connected, you can change what it shows any time from FrameTV "
          "itself — on your phone, your Mac, anywhere — without reopening "
          "this panel.";
}

#pragma mark - Main sheet UI

- (void)buildSheetWindow {
  NSRect frame = NSMakeRect(0, 0, 440, 480);
  NSWindow *window = [[NSWindow alloc] initWithContentRect:frame
                                                  styleMask:NSWindowStyleMaskTitled
                                                    backing:NSBackingStoreBuffered
                                                      defer:NO];
  window.title = @"FrameTV Screensaver";
  window.delegate = self;
  self.sheetWindow = window;

  NSView *content = window.contentView;

  NSTextField *icon = [self labelWithFrame:NSMakeRect(188, 396, 64, 64)];
  icon.font = [NSFont systemFontOfSize:44];
  icon.alignment = NSTextAlignmentCenter;
  icon.stringValue = @"📺";
  [content addSubview:icon];

  NSTextField *title = [self labelWithFrame:NSMakeRect(20, 358, 400, 28)];
  title.font = [NSFont boldSystemFontOfSize:18];
  title.alignment = NSTextAlignmentCenter;
  title.stringValue = @"Welcome to FrameTV";
  [content addSubview:title];

  NSTextField *status = [self labelWithFrame:NSMakeRect(30, 240, 380, 110)];
  status.font = [NSFont systemFontOfSize:12.5];
  status.textColor = [NSColor secondaryLabelColor];
  status.alignment = NSTextAlignmentCenter;
  status.lineBreakMode = NSLineBreakByWordWrapping;
  status.maximumNumberOfLines = 0;
  status.stringValue = self.statusText;
  self.statusLabel = status;
  [content addSubview:status];

  // Mode picker row — populated/shown only once connected with a device
  // token (see rebuildModeSection). Built here (hidden) so later state
  // changes just toggle visibility instead of inserting/removing views.
  NSTextField *modeLabel = [self labelWithFrame:NSMakeRect(30, 202, 110, 20)];
  modeLabel.font = [NSFont systemFontOfSize:12];
  modeLabel.alignment = NSTextAlignmentRight;
  modeLabel.stringValue = @"Screensaver mode:";
  self.modeLabel = modeLabel;
  [content addSubview:modeLabel];

  NSPopUpButton *modePopup = [[NSPopUpButton alloc] initWithFrame:NSMakeRect(150, 198, 260, 26) pullsDown:NO];
  modePopup.target = self;
  modePopup.action = @selector(modeSelected:);
  self.modePopup = modePopup;
  [content addSubview:modePopup];

  NSButton *primary = [NSButton buttonWithTitle:self.isConnected ? @"Sign In as a Different Account" : @"Sign In"
                                          target:self
                                          action:@selector(primaryButtonPressed:)];
  primary.frame = NSMakeRect(120, 148, 200, 32);
  primary.bezelStyle = NSBezelStyleRounded;
  primary.keyEquivalent = @"\r";
  self.primaryButton = primary;
  [content addSubview:primary];

  if (self.isRunningAsStandaloneApp) {
    NSButton *uninstall = [NSButton buttonWithTitle:@"Uninstall Everything…"
                                              target:self
                                              action:@selector(uninstallPressed:)];
    uninstall.frame = NSMakeRect(120, 102, 200, 24);
    uninstall.bezelStyle = NSBezelStyleInline;
    uninstall.contentTintColor = [NSColor systemRedColor];
    [content addSubview:uninstall];
  }

  if (self.isConnected) {
    NSButton *disconnect = [NSButton buttonWithTitle:@"Disconnect"
                                               target:self
                                               action:@selector(disconnectPressed:)];
    disconnect.frame = NSMakeRect(20, 20, 90, 28);
    disconnect.bezelStyle = NSBezelStyleRounded;
    [content addSubview:disconnect];
  }

  NSButton *done = [NSButton buttonWithTitle:@"Done" target:self action:@selector(donePressed:)];
  done.frame = NSMakeRect(340, 20, 80, 28);
  done.bezelStyle = NSBezelStyleRounded;
  [content addSubview:done];

  [self rebuildModeSection];
  if (self.hasModeAccess) [self fetchModes];
}

- (NSTextField *)labelWithFrame:(NSRect)frame {
  NSTextField *label = [[NSTextField alloc] initWithFrame:frame];
  label.editable = NO;
  label.selectable = NO;
  label.bezeled = NO;
  label.drawsBackground = NO;
  return label;
}

- (void)refreshStatus {
  self.statusLabel.stringValue = self.statusText;
  [self.primaryButton setTitle:self.isConnected ? @"Sign In as a Different Account" : @"Sign In"];
}

- (void)rebuildModeSection {
  BOOL show = self.hasModeAccess;
  self.modeLabel.hidden = !show;
  self.modePopup.hidden = !show;
  if (!show) {
    [self.modePopup removeAllItems];
  }
}

#pragma mark - Mode picker (screensaver-scoped bearer token)

- (NSMutableURLRequest *)authedRequestForPath:(NSString *)path {
  NSString *urlString = [self.connectedOrigin stringByAppendingString:path];
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:urlString]];
  NSString *bearer = [@"Bearer " stringByAppendingString:self.deviceToken];
  [request setValue:bearer forHTTPHeaderField:@"Authorization"];
  return request;
}

- (void)fetchModes {
  if (!self.hasModeAccess) return;

  NSMutableURLRequest *request = [self authedRequestForPath:@"/api/modes"];
  NSURLSessionDataTask *task = [[NSURLSession sharedSession]
      dataTaskWithRequest:request
        completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error || !data) return;

    NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    NSArray<NSDictionary *> *modes = json[@"modes"];
    if (![modes isKindOfClass:[NSArray class]]) return;

    // Only modes the user has enabled are worth offering here.
    NSPredicate *enabledOnly = [NSPredicate predicateWithFormat:@"is_enabled == YES"];
    NSArray<NSDictionary *> *enabledModes = [modes filteredArrayUsingPredicate:enabledOnly];

    dispatch_async(dispatch_get_main_queue(), ^{
      [self populateModePopupWithModes:enabledModes];
    });
  }];
  [task resume];
}

- (void)populateModePopupWithModes:(NSArray<NSDictionary *> *)modes {
  self.modes = modes;
  [self.modePopup removeAllItems];
  for (NSDictionary *mode in modes) {
    NSString *name = mode[@"name"] ?: mode[@"id"];
    [self.modePopup addItemWithTitle:name];
    self.modePopup.lastItem.representedObject = mode[@"id"];
  }
  [self fetchActiveMode];
}

- (void)fetchActiveMode {
  if (!self.hasModeAccess) return;

  NSMutableURLRequest *request = [self authedRequestForPath:@"/api/display-state"];
  NSURLSessionDataTask *task = [[NSURLSession sharedSession]
      dataTaskWithRequest:request
        completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error || !data) return;
    NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    NSString *activeModeId = json[@"state"][@"active_mode_id"];
    if (!activeModeId) return;

    dispatch_async(dispatch_get_main_queue(), ^{
      for (NSInteger i = 0; i < self.modePopup.itemArray.count; i++) {
        NSMenuItem *item = self.modePopup.itemArray[i];
        if ([item.representedObject isEqual:activeModeId]) {
          [self.modePopup selectItemAtIndex:i];
          break;
        }
      }
    });
  }];
  [task resume];
}

- (void)modeSelected:(id)sender {
  NSString *modeId = self.modePopup.selectedItem.representedObject;
  if (!modeId.length || !self.hasModeAccess) return;

  NSMutableURLRequest *request = [self authedRequestForPath:@"/api/screensaver/mode"];
  request.HTTPMethod = @"PATCH";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
  request.HTTPBody = [NSJSONSerialization dataWithJSONObject:@{ @"mode_id": modeId } options:0 error:nil];

  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request];
  [task resume];
}

#pragma mark - Actions

- (void)primaryButtonPressed:(id)sender {
  [self presentSignIn];
}

- (void)disconnectPressed:(id)sender {
  [self.config.addresses removeAllObjects];
  [self.config synchronize];

  NSUserDefaults *defaults = self.rawDefaults;
  [defaults removeObjectForKey:kDeviceTokenDefaultsKey];
  [defaults removeObjectForKey:kOriginDefaultsKey];
  [defaults synchronize];

  self.modes = nil;
  [self refreshStatus];
  [self rebuildModeSection];
}

- (void)uninstallPressed:(id)sender {
  NSAlert *alert = [[NSAlert alloc] init];
  alert.alertStyle = NSAlertStyleWarning;
  alert.messageText = @"Uninstall FrameTV Screensaver?";
  alert.informativeText =
      @"This removes the installed screensaver from Screen Savers and "
       "clears all its saved settings, caches, and cookies on this Mac. "
       "This can't be undone — you'll need to sign in again to reconnect.";
  [alert addButtonWithTitle:@"Uninstall"];
  [alert addButtonWithTitle:@"Cancel"];
  [[[alert buttons] objectAtIndex:0] setHasDestructiveAction:YES];

  if ([alert runModal] != NSAlertFirstButtonReturn) return;

  [self performUninstall];
}

- (void)performUninstall {
  NSFileManager *fm = NSFileManager.defaultManager;

  // Best-effort: release the currently-loaded .saver from memory before
  // deleting its files out from under it.
  NSTask *killTask = [[NSTask alloc] init];
  killTask.launchPath = @"/usr/bin/killall";
  killTask.arguments = @[ @"legacyScreenSaver" ];
  @try { [killTask launch]; [killTask waitUntilExit]; } @catch (NSException *e) { /* not running */ }

  // Installed bundle.
  NSArray<NSURL *> *libraryDirs = [fm URLsForDirectory:NSLibraryDirectory inDomains:NSUserDomainMask];
  for (NSURL *libraryURL in libraryDirs) {
    NSURL *saverURL = [[libraryURL URLByAppendingPathComponent:@"Screen Savers"]
        URLByAppendingPathComponent:@"FrameTVScreenSaver.saver"];
    [fm removeItemAtURL:saverURL error:nil];
  }

  // Saved preferences (address/duration, both possible on-disk locations).
  [self clearAllScreenSaverDefaults];

  // Caches, cookies, WebKit storage, logs tied to this app's bundle id.
  NSArray<NSString *> *cacheRelativePaths = @[
    @"Library/Caches/com.frametv.FrameTVScreenSaverRig",
    @"Library/WebKit/com.frametv.FrameTVScreenSaverRig",
    @"Library/HTTPStorages/com.frametv.FrameTVScreenSaverRig.binarycookies",
    @"Library/Logs/com.frametv.FrameTVScreenSaverRig",
  ];
  NSString *home = NSHomeDirectory();
  for (NSString *relativePath in cacheRelativePaths) {
    NSString *fullPath = [home stringByAppendingPathComponent:relativePath];
    [fm removeItemAtPath:fullPath error:nil];
  }

  [self.config.addresses removeAllObjects];
  [self refreshStatus];

  NSAlert *done = [[NSAlert alloc] init];
  done.messageText = @"Uninstalled";
  done.informativeText = @"FrameTVScreenSaver has been removed and all its saved data cleared from this Mac.";
  [done addButtonWithTitle:@"OK"];
  [done runModal];
}

// Clears every key in the ScreenSaverDefaults domain (rather than relying on
// filesystem access to the ByHost plist directly, which is fragile w.r.t.
// cfprefsd's in-memory cache — going through the proper API keeps it in sync).
- (void)clearAllScreenSaverDefaults {
  NSUserDefaults *defaults = [ScreenSaverDefaults defaultsForModuleWithName:kScreenSaverModuleName];
  NSDictionary *all = [defaults dictionaryRepresentation];
  for (NSString *key in all) {
    [defaults removeObjectForKey:key];
  }
  [defaults synchronize];
}

- (void)donePressed:(id)sender {
  [self.delegate configController:self dismissConfigSheet:self.sheetWindow];
}

#pragma mark - Embedded sign-in WebView

- (void)presentSignIn {
  // Presented as a sheet on self.sheetWindow — sheets don't render their own
  // titlebar traffic lights (NSWindowStyleMaskClosable is a no-op here), so
  // without an in-content control there is *no* way to dismiss this if the
  // web content doesn't reach the connect:// redirect for any reason. Always
  // give it its own visible Cancel button, independent of web content state.
  NSRect frame = NSMakeRect(0, 0, 480, 720);
  NSWindow *window = [[NSWindow alloc] initWithContentRect:frame
                                                  styleMask:(NSWindowStyleMaskTitled | NSWindowStyleMaskClosable)
                                                    backing:NSBackingStoreBuffered
                                                      defer:NO];
  window.title = @"Sign in to FrameTV";
  window.delegate = self;
  self.signInWindow = window;

  NSView *content = window.contentView;

  NSButton *cancel = [NSButton buttonWithTitle:@"Cancel" target:self action:@selector(cancelSignInPressed:)];
  cancel.frame = NSMakeRect(16, 720 - 40, 90, 28);
  cancel.bezelStyle = NSBezelStyleRounded;
  cancel.autoresizingMask = NSViewMaxXMargin | NSViewMinYMargin;
  [content addSubview:cancel];

  // Always ephemeral — never a persistent data store. This WKWebView is
  // hosted inside whatever process presents the config sheet (System
  // Settings/legacyScreenSaver for the installed .saver's own Options
  // panel, or the standalone app for its own window), and each of those
  // has its own separate on-disk WebKit storage that our own cache-clearing
  // code has no reach into. The only state that should ever persist across
  // sign-ins is the connected address in ScreenSaverDefaults — the sign-in
  // form itself should always start fresh, whether this is the first
  // "Sign In" or "Sign In as a Different Account". A persistent store here
  // previously caused a stale session from a *different* host process to
  // silently skip the login form on a supposedly fresh install.
  WKWebViewConfiguration *configuration = [[WKWebViewConfiguration alloc] init];
  configuration.websiteDataStore = [WKWebsiteDataStore nonPersistentDataStore];
  WKWebView *webView = [[WKWebView alloc] initWithFrame:NSMakeRect(0, 0, 480, 720 - 44) configuration:configuration];
  webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
  webView.navigationDelegate = self;
  self.signInWebView = webView;
  [content addSubview:webView];

  NSURL *authorizeURL = [NSURL URLWithString:[kFrameTVBaseURL stringByAppendingString:kFrameTVAuthorizePath]];
  [webView loadRequest:[NSURLRequest requestWithURL:authorizeURL]];

  [self.sheetWindow beginSheet:window completionHandler:nil];
}

- (void)cancelSignInPressed:(id)sender {
  [self dismissSignIn];
}

- (void)dismissSignIn {
  if (!self.signInWindow) return;
  [self.sheetWindow endSheet:self.signInWindow];
  self.signInWindow = nil;
  self.signInWebView = nil;
}

#pragma mark - WKNavigationDelegate

// Intercepts the frametvscreensaver://connect?token=...&origin=... deep link
// that /screensaver/authorize's "Open in FrameTVScreenSaver" button emits —
// same URL the standalone companion app's Info.plist URL type handles, just
// consumed in-process here instead of via LSOpenURL.
- (void)webView:(WKWebView *)webView
    decidePolicyForNavigationAction:(WKNavigationAction *)navigationAction
                    decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
  NSURL *url = navigationAction.request.URL;

  if ([url.scheme isEqualToString:kFrameTVURLScheme]) {
    decisionHandler(WKNavigationActionPolicyCancel);
    [self handleConnectURL:url];
    return;
  }

  decisionHandler(WKNavigationActionPolicyAllow);
}

- (void)handleConnectURL:(NSURL *)url {
  if (![url.host isEqualToString:@"connect"]) return;

  NSURLComponents *components = [NSURLComponents componentsWithURL:url resolvingAgainstBaseURL:NO];
  NSString *token = nil;
  NSString *origin = nil;
  NSString *deviceToken = nil;
  for (NSURLQueryItem *item in components.queryItems) {
    if ([item.name isEqualToString:@"token"]) token = item.value;
    if ([item.name isEqualToString:@"origin"]) origin = item.value;
    if ([item.name isEqualToString:@"deviceToken"]) deviceToken = item.value;
  }
  if (!token.length || !origin.length) return;

  NSString *shareUrl = [NSString stringWithFormat:@"%@/s/%@", origin, token];
  [self.config.addresses removeAllObjects];
  [self.config.addresses addObject:[WVSSAddress addressWithURL:shareUrl duration:-1]];
  self.config.shouldFetchAddressList = NO;
  [self.config synchronize];

  NSUserDefaults *defaults = self.rawDefaults;
  [defaults setObject:origin forKey:kOriginDefaultsKey];
  if (deviceToken.length) {
    [defaults setObject:deviceToken forKey:kDeviceTokenDefaultsKey];
  }
  [defaults synchronize];

  [self dismissSignIn];
  [self refreshStatus];
  [self rebuildModeSection];
  if (self.hasModeAccess) [self fetchModes];
}

#pragma mark - NSWindowDelegate

- (void)windowWillClose:(NSNotification *)notification {
  if (notification.object == self.signInWindow) {
    self.signInWindow = nil;
    self.signInWebView = nil;
  }
}

@end
