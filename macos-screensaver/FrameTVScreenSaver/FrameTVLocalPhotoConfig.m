//
//  FrameTVLocalPhotoConfig.m
//  FrameTVScreenSaver
//

#import "FrameTVLocalPhotoConfig.h"
#import <ScreenSaver/ScreenSaver.h>

static NSString *const kScreenSaverModuleName = @"FrameTVScreenSaver";
static NSString *const kFolderPathDefaultsKey = @"FrameTVLocalPhotoFolderPath";
static NSString *const kSourceKindDefaultsKey = @"FrameTVLocalPhotoSourceKind";

@implementation FrameTVLocalPhotoConfig

+ (NSUserDefaults *)rawDefaults {
  return [ScreenSaverDefaults defaultsForModuleWithName:kScreenSaverModuleName];
}

+ (NSString *)folderPath {
  NSString *override = [self.rawDefaults stringForKey:kFolderPathDefaultsKey];
  if (override.length > 0) return override;
  return [NSHomeDirectory() stringByAppendingPathComponent:@"Documents/Screenshots"];
}

+ (void)setFolderPath:(NSString *)folderPath {
  [self.rawDefaults setObject:folderPath forKey:kFolderPathDefaultsKey];
  [self.rawDefaults synchronize];
}

+ (FrameTVLocalPhotoSourceKind)sourceKind {
  NSString *raw = [self.rawDefaults stringForKey:kSourceKindDefaultsKey];
  if ([raw isEqualToString:@"photokit"]) return FrameTVLocalPhotoSourceKindPhotoKit;
  return FrameTVLocalPhotoSourceKindFolder;
}

@end
