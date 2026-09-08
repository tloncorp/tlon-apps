#import "../TlonReadDescriptors.h"
#include <cstdio>
#include <functional>
#include <vector>
static int count = 0;
static void check(BOOL okay, const char *name) { ++count; if (!okay) { fprintf(stderr, "FAIL %s\n", name); exit(1); } }
static NSDictionary *parse(NSDictionary *d, BOOL scope) {
  NSData *data = [NSJSONSerialization dataWithJSONObject:d options:0 error:nullptr];
  return TlonReadParseDescriptor([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding], scope);
}
int main() { @autoreleasepool {
  NSDictionary *scope = @{@"version":@1,@"scope":@"channel/a",@"visit":@"visit-1",@"intent":@"read-1",@"phase":@"read",@"dataRevision":@"1",@"rows":@[@{@"key":@"a",@"revision":@"1"}]};
  NSDictionary *row = @{@"version":@1,@"scope":@"channel/a",@"visit":@"visit-1",@"key":@"a",@"revision":@"1",@"kind":@"row",@"blocks":@[@{@"id":@"p",@"kind":@"text",@"revision":@"1"}]};
  NSDictionary *inner = @{@"version":@1,@"scope":@"channel/a",@"visit":@"visit-1",@"key":@"a",@"rowRevision":@"1",@"blockId":@"p",@"revision":@"1",@"kind":@"text"};
  check(parse(scope, YES) != nil, "scope-valid");
  check(parse(row, NO) != nil, "row-valid");
  check(parse(inner, NO) != nil, "inner-valid");
  check(TlonReadSameRowIncarnation(scope,inner), "captured-row-incarnation-current");
  check(TlonReadInnerMatches(scope,row,inner), "atomic-row-block-associated");
  check(!TlonReadParseDescriptor(@"{",YES), "malformed-json");
  check(!TlonReadParseDescriptor(@"[]",YES), "wrong-root-shape");
  for (NSString *key in @[@"scope",@"visit",@"intent",@"phase",@"dataRevision",@"rows"]) {
    NSMutableDictionary *bad = [scope mutableCopy]; [bad removeObjectForKey:key];
    check(!parse(bad,YES), [[@"missing-" stringByAppendingString:key] UTF8String]);
  }
  NSMutableDictionary *bad = [scope mutableCopy]; bad[@"version"] = @YES;
  check(!parse(bad,YES), "boolean-version-rejected");
  bad = [scope mutableCopy]; bad[@"rows"] = @[scope[@"rows"][0],scope[@"rows"][0]];
  check(!parse(bad,YES), "duplicate-authoritative-row-rejected");
  bad = [row mutableCopy]; bad[@"blocks"] = @[row[@"blocks"][0],row[@"blocks"][0]];
  check(!parse(bad,NO), "duplicate-block-lineage-rejected");
  bad = [inner mutableCopy]; bad[@"rowRevision"] = @"2";
  check(!TlonReadInnerMatches(scope,row,bad), "stale-inner-revision");
  check(!TlonReadSameRowIncarnation(scope,bad), "same-key-row-incarnation-aba");
  bad = [inner mutableCopy]; bad[@"visit"] = @"visit-2";
  check(!TlonReadInnerMatches(scope,row,bad), "same-scope-visit-aba");
  bad = [row mutableCopy]; bad[@"revision"] = @"2";
  check(!TlonReadInnerMatches(scope,bad,inner), "uncommitted-new-row-revision");
  bad = [inner mutableCopy]; bad[@"kind"] = @"media";
  check(!parse(bad,NO), "media-requires-asset");
  bad[@"assetKey"] = @"asset/a"; bad[@"mediaReady"] = @"true";
  check(!parse(bad,NO), "media-readiness-is-boolean");
  bad[@"mediaReady"] = @YES;
  check(parse(bad,NO) != nil, "current-asset-ready-description");
  check(TlonReadRow(scope,@"removed") == nil && TlonReadBlock(row,@"removed") == nil, "authoritative-absence");
  check(TlonReadResolveIdentity(scope,row,inner,inner)==TlonReadIdentityCurrent, "saved-block-current");
  check(TlonReadResolveIdentity(scope,nil,nil,inner)==TlonReadIdentityUnavailable, "missing-mounted-row-not-removed");
  bad=[scope mutableCopy];bad[@"rows"]=@[];
  check(TlonReadResolveIdentity(bad,nil,nil,inner)==TlonReadIdentityRemoved, "authoritative-row-removal");
  bad=[scope mutableCopy];bad[@"rows"]=@[@{@"key":@"a",@"revision":@"2"}];
  check(TlonReadResolveIdentity(bad,nil,nil,inner)==TlonReadIdentityRemoved, "same-key-new-incarnation-retires-point");
  bad=[row mutableCopy];bad[@"blocks"]=@[];
  check(TlonReadResolveIdentity(scope,bad,inner,inner)==TlonReadIdentityRemoved, "authoritative-block-removal");
  bad=[inner mutableCopy];bad[@"blockId"]=@"neighbor";
  check(TlonReadResolveIdentity(scope,row,bad,inner)==TlonReadIdentityUnavailable, "physical-host-reused-for-different-block");
  bad=[scope mutableCopy];bad[@"visit"]=@"v2";
  check(TlonReadResolveIdentity(bad,row,inner,inner)==TlonReadIdentityUnavailable, "foreign-visit-not-removal-evidence");
  check(TlonReadResolveIdentity(scope,row,nil,inner)==TlonReadIdentityUnavailable, "missing-inner-not-authoritative-removal");
  bad=[row mutableCopy];bad[@"blocks"]=@[];bad[@"unresolvedBlockIds"]=@[@"p"];
  check(parse(bad,NO)!=nil && TlonReadResolveIdentity(scope,bad,nil,inner)==TlonReadIdentityUnavailable, "ambiguous-old-lineage-unavailable");
  bad=[row mutableCopy];bad[@"unresolvedBlockIds"]=@[@"p"];
  check(!parse(bad,NO), "unresolved-cannot-also-be-current-block");
  bad=[row mutableCopy];bad[@"unresolvedBlockIds"]=@[@"old",@"old"];
  check(!parse(bad,NO), "duplicate-unresolved-id-rejected");
  NSDictionary *immutable = parse(scope,YES);
  NSMutableDictionary *mutableRow = [scope[@"rows"][0] mutableCopy];
  NSMutableDictionary *mutableScope = [scope mutableCopy]; mutableScope[@"rows"] = [NSMutableArray arrayWithObject:mutableRow];
  NSDictionary *copied = parse(mutableScope,YES); mutableRow[@"revision"] = @"later";
  check([TlonReadRow(copied,@"a")[@"revision"] isEqual:@"1"] && [immutable isEqual:scope], "immutable-atomic-copy");
  auto map = [](NSString *a, NSRange range, NSString *b, TlonReadTextMapStatus status, NSUInteger location) {
    TlonReadTextMap result = TlonReadMapText(a, range, b);
    return result.status == status && (status != TlonReadTextMapMeasured || result.range.location == location);
  };
  check(map(@"abc",NSMakeRange(1,1),@"abc",TlonReadTextMapMeasured,1), "same-text-reflow");
  check(map(@"abc",NSMakeRange(1,1),@"--abc",TlonReadTextMapMeasured,3), "prefix-insertion");
  check(map(@"abc",NSMakeRange(1,1),@"abc--",TlonReadTextMapMeasured,1), "suffix-insertion");
  check(map(@"--abc",NSMakeRange(3,1),@"abc",TlonReadTextMapMeasured,1), "prefix-deletion");
  check(map(@"abc",NSMakeRange(1,1),@"ac",TlonReadTextMapRemoved,0), "saved-span-pure-deletion");
  check(map(@"abc",NSMakeRange(1,1),@"axc",TlonReadTextMapUnavailable,0), "saved-span-replacement");
  check(map(@"abc",NSMakeRange(1,1),@"",TlonReadTextMapRemoved,0), "empty-paragraph-removal");
  check(map(@"a👨‍👩‍👧b",NSMakeRange(1,8),@"--a👨‍👩‍👧b",TlonReadTextMapMeasured,3), "zwj-cluster-shifts-whole");
  check(map(@"a😀b",NSMakeRange(1,1),@"a😀b",TlonReadTextMapUnavailable,0), "split-surrogate-rejected");
  check(map(@"aéb",NSMakeRange(1,1),@"aéb",TlonReadTextMapUnavailable,0), "split-combining-sequence-rejected");
  check(map(@"abc",NSMakeRange(NSUIntegerMax-1,8),@"abc",TlonReadTextMapUnavailable,0), "range-overflow-rejected");
  check(map(@"abc",NSMakeRange(1,0),@"abc",TlonReadTextMapUnavailable,0), "empty-range-rejected");
  check(map(@"one old two",NSMakeRange(4,3),@"one new two",TlonReadTextMapUnavailable,0), "changed-span-no-substring-guess");
  check(map(@"aaa",NSMakeRange(0,1),@"aa",TlonReadTextMapUnavailable,0), "duplicate-deletion-cannot-identify-cluster");
  check(map(@"left aa right",NSMakeRange(5,1),@"left aaa right",TlonReadTextMapUnavailable,0), "duplicate-insertion-cannot-identify-cluster");
  check(map(@"left aaa right",NSMakeRange(0,1),@"left aa right",TlonReadTextMapMeasured,0), "unambiguous-prefix-outside-duplicate-edit");
  printf("PASS %d production Foundation descriptor/text controls; no UIKit or presentation claim\n",count);
} }
