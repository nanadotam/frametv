//
//  FrameTVLocalFolderPhotoSource.h
//  FrameTVScreenSaver
//
//  v1 FrameTVLocalPhotoSource backed by a plain folder of image files.
//

#import <Foundation/Foundation.h>
#import "FrameTVLocalPhotoSource.h"

NS_ASSUME_NONNULL_BEGIN

@interface FrameTVLocalFolderPhotoSource : NSObject <FrameTVLocalPhotoSource>

- (instancetype)initWithFolderPath:(NSString *)folderPath;

@end

NS_ASSUME_NONNULL_END
