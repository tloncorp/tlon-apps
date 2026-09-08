#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN
// JSON parsing creates immutable owned values; invalid publication is nil.
FOUNDATION_EXPORT NSDictionary *_Nullable TlonReadParseDescriptor(NSString *_Nullable json, BOOL scope);
FOUNDATION_EXPORT NSDictionary *_Nullable TlonReadRow(NSDictionary *scope, NSString *key);
FOUNDATION_EXPORT NSDictionary *_Nullable TlonReadBlock(NSDictionary *row, NSString *blockID);
FOUNDATION_EXPORT BOOL TlonReadSameVisit(NSDictionary *a, NSDictionary *b);
FOUNDATION_EXPORT BOOL TlonReadSameRowIncarnation(NSDictionary *scope, NSDictionary *saved);
FOUNDATION_EXPORT BOOL TlonReadInnerMatches(NSDictionary *scope, NSDictionary *row, NSDictionary *inner);
typedef NS_ENUM(NSInteger, TlonReadIdentityStatus) {
  TlonReadIdentityCurrent, TlonReadIdentityRemoved, TlonReadIdentityUnavailable
};
FOUNDATION_EXPORT TlonReadIdentityStatus TlonReadResolveIdentity(NSDictionary *scope,
    NSDictionary *_Nullable row, NSDictionary *_Nullable current, NSDictionary *saved);
typedef NS_ENUM(NSInteger, TlonReadTextMapStatus) {
  TlonReadTextMapMeasured, TlonReadTextMapRemoved, TlonReadTextMapUnavailable
};
typedef struct { TlonReadTextMapStatus status; NSRange range; } TlonReadTextMap;
FOUNDATION_EXPORT TlonReadTextMap TlonReadMapText(NSString *before, NSRange saved, NSString *after);
NS_ASSUME_NONNULL_END
