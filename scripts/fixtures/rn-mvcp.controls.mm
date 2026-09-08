// Acceptance: only the current enabled mounting preparation may adjust its
// actual direct child, at most once. Disabled/empty/recycled/retired ownership
// must not reuse a previous frame; uninterrupted relative adjustment is retained.
// The geometry constants reproduce the bounded R7 failure class, not its writer.
// R7 raw SHA256: fd6e438f80ca15d9fc05b8c14900e414845663527677f1e80bdb7a3900d87f03
// Original RN source SHA256: 0de50a36e0888bc04afc5b8866f7c98636259eef627298b11a267ccaa6e1b569
// Prior-frame bias 10001469 is inferred from the observed offset delta; it was
// not directly captured. Native mounting, UIKit, and painted frames are unproved.
// The runner extracts both actual installed RN method bodies without rewriting.

#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#include <cmath>
#include <memory>
#include <optional>
#include <cstdio>

// Only UIKit property/mount plumbing is modeled. The included RN method
// bodies and Objective-C weak-owner/nil-message behavior execute unchanged.
struct MVCP { int minIndexForVisible = 0; std::optional<int> autoscrollToTopThreshold; };
struct ScrollViewProps { std::optional<MVCP> maintainVisibleContentPosition; };
struct ReactNativeFeatureFlags { static bool culling; static bool enableViewCulling() { return culling; } };
bool ReactNativeFeatureFlags::culling = true;
@interface UIView : NSObject
@property CGRect frame;
@property NSInteger tag;
@property(nonatomic, strong) NSArray<UIView *> *subviews;
@property(weak) UIView *superview;
@end
@implementation UIView
@synthesize subviews = _subviews;
- (void)setSubviews:(NSArray<UIView *> *)views {
  for (UIView *v in _subviews) if(v.superview == self) v.superview = nil;
  _subviews = [views copy];
  for (UIView *v in _subviews) v.superview = self;
}
@end
@interface ModelScroll : UIView
@property CGSize contentSize;
@property CGPoint contentOffset;
@end
@implementation ModelScroll @end
@interface Harness : UIView {
@public
  ModelScroll *_scrollView;
  UIView *_contentView;
  std::shared_ptr<ScrollViewProps> _props;
  BOOL _avoidAdjustmentForMaintainVisibleContentPosition;
  __weak UIView *_firstVisibleView;
  __weak UIView *_preparedMVCPContentView;
  NSUInteger _mvcpPreparationRevision;
  NSInteger _firstVisibleViewTag;
  CGRect _prevFirstVisibleFrame;
  NSInteger dispatches;
}
@property(copy) void (^onForce)(void);
- (void)_prepareForMaintainVisibleScrollPosition;
- (void)_adjustForMaintainVisibleContentPosition;
- (void)_forceDispatchNextScrollEvent;
- (void)scrollToOffset:(CGPoint)offset animated:(BOOL)animated;
@end
@implementation Harness
- (instancetype)init {
  if ((self = [super init])) {
    self.frame = CGRectMake(0,203,402,671);
    _scrollView = [ModelScroll new]; _scrollView.contentSize = CGSizeMake(402,11562.3330078125);
    _scrollView.contentOffset = CGPointMake(0,10989.333333333334);
    _contentView = [UIView new]; _contentView.subviews = @[];
    _props = std::make_shared<ScrollViewProps>();
  }
  return self;
}
- (void)_forceDispatchNextScrollEvent { dispatches++; void (^callback)(void)=self.onForce; self.onForce=nil; if(callback) callback(); }
- (void)scrollToOffset:(CGPoint)offset animated:(BOOL)animated { _scrollView.contentOffset = offset; }
#ifndef METHOD_FILE
#define METHOD_FILE "actual-methods.inc"
#endif
#include METHOD_FILE
@end
static UIView *view(CGFloat y, CGFloat height=0) { UIView *v=[UIView new]; v.frame=CGRectMake(0,y,0,height); v.tag=41; return v; }
static void enabled(Harness *h, bool yes) { h->_props->maintainVisibleContentPosition = yes ? std::optional<MVCP>(MVCP{}) : std::nullopt; }
static double y(Harness *h) { return h->_scrollView.contentOffset.y; }
static NSMutableArray *records;
static int failures=0;
static void check(NSString *name, Harness *h, double expected, NSString *boundary) {
  bool pass=std::isfinite(y(h)) && std::abs(y(h)-expected)<0.00001;
  if(!pass) failures++;
  [records addObject:@{@"name":name,@"pass":@(pass),@"actualOffset":@(y(h)),@"expectedOffset":@(expected),@"dispatches":@(h->dispatches),@"boundary":boundary}];
}
int main() { @autoreleasepool {
  records=[NSMutableArray new];
  { Harness *h=[Harness new]; enabled(h,true); UIView *v=view(10001469); h->_contentView.subviews=@[v];
    [h _prepareForMaintainVisibleScrollPosition]; v.frame=CGRectOffset(v.frame,0,24); [h _adjustForMaintainVisibleContentPosition];
    check(@"continuously-enabled actual relative adjustment",h,11013.333333333334,@"same current anchor changes24 points"); }
  { Harness *h=[Harness new]; enabled(h,false); [h _prepareForMaintainVisibleScrollPosition]; enabled(h,true); h->_contentView.subviews=@[view(10000000)]; [h _adjustForMaintainVisibleContentPosition];
    check(@"first enable without old anchor does not move",h,10989.333333333334,@"old props disabled/new props enabled"); }
  { Harness *h=[Harness new]; enabled(h,true); UIView *v=view(10001469); h->_contentView.subviews=@[v]; [h _prepareForMaintainVisibleScrollPosition];
    enabled(h,false); [h _prepareForMaintainVisibleScrollPosition]; v.frame=CGRectOffset(v.frame,0,24); [h _adjustForMaintainVisibleContentPosition];
    check(@"remaining disabled ignores old anchor",h,10989.333333333334,@"old and new props disabled"); }
  { Harness *h=[Harness new]; enabled(h,true); UIView *v=view(10001469); h->_contentView.subviews=@[v]; [h _prepareForMaintainVisibleScrollPosition];
    enabled(h,false); [h _prepareForMaintainVisibleScrollPosition]; v.frame=CGRectOffset(v.frame,0,24); enabled(h,true); [h _adjustForMaintainVisibleContentPosition];
    check(@"disabled prepare cannot reuse older retained frame",h,10989.333333333334,@"same host survives but no current enabled prepare"); }
  for(bool culling:{true,false}) { @autoreleasepool {
    ReactNativeFeatureFlags::culling=culling; Harness *h=[Harness new]; enabled(h,true);
    @autoreleasepool { UIView *v=view(10001469); h->_contentView.subviews=@[v]; [h _prepareForMaintainVisibleScrollPosition]; }
    enabled(h,false); [h _prepareForMaintainVisibleScrollPosition]; h->_contentView.subviews=@[];
    if(h->_firstVisibleView!=nil) { fprintf(stderr,"weak owner unexpectedly retained\n"); return 2; }
    enabled(h,true); h->_contentView.subviews=@[view(10001469)]; [h _adjustForMaintainVisibleContentPosition];
    check(culling?@"reenable after retired anchor with culling":@"reenable after retired anchor without culling",h,10989.333333333334,@"retired weak owner; nil frame must not be zero-origin geometry");
  }}
  { ReactNativeFeatureFlags::culling=true; Harness *h=[Harness new]; enabled(h,true); UIView *v=view(10001469); h->_contentView.subviews=@[v]; [h _prepareForMaintainVisibleScrollPosition];
    v.tag=42; v.frame=CGRectZero; [h _adjustForMaintainVisibleContentPosition];
    check(@"existing changed-tag culling guard",h,10989.333333333334,@"physical object retained with changed tag"); }
  { Harness *h=[Harness new]; enabled(h,true); @autoreleasepool {UIView *v=view(10001469);h->_contentView.subviews=@[v];[h _prepareForMaintainVisibleScrollPosition];}
    h->_contentView.subviews=@[]; [h _adjustForMaintainVisibleContentPosition];
    check(@"current prepared anchor removed cannot cause unbounded correction",h,10989.333333333334,@"same enabled transaction; weak owner retired before adjust"); }
  { Harness *h=[Harness new]; enabled(h,true); UIView *v=view(10001469); h->_contentView.subviews=@[v]; [h _prepareForMaintainVisibleScrollPosition];
    h->_props->maintainVisibleContentPosition->minIndexForVisible=2;
    v.frame=CGRectOffset(v.frame,0,24); [h _prepareForMaintainVisibleScrollPosition]; [h _adjustForMaintainVisibleContentPosition];
    check(@"no eligible child cannot retain earlier preparation",h,10989.333333333334,@"minIndex exceeds actual child inventory"); }
  { Harness *h=[Harness new]; enabled(h,true); UIView *v=view(10001469); h->_contentView.subviews=@[v]; [h _prepareForMaintainVisibleScrollPosition];
    h->_contentView.subviews=@[]; v.frame=CGRectOffset(v.frame,0,24); [h _adjustForMaintainVisibleContentPosition];
    check(@"detached but strongly retained anchor cannot move",h,10989.333333333334,@"view has no current direct content owner"); }
  { Harness *h=[Harness new]; enabled(h,true); UIView *v=view(10001469); h->_contentView.subviews=@[v]; [h _prepareForMaintainVisibleScrollPosition];
    UIView *oldContent=h->_contentView; h->_contentView=[UIView new]; v.frame=CGRectOffset(v.frame,0,24); [h _adjustForMaintainVisibleContentPosition];
    check(@"replacement content owner cannot reuse old child",h,10989.333333333334,@"old content remains alive with its old direct child"); (void)oldContent; }
  { ReactNativeFeatureFlags::culling=false; Harness *h=[Harness new]; enabled(h,true); UIView *v=view(10001469); h->_contentView.subviews=@[v]; [h _prepareForMaintainVisibleScrollPosition];
    v.tag=42; v.frame=CGRectOffset(v.frame,0,24); [h _adjustForMaintainVisibleContentPosition];
    check(@"recycled tag rejected when view culling disabled",h,10989.333333333334,@"same physical host now different tagged owner"); }
  { Harness *h=[Harness new]; enabled(h,true); UIView *v=view(10001469); h->_contentView.subviews=@[v]; [h _prepareForMaintainVisibleScrollPosition];
    v.frame=CGRectOffset(v.frame,0,24); [h _adjustForMaintainVisibleContentPosition]; [h _adjustForMaintainVisibleContentPosition];
    check(@"duplicate adjust consumes preparation once",h,11013.333333333334,@"same native phase must not apply its delta twice"); }
  { Harness *h=[Harness new]; enabled(h,true); UIView *v=view(10001469); h->_contentView.subviews=@[v]; [h _prepareForMaintainVisibleScrollPosition];
    v.frame=CGRectOffset(v.frame,0,24); __weak Harness *weakH=h; h.onForce=^{[weakH _adjustForMaintainVisibleContentPosition];}; [h _adjustForMaintainVisibleContentPosition];
    check(@"reentrant adjustment cannot reuse in-flight preparation",h,11013.333333333334,@"modeled callback reenters adjust before original offset write"); }
  { Harness *h=[Harness new]; enabled(h,true); UIView *v=view(10001469); h->_contentView.subviews=@[v]; [h _prepareForMaintainVisibleScrollPosition];
    v.frame=CGRectOffset(v.frame,0,24); __weak Harness *weakH=h; h.onForce=^{[weakH _prepareForMaintainVisibleScrollPosition];}; [h _adjustForMaintainVisibleContentPosition];
    check(@"new preparation retires old pending write",h,10989.333333333334,@"modeled callback starts a newer mount preparation");
    v.frame=CGRectOffset(v.frame,0,7); [h _adjustForMaintainVisibleContentPosition];
    check(@"newer preparation remains available after retired outer callback",h,10996.333333333334,@"old callback does not clear newer same-owner preparation"); }
  { Harness *h=[Harness new]; enabled(h,true); UIView *v=view(10000000); h->_contentView.subviews=@[v]; [h _prepareForMaintainVisibleScrollPosition];
    h->_avoidAdjustmentForMaintainVisibleContentPosition=YES; [h _prepareForMaintainVisibleScrollPosition]; h->_avoidAdjustmentForMaintainVisibleContentPosition=NO; v.frame=CGRectOffset(v.frame,0,24); [h _adjustForMaintainVisibleContentPosition];
    check(@"avoid-adjustment skipped prepare also retires old state",h,10989.333333333334,@"independent zero-adjust Legend bias; suppressed preparation"); }
  NSData *json=[NSJSONSerialization dataWithJSONObject:@{@"scope":@"exact installed RN method bodies; modeled UIKit property/mount boundary",@"passed":@(records.count-failures),@"failed":@(failures),@"records":records} options:NSJSONWritingPrettyPrinted error:nil];
  fwrite(json.bytes,1,json.length,stdout);printf("\n");
  return failures?1:0;
}}
