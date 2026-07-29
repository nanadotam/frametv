//
//  FrameTVLocalPhotoSchemeHandler.h
//  FrameTVScreenSaver
//
//  WKURLSchemeHandler for the frametv-local:// scheme. Hands photo bytes
//  from a FrameTVLocalPhotoSource straight to the display webview,
//  in-process — no network, no upload, nothing ever touches the backend.
//
//  Routes:
//    frametv-local://index         -> JSON manifest of available photos
//    frametv-local://photo/<id>    -> raw image bytes for that id
//

#import <Foundation/Foundation.h>
#import <WebKit/WebKit.h>
#import "FrameTVLocalPhotoSource.h"

NS_ASSUME_NONNULL_BEGIN

extern NSString *const FrameTVLocalPhotoScheme;

@interface FrameTVLocalPhotoSchemeHandler : NSObject <WKURLSchemeHandler>

- (instancetype)initWithSource:(id<FrameTVLocalPhotoSource>)source;

@end

NS_ASSUME_NONNULL_END
