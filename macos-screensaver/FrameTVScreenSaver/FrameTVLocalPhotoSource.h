//
//  FrameTVLocalPhotoSource.h
//  FrameTVScreenSaver
//
//  Protocol implemented by anything that can back the frametv-local://
//  scheme handler — a folder scan today, PHPhotoLibrary later. Keeping this
//  as a protocol means the scheme handler and the web-side contract never
//  need to change when the source does.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@protocol FrameTVLocalPhotoSource <NSObject>

// Array of NSDictionary entries: {id, width, height, aspect_ratio, filename}.
// `id` is an opaque identifier — never a raw filename or path.
- (NSArray<NSDictionary<NSString *, id> *> *)indexManifest;

// Raw image bytes for a previously-issued `id`, or nil if unknown. Sets
// *outMimeType to the appropriate MIME type on success.
- (nullable NSData *)dataForPhotoId:(NSString *)photoId
                            mimeType:(NSString *_Nullable *_Nonnull)outMimeType;

@end

NS_ASSUME_NONNULL_END
