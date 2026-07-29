//
//  FrameTVLocalPhotoConfig.h
//  FrameTVScreenSaver
//
//  ScreenSaverDefaults-backed config for the local-photos feature. Same
//  ScreenSaverDefaults domain FrameTVConfigController already reads/writes
//  (kScreenSaverModuleName == "FrameTVScreenSaver"), so a future Options
//  panel field just needs to write these same keys.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, FrameTVLocalPhotoSourceKind) {
  FrameTVLocalPhotoSourceKindFolder = 0,
  FrameTVLocalPhotoSourceKindPhotoKit = 1,  // v2
};

@interface FrameTVLocalPhotoConfig : NSObject

// Folder to scan for FrameTVLocalPhotoSourceKindFolder. Defaults to
// ~/Documents/Screenshots if no override has been set.
+ (NSString *)folderPath;
+ (void)setFolderPath:(NSString *)folderPath;

// Which concrete FrameTVLocalPhotoSource to instantiate. Defaults to Folder.
+ (FrameTVLocalPhotoSourceKind)sourceKind;

@end

NS_ASSUME_NONNULL_END
