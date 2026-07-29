//
//  FrameTVConfigController.m
//  FrameTVScreenSaver
//

#import "FrameTVConfigController.h"
#import "WVSSAddress.h"
#import "WVSSLog.h"
#import "FrameTVLocalPhotoConfig.h"
#import <WebKit/WebKit.h>
#import <ScreenSaver/ScreenSaver.h>

static NSString *const kFrameTVBaseURL = @"https://frametv.vercel.app";
static NSString *const kFrameTVAuthorizePath = @"/screensaver/authorize";
static NSString *const kFrameTVURLScheme = @"frametvscreensaver";
static NSString *const kScreenSaverModuleName = @"FrameTVScreenSaver";
static NSString *const kRigBundleIdentifier = @"com.frametv.FrameTVScreenSaverRig";
static NSString *const kDeviceTokenDefaultsKey = @"FrameTVDeviceToken";
static NSString *const kOriginDefaultsKey = @"FrameTVOrigin";

// Mirrors the category grouping/order/labels in src/lib/modeMetadata.ts
// (MODE_CATEGORIES) and the id->category mapping in MODE_METADATA there —
// there's no native access to that TS module, so this is a hand-kept copy
// used purely to group the mode grid below into the same sections the web
// admin's ModePickerSheet shows. Keep the two in sync when modes are added.
static NSArray<NSString *> *kModeCategoryOrder;
static NSDictionary<NSString *, NSString *> *kModeCategoryLabels;
static NSDictionary<NSString *, NSString *> *kModeCategoryIcons;
static NSDictionary<NSString *, NSString *> *kModeIdToCategory;

@interface FrameTVConfigController () <WKNavigationDelegate>

@property(nonatomic, strong) WVSSConfig *config;

@property(nonatomic, strong) NSWindow *sheetWindow;
@property(nonatomic, strong) NSTextField *statusLabel;
@property(nonatomic, strong) NSButton *primaryButton;
@property(nonatomic, strong) NSScrollView *modeScrollView;
@property(nonatomic, strong) NSTextField *modeSectionLabel;
@property(nonatomic, strong) NSArray<NSDictionary *> *modes;
@property(nonatomic, copy) NSString *activeModeId;
@property(nonatomic, copy) NSArray<NSString *> *activeAlbumIds;

@property(nonatomic, strong) NSTextField *localSectionLabel;
@property(nonatomic, strong) NSButton *localPhotosToggle;
@property(nonatomic, strong) NSButton *chooseFolderButton;
@property(nonatomic, strong) NSTextField *folderPathLabel;

@property(nonatomic, strong) NSWindow *signInWindow;
@property(nonatomic, strong) WKWebView *signInWebView;

@end

@implementation FrameTVConfigController

+ (void)initialize {
  if (self != [FrameTVConfigController class]) return;

  kModeCategoryOrder = @[ @"photos", @"music", @"ambient", @"productivity" ];
  kModeCategoryLabels = @{
    @"photos" : @"Photos",
    @"music" : @"Music",
    @"ambient" : @"Ambient",
    @"productivity" : @"Boards",
  };
  kModeCategoryIcons = @{
    @"photos" : @"🖼️",
    @"music" : @"🎵",
    @"ambient" : @"🌙",
    @"productivity" : @"🗂️",
  };
  kModeIdToCategory = @{
    @"slideshow-single" : @"photos",
    @"slideshow-grid" : @"photos",
    @"pinterest" : @"photos",
    @"scrapbook" : @"photos",
    @"coverflow" : @"music",
    @"vinyl" : @"music",
    @"clock-text" : @"ambient",
    @"unsplash-mood" : @"ambient",
    @"scripture" : @"ambient",
    @"flipboard" : @"productivity",
    @"easel" : @"productivity",
    @"eisenhower" : @"productivity",
  };
}

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
  NSRect frame = NSMakeRect(0, 0, 440, 710);
  NSWindow *window = [[NSWindow alloc] initWithContentRect:frame
                                                  styleMask:NSWindowStyleMaskTitled
                                                    backing:NSBackingStoreBuffered
                                                      defer:NO];
  window.title = @"FrameTV Screensaver";
  window.delegate = self;
  self.sheetWindow = window;

  NSView *content = window.contentView;

  NSTextField *icon = [self labelWithFrame:NSMakeRect(188, 626, 64, 64)];
  icon.font = [NSFont systemFontOfSize:44];
  icon.alignment = NSTextAlignmentCenter;
  icon.stringValue = @"📺";
  [content addSubview:icon];

  NSTextField *title = [self labelWithFrame:NSMakeRect(20, 588, 400, 28)];
  title.font = [NSFont boldSystemFontOfSize:18];
  title.alignment = NSTextAlignmentCenter;
  title.stringValue = @"Welcome to FrameTV";
  [content addSubview:title];

  NSTextField *status = [self labelWithFrame:NSMakeRect(30, 482, 380, 96)];
  status.font = [NSFont systemFontOfSize:12.5];
  status.textColor = [NSColor secondaryLabelColor];
  status.alignment = NSTextAlignmentCenter;
  status.lineBreakMode = NSLineBreakByWordWrapping;
  status.maximumNumberOfLines = 0;
  status.stringValue = self.statusText;
  self.statusLabel = status;
  [content addSubview:status];

  // "Manage further" row — always visible, connected or not, since signing
  // in only wires up the display link; albums/other data management lives
  // on the web app.
  NSTextField *manageDesc = [self labelWithFrame:NSMakeRect(30, 458, 380, 16)];
  manageDesc.font = [NSFont systemFontOfSize:11];
  manageDesc.textColor = [NSColor tertiaryLabelColor];
  manageDesc.alignment = NSTextAlignmentCenter;
  manageDesc.stringValue = @"Manage albums, links & data on the web:";
  [content addSubview:manageDesc];

  NSButton *manageLink = [NSButton buttonWithTitle:@"frametv.vercel.app ↗"
                                             target:self
                                             action:@selector(openManageLinkPressed:)];
  manageLink.frame = NSMakeRect(90, 434, 180, 22);
  manageLink.bezelStyle = NSBezelStyleInline;
  [content addSubview:manageLink];

  NSButton *manageCopy = [NSButton buttonWithTitle:@"Copy Link"
                                             target:self
                                             action:@selector(copyManageLinkPressed:)];
  manageCopy.frame = NSMakeRect(278, 434, 90, 22);
  manageCopy.bezelStyle = NSBezelStyleInline;
  [content addSubview:manageCopy];

  // Mode grid — populated/shown only once connected with a device token
  // (see rebuildModeGrid). Sectioned the same way the web admin's mode
  // picker is (Photos/Music/Ambient/Boards).
  NSTextField *modeSectionLabel = [self labelWithFrame:NSMakeRect(30, 404, 380, 18)];
  modeSectionLabel.font = [NSFont boldSystemFontOfSize:12];
  modeSectionLabel.alignment = NSTextAlignmentLeft;
  modeSectionLabel.stringValue = @"Screensaver mode";
  self.modeSectionLabel = modeSectionLabel;
  [content addSubview:modeSectionLabel];

  NSScrollView *modeScrollView = [[NSScrollView alloc] initWithFrame:NSMakeRect(20, 230, 400, 168)];
  modeScrollView.hasVerticalScroller = YES;
  modeScrollView.drawsBackground = NO;
  modeScrollView.borderType = NSBezelBorder;
  modeScrollView.documentView = [[NSView alloc] initWithFrame:NSMakeRect(0, 0, 380, 168)];
  self.modeScrollView = modeScrollView;
  [content addSubview:modeScrollView];

  // "This Mac" section — lets the screensaver pull photos straight from a
  // local folder via the frametv-local:// scheme handler, no upload. Sits
  // in the gap between the mode grid and the Sign In button.
  NSTextField *localSectionLabel = [self labelWithFrame:NSMakeRect(30, 204, 380, 18)];
  localSectionLabel.font = [NSFont boldSystemFontOfSize:12];
  localSectionLabel.alignment = NSTextAlignmentLeft;
  localSectionLabel.stringValue = @"🖥  This Mac";
  self.localSectionLabel = localSectionLabel;
  [content addSubview:localSectionLabel];

  NSButton *localPhotosToggle = [NSButton buttonWithTitle:@"Use My Mac's Photos"
                                                     target:self
                                                     action:@selector(localPhotosTogglePressed:)];
  localPhotosToggle.frame = NSMakeRect(30, 176, 200, 22);
  localPhotosToggle.bezelStyle = NSBezelStyleRounded;
  self.localPhotosToggle = localPhotosToggle;
  [content addSubview:localPhotosToggle];

  NSButton *chooseFolderButton = [NSButton buttonWithTitle:@"Choose Folder…"
                                                      target:self
                                                      action:@selector(chooseFolderPressed:)];
  chooseFolderButton.frame = NSMakeRect(298, 150, 112, 22);
  chooseFolderButton.bezelStyle = NSBezelStyleInline;
  self.chooseFolderButton = chooseFolderButton;
  [content addSubview:chooseFolderButton];

  NSTextField *folderPathLabel = [self labelWithFrame:NSMakeRect(30, 152, 260, 16)];
  folderPathLabel.font = [NSFont systemFontOfSize:11];
  folderPathLabel.textColor = [NSColor tertiaryLabelColor];
  folderPathLabel.lineBreakMode = NSLineBreakByTruncatingMiddle;
  self.folderPathLabel = folderPathLabel;
  [content addSubview:folderPathLabel];

  NSButton *primary = [NSButton buttonWithTitle:self.isConnected ? @"Sign In as a Different Account" : @"Sign In"
                                          target:self
                                          action:@selector(primaryButtonPressed:)];
  primary.frame = NSMakeRect(120, 96, 200, 32);
  primary.bezelStyle = NSBezelStyleRounded;
  primary.keyEquivalent = @"\r";
  self.primaryButton = primary;
  [content addSubview:primary];

  if (self.isRunningAsStandaloneApp) {
    NSButton *uninstall = [NSButton buttonWithTitle:@"Uninstall Everything…"
                                              target:self
                                              action:@selector(uninstallPressed:)];
    uninstall.frame = NSMakeRect(120, 60, 200, 22);
    uninstall.bezelStyle = NSBezelStyleInline;
    uninstall.contentTintColor = [NSColor systemRedColor];
    [content addSubview:uninstall];
  }

  if (self.isConnected) {
    NSButton *disconnect = [NSButton buttonWithTitle:@"Disconnect"
                                               target:self
                                               action:@selector(disconnectPressed:)];
    disconnect.frame = NSMakeRect(20, 16, 90, 28);
    disconnect.bezelStyle = NSBezelStyleRounded;
    [content addSubview:disconnect];
  }

  NSButton *done = [NSButton buttonWithTitle:@"Done" target:self action:@selector(donePressed:)];
  done.frame = NSMakeRect(330, 16, 90, 28);
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
  self.modeSectionLabel.hidden = !show;
  self.modeScrollView.hidden = !show;
  if (!show) {
    self.modes = nil;
    [self rebuildModeGrid];
  }
}

#pragma mark - This Mac (local photos)

- (void)rebuildLocalPhotosSection {
  BOOL show = self.hasModeAccess;
  self.localSectionLabel.hidden = !show;
  self.localPhotosToggle.hidden = !show;
  self.chooseFolderButton.hidden = !show;
  self.folderPathLabel.hidden = !show;
  if (!show) return;

  BOOL isOn = [self.activeAlbumIds isEqualToArray:@[ @"local" ]];
  [self.localPhotosToggle setTitle:isOn ? @"✓ Using My Mac's Photos" : @"Use My Mac's Photos"];
  [self styleModeButton:self.localPhotosToggle selected:isOn];
  [self updateFolderPathLabel];
}

- (void)updateFolderPathLabel {
  NSString *path = FrameTVLocalPhotoConfig.folderPath;
  NSString *home = NSHomeDirectory();
  if ([path hasPrefix:home]) {
    path = [@"~" stringByAppendingString:[path substringFromIndex:home.length]];
  }
  self.folderPathLabel.stringValue = [NSString stringWithFormat:@"Folder: %@", path];
}

- (void)chooseFolderPressed:(id)sender {
  NSOpenPanel *panel = [NSOpenPanel openPanel];
  panel.canChooseDirectories = YES;
  panel.canChooseFiles = NO;
  panel.allowsMultipleSelection = NO;
  panel.prompt = @"Choose";
  panel.message = @"Pick a folder of photos for this screensaver to show — nothing in it is ever uploaded.";

  NSString *current = FrameTVLocalPhotoConfig.folderPath;
  if (current.length) panel.directoryURL = [NSURL fileURLWithPath:current isDirectory:YES];

  [panel beginSheetModalForWindow:self.sheetWindow completionHandler:^(NSModalResponse result) {
    if (result != NSModalResponseOK || panel.URL == nil) return;
    [FrameTVLocalPhotoConfig setFolderPath:panel.URL.path];
    [self updateFolderPathLabel];
  }];
}

- (void)localPhotosTogglePressed:(id)sender {
  if (!self.hasModeAccess) return;

  NSArray<NSString *> *previousAlbumIds = self.activeAlbumIds;
  NSString *previousModeId = self.activeModeId;

  BOOL turningOn = ![self.activeAlbumIds isEqualToArray:@[ @"local" ]];
  self.activeAlbumIds = turningOn ? @[ @"local" ] : @[];
  [self.localPhotosToggle setTitle:turningOn ? @"✓ Using My Mac's Photos" : @"Use My Mac's Photos"];
  [self styleModeButton:self.localPhotosToggle selected:turningOn];

  // Keep whatever photo mode is already active (defaulting to the Pinterest
  // grid if nothing's selected yet) — the toggle only changes where that
  // mode's photos come from, not which mode is showing.
  NSString *modeId = self.activeModeId.length ? self.activeModeId : @"pinterest";
  self.activeModeId = modeId;
  [self rebuildModeGrid];

  [self patchScreensaverMode:@{
    @"mode_id" : modeId,
    @"active_album_ids" : self.activeAlbumIds,
  } onFailureRevert:^{
    self.activeAlbumIds = previousAlbumIds;
    self.activeModeId = previousModeId;
    [self rebuildModeGrid];
    [self rebuildLocalPhotosSection];
  }];
}

#pragma mark - Manage-further link

- (NSURL *)manageURL {
  return [NSURL URLWithString:kFrameTVBaseURL];
}

- (void)openManageLinkPressed:(id)sender {
  [[NSWorkspace sharedWorkspace] openURL:self.manageURL];
}

- (void)copyManageLinkPressed:(id)sender {
  NSPasteboard *pasteboard = NSPasteboard.generalPasteboard;
  [pasteboard clearContents];
  [pasteboard setString:kFrameTVBaseURL forType:NSPasteboardTypeString];
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
  [self rebuildModeGrid];
  [self fetchActiveMode];
}

// Builds a scrolling grid of mode buttons grouped into the same
// Photos/Music/Ambient/Boards sections the web admin's ModePickerSheet
// uses (see kModeCategoryOrder/kModeIdToCategory above), replacing what
// used to be a flat NSPopUpButton dropdown.
- (void)rebuildModeGrid {
  NSView *container = self.modeScrollView.documentView;
  [container.subviews makeObjectsPerformSelector:@selector(removeFromSuperview)];

  CGFloat containerWidth = self.modeScrollView.contentSize.width;
  const CGFloat kPadding = 8;
  const CGFloat kHeaderHeight = 18;
  const CGFloat kButtonHeight = 34;
  const CGFloat kButtonSpacing = 6;
  const CGFloat kSectionGap = 12;
  const NSInteger kColumns = 3;
  CGFloat columnWidth = (containerWidth - kPadding * 2 - kButtonSpacing * (kColumns - 1)) / kColumns;

  // Two passes: first compute each visible section's height so the total
  // container height (and thus scroll range) is known up front, then place
  // views top-down using a descending cursor — much simpler than trying to
  // convert a top-down layout into NSView's bottom-up frame coordinates
  // on the fly.
  NSArray<NSString *> *visibleCategories = [kModeCategoryOrder filteredArrayUsingPredicate:
      [NSPredicate predicateWithBlock:^BOOL(NSString *categoryId, NSDictionary *bindings) {
        return [self modesInCategory:categoryId].count > 0;
      }]];

  CGFloat totalHeight = kPadding;
  for (NSString *categoryId in visibleCategories) {
    NSInteger modeCount = [self modesInCategory:categoryId].count;
    NSInteger rowCount = (modeCount + kColumns - 1) / kColumns;
    totalHeight += kHeaderHeight + rowCount * kButtonHeight + (rowCount - 1) * kButtonSpacing + kSectionGap;
  }
  totalHeight = MAX(totalHeight, self.modeScrollView.contentSize.height);
  container.frame = NSMakeRect(0, 0, containerWidth, totalHeight);

  CGFloat topCursor = totalHeight - kPadding; // distance from the container's top edge
  for (NSString *categoryId in visibleCategories) {
    NSArray<NSDictionary *> *categoryModes = [self modesInCategory:categoryId];
    NSInteger rowCount = (categoryModes.count + kColumns - 1) / kColumns;

    NSTextField *header = [self labelWithFrame:NSMakeRect(kPadding, topCursor - kHeaderHeight, containerWidth - kPadding * 2, kHeaderHeight)];
    header.font = [NSFont boldSystemFontOfSize:10.5];
    header.textColor = [NSColor secondaryLabelColor];
    header.stringValue = [NSString stringWithFormat:@"%@  %@", kModeCategoryIcons[categoryId], kModeCategoryLabels[categoryId]];
    [container addSubview:header];
    topCursor -= kHeaderHeight + kButtonSpacing;

    for (NSInteger i = 0; i < categoryModes.count; i++) {
      NSDictionary *mode = categoryModes[i];
      NSInteger row = i / kColumns;
      NSInteger col = i % kColumns;
      CGFloat x = kPadding + col * (columnWidth + kButtonSpacing);
      CGFloat rowTop = topCursor - row * (kButtonHeight + kButtonSpacing);
      CGFloat frameY = rowTop - kButtonHeight;

      NSButton *button = [NSButton buttonWithTitle:(mode[@"name"] ?: mode[@"id"]) target:self action:@selector(modeButtonPressed:)];
      button.tag = [self.modes indexOfObject:mode];
      button.bezelStyle = NSBezelStyleRounded;
      button.lineBreakMode = NSLineBreakByTruncatingTail;
      [self styleModeButton:button selected:[mode[@"id"] isEqual:self.activeModeId]];
      button.frame = NSMakeRect(x, frameY, columnWidth, kButtonHeight);
      [container addSubview:button];
    }

    topCursor -= rowCount * kButtonHeight + (rowCount - 1) * kButtonSpacing + kSectionGap;
  }
}

- (NSArray<NSDictionary *> *)modesInCategory:(NSString *)categoryId {
  return [self.modes filteredArrayUsingPredicate:[NSPredicate predicateWithBlock:^BOOL(NSDictionary *mode, NSDictionary *bindings) {
    return [kModeIdToCategory[mode[@"id"]] isEqualToString:categoryId];
  }]];
}

- (void)styleModeButton:(NSButton *)button selected:(BOOL)selected {
  button.contentTintColor = selected ? [NSColor controlAccentColor] : nil;
  button.font = selected ? [NSFont boldSystemFontOfSize:11] : [NSFont systemFontOfSize:11];
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
    NSArray *activeAlbumIds = json[@"state"][@"active_album_ids"];
    if (!activeModeId) return;

    dispatch_async(dispatch_get_main_queue(), ^{
      self.activeModeId = activeModeId;
      self.activeAlbumIds = [activeAlbumIds isKindOfClass:[NSArray class]] ? activeAlbumIds : @[];
      [self rebuildModeGrid];
      [self rebuildLocalPhotosSection];
    });
  }];
  [task resume];
}

- (void)modeButtonPressed:(NSButton *)sender {
  if (sender.tag < 0 || sender.tag >= (NSInteger)self.modes.count) return;
  NSString *modeId = self.modes[sender.tag][@"id"];
  if (!modeId.length || !self.hasModeAccess) return;

  NSString *previousModeId = self.activeModeId;
  self.activeModeId = modeId;
  [self rebuildModeGrid];

  [self patchScreensaverMode:@{ @"mode_id" : modeId } onFailureRevert:^{
    self.activeModeId = previousModeId;
    [self rebuildModeGrid];
  }];
}

// Every write to display_state via the screensaver's scoped token goes
// through here — both the mode grid and the local-photos toggle update the
// UI optimistically, so a failed request needs to revert that state and
// tell the user, or the panel silently lies about what's actually live.
- (void)patchScreensaverMode:(NSDictionary *)body onFailureRevert:(void (^)(void))revertBlock {
  NSMutableURLRequest *request = [self authedRequestForPath:@"/api/screensaver/mode"];
  request.HTTPMethod = @"PATCH";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
  request.HTTPBody = [NSJSONSerialization dataWithJSONObject:body options:0 error:nil];

  NSURLSessionDataTask *task = [[NSURLSession sharedSession]
      dataTaskWithRequest:request
        completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    NSInteger statusCode = [response isKindOfClass:[NSHTTPURLResponse class]]
        ? ((NSHTTPURLResponse *)response).statusCode : 0;
    BOOL ok = !error && statusCode >= 200 && statusCode < 300;
    if (ok) return;

    NSString *bodyString = data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : nil;
    WVSSLog(@"PATCH /api/screensaver/mode failed (status %ld): %@ body=%@",
            (long)statusCode, error, bodyString);

    dispatch_async(dispatch_get_main_queue(), ^{
      revertBlock();
      NSAlert *alert = [[NSAlert alloc] init];
      alert.alertStyle = NSAlertStyleWarning;
      alert.messageText = @"Couldn't update the display";
      alert.informativeText = error
          ? [NSString stringWithFormat:@"Network error: %@", error.localizedDescription]
          : [NSString stringWithFormat:@"Server rejected the request (status %ld). Try signing in again.",
                                        (long)statusCode];
      [alert runModal];
    });
  }];
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
  [self rebuildLocalPhotosSection];
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
  [self rebuildLocalPhotosSection];
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
