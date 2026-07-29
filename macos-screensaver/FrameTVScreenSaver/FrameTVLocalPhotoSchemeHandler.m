//
//  FrameTVLocalPhotoSchemeHandler.m
//  FrameTVScreenSaver
//

#import "FrameTVLocalPhotoSchemeHandler.h"

NSString *const FrameTVLocalPhotoScheme = @"frametv-local";

static NSString *const kErrorDomain = @"FrameTVLocalPhotoSchemeHandler";

@interface FrameTVLocalPhotoSchemeHandler ()
@property(nonatomic, strong) id<FrameTVLocalPhotoSource> source;
@end

@implementation FrameTVLocalPhotoSchemeHandler

- (instancetype)initWithSource:(id<FrameTVLocalPhotoSource>)source {
  self = [super init];
  if (self) {
    _source = source;
  }
  return self;
}

- (void)webView:(WKWebView *)webView startURLSchemeTask:(id<WKURLSchemeTask>)task {
  NSURL *url = task.request.URL;
  NSString *host = url.host;

  if ([host isEqualToString:@"index"]) {
    [self respondWithManifest:task];
    return;
  }

  if ([host isEqualToString:@"photo"]) {
    // frametv-local://photo/<id> -> path is "/<id>"
    NSString *photoId = url.path.length > 1 ? [url.path substringFromIndex:1] : nil;
    if (photoId.length > 0) {
      [self respondWithPhoto:photoId task:task];
      return;
    }
  }

  [self failTask:task
        withCode:404
         message:[NSString stringWithFormat:@"No handler for frametv-local://%@%@", host ?: @"",
                                             url.path ?: @""]];
}

- (void)webView:(WKWebView *)webView stopURLSchemeTask:(id<WKURLSchemeTask>)task {
  // Every request below is resolved synchronously before returning, so
  // there's no in-flight work to cancel.
}

#pragma mark - Routes

- (void)respondWithManifest:(id<WKURLSchemeTask>)task {
  NSArray<NSDictionary<NSString *, id> *> *manifest = [self.source indexManifest];
  NSDictionary *body = @{@"photos" : manifest ?: @[]};

  NSError *error = nil;
  NSData *json = [NSJSONSerialization dataWithJSONObject:body options:0 error:&error];
  if (!json) {
    [self failTask:task withCode:500 message:@"Failed to encode manifest"];
    return;
  }

  [self respondToTask:task data:json mimeType:@"application/json"];
}

- (void)respondWithPhoto:(NSString *)photoId task:(id<WKURLSchemeTask>)task {
  NSString *mimeType = nil;
  NSData *data = [self.source dataForPhotoId:photoId mimeType:&mimeType];
  if (!data) {
    [self failTask:task withCode:404 message:[NSString stringWithFormat:@"Unknown photo id: %@", photoId]];
    return;
  }
  [self respondToTask:task data:data mimeType:mimeType ?: @"application/octet-stream"];
}

#pragma mark - Helpers

- (void)respondToTask:(id<WKURLSchemeTask>)task data:(NSData *)data mimeType:(NSString *)mimeType {
  NSURLResponse *response = [[NSURLResponse alloc] initWithURL:task.request.URL
                                                        MIMEType:mimeType
                                           expectedContentLength:data.length
                                                textEncodingName:nil];
  [task didReceiveResponse:response];
  [task didReceiveData:data];
  [task didFinish];
}

- (void)failTask:(id<WKURLSchemeTask>)task withCode:(NSInteger)code message:(NSString *)message {
  NSError *error = [NSError errorWithDomain:kErrorDomain
                                        code:code
                                    userInfo:@{NSLocalizedDescriptionKey : message}];
  [task didFailWithError:error];
}

@end
