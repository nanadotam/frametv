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

@end

@protocol FrameTVConfigControllerDelegate <NSObject>

- (void)configController:(FrameTVConfigController *)configController
      dismissConfigSheet:(NSWindow *)sheet;

@end
