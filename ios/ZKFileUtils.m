//
//  ZKFileUtils.m
//  ieltsmobile
//
//  Created by wansong on 22/07/2017.
//  Copyright © 2017 Facebook. All rights reserved.
//

#import "ZKFileUtils.h"

@implementation ZKFileUtils

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(isIcloudAvailable:(RCTResponseSenderBlock)callback) {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSFileManager *fm = [NSFileManager defaultManager];
    BOOL ret = fm.ubiquityIdentityToken ? 1 : 0;
    if (!ret) {
      NSLog(@"icloud not available");
    }
    callback(@[[NSNull null], @(ret)]);
  });
}


@end
