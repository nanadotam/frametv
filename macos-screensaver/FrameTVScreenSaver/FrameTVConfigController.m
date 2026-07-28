//
//  FrameTVConfigController.m
//  FrameTVScreenSaver
//

#import "FrameTVConfigController.h"
#import "WVSSAddress.h"
#import <WebKit/WebKit.h>

static NSString *const kFrameTVBaseURL = @"https://frametv.vercel.app";
static NSString *const kFrameTVAuthorizePath = @"/screensaver/authorize";
static NSString *const kFrameTVURLScheme = @"frametvscreensaver";

@interface FrameTVConfigController () <WKNavigationDelegate>

@property(nonatomic, strong) WVSSConfig *config;

@property(nonatomic, strong) NSWindow *sheetWindow;
@property(nonatomic, strong) NSTextField *statusLabel;
@property(nonatomic, strong) NSButton *primaryButton;

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

- (BOOL)isConnected {
  return self.config.addresses.count > 0;
}

- (NSString *)connectedURL {
  if (!self.isConnected) return nil;
  return [(WVSSAddress *)self.config.addresses.firstObject url];
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
  NSRect frame = NSMakeRect(0, 0, 440, 380);
  NSWindow *window = [[NSWindow alloc] initWithContentRect:frame
                                                  styleMask:NSWindowStyleMaskTitled
                                                    backing:NSBackingStoreBuffered
                                                      defer:NO];
  window.title = @"FrameTV Screensaver";
  window.delegate = self;
  self.sheetWindow = window;

  NSView *content = window.contentView;

  NSTextField *icon = [self labelWithFrame:NSMakeRect(188, 296, 64, 64)];
  icon.font = [NSFont systemFontOfSize:44];
  icon.alignment = NSTextAlignmentCenter;
  icon.stringValue = @"📺";
  [content addSubview:icon];

  NSTextField *title = [self labelWithFrame:NSMakeRect(20, 258, 400, 28)];
  title.font = [NSFont boldSystemFontOfSize:18];
  title.alignment = NSTextAlignmentCenter;
  title.stringValue = @"Welcome to FrameTV";
  [content addSubview:title];

  NSTextField *status = [self labelWithFrame:NSMakeRect(30, 130, 380, 120)];
  status.font = [NSFont systemFontOfSize:12.5];
  status.textColor = [NSColor secondaryLabelColor];
  status.alignment = NSTextAlignmentCenter;
  status.lineBreakMode = NSLineBreakByWordWrapping;
  status.maximumNumberOfLines = 0;
  status.stringValue = self.statusText;
  self.statusLabel = status;
  [content addSubview:status];

  NSButton *primary = [NSButton buttonWithTitle:self.isConnected ? @"Sign In as a Different Account" : @"Sign In"
                                          target:self
                                          action:@selector(primaryButtonPressed:)];
  primary.frame = NSMakeRect(120, 78, 200, 32);
  primary.bezelStyle = NSBezelStyleRounded;
  primary.keyEquivalent = @"\r";
  self.primaryButton = primary;
  [content addSubview:primary];

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

#pragma mark - Actions

- (void)primaryButtonPressed:(id)sender {
  [self presentSignIn];
}

- (void)disconnectPressed:(id)sender {
  [self.config.addresses removeAllObjects];
  [self.config synchronize];
  [self refreshStatus];
}

- (void)donePressed:(id)sender {
  [self.delegate configController:self dismissConfigSheet:self.sheetWindow];
}

#pragma mark - Embedded sign-in WebView

- (void)presentSignIn {
  NSRect frame = NSMakeRect(0, 0, 480, 680);
  NSWindow *window = [[NSWindow alloc] initWithContentRect:frame
                                                  styleMask:(NSWindowStyleMaskTitled | NSWindowStyleMaskClosable)
                                                    backing:NSBackingStoreBuffered
                                                      defer:NO];
  window.title = @"Sign in to FrameTV";
  self.signInWindow = window;

  WKWebViewConfiguration *configuration = [[WKWebViewConfiguration alloc] init];
  WKWebView *webView = [[WKWebView alloc] initWithFrame:window.contentView.bounds configuration:configuration];
  webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
  webView.navigationDelegate = self;
  self.signInWebView = webView;
  [window.contentView addSubview:webView];

  NSURL *authorizeURL = [NSURL URLWithString:[kFrameTVBaseURL stringByAppendingString:kFrameTVAuthorizePath]];
  [webView loadRequest:[NSURLRequest requestWithURL:authorizeURL]];

  [self.sheetWindow beginSheet:window completionHandler:nil];
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
  for (NSURLQueryItem *item in components.queryItems) {
    if ([item.name isEqualToString:@"token"]) token = item.value;
    if ([item.name isEqualToString:@"origin"]) origin = item.value;
  }
  if (!token.length || !origin.length) return;

  NSString *shareUrl = [NSString stringWithFormat:@"%@/s/%@", origin, token];
  [self.config.addresses removeAllObjects];
  [self.config.addresses addObject:[WVSSAddress addressWithURL:shareUrl duration:-1]];
  self.config.shouldFetchAddressList = NO;
  [self.config synchronize];

  [self dismissSignIn];
  [self refreshStatus];
}

#pragma mark - NSWindowDelegate

- (void)windowWillClose:(NSNotification *)notification {
  if (notification.object == self.signInWindow) {
    self.signInWindow = nil;
    self.signInWebView = nil;
  }
}

@end
