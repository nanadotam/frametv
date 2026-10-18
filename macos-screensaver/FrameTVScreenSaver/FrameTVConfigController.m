//
//  FrameTVConfigController.m
//  FrameTVScreenSaver
//

#import "FrameTVConfigController.h"
#import "WVSSAddress.h"
#import <WebKit/WebKit.h>
#import <ScreenSaver/ScreenSaver.h>
#import "MantelIcon.h"

static NSString *const kFrameTVBaseURL = @"https://mantelapp.vercel.app";
static NSString *const kFrameTVAuthorizePath = @"/screensaver/authorize";
static NSString *const kFrameTVURLScheme = @"frametvscreensaver";
static NSString *const kScreenSaverModuleName = @"FrameTVScreenSaver";
static NSString *const kRigBundleIdentifier = @"com.frametv.FrameTVScreenSaverRig";
static NSString *const kDeviceTokenDefaultsKey = @"FrameTVDeviceToken";
static NSString *const kOriginDefaultsKey = @"FrameTVOrigin";
static NSString *const kDesktopAppBundleIdentifier = @"app.mantel.desktop";

// Friendly names + SF Symbols for each look, matching the Mantel app.
static NSDictionary<NSString *, NSArray<NSString *> *> *MantelLooks(void) {
  return @{
    @"slideshow-single" : @[ @"Slideshow", @"photo" ],
    @"slideshow-grid" : @[ @"Gallery Wall", @"square.grid.3x2" ],
    @"pinterest" : @[ @"Pinboard", @"rectangle.split.3x1" ],
    @"scrapbook" : @[ @"Scrapbook", @"pin" ],
    @"video" : @[ @"Video Loops", @"film" ],
    @"clock-text" : @[ @"Clock", @"clock" ],
    @"unsplash-mood" : @[ @"Mood", @"mountain.2" ],
    @"scripture" : @[ @"Verse", @"book" ],
    @"vinyl" : @[ @"Vinyl", @"opticaldisc" ],
    @"coverflow" : @[ @"Cover Flow", @"square.stack" ],
    @"flipboard" : @[ @"Flip Board", @"textformat.abc" ],
    @"easel" : @[ @"Easel", @"pencil.line" ],
    @"eisenhower" : @[ @"Priorities", @"checklist" ],
  };
}

static NSArray<NSString *> *MantelLookOrder(void) {
  return @[ @"slideshow-single", @"slideshow-grid", @"pinterest", @"scrapbook", @"video", @"clock-text",
            @"unsplash-mood", @"scripture", @"vinyl", @"coverflow", @"flipboard", @"easel", @"eisenhower" ];
}

@interface FrameTVConfigController () <WKNavigationDelegate>

@property(nonatomic, strong) WVSSConfig *config;

@property(nonatomic, strong) NSWindow *sheetWindow;
@property(nonatomic, strong) NSArray<NSDictionary *> *modes;
@property(nonatomic, copy) NSString *activeModeId;
@property(nonatomic, strong) NSMutableArray<NSButton *> *lookButtons;
@property(nonatomic, strong) NSView *lookGrid;
@property(nonatomic, strong) NSTextField *codeField;
@property(nonatomic, strong) NSButton *codeButton;
@property(nonatomic, strong) NSTextField *codeError;
@property(nonatomic, strong) NSTimer *pollTimer;

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

#pragma mark - Main sheet UI
//
// Two states, rebuilt in place:
//  • Not connected — "Open the Mantel app" (which connects this screensaver
//    for you; this panel notices by itself), or paste a connect code. Email
//    sign-in stays as a last resort.
//  • Connected — pick what the screensaver shows, plus a jump into the app
//    for everything else.

static const CGFloat kW = 520;
static const CGFloat kH = 600;

- (void)buildSheetWindow {
  NSWindow *window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0, 0, kW, kH)
                                                  styleMask:NSWindowStyleMaskTitled
                                                    backing:NSBackingStoreBuffered
                                                      defer:NO];
  window.title = @"Mantel";
  window.delegate = self;
  self.sheetWindow = window;
  [self rebuild];
}

- (void)rebuild {
  NSView *content = self.sheetWindow.contentView;
  for (NSView *v in [content.subviews copy]) [v removeFromSuperview];
  [self.pollTimer invalidate];
  self.pollTimer = nil;
  self.lookButtons = [NSMutableArray array];

  // Icon + title
  NSData *iconData = [[NSData alloc] initWithBase64EncodedString:kMantelIconPNGBase64 options:0];
  NSImageView *icon = [NSImageView imageViewWithImage:[[NSImage alloc] initWithData:iconData]];
  icon.frame = NSMakeRect((kW - 72) / 2, kH - 100, 72, 72);
  icon.imageScaling = NSImageScaleProportionallyUpOrDown;
  [content addSubview:icon];

  if (self.isConnected) {
    [self buildConnectedIn:content];
  } else {
    [self buildConnectIn:content];
  }

  NSButton *done = [NSButton buttonWithTitle:@"Done" target:self action:@selector(donePressed:)];
  done.frame = NSMakeRect(kW - 110, 18, 90, 30);
  done.bezelStyle = NSBezelStyleRounded;
  done.keyEquivalent = @"\r";
  [content addSubview:done];
}

- (NSTextField *)text:(NSString *)string frame:(NSRect)frame size:(CGFloat)size weight:(NSFontWeight)weight {
  NSTextField *label = [self labelWithFrame:frame];
  label.stringValue = string;
  label.font = [NSFont systemFontOfSize:size weight:weight];
  label.alignment = NSTextAlignmentCenter;
  label.lineBreakMode = NSLineBreakByWordWrapping;
  label.maximumNumberOfLines = 0;
  return label;
}

- (void)buildConnectedIn:(NSView *)content {
  [content addSubview:[self text:@"Mantel" frame:NSMakeRect(20, kH - 136, kW - 40, 28) size:22 weight:NSFontWeightBold]];
  NSTextField *status = [self text:@"● Connected. Your screensaver shows your Mantel photos."
                             frame:NSMakeRect(20, kH - 160, kW - 40, 18) size:12.5 weight:NSFontWeightMedium];
  status.textColor = [NSColor systemGreenColor];
  [content addSubview:status];

  NSTextField *heading = [self text:@"What should it show?" frame:NSMakeRect(24, kH - 200, kW - 48, 20) size:14 weight:NSFontWeightSemibold];
  heading.alignment = NSTextAlignmentLeft;
  [content addSubview:heading];

  NSView *grid = [[NSView alloc] initWithFrame:NSMakeRect(20, 118, kW - 40, kH - 330)];
  self.lookGrid = grid;
  [content addSubview:grid];
  [self layoutLooks];

  NSButton *more = [NSButton buttonWithTitle:@"More options in the Mantel app…" target:self action:@selector(openAppLooks:)];
  more.frame = NSMakeRect((kW - 300) / 2, 70, 300, 32);
  more.bezelStyle = NSBezelStyleRounded;
  [content addSubview:more];

  NSButton *disconnect = [NSButton buttonWithTitle:@"Disconnect" target:self action:@selector(disconnectPressed:)];
  disconnect.frame = NSMakeRect(20, 18, 110, 30);
  disconnect.bezelStyle = NSBezelStyleRounded;
  [content addSubview:disconnect];

  if (self.hasModeAccess) [self fetchModes];
}

- (void)layoutLooks {
  for (NSView *v in [self.lookGrid.subviews copy]) [v removeFromSuperview];
  [self.lookButtons removeAllObjects];

  // Looks the user has enabled (or every look until the list has loaded).
  NSMutableArray<NSString *> *ids = [NSMutableArray array];
  NSSet *enabled = self.modes ? [NSSet setWithArray:[self.modes valueForKey:@"id"]] : nil;
  for (NSString *lookId in MantelLookOrder()) {
    if (!enabled || [enabled containsObject:lookId]) [ids addObject:lookId];
  }

  const NSInteger cols = 4;
  const CGFloat gap = 8;
  const CGFloat w = (self.lookGrid.bounds.size.width - gap * (cols - 1)) / cols;
  const CGFloat h = 62;
  CGFloat top = self.lookGrid.bounds.size.height;
  for (NSUInteger i = 0; i < ids.count; i++) {
    NSString *lookId = ids[i];
    NSArray *meta = MantelLooks()[lookId];
    NSButton *b = [NSButton buttonWithTitle:meta[0] target:self action:@selector(lookPressed:)];
    b.identifier = lookId;
    [b setButtonType:NSButtonTypePushOnPushOff];
    b.bezelStyle = NSBezelStyleFlexiblePush;
    b.image = [NSImage imageWithSystemSymbolName:meta[1] accessibilityDescription:meta[0]];
    b.imagePosition = NSImageAbove;
    b.font = [NSFont systemFontOfSize:11.5 weight:NSFontWeightMedium];
    NSInteger row = i / cols, col = i % cols;
    b.frame = NSMakeRect(col * (w + gap), top - (row + 1) * h - row * gap, w, h);
    [self.lookGrid addSubview:b];
    [self.lookButtons addObject:b];
  }
  [self highlightActiveLook];
}

- (void)highlightActiveLook {
  for (NSButton *b in self.lookButtons) {
    BOOL on = [b.identifier isEqualToString:self.activeModeId];
    b.state = on ? NSControlStateValueOn : NSControlStateValueOff;
    b.bezelColor = on ? [NSColor systemOrangeColor] : nil;
    b.contentTintColor = on ? [NSColor whiteColor] : nil;
  }
}

- (void)buildConnectIn:(NSView *)content {
  [content addSubview:[self text:@"Connect Mantel" frame:NSMakeRect(20, kH - 136, kW - 40, 28) size:22 weight:NSFontWeightBold]];
  NSTextField *lead = [self text:@"Open the Mantel app and click Connect. This window updates by itself, with nothing to type."
                           frame:NSMakeRect(50, kH - 196, kW - 100, 52) size:13.5 weight:NSFontWeightRegular];
  lead.textColor = [NSColor secondaryLabelColor];
  [content addSubview:lead];

  BOOL appInstalled = [[NSWorkspace sharedWorkspace] URLForApplicationWithBundleIdentifier:kDesktopAppBundleIdentifier] != nil;
  NSButton *open = [NSButton buttonWithTitle:appInstalled ? @"Open the Mantel App" : @"Get the Mantel App"
                                       target:self
                                       action:@selector(openAppSetup:)];
  open.frame = NSMakeRect((kW - 260) / 2, kH - 252, 260, 40);
  open.bezelStyle = NSBezelStyleFlexiblePush;
  open.bezelColor = [NSColor systemOrangeColor];
  open.font = [NSFont systemFontOfSize:15 weight:NSFontWeightSemibold];
  [content addSubview:open];

  NSTextField *or = [self text:@"or paste the connect code shown in the app"
                         frame:NSMakeRect(20, kH - 300, kW - 40, 18) size:12 weight:NSFontWeightRegular];
  or.textColor = [NSColor tertiaryLabelColor];
  [content addSubview:or];

  NSTextField *field = [[NSTextField alloc] initWithFrame:NSMakeRect((kW - 300) / 2, kH - 348, 190, 34)];
  field.placeholderString = @"ABCD-EFGH";
  field.font = [NSFont monospacedSystemFontOfSize:18 weight:NSFontWeightSemibold];
  field.alignment = NSTextAlignmentCenter;
  field.bezelStyle = NSTextFieldRoundedBezel;
  field.target = self;
  field.action = @selector(redeemPressed:);
  self.codeField = field;
  [content addSubview:field];

  NSButton *connect = [NSButton buttonWithTitle:@"Connect" target:self action:@selector(redeemPressed:)];
  connect.frame = NSMakeRect((kW - 300) / 2 + 200, kH - 347, 100, 32);
  connect.bezelStyle = NSBezelStyleRounded;
  self.codeButton = connect;
  [content addSubview:connect];

  NSTextField *err = [self text:@"" frame:NSMakeRect(20, kH - 380, kW - 40, 18) size:12 weight:NSFontWeightMedium];
  err.textColor = [NSColor systemRedColor];
  self.codeError = err;
  [content addSubview:err];

  NSButton *email = [NSButton buttonWithTitle:@"Sign in with email instead" target:self action:@selector(primaryButtonPressed:)];
  email.frame = NSMakeRect((kW - 220) / 2, 70, 220, 24);
  email.bezelStyle = NSBezelStyleInline;
  [content addSubview:email];

  // The app writes our settings from outside; notice it and switch views.
  self.pollTimer = [NSTimer scheduledTimerWithTimeInterval:2 target:self selector:@selector(pollForConnection:) userInfo:nil repeats:YES];
}

- (void)pollForConnection:(NSTimer *)timer {
  NSUserDefaults *defaults = self.rawDefaults;
  [defaults synchronize];
  WVSSConfig *fresh = [[WVSSConfig alloc] initWithUserDefaults:defaults];
  if ([FrameTVConfigController isConfigConnected:fresh]) {
    [self.config.addresses removeAllObjects];
    [self.config.addresses addObjectsFromArray:fresh.addresses];
    self.config.shouldFetchAddressList = NO;
    [self rebuild];
  }
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
  [self rebuild];
}

- (void)rebuildModeSection {
  [self rebuild];
}

#pragma mark - Opening the Mantel app

- (void)openURLString:(NSString *)string {
  [[NSWorkspace sharedWorkspace] openURL:[NSURL URLWithString:string]];
}

- (void)openAppSetup:(id)sender {
  BOOL appInstalled = [[NSWorkspace sharedWorkspace] URLForApplicationWithBundleIdentifier:kDesktopAppBundleIdentifier] != nil;
  [self openURLString:appInstalled ? @"mantel://setup" : [kFrameTVBaseURL stringByAppendingString:@"/download"]];
}

- (void)openAppLooks:(id)sender {
  BOOL appInstalled = [[NSWorkspace sharedWorkspace] URLForApplicationWithBundleIdentifier:kDesktopAppBundleIdentifier] != nil;
  NSString *origin = self.connectedOrigin.length ? self.connectedOrigin : kFrameTVBaseURL;
  [self openURLString:appInstalled ? @"mantel://looks" : [origin stringByAppendingString:@"/admin/modes"]];
}

#pragma mark - Connect code

- (void)redeemPressed:(id)sender {
  NSString *code = [self.codeField.stringValue stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet];
  if (code.length < 8) {
    self.codeError.stringValue = @"Codes look like ABCD-EFGH.";
    return;
  }
  self.codeError.stringValue = @"";
  self.codeButton.enabled = NO;

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:[kFrameTVBaseURL stringByAppendingString:@"/api/screensaver/redeem"]]];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
  request.HTTPBody = [NSJSONSerialization dataWithJSONObject:@{ @"code" : code } options:0 error:nil];

  [[[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    NSDictionary *json = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
    NSInteger status = [(NSHTTPURLResponse *)response statusCode];
    dispatch_async(dispatch_get_main_queue(), ^{
      self.codeButton.enabled = YES;
      if (error || status != 200 || ![json[@"token"] isKindOfClass:NSString.class]) {
        self.codeError.stringValue = json[@"error"] ?: @"Couldn’t connect. Check your internet and try again.";
        return;
      }
      [self applyToken:json[@"token"] deviceToken:json[@"deviceToken"] origin:json[@"origin"] ?: kFrameTVBaseURL];
    });
  }] resume];
}

- (void)applyToken:(NSString *)token deviceToken:(NSString *)deviceToken origin:(NSString *)origin {
  NSString *shareUrl = [NSString stringWithFormat:@"%@/s/%@", origin, token];
  [self.config.addresses removeAllObjects];
  [self.config.addresses addObject:[WVSSAddress addressWithURL:shareUrl duration:-1]];
  self.config.shouldFetchAddressList = NO;
  [self.config synchronize];

  NSUserDefaults *defaults = self.rawDefaults;
  [defaults setObject:origin forKey:kOriginDefaultsKey];
  if (deviceToken.length) [defaults setObject:deviceToken forKey:kDeviceTokenDefaultsKey];
  [defaults synchronize];

  [self dismissSignIn];
  [self rebuild];
}

#pragma mark - Looks (screensaver-scoped bearer token)

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
  [[[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error || !data) return;
    id json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    NSArray<NSDictionary *> *modes = [json isKindOfClass:NSArray.class] ? json : json[@"modes"];
    if (![modes isKindOfClass:[NSArray class]]) return;
    NSPredicate *enabledOnly = [NSPredicate predicateWithFormat:@"is_enabled == YES"];
    NSArray<NSDictionary *> *enabledModes = [modes filteredArrayUsingPredicate:enabledOnly];
    dispatch_async(dispatch_get_main_queue(), ^{
      self.modes = enabledModes;
      [self layoutLooks];
      [self fetchActiveMode];
    });
  }] resume];
}

- (void)fetchActiveMode {
  if (!self.hasModeAccess) return;
  NSMutableURLRequest *request = [self authedRequestForPath:@"/api/display-state"];
  [[[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error || !data) return;
    NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    NSDictionary *state = json[@"state"] ?: json;
    NSString *activeModeId = state[@"active_mode_id"];
    if (![activeModeId isKindOfClass:NSString.class]) return;
    dispatch_async(dispatch_get_main_queue(), ^{
      self.activeModeId = activeModeId;
      [self highlightActiveLook];
    });
  }] resume];
}

- (void)lookPressed:(NSButton *)sender {
  NSString *modeId = sender.identifier;
  if (!modeId.length || !self.hasModeAccess) return;
  self.activeModeId = modeId;
  [self highlightActiveLook];

  NSMutableURLRequest *request = [self authedRequestForPath:@"/api/screensaver/mode"];
  request.HTTPMethod = @"PATCH";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
  request.HTTPBody = [NSJSONSerialization dataWithJSONObject:@{ @"mode_id" : modeId } options:0 error:nil];
  [[[NSURLSession sharedSession] dataTaskWithRequest:request] resume];
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
  self.activeModeId = nil;
  [self rebuild];
}

- (void)uninstallPressed:(id)sender {
  NSAlert *alert = [[NSAlert alloc] init];
  alert.alertStyle = NSAlertStyleWarning;
  alert.messageText = @"Uninstall Mantel Screensaver?";
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
    for (NSString *name in @[ @"Mantel.saver", @"FrameTVScreenSaver.saver" ]) {
      NSURL *saverURL = [[libraryURL URLByAppendingPathComponent:@"Screen Savers"] URLByAppendingPathComponent:name];
      [fm removeItemAtURL:saverURL error:nil];
    }
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
  done.informativeText = @"The Mantel screensaver has been removed and all its saved data cleared from this Mac.";
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
  [self.pollTimer invalidate];
  self.pollTimer = nil;
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
  window.title = @"Sign in to Mantel";
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

  [self applyToken:token deviceToken:deviceToken origin:origin];
}

#pragma mark - NSWindowDelegate

- (void)windowWillClose:(NSNotification *)notification {
  if (notification.object == self.signInWindow) {
    self.signInWindow = nil;
    self.signInWebView = nil;
  }
}

@end
