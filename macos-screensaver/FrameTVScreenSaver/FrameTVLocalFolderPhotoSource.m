//
//  FrameTVLocalFolderPhotoSource.m
//  FrameTVScreenSaver
//

#import "FrameTVLocalFolderPhotoSource.h"
#import <ImageIO/ImageIO.h>
#import <CommonCrypto/CommonCrypto.h>

static NSUInteger const kIdLength = 16;

@interface FrameTVLocalFolderPhotoSource ()
@property(nonatomic, copy) NSString *folderPath;
@end

@implementation FrameTVLocalFolderPhotoSource

- (instancetype)initWithFolderPath:(NSString *)folderPath {
  self = [super init];
  if (self) {
    _folderPath = [folderPath copy];
  }
  return self;
}

// Stable, opaque id derived from the file's absolute path. Never invertible
// back to a path by the caller — the scheme handler only ever resolves ids
// through the map built here, so a crafted request can't traverse outside
// the folder.
- (NSString *)idForPath:(NSString *)absolutePath {
  const char *cstr = absolutePath.UTF8String;
  unsigned char digest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256(cstr, (CC_LONG)strlen(cstr), digest);

  NSMutableString *hex = [NSMutableString stringWithCapacity:kIdLength];
  for (NSUInteger i = 0; i < CC_SHA256_DIGEST_LENGTH && hex.length < kIdLength; i++) {
    [hex appendFormat:@"%02x", digest[i]];
  }
  return [hex substringToIndex:MIN(kIdLength, hex.length)];
}

- (BOOL)isImageFile:(NSString *)filename {
  NSString *ext = filename.pathExtension.lowercaseString;
  static NSSet<NSString *> *extensions;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    extensions = [NSSet setWithArray:@[
      @"jpg", @"jpeg", @"png", @"heic", @"heif", @"gif", @"tiff", @"tif", @"webp"
    ]];
  });
  return [extensions containsObject:ext];
}

// Rebuilds the id -> absolute path map by scanning the folder. Cheap enough
// to do on every request for a personal folder's size; not recursive.
- (NSDictionary<NSString *, NSString *> *)scanIdToPathMap {
  NSFileManager *fm = NSFileManager.defaultManager;
  NSURL *folderURL = [NSURL fileURLWithPath:self.folderPath isDirectory:YES];

  NSArray<NSURL *> *contents = [fm contentsOfDirectoryAtURL:folderURL
                                  includingPropertiesForKeys:@[ NSURLIsRegularFileKey ]
                                                     options:NSDirectoryEnumerationSkipsHiddenFiles
                                                       error:nil];
  if (!contents) return @{};

  NSMutableDictionary<NSString *, NSString *> *map = [NSMutableDictionary dictionary];
  for (NSURL *fileURL in contents) {
    NSString *filename = fileURL.lastPathComponent;
    if (![self isImageFile:filename]) continue;
    NSString *absolutePath = fileURL.path;
    map[[self idForPath:absolutePath]] = absolutePath;
  }
  return map;
}

- (NSArray<NSDictionary<NSString *, id> *> *)indexManifest {
  NSDictionary<NSString *, NSString *> *idToPath = [self scanIdToPathMap];
  NSMutableArray<NSDictionary<NSString *, id> *> *manifest =
      [NSMutableArray arrayWithCapacity:idToPath.count];

  for (NSString *photoId in idToPath) {
    NSString *path = idToPath[photoId];
    NSURL *url = [NSURL fileURLWithPath:path];
    CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)url, NULL);
    if (!source) continue;

    NSDictionary *props = CFBridgingRelease(CGImageSourceCopyPropertiesAtIndex(source, 0, NULL));
    CFRelease(source);
    if (!props) continue;

    NSNumber *width = props[(NSString *)kCGImagePropertyPixelWidth];
    NSNumber *height = props[(NSString *)kCGImagePropertyPixelHeight];
    if (!width || !height || height.doubleValue == 0) continue;

    [manifest addObject:@{
      @"id" : photoId,
      @"width" : width,
      @"height" : height,
      @"aspect_ratio" : @(width.doubleValue / height.doubleValue),
      @"filename" : path.lastPathComponent,
    }];
  }
  return manifest;
}

- (nullable NSData *)dataForPhotoId:(NSString *)photoId
                            mimeType:(NSString *_Nullable *_Nonnull)outMimeType {
  NSDictionary<NSString *, NSString *> *idToPath = [self scanIdToPathMap];
  NSString *path = idToPath[photoId];
  if (!path) return nil;

  NSData *data = [NSData dataWithContentsOfFile:path];
  if (!data) return nil;

  *outMimeType = [self mimeTypeForPath:path];
  return data;
}

- (NSString *)mimeTypeForPath:(NSString *)path {
  NSString *ext = path.pathExtension.lowercaseString;
  if ([ext isEqualToString:@"jpg"] || [ext isEqualToString:@"jpeg"]) return @"image/jpeg";
  if ([ext isEqualToString:@"png"]) return @"image/png";
  if ([ext isEqualToString:@"gif"]) return @"image/gif";
  if ([ext isEqualToString:@"heic"]) return @"image/heic";
  if ([ext isEqualToString:@"heif"]) return @"image/heif";
  if ([ext isEqualToString:@"tiff"] || [ext isEqualToString:@"tif"]) return @"image/tiff";
  if ([ext isEqualToString:@"webp"]) return @"image/webp";
  return @"application/octet-stream";
}

@end
