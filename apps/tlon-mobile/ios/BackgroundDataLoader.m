// BackgroundDataLoaderBridge.m
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(BackgroundDataLoader, NSObject)

RCT_EXTERN_METHOD(retrieveBackgroundData:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setLastSyncTimestamp:(nonnull NSNumber *)timestamp resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

@end

