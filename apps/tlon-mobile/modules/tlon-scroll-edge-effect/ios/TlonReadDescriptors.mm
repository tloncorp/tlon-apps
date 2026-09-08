#import "TlonReadDescriptors.h"

static BOOL string(id value) { return [value isKindOfClass:NSString.class] && [value length] > 0 && [value length] <= 16384; }
static BOOL dictionary(id value) { return [value isKindOfClass:NSDictionary.class]; }
static BOOL fields(NSDictionary *value, NSArray<NSString *> *keys) {
  for (NSString *key in keys) if (!string(value[key])) return NO;
  return YES;
}
static BOOL kind(id value) { return [value isEqual:@"text"] || [value isEqual:@"media"]; }
static BOOL media(NSDictionary *value) {
  return ![value[@"kind"] isEqual:@"media"] || string(value[@"assetKey"]);
}
NSDictionary *TlonReadParseDescriptor(NSString *json, BOOL scope) {
  if (![json isKindOfClass:NSString.class] || json.length > 4 * 1024 * 1024) return nil;
  id parsed = [NSJSONSerialization JSONObjectWithData:[json dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nullptr];
  if (!dictionary(parsed)) return nil;
  NSDictionary *d = parsed;
  if (![d[@"version"] isKindOfClass:NSNumber.class] || [d[@"version"] doubleValue] != 1 ||
      CFGetTypeID((__bridge CFTypeRef)d[@"version"]) == CFBooleanGetTypeID() || !fields(d, @[@"scope", @"visit"])) return nil;
  if (scope) {
    if (!fields(d, @[@"intent", @"dataRevision"]) ||
        ![@[@"read", @"follow", @"target", @"inactive"] containsObject:d[@"phase"]]) return nil;
    id rows = d[@"rows"];
    if (![rows isKindOfClass:NSArray.class] || [rows count] > 100000) return nil;
    NSMutableSet *keys = [NSMutableSet new];
    for (id row in rows) {
      if (!dictionary(row) || !fields(row, @[@"key", @"revision"]) || [keys containsObject:row[@"key"]]) return nil;
      [keys addObject:row[@"key"]];
    }
  } else if ([d[@"kind"] isEqual:@"row"]) {
    if (!fields(d, @[@"key", @"revision"]) || ![d[@"blocks"] isKindOfClass:NSArray.class] || [d[@"blocks"] count] > 4096) return nil;
    NSMutableSet *ids = [NSMutableSet new];
    for (id block in d[@"blocks"]) {
      if (!dictionary(block) || !fields(block, @[@"id", @"revision"]) || !kind(block[@"kind"]) ||
          !media(block) || [ids containsObject:block[@"id"]]) return nil;
      [ids addObject:block[@"id"]];
    }
    id unresolved = d[@"unresolvedBlockIds"];
    if (unresolved) {
      if (![unresolved isKindOfClass:NSArray.class] || [unresolved count] > 4096) return nil;
      for (id blockID in unresolved) {
        if (!string(blockID) || [ids containsObject:blockID]) return nil;
        [ids addObject:blockID];
      }
    }
  } else {
    if (!fields(d, @[@"key", @"rowRevision", @"blockId", @"revision"]) || !kind(d[@"kind"]) || !media(d)) return nil;
    if (d[@"mediaReady"] && (![d[@"mediaReady"] isKindOfClass:NSNumber.class] ||
        CFGetTypeID((__bridge CFTypeRef)d[@"mediaReady"]) != CFBooleanGetTypeID())) return nil;
  }
  return d;
}
NSDictionary *TlonReadRow(NSDictionary *scope, NSString *key) {
  for (NSDictionary *row in scope[@"rows"]) if ([row[@"key"] isEqual:key]) return row;
  return nil;
}
NSDictionary *TlonReadBlock(NSDictionary *row, NSString *blockID) {
  for (NSDictionary *block in row[@"blocks"]) if ([block[@"id"] isEqual:blockID]) return block;
  return nil;
}
BOOL TlonReadSameVisit(NSDictionary *a, NSDictionary *b) {
  return a && b && [a[@"scope"] isEqual:b[@"scope"]] && [a[@"visit"] isEqual:b[@"visit"]];
}
BOOL TlonReadSameRowIncarnation(NSDictionary *scope, NSDictionary *saved) {
  NSString *revision = [saved[@"kind"] isEqual:@"row"] ? saved[@"revision"] : saved[@"rowRevision"];
  return TlonReadSameVisit(scope, saved) && [TlonReadRow(scope, saved[@"key"])[@"revision"] isEqual:revision];
}
BOOL TlonReadInnerMatches(NSDictionary *scope, NSDictionary *row, NSDictionary *inner) {
  NSDictionary *member = TlonReadRow(scope, row[@"key"]);
  NSDictionary *block = TlonReadBlock(row, inner[@"blockId"]);
  return TlonReadSameVisit(scope, row) && TlonReadSameVisit(scope, inner) &&
      [member[@"revision"] isEqual:row[@"revision"]] && [inner[@"key"] isEqual:row[@"key"]] &&
      [inner[@"rowRevision"] isEqual:row[@"revision"]] && [block[@"kind"] isEqual:inner[@"kind"]] &&
      [block[@"revision"] isEqual:inner[@"revision"]] &&
      (![inner[@"kind"] isEqual:@"media"] || [block[@"assetKey"] isEqual:inner[@"assetKey"]]);
}
TlonReadIdentityStatus TlonReadResolveIdentity(NSDictionary *scope, NSDictionary *row, NSDictionary *current, NSDictionary *saved) {
  if (!TlonReadSameVisit(scope, saved)) return TlonReadIdentityUnavailable;
  if (!TlonReadSameRowIncarnation(scope, saved)) return TlonReadIdentityRemoved;
  if (!row || ![row[@"key"] isEqual:saved[@"key"]] || !TlonReadSameRowIncarnation(scope, row)) return TlonReadIdentityUnavailable;
  if ([saved[@"kind"] isEqual:@"row"]) return current && [current isEqual:row] ? TlonReadIdentityCurrent : TlonReadIdentityUnavailable;
  if ([row[@"unresolvedBlockIds"] containsObject:saved[@"blockId"]]) return TlonReadIdentityUnavailable;
  NSDictionary *block = TlonReadBlock(row, saved[@"blockId"]);
  if (!block || ![block[@"kind"] isEqual:saved[@"kind"]] ||
      ([block[@"kind"] isEqual:@"media"] && ![block[@"assetKey"] isEqual:saved[@"assetKey"]])) return TlonReadIdentityRemoved;
  if (!current || ![current[@"blockId"] isEqual:saved[@"blockId"]] || ![current[@"kind"] isEqual:saved[@"kind"]] ||
      !TlonReadInnerMatches(scope, row, current)) return TlonReadIdentityUnavailable;
  return TlonReadIdentityCurrent;
}
static BOOL boundary(NSString *text, NSUInteger at) {
  return at == 0 || at == text.length || [text rangeOfComposedCharacterSequenceAtIndex:at].location == at;
}
TlonReadTextMap TlonReadMapText(NSString *before, NSRange saved, NSString *after) {
  TlonReadTextMap unavailable = {TlonReadTextMapUnavailable, NSMakeRange(NSNotFound, 0)};
  if (!before || !after || saved.location == NSNotFound || saved.length == 0 ||
      saved.location > before.length || saved.length > before.length - saved.location ||
      !boundary(before, saved.location) || !boundary(before, NSMaxRange(saved))) return unavailable;
  if ([before isEqualToString:after]) return {TlonReadTextMapMeasured, saved};
  if (after.length == 0) return {TlonReadTextMapRemoved, NSMakeRange(NSNotFound, 0)};
  NSUInteger prefix = 0;
  while (prefix < before.length && prefix < after.length && [before characterAtIndex:prefix] == [after characterAtIndex:prefix]) ++prefix;
  while (prefix && (!boundary(before, prefix) || !boundary(after, prefix))) --prefix;
  // Repeated text permits several equally minimal edit locations. Do not
  // pretend the leftmost longest-prefix alignment identifies the same glyph.
  NSUInteger allSuffix = 0;
  while (allSuffix < before.length && allSuffix < after.length &&
      [before characterAtIndex:before.length - allSuffix - 1] == [after characterAtIndex:after.length - allSuffix - 1]) ++allSuffix;
  while (allSuffix && (!boundary(before, before.length - allSuffix) || !boundary(after, after.length - allSuffix))) --allSuffix;
  NSUInteger shortest = MIN(before.length, after.length);
  if (prefix + allSuffix > shortest) {
    NSUInteger ambiguousStart = shortest - allSuffix;
    NSUInteger ambiguousEnd = prefix + (before.length > after.length ? before.length - after.length : 0);
    if (saved.location < ambiguousEnd && NSMaxRange(saved) > ambiguousStart) return unavailable;
  }
  NSUInteger suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix &&
      [before characterAtIndex:before.length - suffix - 1] == [after characterAtIndex:after.length - suffix - 1]) ++suffix;
  while (suffix && (!boundary(before, before.length - suffix) || !boundary(after, after.length - suffix))) --suffix;
  if (NSMaxRange(saved) <= prefix) return {TlonReadTextMapMeasured, saved};
  if (saved.location >= before.length - suffix) {
    NSRange mapped = NSMakeRange(after.length - (before.length - saved.location), saved.length);
    if (boundary(after, mapped.location) && boundary(after, NSMaxRange(mapped))) return {TlonReadTextMapMeasured, mapped};
    return unavailable;
  }
  // Only a pure deletion of the complete saved cluster proves removal. A
  // replacement, duplicate substring or ambiguous changed interval cannot.
  if (after.length == prefix + suffix && saved.location >= prefix && NSMaxRange(saved) <= before.length - suffix)
    return {TlonReadTextMapRemoved, NSMakeRange(NSNotFound, 0)};
  return unavailable;
}
