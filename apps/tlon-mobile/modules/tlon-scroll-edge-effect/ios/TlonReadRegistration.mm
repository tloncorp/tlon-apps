#import "TlonReadRegistration.h"
#import "TlonReadDescriptors.h"
#import "TlonReadDurations.h"
#import <QuartzCore/QuartzCore.h>
#import <React/RCTScrollViewComponentView.h>
#import <React/RCTParagraphComponentView.h>
#import <RNScreens/RNSScreen.h>
#import <objc/runtime.h>
#include <algorithm>
#include <cmath>
#include <map>

namespace timing = tlon::read_durations;
namespace sr = facebook::react::scroll_read;
using facebook::react::TextReadingPointStatus;
using facebook::react::TextReadingPointResult;
@class TlonReadRegistry;
@interface TlonReadRegistration ()
@property(nonatomic, weak) UIView *host;
@property(nonatomic) BOOL scope;
@property(nonatomic, copy) NSDictionary *descriptor;
@property(nonatomic, weak) TlonReadRegistry *registry;
@end
@interface TlonReadRegistry : NSObject <UIScrollViewDelegate, RNSNativeReadingLifecycleListener>
@property(nonatomic, weak) RCTScrollViewComponentView *owner;
@property(nonatomic, weak) RNSScreenView *screen;
@property(nonatomic) NSHashTable<TlonReadRegistration *> *registrations;
@property(nonatomic, weak) TlonReadRegistration *activeScope;
@property(nonatomic, copy) NSDictionary *leaseDescriptor;
@property(nonatomic, copy) NSDictionary *followDescriptor;
@property(nonatomic, weak) TlonReadRegistration *followScope;
@property(nonatomic, copy) NSDictionary *factoryDescriptor;
@property(nonatomic, weak) TlonReadRegistration *factoryScope;
@property(nonatomic, copy) NSString *lastPhase;
@property(nonatomic, copy) NSString *registrationReason;
@property(nonatomic) BOOL gesture;
@property(nonatomic) NSUInteger captureAttempts, admissionAttempts;
@property(nonatomic, copy) NSDictionary *lastCapture, *lastAdmission;
@property(nonatomic) std::shared_ptr<timing::State> durationCounters;
@property(nonatomic, weak) TlonReadRegistration *durationScope;
@property(nonatomic, copy) NSString *durationScopeID, *durationVisitID, *durationSession;
- (void)updateDurationsForScope:(TlonReadRegistration *)scope;
- (void)recordCapture:(NSString *)reason counts:(NSDictionary *)counts rejected:(NSDictionary *)rejected;
- (void)recordAdmission:(NSString *)reason;
- (NSDictionary *)providerDiagnostic;
- (void)update:(BOOL)mayBegin;
- (void)retire;
@end

static char RegistryKey, RegistrationKey;
static RNSScreenView *nearestScreen(UIView *owner) {
  for (UIView *v = owner.superview; v; v = v.superview)
    if ([v isKindOfClass:RNSScreenView.class]) return (RNSScreenView *)v;
  return nil;
}
static BOOL belongsTo(UIView *host, RCTScrollViewComponentView *owner) {
  return host && owner && [RCTScrollViewComponentView findScrollViewComponentViewForView:host] == owner;
}
// This is copied only by the explicit native diagnostic capture. The source
// remains the immutable descriptor published by the actual Expo scope host.
static NSDictionary *unavailableMembership(NSString *issue) {
  return @{@"version": @1, @"status": @"unavailable", @"issues": @[issue]};
}
static TlonReadRegistration *currentMembershipScope(RCTScrollViewComponentView *owner,
    UIScrollView *scrollView, TlonReadRegistry *registry, NSString *__autoreleasing *issue) {
  *issue = @"membership-owner-unavailable";
  if (!NSThread.isMainThread || !owner || !scrollView || owner.scrollView != scrollView ||
      !scrollView.window || owner.window != scrollView.window || !registry || registry.owner != owner ||
      objc_getAssociatedObject(owner, &RegistryKey) != registry) return nil;
  *issue = @"membership-screen-unavailable";
  if (!registry.screen || nearestScreen(owner) != registry.screen || !registry.screen.nativeReadingVisible ||
      registry.screen.window != scrollView.window) return nil;
  TlonReadRegistration *scope = nil;
  for (TlonReadRegistration *r in registry.registrations) if (r.scope && r.host.window) {
    if (scope) { *issue = @"membership-duplicate-scope"; return nil; }
    scope = r;
  }
  *issue = @"membership-scope-unavailable";
  if (!scope || scope != registry.activeScope || scope.registry != registry ||
      scope.host.window != scrollView.window || !belongsTo(scope.host, owner) ||
      objc_getAssociatedObject(scope.host, &RegistrationKey) != scope) return nil;
  return scope;
}
static char MembershipLifetimeIdentityKey;
static NSString *membershipLifetimeIdentity(NSObject *object) {
  NSString *identity = objc_getAssociatedObject(object, &MembershipLifetimeIdentityKey);
  if (!identity) {
    identity = NSUUID.UUID.UUIDString;
    objc_setAssociatedObject(object, &MembershipLifetimeIdentityKey, identity, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
  return identity;
}
static NSDictionary *committedMembership(RCTScrollViewComponentView *owner,
    UIScrollView *scrollView, TlonReadRegistry *registry) {
  NSString *issue = nil;
  TlonReadRegistration *scope = currentMembershipScope(owner, scrollView, registry, &issue);
  if (!scope) return unavailableMembership(issue);
  NSDictionary *d = scope.descriptor;
  auto string = [](id value) { return [value isKindOfClass:NSString.class] && [value length] > 0 && [value length] <= 16384; };
  if (![d isKindOfClass:NSDictionary.class] || ![d[@"version"] isKindOfClass:NSNumber.class] ||
      CFGetTypeID((__bridge CFTypeRef)d[@"version"]) == CFBooleanGetTypeID() || [d[@"version"] doubleValue] != 1 ||
      !string(d[@"scope"]) || !string(d[@"visit"]) || !string(d[@"dataRevision"]) || !string(d[@"intent"]) ||
      ![@[@"read", @"follow", @"target", @"inactive"] containsObject:d[@"phase"]] ||
      ![d[@"rows"] isKindOfClass:NSArray.class] || [d[@"rows"] count] > 100000)
    return unavailableMembership(@"membership-invalid-descriptor");
  if ([d[@"phase"] isEqual:@"inactive"]) return unavailableMembership(@"membership-inactive-scope");
  NSMutableArray *rows = [NSMutableArray arrayWithCapacity:[d[@"rows"] count]];
  NSMutableSet *keys = [NSMutableSet new];
  for (id row in d[@"rows"]) {
    if (![row isKindOfClass:NSDictionary.class] || !string(row[@"key"]) || !string(row[@"revision"]) ||
        [keys containsObject:row[@"key"]]) return unavailableMembership(@"membership-invalid-rows");
    [keys addObject:row[@"key"]];
    [rows addObject:@{@"key": [row[@"key"] copy], @"revision": [row[@"revision"] copy]}];
  }
  NSString *identity = [membershipLifetimeIdentity(scope) stringByAppendingFormat:@"/%@", membershipLifetimeIdentity(scope.host)];
  if (scope != currentMembershipScope(owner, scrollView, registry, &issue) || scope.descriptor != d)
    return unavailableMembership(@"membership-owner-changed");
  return @{@"version": @1, @"status": @"ok", @"scopeIdentity": identity,
      @"scope": [d[@"scope"] copy], @"visit": [d[@"visit"] copy],
      @"dataRevision": [d[@"dataRevision"] copy], @"rows": [rows copy]};
}

// The recorder supplies the physical views it just inventoried. These helpers
// never acquire provider geometry or maintain a second row/membership store.
static BOOL within(UIView *view, UIView *ancestor) {
  NSUInteger depth = 0;
  for (UIView *v = view; v && depth++ < 128; v = v.superview) if (v == ancestor) return YES;
  return NO;
}
static UIView *indexedCellOf(UIView *view) {
  NSUInteger depth = 0;
  for (UIView *v = view; v && depth++ < 128; v = v.superview)
    if ([v.accessibilityIdentifier hasPrefix:@"scroll-cell-"]) return v;
  return nil;
}
static BOOL visibleBindingHost(UIView *view, UIScrollView *scrollView) {
  NSUInteger depth = 0;
  for (UIView *v = view; v && depth++ < 128; v = v.superview) {
    if (v.hidden || !std::isfinite(v.alpha) || v.alpha <= 0 || !CGAffineTransformIsIdentity(v.transform)) return NO;
    if (v == scrollView) return YES;
  }
  return NO;
}
static NSDictionary *rulerIdentity(UIView *view) {
  NSString *json = view.accessibilityValue;
  if (![json isKindOfClass:NSString.class] || json.length > 4 * 1024 * 1024) return nil;
  id d = [NSJSONSerialization JSONObjectWithData:[json dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nullptr];
  if (![d isKindOfClass:NSDictionary.class] || ![d[@"version"] isKindOfClass:NSNumber.class] ||
      CFGetTypeID((__bridge CFTypeRef)d[@"version"]) == CFBooleanGetTypeID() || [d[@"version"] doubleValue] != 1 ||
      ![d[@"key"] isKindOfClass:NSString.class] || ![d[@"key"] length] || [d[@"key"] length] > 16384 ||
      ![d[@"scope"] isKindOfClass:NSString.class] || ![d[@"scope"] length] || [d[@"scope"] length] > 16384) return nil;
  return @{@"key": d[@"key"], @"scope": d[@"scope"]};
}
static NSDictionary *unavailableRowBinding(NSString *rowID, NSString *issue) {
  return @{@"rowId": rowID, @"status": @"unavailable", @"issues": @[issue]};
}
static NSDictionary *measuredRowBindings(RCTScrollViewComponentView *owner, UIScrollView *scrollView,
    TlonReadRegistry *registry, NSDictionary *membership,
    NSDictionary<NSString *, NSArray<UIView *> *> *rowViews,
    NSDictionary<NSString *, NSArray<UIView *> *> *cellViews) {
  if (![membership[@"status"] isEqual:@"ok"]) return unavailableMembership(@"binding-membership-unavailable");
  NSString *issue = nil;
  TlonReadRegistration *scope = currentMembershipScope(owner, scrollView, registry, &issue);
  if (!scope) return unavailableMembership(@"binding-owner-unavailable");
  NSDictionary *scopeDescriptor = scope.descriptor;
  // One immutable registry inventory/index per capture, not one scan per row.
  NSArray<TlonReadRegistration *> *registrations = registry.registrations.allObjects;
  if (![rowViews isKindOfClass:NSDictionary.class] || ![cellViews isKindOfClass:NSDictionary.class] ||
      rowViews.count > 128 || cellViews.count > 128 || registrations.count > 20000)
    return unavailableMembership(@"binding-inventory-limit");
  for (id key in rowViews) if (![key isKindOfClass:NSString.class]) return unavailableMembership(@"binding-invalid-inventory-key");
  NSMutableArray *registrationOwners = [NSMutableArray new];
  for (TlonReadRegistration *r in registrations)
    [registrationOwners addObject:@{@"registration": r, @"descriptor": r.descriptor ?: NSNull.null, @"host": r.host ?: NSNull.null}];
  NSMutableDictionary<NSString *, NSMutableArray<TlonReadRegistration *> *> *byKey = [NSMutableDictionary new];
  NSMutableDictionary<NSString *, NSString *> *memberRevisions = [NSMutableDictionary new];
  for (NSDictionary *member in membership[@"rows"]) memberRevisions[member[@"key"]] = member[@"revision"];
  for (TlonReadRegistration *r in registrations) {
    NSDictionary *d = r.descriptor;
    if (!r.scope && [d[@"kind"] isEqual:@"row"] && [d[@"key"] isKindOfClass:NSString.class] && TlonReadSameVisit(d, scopeDescriptor)) {
      if (!byKey[d[@"key"]]) byKey[d[@"key"]] = [NSMutableArray new];
      [byKey[d[@"key"]] addObject:r];
    }
  }
  NSMutableArray *bindings = [NSMutableArray new], *owners = [NSMutableArray new];
  NSUInteger visited = 0;
  for (NSString *rowID in [[rowViews allKeys] sortedArrayUsingSelector:@selector(compare:)]) {
    NSArray<UIView *> *views = rowViews[rowID];
    auto reject = [&](NSString *reason) { [bindings addObject:unavailableRowBinding(rowID, reason)]; };
    if (![rowID isKindOfClass:NSString.class] || ![views isKindOfClass:NSArray.class] || views.count != 1 ||
        ![views[0] isKindOfClass:UIView.class]) { reject(@"binding-missing-or-duplicate-row"); continue; }
    UIView *rowView = views[0];
    NSDictionary *semantic = rulerIdentity(rowView);
    NSString *key = semantic[@"key"];
    if (!semantic || ![rowID isEqual:[@"scroll-row-" stringByAppendingString:key]] || ![rowView.accessibilityIdentifier isEqual:rowID]) {
      reject(@"binding-row-semantics-mismatch"); continue;
    }
    NSString *cellID = [@"scroll-cell-" stringByAppendingString:key];
    NSArray<UIView *> *cells = cellViews[cellID];
    if (![cells isKindOfClass:NSArray.class] || cells.count != 1 || ![cells[0] isKindOfClass:UIView.class]) {
      reject(@"binding-missing-or-duplicate-cell"); continue;
    }
    UIView *cell = cells[0];
    if (![cell.accessibilityIdentifier isEqual:cellID] || ![rulerIdentity(cell) isEqual:semantic] ||
        cell == rowView || indexedCellOf(rowView) != cell || !within(rowView, cell) ||
        rowView.window != scrollView.window || cell.window != scrollView.window ||
        !within(cell, scrollView) || !belongsTo(rowView, owner) || !belongsTo(cell, owner)) {
      reject(@"binding-cell-owner-or-semantics-mismatch"); continue;
    }
    NSMutableArray<UIView *> *pending = [NSMutableArray arrayWithObject:rowView];
    TlonReadRegistration *registration = nil;
    BOOL ambiguous = NO;
    while (pending.count && visited++ < 20000) {
      UIView *view = pending.lastObject; [pending removeLastObject];
      TlonReadRegistration *candidate = objc_getAssociatedObject(view, &RegistrationKey);
      if (candidate && (candidate.scope || [candidate.descriptor[@"kind"] isEqual:@"row"])) {
        if (candidate.scope || registration || candidate.host != view) { ambiguous = YES; break; }
        registration = candidate;
      }
      [pending addObjectsFromArray:view.subviews];
    }
    if (visited >= 20000) return unavailableMembership(@"binding-traversal-limit");
    NSDictionary *d = registration.descriptor;
    UIView *host = registration.host;
    if (ambiguous || pending.count || !registration || registration.registry != registry ||
        byKey[key].count != 1 || byKey[key][0] != registration ||
        !TlonReadSameVisit(d, scopeDescriptor) || ![d[@"key"] isEqual:key] ||
        ![d[@"version"] isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)d[@"version"]) == CFBooleanGetTypeID() ||
        [d[@"version"] doubleValue] != 1 ||
        ![d[@"revision"] isKindOfClass:NSString.class] || ![d[@"revision"] length] ||
        ![memberRevisions[key] isEqual:d[@"revision"]] || !host || host.window != scrollView.window ||
        objc_getAssociatedObject(host, &RegistrationKey) != registration || !within(host, rowView) ||
        indexedCellOf(host) != cell || !belongsTo(host, owner) || !visibleBindingHost(host, scrollView)) {
      reject(@"binding-registration-unavailable"); continue;
    }
    [bindings addObject:@{@"status": @"ok", @"rowId": rowID, @"cellId": cellID,
        @"key": [key copy], @"revision": [d[@"revision"] copy], @"fixtureScope": semantic[@"scope"],
        @"rowViewIdentity": membershipLifetimeIdentity(rowView), @"cellViewIdentity": membershipLifetimeIdentity(cell),
        @"registrationIdentity": membershipLifetimeIdentity(registration), @"hostIdentity": membershipLifetimeIdentity(host)}];
    [owners addObject:@{@"registration": registration, @"descriptor": d, @"host": host, @"row": rowView, @"cell": cell,
        @"rowSemantic": rowView.accessibilityValue, @"cellSemantic": cell.accessibilityValue, @"rowId": rowID, @"cellId": cellID}];
  }
  // A publication or physical owner change during a native callback invalidates
  // the whole batch, including otherwise valid earlier entries.
  if (scope != currentMembershipScope(owner, scrollView, registry, &issue) || scope.descriptor != scopeDescriptor ||
      ![membership isEqual:committedMembership(owner, scrollView, registry)])
    return unavailableMembership(@"binding-owner-changed");
  if (![[NSSet setWithArray:registrations] isEqual:[NSSet setWithArray:registry.registrations.allObjects]])
    return unavailableMembership(@"binding-registry-changed");
  for (NSDictionary *saved in registrationOwners) {
    TlonReadRegistration *r = saved[@"registration"];
    if ((r.descriptor ?: NSNull.null) != saved[@"descriptor"] || (r.host ?: NSNull.null) != saved[@"host"])
      return unavailableMembership(@"binding-registry-owner-changed");
  }
  for (NSDictionary *saved in owners) {
    TlonReadRegistration *r = saved[@"registration"]; UIView *host = saved[@"host"], *row = saved[@"row"], *cell = saved[@"cell"];
    if (r.descriptor != saved[@"descriptor"] || r.host != host || r.registry != registry ||
        ![registry.registrations containsObject:r] || objc_getAssociatedObject(host, &RegistrationKey) != r ||
        host.window != scrollView.window || !within(host, row) || indexedCellOf(host) != cell || indexedCellOf(row) != cell ||
        !within(cell, scrollView) || !visibleBindingHost(host, scrollView) ||
        ![row.accessibilityIdentifier isEqual:saved[@"rowId"]] || ![cell.accessibilityIdentifier isEqual:saved[@"cellId"]] ||
        ![row.accessibilityValue isEqual:saved[@"rowSemantic"]] || ![cell.accessibilityValue isEqual:saved[@"cellSemantic"]])
      return unavailableMembership(@"binding-row-owner-changed");
  }
  return @{@"version": @1, @"status": @"ok", @"scopeIdentity": membership[@"scopeIdentity"],
      @"scope": membership[@"scope"], @"visit": membership[@"visit"], @"dataRevision": membership[@"dataRevision"], @"rows": [bindings copy]};
}

static std::string utf8(NSString *s) { return s ? std::string(s.UTF8String ?: "") : std::string(); }
static BOOL finiteRect(CGRect r) {
  return std::isfinite(r.origin.x) && std::isfinite(r.origin.y) && std::isfinite(r.size.width) &&
      std::isfinite(r.size.height) && r.size.width > 0 && r.size.height > 0;
}
static CGRect exposure(UIView *view, CGRect local, UIWindow *window, CGRect viewport, UIScrollView *resolvingScroll = nil, NSString *__autoreleasing *reason = nullptr, const std::shared_ptr<timing::State> &durations = {}) {
  timing::Span span(durations, timing::Phase::Exposure);
  if (reason) *reason = @"unexposed";
  if (!view || !window || view.window != window || !finiteRect(local)) return CGRectNull;
  CGRect result = [view convertRect:local toView:window];
  UIView *v = view;
  NSUInteger depth = 0;
  while (v && depth++ < 128) {
    if (v.hidden || !std::isfinite(v.alpha) || v.alpha <= 0) { if (reason) *reason = @"hidden-host"; return CGRectNull; }
    if (!CGAffineTransformIsIdentity(v.transform)) { if (reason) *reason = @"unexpected-transform"; return CGRectNull; }
    // Before compensation the old point can be outside the scroll viewport.
    // Keep its intrinsic clipping, but the owning viewport and its ancestors
    // are the obstruction we are about to correct, not evidence of removal.
    if (v == resolvingScroll) return result;
    if (v.clipsToBounds || v == view) result = CGRectIntersection(result, [v convertRect:v.bounds toView:window]);
    if (v == window) return CGRectIntersection(result, viewport);
    v = v.superview;
  }
  return CGRectNull;
}
static CGRect usable(const sr::Viewport &v) {
  return CGRectMake(v.windowX + std::max(0.0, v.insetLeft), v.windowY + std::max(0.0, v.insetTop),
      v.width - std::max(0.0, v.insetLeft) - std::max(0.0, v.insetRight),
      v.height - std::max(0.0, v.insetTop) - std::max(0.0, v.insetBottom));
}
// Only walk the subtree of an explicitly registered semantic host. Nested
// semantic registrations belong to themselves and cannot be stolen by a row.
static UIView *uniqueDescendant(UIView *host, Class klass) {
  NSMutableArray<UIView *> *pending = [NSMutableArray arrayWithObject:host];
  UIView *found = nil;
  NSUInteger visited = 0;
  while (pending.count && visited++ < 512) {
    UIView *v = pending.lastObject;
    [pending removeLastObject];
    if (v != host && objc_getAssociatedObject(v, &RegistrationKey)) continue;
    if ([v isKindOfClass:klass]) { if (found) return nil; found = v; continue; }
    [pending addObjectsFromArray:v.subviews];
  }
  return pending.count ? nil : found;
}
static CGRect imageRect(UIImageView *view) {
  CGSize size = view.image.size;
  CGRect b = view.bounds;
  if (!view.image || size.width <= 0 || size.height <= 0 || !finiteRect(b)) return CGRectNull;
  if (view.contentMode == UIViewContentModeScaleToFill) return b;
  double factor;
  if (view.contentMode == UIViewContentModeScaleAspectFit) factor = std::min(b.size.width / size.width, b.size.height / size.height);
  else if (view.contentMode == UIViewContentModeScaleAspectFill) factor = std::max(b.size.width / size.width, b.size.height / size.height);
  else if (view.contentMode == UIViewContentModeCenter) factor = 1;
  else return CGRectNull;
  CGSize rendered = CGSizeMake(size.width * factor, size.height * factor);
  return CGRectMake(CGRectGetMidX(b) - rendered.width / 2, CGRectGetMidY(b) - rendered.height / 2, rendered.width, rendered.height);
}

struct SavedPoint {
  __weak TlonReadRegistration *registration;
  __weak UIView *nativeView;
  __strong NSDictionary *descriptor;
  __strong NSString *source;
  __strong id paragraphOwner;
  NSRange range{NSNotFound, 0};
  double xFraction{0.5}, yFraction{0.5};
  bool rowEdge{false};
};
struct Candidate { sr::Witness witness; SavedPoint saved; double distance; };
class TlonNativeReadProvider final : public sr::Provider {
  __weak TlonReadRegistry *registry_;
  __weak TlonReadRegistration *scope_;
  __strong NSDictionary *lease_;
  __weak RNSScreenView *screen_;
  bool admitted_{false};
  std::map<std::string, SavedPoint> saved_;
  std::shared_ptr<timing::State> durationState() const {
    TlonReadRegistry *r = registry_;
    auto state = r ? r.durationCounters : std::shared_ptr<timing::State>{};
    if (!state) return {}; // No extra identity work in ordinary runs.
    TlonReadRegistration *s = scope_;
    return s && s == r.activeScope && s == r.durationScope && TlonReadSameVisit(s.descriptor, lease_)
        ? state : std::shared_ptr<timing::State>{};
  }
  NSString *currentRejection(const sr::Mount &mount, bool resolving = false) const {
    TlonReadRegistry *r = registry_; TlonReadRegistration *s = scope_;
    NSDictionary *d = s.descriptor;
    if (!NSThread.isMainThread || !r || !s || s != r.activeScope || s.registry != r) return @"owner-mismatch";
    if (!TlonReadSameVisit(d, lease_)) return @"bad-current-descriptor";
    if (resolving && (!admitted_ || ![d[@"phase"] isEqual:@"read"] || ![d[@"intent"] isEqual:lease_[@"intent"]])) return @"admission-rejected";
    if (r.screen != screen_ || nearestScreen(r.owner) != screen_ || !belongsTo(s.host, r.owner) || !r.owner || !r.owner.window) return @"owner-mismatch";
    if (!r.screen.nativeReadingVisible) return @"invisible-owner";
    if (mount.component != (__bridge const void *)r.owner || mount.scrollView != (__bridge const void *)r.owner.scrollView ||
        mount.window != (__bridge const void *)r.owner.window) return @"mount-mismatch";
    return nil;
  }
  bool current(const sr::Mount &mount, bool resolving = false) const { return !currentRejection(mount, resolving); }
  TlonReadRegistration *row(NSString *key) const {
    TlonReadRegistration *result = nil;
    for (TlonReadRegistration *r in registry_.registrations) {
      if (!r.scope && [r.descriptor[@"kind"] isEqual:@"row"] && [r.descriptor[@"key"] isEqual:key] &&
          TlonReadSameVisit(r.descriptor, scope_.descriptor)) {
        if (result) return nil;
        result = r;
      }
    }
    return result;
  }
  std::optional<Candidate> candidate(TlonReadRegistration *registration, CGRect viewport, int order, NSString *__autoreleasing *reason, NSInteger *textAPIReason, const std::shared_ptr<timing::State> &durations) {
    NSDictionary *d = registration.descriptor;
    UIView *host = registration.host;
    UIWindow *window = registry_.owner.window;
    const BOOL edge = [d[@"kind"] isEqual:@"row"];
    CGRect exposed = exposure(host, host.bounds, window, viewport, nil, reason, durations);
    if (!belongsTo(host, registry_.owner)) { *reason = @"owner-mismatch"; return {}; }
    if (!finiteRect(exposed)) return {};
    SavedPoint saved; saved.registration = registration; saved.descriptor = d; saved.rowEdge = edge;
    CGPoint point = CGPointMake(CGRectGetMidX(exposed), std::clamp(CGRectGetMidY(viewport), CGRectGetMinY(exposed), CGRectGetMaxY(exposed)));
    if ([d[@"kind"] isEqual:@"text"]) {
      auto *paragraph = (RCTParagraphComponentView *)uniqueDescendant(host, RCTParagraphComponentView.class);
      if (!paragraph) { *reason = @"unexpected-paragraph"; return {}; }
      CGPoint local = [paragraph convertPoint:point fromView:window];
      facebook::react::TextReadingPointQuery query;
      TextReadingPointResult measured = timing::query(durations, [&] { return [paragraph readingPointAtPoint:local query:&query]; });
      if (!measured.owner || !measured.sourceText.length) { *textAPIReason = (NSInteger)measured.reason; *reason = @"capture-api-unavailable"; return {}; }
      // Whitespace at the center is not a glyph. One renderer query supplies
      // actual fragments; select an exposed fragment, never guessed line boxes.
      if (measured.status != TextReadingPointStatus::Measured)
        measured = timing::query(durations, [&] { return [paragraph readingPointForRange:NSMakeRange(0, measured.sourceText.length)
            expectedCurrentText:measured.sourceText owner:measured.owner query:&query]; });
      if (measured.status != TextReadingPointStatus::Measured) { *textAPIReason = (NSInteger)measured.reason; *reason = @"capture-api-unavailable"; return {}; }
      double best = INFINITY;
      NSRange range = NSMakeRange(NSNotFound, 0);
      CGRect fragment = CGRectNull;
      // A fragment scan performs no callbacks. After the current TextKit query,
      // inspect the paragraph's ancestor chain once and reuse only its clipping
      // and translation within this scan. Identity transforms are required by
      // exposure; no state is retained across queries, candidates or mounts.
      const bool shareClip = measured.fragments.size() > 1;
      CGRect paragraphClip = CGRectNull;
      CGPoint paragraphOrigin = CGPointZero;
      if (shareClip) {
        paragraphClip = exposure(paragraph, paragraph.bounds, window, viewport, nil, nullptr, durations);
        if (finiteRect(paragraphClip)) paragraphOrigin = [paragraph convertRect:CGRectZero toView:window].origin;
      }
      for (const auto &f : measured.fragments) {
        CGRect shown = shareClip
            ? (finiteRect(f.rect) && finiteRect(paragraphClip)
                ? CGRectIntersection(CGRectOffset(f.rect, paragraphOrigin.x, paragraphOrigin.y), paragraphClip) : CGRectNull)
            : exposure(paragraph, f.rect, window, viewport, nil, nullptr, durations);
        if (!finiteRect(shown)) continue;
        double delta = std::abs(CGRectGetMidY(shown) - CGRectGetMidY(viewport));
        if (delta < best) { best = delta; range = f.characterRange; fragment = f.rect;
          point = CGPointMake(CGRectGetMidX(shown), CGRectGetMidY(shown)); }
      }
      if (range.location == NSNotFound) { *reason = @"no-exposed-glyph"; return {}; }
      auto cluster = timing::query(durations, [&] { return [paragraph readingPointForRange:range expectedCurrentText:measured.sourceText owner:measured.owner query:&query]; });
      if (cluster.status != TextReadingPointStatus::Measured) { *textAPIReason = (NSInteger)cluster.reason; *reason = @"capture-api-unavailable"; return {}; }
      // Save the particular measured fragment's character range. TextKit
      // expands a composed/ligature range; resolving that range must contain it.
      saved.nativeView = paragraph; saved.source = measured.sourceText;
      saved.paragraphOwner = measured.owner; saved.range = cluster.characterRange;
      CGPoint p = [paragraph convertPoint:point fromView:window];
      saved.xFraction = (p.x - fragment.origin.x) / fragment.size.width;
      saved.yFraction = (p.y - fragment.origin.y) / fragment.size.height;
    } else if ([d[@"kind"] isEqual:@"media"]) {
      if (![d[@"mediaReady"] boolValue]) { *reason = @"media-not-ready"; return {}; }
      auto *image = (UIImageView *)uniqueDescendant(host, UIImageView.class);
      CGRect rect = imageRect(image);
      CGRect shown = exposure(image, rect, window, viewport, nil, nullptr, durations);
      if (!finiteRect(shown)) { *reason = @"media-unavailable"; return {}; }
      point = CGPointMake(CGRectGetMidX(shown), std::clamp(CGRectGetMidY(viewport), CGRectGetMinY(shown), CGRectGetMaxY(shown)));
      CGPoint local = [image convertPoint:point fromView:window];
      saved.nativeView = image; saved.xFraction = (local.x - rect.origin.x) / rect.size.width;
      saved.yFraction = (local.y - rect.origin.y) / rect.size.height;
    } else if (edge) {
      saved.nativeView = host;
      // Row fallback preserves its actual nearest exposed point, and is only
      // considered by RN after the interior primary is authoritatively gone.
      CGPoint local = [host convertPoint:point fromView:window];
      saved.yFraction = local.y - CGRectGetMinY(host.bounds);
    } else { *reason = @"unsupported-inner-kind"; return {}; }
    NSString *pointID = edge ? @"row" : [@"block:" stringByAppendingString:d[@"blockId"]];
    std::string identity = utf8([d[@"key"] stringByAppendingFormat:@"/%@", pointID]);
    return Candidate{{utf8(d[@"key"]), identity, sr::Role::Next, order, point.y}, saved,
      std::abs(point.y - CGRectGetMidY(viewport)) + (edge ? 1e9 : 0)};
  }
 public:
  TlonNativeReadProvider(TlonReadRegistry *registry, TlonReadRegistration *scope)
      : registry_(registry), scope_(scope), lease_(scope.descriptor), screen_(registry.screen) {}
  bool admit() override {
    TlonReadRegistry *r = registry_; TlonReadRegistration *s = scope_;
    NSDictionary *d = s.descriptor;
    if (!NSThread.isMainThread || !r || !s || s != r.activeScope || s.registry != r ||
        r.screen != screen_ || nearestScreen(r.owner) != screen_ || !belongsTo(s.host, r.owner) || !r.screen.nativeReadingVisible || !r.owner.window ||
        !TlonReadSameVisit(d, lease_) || ![d[@"phase"] isEqual:@"read"] ||
        r.owner.scrollView.isDragging || r.owner.scrollView.isDecelerating || r.owner.scrollView.isTracking) {
      [r recordAdmission:@"admission-rejected"]; return false;
    }
    lease_ = d; admitted_ = true; [r recordAdmission:@"admitted"]; return true;
  }
  sr::Capture capture(const sr::Mount &mount, const sr::Viewport &v) override {
    auto durations = durationState();
    timing::Span span(durations, timing::Phase::Capture);
    NSMutableDictionary *counts = [@{@"registered": @(registry_.registrations.count), @"rows": @0, @"inners": @0,
        @"candidates": @0, @"measuredRows": @0, @"centralRows": @0} mutableCopy];
    NSMutableDictionary *rejected = [NSMutableDictionary new];
    auto rejectCandidate = [&](NSString *reason) { rejected[reason] = @([rejected[reason] unsignedIntegerValue] + 1); };
    auto finish = [&](NSString *reason) { [registry_ recordCapture:reason counts:counts rejected:rejected]; };
    auto fail = [&](NSString *reason) { finish(reason); return sr::Capture{}; };
    if (NSString *reason = currentRejection(mount)) return fail(reason);
    CGRect viewport = usable(v);
    if (!finiteRect(viewport)) return fail(@"invalid-viewport");
    std::vector<Candidate> candidates;
    std::set<std::string> centerRows, measuredRows;
    NSArray *members = scope_.descriptor[@"rows"];
    // Registry iteration is bounded by actual mounted hosts, not history size.
    for (TlonReadRegistration *r in registry_.registrations) {
      if (r.scope || !TlonReadSameVisit(scope_.descriptor, r.descriptor)) continue;
      NSString *hostReason = @"unexposed";
      CGRect shown = exposure(r.host, r.host.bounds, registry_.owner.window, viewport, nil, &hostReason, durations);
      BOOL isRow = [r.descriptor[@"kind"] isEqual:@"row"];
      NSString *countKey = isRow ? @"rows" : @"inners";
      counts[countKey] = @([counts[countKey] unsignedIntegerValue] + 1);
      if (!finiteRect(shown)) rejectCandidate(hostReason);
      BOOL coversCenter = finiteRect(shown) && CGRectGetMinY(shown) <= CGRectGetMidY(viewport) && CGRectGetMaxY(shown) >= CGRectGetMidY(viewport);
      if (isRow && coversCenter) centerRows.insert(utf8(r.descriptor[@"key"]));
      counts[@"centralRows"] = @(centerRows.size());
      TlonReadRegistration *outer = row(r.descriptor[@"key"]);
      if (!outer || ![TlonReadRow(scope_.descriptor, outer.descriptor[@"key"])[@"revision"] isEqual:outer.descriptor[@"revision"]]) {
        if (coversCenter) return fail(@"central-row-membership");
        continue;
      }
      if (r != outer && !TlonReadInnerMatches(scope_.descriptor, outer.descriptor, r.descriptor)) {
        if (coversCenter) return fail(@"central-inner-membership");
        continue;
      }
      NSUInteger order = [members indexOfObjectPassingTest:^BOOL(NSDictionary *member, NSUInteger, BOOL *) {
        return [member[@"key"] isEqual:r.descriptor[@"key"]];
      }];
      if (order == NSNotFound || order > INT_MAX) continue;
      NSString *candidateReason = @"unexposed";
      NSInteger textAPIReason = -1;
      auto found = candidate(r, viewport, (int)order, &candidateReason, &textAPIReason, durations);
      if (textAPIReason >= 0) counts[@"textAPIReason"] = @(textAPIReason);
      if (found) {
        if (!found->saved.rowEdge) measuredRows.insert(found->witness.rowKey);
        candidates.push_back(std::move(*found));
        counts[@"candidates"] = @(candidates.size()); counts[@"measuredRows"] = @(measuredRows.size());
      } else {
        rejectCandidate(candidateReason);
        if (r != outer && coversCenter) return fail(candidateReason);
      }
      if (candidates.size() > 128) return fail(@"candidate-limit");
    }
    if (candidates.empty()) return fail(@"no-eligible-candidate");
    // Do not silently switch to a neighbor because the central row's actual
    // content is pending, ambiguous or unmeasurable.
    for (const auto &key : centerRows) if (!measuredRows.count(key)) return fail(@"no-eligible-central-block");
    auto primary = std::min_element(candidates.begin(), candidates.end(), [](const auto &a, const auto &b) { return a.distance < b.distance; });
    if (primary->saved.rowEdge) return fail(@"no-interior-primary"); // No generic row primary.
    int primaryOrder = primary->witness.originalOrder;
    std::string primaryID = primary->witness.pointKey;
    std::stable_sort(candidates.begin(), candidates.end(), [](const auto &a, const auto &b) {
      if (a.distance != b.distance) return a.distance < b.distance;
      if (a.witness.originalOrder != b.witness.originalOrder) return a.witness.originalOrder < b.witness.originalOrder;
      return a.witness.pointKey < b.witness.pointKey;
    });
    sr::Capture result; result.available = true; saved_.clear();
    for (auto &c : candidates) {
      c.witness.role = c.witness.pointKey == primaryID ? sr::Role::Primary :
          c.witness.originalOrder == primaryOrder ? sr::Role::SameRow :
          c.witness.originalOrder > primaryOrder ? sr::Role::Next : sr::Role::Previous;
      if (!saved_.emplace(c.witness.pointKey, c.saved).second) return fail(@"duplicate-point");
      result.witnesses.push_back(c.witness);
    }
    finish(@"captured"); return result;
  }
  sr::Point resolve(const sr::Witness &w, const sr::Mount &mount, const sr::Viewport &) override {
    auto durations = durationState();
    auto answer = [&](sr::PointStatus status, double y = 0) { return sr::Point{status, w.rowKey, w.pointKey, y}; };
    if (!current(mount, true)) return answer(sr::PointStatus::Unavailable);
    auto i = saved_.find(w.pointKey);
    if (i == saved_.end()) return answer(sr::PointStatus::Unavailable);
    SavedPoint &saved = i->second;
    NSDictionary *scope = scope_.descriptor;
    NSString *key = saved.descriptor[@"key"];
    TlonReadRegistration *outer = row(key);
    TlonReadRegistration *registration = saved.registration;
    auto identity = TlonReadResolveIdentity(scope, outer.descriptor, registration.descriptor, saved.descriptor);
    if (identity == TlonReadIdentityRemoved) return answer(sr::PointStatus::Removed);
    if (identity != TlonReadIdentityCurrent || !registration || registration.registry != registry_ ||
        !registration.host.window || !belongsTo(registration.host, registry_.owner) || (saved.rowEdge && registration != outer)) return answer(sr::PointStatus::Unavailable);
    UIView *native = saved.nativeView;
    UIWindow *window = registry_.owner.window;
    CGPoint point;
    if (saved.rowEdge) {
      if (native != registration.host || saved.yFraction > native.bounds.size.height) return answer(sr::PointStatus::Unavailable);
      point = CGPointMake(CGRectGetMidX(native.bounds), CGRectGetMinY(native.bounds) + saved.yFraction);
    } else if ([saved.descriptor[@"kind"] isEqual:@"text"]) {
      if (native != uniqueDescendant(registration.host, RCTParagraphComponentView.class)) return answer(sr::PointStatus::Unavailable);
      auto *paragraph = (RCTParagraphComponentView *)native;
      auto probe = timing::query(durations, [&] { return [paragraph readingPointAtPoint:CGPointMake(CGRectGetMidX(paragraph.bounds), CGRectGetMidY(paragraph.bounds))]; });
      if (probe.owner != saved.paragraphOwner || !probe.sourceText) return answer(sr::PointStatus::Unavailable);
      TlonReadTextMap mapped = TlonReadMapText(saved.source, saved.range, probe.sourceText);
      if (mapped.status == TlonReadTextMapRemoved) return answer(sr::PointStatus::Removed);
      if (mapped.status != TlonReadTextMapMeasured) return answer(sr::PointStatus::Unavailable);
      auto measured = timing::query(durations, [&] { return [paragraph readingPointForRange:mapped.range expectedCurrentText:probe.sourceText owner:saved.paragraphOwner]; });
      if (measured.status != TextReadingPointStatus::Measured || measured.fragments.size() != 1) return answer(sr::PointStatus::Unavailable);
      CGRect rect = measured.fragments.front().rect;
      point = CGPointMake(rect.origin.x + rect.size.width * saved.xFraction, rect.origin.y + rect.size.height * saved.yFraction);
    } else {
      if (native != uniqueDescendant(registration.host, UIImageView.class) || ![registration.descriptor[@"mediaReady"] boolValue])
        return answer(sr::PointStatus::Unavailable);
      CGRect rect = imageRect((UIImageView *)native);
      if (!finiteRect(rect)) return answer(sr::PointStatus::Unavailable);
      point = CGPointMake(rect.origin.x + rect.size.width * saved.xFraction, rect.origin.y + rect.size.height * saved.yFraction);
    }
    CGPoint windowPoint = [native convertPoint:point toView:window];
    // Resolve may legitimately be outside the viewport before compensation.
    // Require native ancestor visibility/clipping, but not the old viewport
    // intersection: RN will calculate and clamp the single corrective write.
    CGRect nativeShown = exposure(native, native.bounds, window, CGRectInfinite, registry_.owner.scrollView, nullptr, durations);
    if (!finiteRect(nativeShown) || !CGRectContainsPoint(nativeShown, windowPoint) || !std::isfinite(windowPoint.y))
      return answer(sr::PointStatus::Unavailable);
    return answer(sr::PointStatus::Measured, windowPoint.y);
  }
};

@implementation TlonReadRegistry
- (void)recordCapture:(NSString *)reason counts:(NSDictionary *)counts rejected:(NSDictionary *)rejected {
  ++_captureAttempts;
  _lastCapture = @{@"reason": reason, @"counts": [counts copy], @"rejected": [rejected copy]};
}
- (void)recordAdmission:(NSString *)reason { ++_admissionAttempts; _lastAdmission = @{@"reason": reason}; }
// Session metadata is diagnostic only; it is deliberately absent from every
// READ admission, intent and membership comparison below.
- (void)updateDurationsForScope:(TlonReadRegistration *)scope {
  id value = scope.descriptor[@"diagnosticTimingSession"];
  NSString *session = [value isKindOfClass:NSString.class] ? value : nil;
  if (session.length < 1 || session.length > 128) session = nil;
  for (NSUInteger i = 0; i < session.length; ++i) {
    unichar c = [session characterAtIndex:i];
    if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ||
        c == '.' || c == '_' || c == ':' || c == '-')) { session = nil; break; }
  }
  if (!session && !_durationCounters) return;
  if (session && scope == _durationScope && [scope.descriptor[@"scope"] isEqual:_durationScopeID] &&
      [scope.descriptor[@"visit"] isEqual:_durationVisitID] && [session isEqual:_durationSession]) return;
  if (_durationCounters) _durationCounters->enabled = false;
  _durationCounters.reset();
  _durationScope = nil; _durationScopeID = nil; _durationVisitID = nil; _durationSession = nil;
  if (!session) return;
  _durationScope = scope; _durationScopeID = [scope.descriptor[@"scope"] copy];
  _durationVisitID = [scope.descriptor[@"visit"] copy]; _durationSession = [session copy];
  _durationCounters = std::make_shared<timing::State>([] { return CACurrentMediaTime() * 1000.0; });
}
- (NSDictionary *)providerDiagnostic {
  NSDictionary *base = @{@"version": @1, @"captureAttempts": @(_captureAttempts), @"admissionAttempts": @(_admissionAttempts),
    @"capture": _lastCapture ?: @{@"reason": @"not-attempted"},
    @"admission": _lastAdmission ?: @{@"reason": @"not-attempted"},
    @"registration": @{@"reason": _registrationReason ?: @"not-attempted"}};
  if (!_durationCounters) return base;
  NSMutableDictionary *phases = [NSMutableDictionary new];
  NSArray *names = @[@"capture", @"query", @"exposure"];
  for (NSUInteger i = 0; i < names.count; ++i) {
    const auto &s = _durationCounters->phases[i];
    phases[names[i]] = @{@"count": @(s.count), @"totalMs": @(s.totalMs), @"maxMs": @(s.maxMs),
        @"lastStartedAtMs": @(s.lastStartedAtMs), @"lastFinishedAtMs": @(s.lastFinishedAtMs),
        @"maxStartedAtMs": @(s.maxStartedAtMs), @"maxFinishedAtMs": @(s.maxFinishedAtMs)};
  }
  NSMutableDictionary *result = [base mutableCopy];
  result[@"durations"] = @{@"version": @1, @"session": _durationSession,
      @"clock": @"CACurrentMediaTime milliseconds", @"nested": @YES,
      @"valid": @(_durationCounters->valid), @"activeSpans": @(_durationCounters->activeSpans), @"phases": [phases copy]};
  return [result copy];
}
- (instancetype)init { if ((self = [super init])) _registrations = [NSHashTable weakObjectsHashTable]; return self; }
- (void)retire { [_owner invalidateReadPointLease]; }
- (void)update:(BOOL)mayBegin {
  TlonReadRegistration *scope = nil;
  for (TlonReadRegistration *r in _registrations) if (r.scope && r.host.window) {
    if (scope) { _registrationReason = @"multiple-scopes"; [self retire]; _activeScope = nil; [self updateDurationsForScope:nil]; [_owner setReadPointProviderFactory:{}]; _factoryScope = nil; return; }
    scope = r;
  }
  if (scope != _activeScope) { [self retire]; _leaseDescriptor = nil; }
  _activeScope = scope;
  [self updateDurationsForScope:scope];
  RNSScreenView *screen = nearestScreen(_owner);
  if (screen != _screen) { [_screen removeNativeReadingLifecycleListener:self]; [self retire]; _screen = screen;
    [_screen addNativeReadingLifecycleListener:self]; }
  NSDictionary *d = scope.descriptor;
  if (!scope) { _registrationReason = @"no-attached-scope"; [_owner setReadPointProviderFactory:{}]; _factoryScope = nil; _factoryDescriptor = nil; return; }
  if (d && (scope != _factoryScope || !TlonReadSameVisit(d, _factoryDescriptor))) {
    [self retire]; _factoryScope = scope; _factoryDescriptor = d;
    __weak TlonReadRegistry *registry = self;
    __weak TlonReadRegistration *physicalScope = scope;
    NSDictionary *visit = d;
    [_owner setReadPointProviderFactory:[registry, physicalScope, visit]() -> std::shared_ptr<sr::Provider> {
      TlonReadRegistry *r = registry; TlonReadRegistration *s = physicalScope;
      if (!r || !s || s != r.activeScope || !TlonReadSameVisit(s.descriptor, visit)) return {};
      return std::make_shared<TlonNativeReadProvider>(r, s);
    }];
  }
  NSString *phase = d[@"phase"];
  if ([phase isEqual:@"follow"] && _owner.window && _screen.nativeReadingVisible &&
      scope.registry == self && scope.host.window == _owner.window && belongsTo(scope.host, _owner)) {
    // This ticket survives command/gesture/cover retirement. Data-only
    // publication cannot rearm FOLLOW; only a fresh completed intent can.
    BOOL changed = scope != _followScope || !TlonReadSameVisit(_followDescriptor, d) ||
        ![_followDescriptor[@"intent"] isEqual:d[@"intent"]];
    _lastPhase = phase;
    _registrationReason = @"no-fresh-follow-admission";
    if (changed && mayBegin && !_gesture && !_owner.scrollView.isDragging &&
        !_owner.scrollView.isDecelerating && !_owner.scrollView.isTracking) {
      __weak TlonReadRegistry *registry = self;
      __weak TlonReadRegistration *physicalScope = scope;
      __weak RCTScrollViewComponentView *physicalOwner = _owner;
      __weak UIView *window = _owner.window;
      __weak RNSScreenView *screen = _screen;
      NSDictionary *admission = d;
      [_owner beginFollowEndLease:d[@"intent"] isCurrent:[registry, physicalScope, physicalOwner, window, screen, admission]() {
        TlonReadRegistry *r = registry; TlonReadRegistration *s = physicalScope;
        RCTScrollViewComponentView *owner = physicalOwner; UIView *w = window; RNSScreenView *sc = screen;
        return r && s && owner && w && sc && r.owner == owner && r.activeScope == s && s.registry == r &&
            r.screen == sc && nearestScreen(owner) == sc && sc.nativeReadingVisible &&
            owner.window == w && s.host.window == w && belongsTo(s.host, owner) &&
            TlonReadSameVisit(s.descriptor, admission) && [s.descriptor[@"intent"] isEqual:admission[@"intent"]] &&
            [s.descriptor[@"phase"] isEqual:@"follow"] && !r.gesture &&
            !owner.scrollView.isDragging && !owner.scrollView.isDecelerating && !owner.scrollView.isTracking;
      }];
      _followDescriptor = d; _followScope = scope;
      _registrationReason = @"follow-admission-requested";
    }
    return;
  }
  if (!d || !_owner.window || !_screen.nativeReadingVisible || ![phase isEqual:@"read"]) {
    _registrationReason = !d ? @"bad-current-descriptor" : !_owner.window ? @"owner-unavailable" :
        !_screen.nativeReadingVisible ? @"invisible-owner" : @"non-read-phase";
    // Repeated non-READ data publication must not retire the resident candidate
    // prepared earlier in this same mount. Actual phase/lifecycle changes do.
    if (!d || ![_lastPhase isEqual:phase] || !_owner.window || !_screen.nativeReadingVisible) [self retire];
    _lastPhase = phase; return;
  }
  _lastPhase = phase;
  BOOL changed = !TlonReadSameVisit(_leaseDescriptor, d) || ![_leaseDescriptor[@"intent"] isEqual:d[@"intent"]];
  _registrationReason = @"no-fresh-admission";
  if (changed && mayBegin && !_owner.scrollView.isDragging && !_owner.scrollView.isDecelerating && !_owner.scrollView.isTracking) {
    _registrationReason = @"admission-requested";
    [_owner beginReadPointLeaseFromResident:d[@"intent"]];
    _leaseDescriptor = d;
  }
}
- (void)screen:(RNSScreenView *)screen readingVisibilityDidChange:(BOOL)visible {
  if (screen != _screen) return;
  [self retire];
  if (visible) { _leaseDescriptor = nil; [self update:YES]; }
}
- (void)scrollViewWillBeginDragging:(UIScrollView *)scrollView {
  if (scrollView != _owner.scrollView) return;
  _gesture = YES; [self retire];
}
- (void)finishGesture:(UIScrollView *)scrollView {
  if (scrollView != _owner.scrollView || !_gesture) return;
  _gesture = NO;
  CGFloat end = MAX(-scrollView.adjustedContentInset.top, scrollView.contentSize.height - scrollView.bounds.size.height + scrollView.adjustedContentInset.bottom);
  NSString *phase = _activeScope.descriptor[@"phase"];
  if (end - scrollView.contentOffset.y > 1) {
    if ([phase isEqual:@"read"]) { _leaseDescriptor = nil; [self update:YES]; }
    else if ([phase isEqual:@"follow"]) {
      // Native completion outranks a delayed JS FOLLOW declaration. Retain its
      // rejected ticket so later data or an end gesture cannot revive it.
      _followScope = _activeScope; _followDescriptor = _activeScope.descriptor;
      _registrationReason = @"follow-ended-away";
    }
  }
  // A fresh completed FOLLOW may have arrived while momentum blocked admission.
  // Retry it now; the retained FOLLOW ticket still rejects the canceled intent.
  else if ([phase isEqual:@"follow"]) [self update:YES];
}
- (void)scrollViewDidEndDragging:(UIScrollView *)scrollView willDecelerate:(BOOL)decelerate { if (!decelerate) [self finishGesture:scrollView]; }
- (void)scrollViewDidEndDecelerating:(UIScrollView *)scrollView { [self finishGesture:scrollView]; }
- (void)dealloc { if (_durationCounters) _durationCounters->enabled = false; [_screen removeNativeReadingLifecycleListener:self]; }
@end

@implementation TlonReadRegistration
+ (NSDictionary *)diagnosticForScrollView:(UIScrollView *)scrollView {
  if (!NSThread.isMainThread) return @{@"available": @NO, @"committedMembership": unavailableMembership(@"membership-not-main-thread")};
  RCTScrollViewComponentView *owner = [RCTScrollViewComponentView findScrollViewComponentViewForView:scrollView];
  if (!owner) return @{@"available": @NO, @"committedMembership": unavailableMembership(@"membership-owner-unavailable")};
  NSMutableDictionary *result = [[owner readPointDiagnostic] mutableCopy];
  TlonReadRegistry *registry = objc_getAssociatedObject(owner, &RegistryKey);
  result[@"provider"] = registry ? [registry providerDiagnostic] : @{@"version": @1, @"reason": @"not-registered"};
  result[@"committedMembership"] = committedMembership(owner, scrollView, registry);
  return [result copy];
}

+ (NSString *)diagnosticIdentityForView:(UIView *)view {
  NSAssert(NSThread.isMainThread, @"Native diagnostic identity must be read on main");
  return membershipLifetimeIdentity(view);
}
+ (NSDictionary *)diagnosticForScrollView:(UIScrollView *)scrollView
                           measuredRows:(NSDictionary<NSString *, NSArray<UIView *> *> *)rows
                           indexedCells:(NSDictionary<NSString *, NSArray<UIView *> *> *)cells {
  NSMutableDictionary *result = [[self diagnosticForScrollView:scrollView] mutableCopy];
  if (!NSThread.isMainThread) {
    result[@"rowBindings"] = unavailableMembership(@"binding-not-main-thread");
    return [result copy];
  }
  RCTScrollViewComponentView *owner = [RCTScrollViewComponentView findScrollViewComponentViewForView:scrollView];
  TlonReadRegistry *registry = owner ? objc_getAssociatedObject(owner, &RegistryKey) : nil;
  result[@"rowBindings"] = measuredRowBindings(owner, scrollView, registry, result[@"committedMembership"], rows, cells);
  return [result copy];
}

- (instancetype)initWithHost:(UIView *)host scope:(BOOL)scope {
  if ((self = [super init])) { _host = host; _scope = scope;
    objc_setAssociatedObject(host, &RegistrationKey, self, OBJC_ASSOCIATION_ASSIGN); }
  return self;
}
- (void)publishDescriptor:(NSString *)descriptor {
  NSAssert(NSThread.isMainThread, @"READ metadata must commit on main");
  NSDictionary *previous = _descriptor;
  _descriptor = TlonReadParseDescriptor(descriptor, _scope);
  [self refreshAttachment];
  BOOL changed = !TlonReadSameVisit(previous, _descriptor) || ![previous[@"intent"] isEqual:_descriptor[@"intent"]] ||
      ![previous[@"phase"] isEqual:_descriptor[@"phase"]];
  [_registry update:_scope && changed];
}
- (void)refreshAttachment {
  RCTScrollViewComponentView *owner = _host.window ? [RCTScrollViewComponentView findScrollViewComponentViewForView:_host] : nil;
  if (_registry.owner == owner && owner) return;
  [self detach];
  if (!owner) return;
  TlonReadRegistry *registry = objc_getAssociatedObject(owner, &RegistryKey);
  if (!registry) { registry = [TlonReadRegistry new]; registry.owner = owner;
    objc_setAssociatedObject(owner, &RegistryKey, registry, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    [owner.scrollViewDelegateSplitter addDelegate:registry]; }
  _registry = registry; [registry.registrations addObject:self]; [registry update:_scope];
}
- (void)detach {
  TlonReadRegistry *registry = _registry;
  if (_scope && registry.activeScope == self) [registry retire];
  [registry.registrations removeObject:self]; _registry = nil;
  [registry update:NO];
}
- (void)dealloc { [self detach]; objc_setAssociatedObject(_host, &RegistrationKey, nil, OBJC_ASSOCIATION_ASSIGN); }
@end
