//
//  UrbitModule.m
//  Landscape
//
//  Created by Alec Ananian on 7/6/23.
//

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(UrbitModule, NSObject)

RCT_EXTERN_METHOD(setUrbit:(NSString *)shipName shipUrl:(NSString *)shipUrl authCookie:(NSString *)authCookie)
RCT_EXTERN_METHOD(clearUrbit)
RCT_EXTERN_METHOD(setPostHogApiKey:(NSString *)apiKey)
RCT_EXTERN_METHOD(updateBadgeCount:(NSInteger)count uid:(NSString *)uid)
+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end

