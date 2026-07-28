//
//  FrameTVConfigController.h
//  FrameTVScreenSaver
//
//  Native, FrameTV-branded replacement for the upstream WVSSConfigController
//  "Fetch URLs Remotely / Addresses table" panel. Shows a welcome screen with
//  a "Sign In" button that opens an embedded WKWebView pointed at
//  /screensaver/authorize (the same page the browser-based connect flow
//  uses); on completion it configures the single FrameTV address directly,
//  no manual URL pasting.
//

#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#import "WVSSConfig.h"

@protocol FrameTVConfigControllerDelegate;

@interface FrameTVConfigController : NSObject <NSWindowDelegate>

@property(nonatomic, weak) id<FrameTVConfigControllerDelegate> delegate;
@property(nonatomic, strong, readonly) NSWindow *sheet;

- (instancetype)initWithConfig:(WVSSConfig *)config;

// True if `config` has a real FrameTV address configured — as opposed to
// empty/just the WVSSConfig-provided "about:blank" placeholder. Shared with
// AppDelegate so it only auto-opens this panel on first run, not every
// launch once already connected.
+ (BOOL)isConfigConnected:(WVSSConfig *)config;

@end

@protocol FrameTVConfigControllerDelegate <NSObject>

- (void)configController:(FrameTVConfigController *)configController
      dismissConfigSheet:(NSWindow *)sheet;

@end
