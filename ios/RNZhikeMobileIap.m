#import "RNZhikeMobileIap.h"

@implementation RNZhikeMobileIap

- (dispatch_queue_t)methodQueue
{
    return dispatch_get_main_queue();
}

RCT_EXPORT_MODULE()

RCT_REMAP_METHOD(isIcloudAvailable,
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject) {
    NSFileManager *fm = [NSFileManager defaultManager];
    BOOL ret = fm.ubiquityIdentityToken ? 1 : 0;
    resolver(@(ret));
}

@end
