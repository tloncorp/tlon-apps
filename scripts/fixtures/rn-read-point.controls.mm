#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#include "RCTScrollViewReadPointCoordinator.h"
#include <map>
#include <mutex>
#include <cstdio>
#include <stdexcept>
#include <iostream>
#define RCTAssertMainQueue() ((void)0)
#ifndef ABS
#define ABS(x) std::abs(x)
#endif
using namespace facebook::react;
using namespace facebook::react::scroll_read;
namespace facebook::react {
struct MountingTransaction { int surface; int64_t number; int getSurfaceId() const{return surface;} int64_t getNumber()const{return number;} };
struct SurfaceTelemetry {};
struct State { using Shared=std::shared_ptr<const State>; virtual ~State()=default; };
struct ScrollViewShadowNode { struct ConcreteState: State { struct Data {CGPoint contentOffset=CGPointZero; struct {CGPoint origin=CGPointZero;} contentBoundingRect; CGSize size; CGSize getContentSize()const{return size;} } data; const Data&getData()const{return data;} }; };
static CGPoint RCTCGPointFromPoint(CGPoint p){return p;} static CGSize RCTCGSizeFromSize(CGSize s){return s;}
enum class LayoutDirection { LeftToRight, RightToLeft };
#include "ack-type.inc"
struct ScrollEvent { std::optional<NativeReadPointAdjustmentAck> nativeReadPointAdjustmentAck; };
struct RawEvent { std::string type; int eventTarget=1; bool isUnique=false; ScrollEvent event; };
struct EventQueue { mutable std::mutex queueMutex_; mutable std::vector<RawEvent> eventQueue_; void onEnqueue()const{} void enqueueEvent(RawEvent&&)const; };
struct ScrollViewEventEmitter {
  using Metrics=ScrollEvent; mutable EventQueue queue;
  void dispatchEvent(std::string type,std::shared_ptr<ScrollEvent> event)const {queue.enqueueEvent({type,1,false,*event});}
  void dispatchUniqueEvent(std::string type,std::shared_ptr<ScrollEvent> event)const {queue.enqueueEvent({type,1,true,*event});}
  void onScroll(const ScrollEvent&)const;
  void onScrollBeginDrag(const Metrics&)const{} void onMomentumScrollBegin(const Metrics&)const{}
};
#include "event-methods.inc"
}
struct LayoutMetrics { LayoutDirection layoutDirection=LayoutDirection::LeftToRight; };
struct MVCP { int minIndexForVisible=0; std::optional<int> autoscrollToTopThreshold; };
struct ScrollViewProps { std::optional<MVCP> maintainVisibleContentPosition=MVCP{}; bool scrollToOverflowEnabled=false; std::string nativeReadPointAdjustment; };
struct ReactNativeFeatureFlags { static bool enableViewCulling(){return true;} };
struct UIEdgeInsets { CGFloat top,left,bottom,right; };
@class UIWindow;
@interface UIView : NSObject
@property CGRect frame;
@property CGRect bounds;
@property CGAffineTransform transform;
@property CGFloat alpha;
@property BOOL hidden;
@property NSInteger tag;
@property(nonatomic,weak) UIWindow *window;
@property(nonatomic,weak) UIView *superview;
@property(nonatomic,strong) NSArray<UIView*> *subviews;
- (CGRect)convertRect:(CGRect)rect toView:(UIView*)view;
- (void)didMoveToWindow;
@end
@implementation UIView
@synthesize subviews=_subviews;
- (instancetype)init { if((self=[super init])){_transform=CGAffineTransformIdentity;_alpha=1;}return self; }
- (void)setSubviews:(NSArray<UIView*>*)views {for(UIView*v in _subviews)v.superview=nil;_subviews=views;for(UIView*v in views)v.superview=self;}
- (CGRect)convertRect:(CGRect)rect toView:(UIView*)view {
  UIView *current=self;
  while(current&&current!=view){rect=CGRectOffset(rect,current.frame.origin.x-current.bounds.origin.x,current.frame.origin.y-current.bounds.origin.y);current=current.superview;}
  return rect;
}
- (void)didMoveToWindow {}
@end
@interface UIWindow:UIView @end
@implementation UIWindow @end
@interface UIScrollView:UIView
@property(nonatomic) CGPoint contentOffset;
@property CGSize contentSize;
@property UIEdgeInsets contentInset;
@property UIEdgeInsets adjustedContentInset;
@property CGFloat zoomScale;
@property BOOL isTracking;
@property BOOL isDragging;
@property BOOL isDecelerating;
@property int writes;
@property BOOL ignoreOffset;
@property(nonatomic,copy) void (^afterOffset)(void);
- (void)setContentOffset:(CGPoint)offset animated:(BOOL)animated;
- (void)preserveContentOffsetWithBlock:(void (^)())block;
@end
@implementation UIScrollView
@synthesize contentOffset=_contentOffset;
- (void)preserveContentOffsetWithBlock:(void (^)())block {const auto old=self.contentOffset;block();self.contentOffset=old;}
- (void)setContentOffset:(CGPoint)offset {if(self.ignoreOffset)return;_contentOffset=offset;self.bounds=CGRectMake(offset.x,offset.y,self.bounds.size.width,self.bounds.size.height);self.writes++;void(^callback)(void)=self.afterOffset;if(callback)callback();}
- (void)setContentOffset:(CGPoint)offset animated:(BOOL)animated {self.contentOffset=offset;}
@end
@compatibility_alias RCTEnhancedScrollView UIScrollView;
@interface Harness:UIView {
@public
  Coordinator _readPointCoordinator;
  std::shared_ptr<const ScrollViewShadowNode::ConcreteState> _state;
  CGSize _contentSize;
  UIView *_containerView;
  std::function<std::shared_ptr<Provider>()> baselineFactory;
  UIScrollView *_scrollView;
  UIView *_contentView;
  std::shared_ptr<ScrollViewProps> _props;
  std::shared_ptr<ScrollViewEventEmitter> _eventEmitter;
  LayoutMetrics _layoutMetrics;
  BOOL _avoidAdjustmentForMaintainVisibleContentPosition;
  BOOL _isUserTriggeredScrolling;
  __weak UIView *_firstVisibleView;
  __weak UIView *_preparedMVCPContentView;
  CGRect _prevFirstVisibleFrame;
  NSUInteger _mvcpPreparationRevision;
  NSInteger _firstVisibleViewTag;
  int dispatches, remounts, finished;
  std::function<void()> onForce;
}
@property(nonatomic,strong) UIScrollView *scrollView;
@property(readonly) CGSize contentSize;
- (void)beginReadPointLease:(std::shared_ptr<Provider>)provider;
- (void)beginFollowEndLease:(NSString *)intent isCurrent:(std::function<bool()>)isCurrent;
- (void)updateState:(const State::Shared &)state oldState:(const State::Shared &)oldState;
- (void)_preserveContentOffsetIfNeededWithBlock:(void (^)())block;
- (void)setReadPointProviderFactory:(std::function<std::shared_ptr<Provider>()>)factory;
- (void)beginReadPointLeaseFromResident:(NSString *)intent;
- (RelativeSignal)_readPointRelativeSignal;
- (NSDictionary *)readPointDiagnostic;
- (void)invalidateReadPointLease;
- (Mount)_readPointMount:(const MountingTransaction&)transaction;
- (std::optional<Viewport>)_readPointViewport;
- (void)mountingTransactionWillMount:(const MountingTransaction&)transaction withSurfaceTelemetry:(const SurfaceTelemetry&)telemetry;
- (void)mountingTransactionDidMount:(const MountingTransaction&)transaction withSurfaceTelemetry:(const SurfaceTelemetry&)telemetry;
- (void)scrollToOffset:(CGPoint)offset animated:(BOOL)animated;
- (void)_scrollToOffset:(CGPoint)offset animated:(BOOL)animated preservingRead:(BOOL)preserving;
- (void)_scrollTo:(double)x y:(double)y animated:(BOOL)animated preservingRead:(BOOL)preserving;
- (void)scrollTo:(double)x y:(double)y animated:(BOOL)animated;
- (void)scrollToEnd:(BOOL)animated;
- (void)scrollViewWillBeginDragging:(UIScrollView*)scrollView;
- (void)scrollViewWillBeginDecelerating:(UIScrollView*)scrollView;
- (BOOL)scrollViewShouldScrollToTop:(UIScrollView*)scrollView;
- (void)_prepareForMaintainVisibleScrollPosition;
- (void)_adjustForMaintainVisibleContentPosition;
@end
@implementation Harness
- (instancetype)init {if((self=[super init])){_props=std::make_shared<ScrollViewProps>();_eventEmitter=std::make_shared<ScrollViewEventEmitter>();_scrollView=[UIScrollView new];_contentView=[UIView new];_containerView=[UIView new];}return self;}
- (void)_forceDispatchNextScrollEvent {dispatches++;auto callback=onForce;if(callback)callback();}
- (void)_handleFinishedScrolling:(UIScrollView*)scrollView {finished++;}
- (void)_remountChildren {remounts++;}
- (void)_handleScrollEndIfNeeded {}
- (ScrollViewEventEmitter::Metrics)_scrollViewMetrics {return {};}
- (CGSize)contentSize{return _scrollView.contentSize;}
#include "actual-methods.inc"
@end

struct TestProvider:Provider {
  Capture initial{true,{{"111","glyph:25",Role::Primary,11,350}}};
  std::map<std::string,PointStatus> statuses;
  std::map<std::string,double> points{{"111",350},{"112",480},{"113",520},{"110",200},{"109",70}};
  std::vector<std::string> resolved;
  std::vector<std::string> resolvedPoints;
  std::map<std::string,PointStatus> pointStatuses;
  std::map<std::string,double> pointPositions;
  int captures=0, admissions=0;
  bool admissible=true; std::function<void()> beforeAdmit;
  bool admit() { admissions++; auto callback=beforeAdmit; if(callback)callback(); return admissible; }
  std::function<void()> beforeCapture,beforeResolve;
  bool throwCapture=false,throwResolve=false,wrongIdentity=false;
  Capture capture(const Mount&,const Viewport&) override {captures++;auto callback=beforeCapture;if(callback)callback();if(throwCapture)throw std::runtime_error("capture unavailable");return initial;}
  scroll_read::Point resolve(const Witness&w,const Mount&,const Viewport&v) override {
    resolved.push_back(w.rowKey);resolvedPoints.push_back(w.pointKey);auto callback=beforeResolve;if(callback)callback();if(throwResolve)throw std::runtime_error("resolve unavailable");
    const auto status=pointStatuses.count(w.pointKey)?pointStatuses[w.pointKey]:statuses.count(w.rowKey)?statuses[w.rowKey]:PointStatus::Measured;
    return {status,w.rowKey,wrongIdentity?"wrong-point":w.pointKey,(pointPositions.count(w.pointKey)?pointPositions[w.pointKey]:points[w.rowKey])-(v.offsetY-100)};
  }
};
struct Rig {
  __strong UIWindow *window=[UIWindow new];
  __strong Harness *host=[Harness new];
  std::shared_ptr<TestProvider> provider=std::make_shared<TestProvider>();
  int64_t transaction=1;
  Rig(){window.frame=CGRectMake(0,0,400,800);window.bounds=window.frame;window.window=window;
    host.window=window;host.superview=window;host.frame=CGRectMake(0,50,400,500);host.bounds=CGRectMake(0,0,400,500);
    host->_scrollView.window=window;host->_scrollView.superview=host;host->_scrollView.frame=host.bounds;host->_scrollView.bounds=host.bounds;
    host->_scrollView.zoomScale=1;host->_scrollView.contentSize=CGSizeMake(400,2000);
    host->_scrollView.contentInset={20,0,40,0};host->_scrollView.adjustedContentInset={20,0,40,0};
    host->_scrollView.contentOffset=CGPointMake(0,100);host->_scrollView.writes=0;
    UIView*row=[UIView new];row.frame=CGRectMake(0,150,400,100);row.tag=1;host->_contentView.subviews=@[row];
  }
  void content(double height){auto next=std::make_shared<ScrollViewShadowNode::ConcreteState>();next->data.size=CGSizeMake(402,height);State::Shared state=next,old=host->_state;[host updateState:state oldState:old];}
  void follow(NSString*intent=@"F",std::function<bool()>current=[] {return true;}){[host beginFollowEndLease:intent isCurrent:std::move(current)];}
  void followBase(){host->_props->maintainVisibleContentPosition.reset();host.frame=CGRectMake(0,203,402,671);host->_scrollView.frame=CGRectMake(0,0,402,671);host->_scrollView.bounds=CGRectMake(0,0,402,671);host->_scrollView.contentInset={0,0,98,0};host->_scrollView.adjustedContentInset={0,0,98,0};content(11060.333333333334);host->_scrollView.contentOffset=CGPointMake(0,10487.333333333334);host->_scrollView.writes=0;}
  void begin(){[host beginReadPointLease:provider];}
  void resident(){auto p=provider;[host setReadPointProviderFactory:[p]{return p;}];}
  void admit(NSString*intent=@"A"){[host beginReadPointLeaseFromResident:intent];}
  double modeledOldSignalAmount=0;
  NSDictionary *operation=nil;
  bool omitOperation=false;
  uint64_t nextOperation=0;
  NSString *previousSignalIntent=nil;
  double previousSignalAmount=0;
  void signal(NSString*intent,double amount){
#ifdef HAS_TAGGED_READ
    NSMutableDictionary *payload=[@{@"intent":intent,@"amount":@(amount)} mutableCopy];
    if(!omitOperation)payload[@"operation"]=operation?:@{@"id":@(++nextOperation),@"startOffset":@(y()),@"startAmount":@([previousSignalIntent isEqualToString:intent]?previousSignalAmount:0)};
    previousSignalIntent=intent;previousSignalAmount=amount;
    NSData*d=[NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];host->_props->nativeReadPointAdjustment=std::string((const char*)d.bytes,d.length);
#else
    // Native mount delivery of the original actual JS cumulative sentinel.
    // The old native source has no tagged prop; keep its real relative writer.
    UIView*v=host->_contentView.subviews[0];v.frame=CGRectOffset(v.frame,0,amount-modeledOldSignalAmount);modeledOldSignalAmount=amount;
#endif
  }
  void shift(double row,double point){UIView*v=host->_contentView.subviews[0];v.frame=CGRectOffset(v.frame,0,row);provider->points["111"]+=point;}
  void will(){[host mountingTransactionWillMount:MountingTransaction{11,transaction} withSurfaceTelemetry:SurfaceTelemetry{}];}
  void did(){[host mountingTransactionDidMount:MountingTransaction{11,transaction} withSurfaceTelemetry:SurfaceTelemetry{}];}
  void next(){++transaction;}
  double y(){return host->_scrollView.contentOffset.y;}
};
static void check(bool value,const char*message="assertion failed"){if(!value)throw std::runtime_error(message);}
static void near(double actual,double expected){check(std::isfinite(actual)&&std::abs(actual-expected)<0.000001,"wrong native offset");}
static Witness next1{"112","glyph:4",Role::Next,12,480},next2{"113","glyph:7",Role::Next,13,520},previous1{"110","glyph:8",Role::Previous,10,200},previous2{"109","glyph:9",Role::Previous,9,70};
int main(int argc,char**argv){@autoreleasepool {
  NSMutableArray *records=[NSMutableArray new];int failures=0;
  auto test=[&](const char*name,auto body){bool passed=true;std::string error;@autoreleasepool{try{body();}catch(const std::exception&e){passed=false;error=e.what();}}if(!passed)failures++;[records addObject:@{@"name":@(name),@"passed":@(passed),@"error":@(error.c_str())}];};
  test("FOLLOW actual content-size commit reaches end before held JS layout delivery",[]{Rig r;r.followBase();r.follow();r.will();r.content(11112.333333333334);near(r.y(),10487.333333333334);r.did();near(r.y(),10539.333333333334);check(r.provider->captures==0);});
  test("FOLLOW unchanged actual content commit is a no-op",[]{Rig r;r.followBase();r.follow();r.will();r.content(11060.333333333334);r.did();near(r.y(),10487.333333333334);check(r.host->_scrollView.writes==0);});
  test("FOLLOW fractional footer hide and short content use current adjusted range",[]{Rig r;r.followBase();r.follow();r.will();r.content(11008.125);r.did();near(r.y(),10435.125);r.next();r.will();r.content(400);r.did();near(r.y(),0);});
  test("FOLLOW native drag retires lease and old data cannot resume",[]{Rig r;r.followBase();r.follow();r.will();[r.host scrollViewWillBeginDragging:r.host->_scrollView];r.content(11112.333333333334);r.did();near(r.y(),10487.333333333334);r.next();r.will();r.content(11164.333333333334);r.did();near(r.y(),10487.333333333334);});
  test("FOLLOW native command retires lease until fresh completed intent",[]{Rig r;r.followBase();r.follow();r.will();[r.host scrollTo:0 y:500 animated:NO];r.content(11112.333333333334);r.did();near(r.y(),500);[r.host scrollToEnd:NO];r.next();r.follow(@"fresh-completed");r.will();r.content(11164.333333333334);r.did();near(r.y(),10591.333333333334);});
  test("FOLLOW route validator withdrawal cannot revive on same lease",[]{Rig r;r.followBase();auto current=std::make_shared<bool>(true);r.follow(@"F",[current]{return *current;});r.will();*current=false;r.content(11112.333333333334);r.did();near(r.y(),10487.333333333334);*current=true;r.next();r.will();r.did();near(r.y(),10487.333333333334);});
  test("FOLLOW same-mount completion admission uses current transaction",[]{Rig r;r.followBase();r.will();r.content(11112.333333333334);r.follow(@"completed");r.did();near(r.y(),10539.333333333334);});
  test("FOLLOW stale didMount cannot consume current lease",[]{Rig r;r.followBase();r.follow();r.will();r.next();r.will();r.content(11112.333333333334);[r.host mountingTransactionDidMount:MountingTransaction{11,1} withSurfaceTelemetry:SurfaceTelemetry{}];near(r.y(),10487.333333333334);r.did();near(r.y(),10539.333333333334);});
  test("FOLLOW duplicate consume cannot add another write",[]{Rig r;r.followBase();r.follow();r.will();r.content(11112.333333333334);r.did();int writes=r.host->_scrollView.writes;r.did();near(r.y(),10539.333333333334);check(r.host->_scrollView.writes==writes);});
  test("FOLLOW physical owner ABA permanently retires old lease",[]{Rig r;r.followBase();r.follow();r.will();r.host->_scrollView.window=nil;r.content(11112.333333333334);r.did();r.host->_scrollView.window=r.window;r.next();r.will();r.did();near(r.y(),10487.333333333334);});
  test("FOLLOW validator reentrant newer command wins",[]{Rig r;r.followBase();__weak Harness*h=r.host;r.follow(@"F",[h]{[h scrollTo:0 y:300 animated:NO];return true;});r.will();r.content(11112.333333333334);r.did();near(r.y(),300);});
  test("FOLLOW before-write reentrancy cannot clear newer lease",[]{Rig r;r.followBase();r.follow();r.will();r.content(11112.333333333334);__weak Harness*h=r.host;r.host->onForce=[h]{Harness*strong=h;strong->onForce={};[strong beginFollowEndLease:@"new" isCurrent:[]{return true;}];};r.did();near(r.y(),10487.333333333334);r.next();r.will();r.did();near(r.y(),10539.333333333334);});
  test("FOLLOW distinct list cancellation is independent",[]{Rig a,b;a.followBase();b.followBase();a.follow();b.follow();a.will();b.will();[a.host invalidateReadPointLease];a.content(11112.333333333334);b.content(11112.333333333334);a.did();b.did();near(a.y(),10487.333333333334);near(b.y(),10539.333333333334);});
  test("FOLLOW validator failure blocks write without granting READ fallback",[]{Rig r;r.followBase();r.follow(@"F",[]{throw std::runtime_error("unavailable");return true;});r.will();r.content(11112.333333333334);r.did();near(r.y(),10487.333333333334);check(r.provider->captures==0);});
  test("disabled provider preserves actual generic RN relative adjustment",[]{Rig r;r.will();UIView*v=r.host->_contentView.subviews[0];v.frame=CGRectOffset(v.frame,0,24);r.did();near(r.y(),124);check(r.provider->captures==0);});
  test("new public command from native delivery wins over generic autoscroll continuation",[]{Rig r;r.host->_props->maintainVisibleContentPosition->autoscrollToTopThreshold=200;r.will();UIView*v=r.host->_contentView.subviews[0];v.frame=CGRectOffset(v.frame,0,24);r.host->_scrollView.afterOffset=^{r.host->_scrollView.afterOffset=nil;[r.host scrollToOffset:CGPointMake(0,500) animated:NO];};r.did();near(r.y(),500);check(r.host->_scrollView.writes==2);});
  test("public no-op command invalidates previously prepared generic frame",[]{Rig r;r.will();[r.host scrollToOffset:CGPointMake(0,100) animated:NO];UIView*v=r.host->_contentView.subviews[0];v.frame=CGRectOffset(v.frame,0,24);r.did();near(r.y(),100);check(r.host->_scrollView.writes==0);});
  test("generic autoscroll without newer command stays unchanged",[]{Rig r;r.host->_props->maintainVisibleContentPosition->autoscrollToTopThreshold=200;r.will();UIView*v=r.host->_contentView.subviews[0];v.frame=CGRectOffset(v.frame,0,24);r.did();near(r.y(),0);check(r.host->_scrollView.writes==2);});
  test("active point shift writes remaining delta once",[]{Rig r;r.begin();r.will();r.provider->points["111"]-=38;r.did();near(r.y(),62);check(r.host->_scrollView.writes==1);r.did();check(r.host->_scrollView.writes==1);});
  test("duplicate will and did cannot reuse a completed native transaction",[]{Rig r;r.begin();r.will();r.provider->points["111"]+=38;r.did();r.provider->points["111"]+=38;r.will();r.did();near(r.y(),138);check(r.host->_scrollView.writes==1);});
  test("already compensated native point causes no second write",[]{Rig r;r.begin();r.will();r.provider->points["111"]+=30;[r.host _scrollToOffset:CGPointMake(0,130) animated:NO preservingRead:YES];int writes=r.host->_scrollView.writes;r.did();near(r.y(),130);check(r.host->_scrollView.writes==writes);});
  test("partial compensation contributes only remaining displacement",[]{Rig r;r.begin();r.will();r.provider->points["111"]+=80;[r.host _scrollToOffset:CGPointMake(0,130) animated:NO preservingRead:YES];r.did();near(r.y(),180);});
  test("unavailable capture suppresses first-row fallback",[]{Rig r;r.provider->initial.available=false;r.begin();r.will();UIView*v=r.host->_contentView.subviews[0];v.frame=CGRectOffset(v.frame,0,80);r.did();near(r.y(),100);check(r.host->_scrollView.writes==0);});
  test("missing active preparation never falls through default",[]{Rig r;r.will();r.begin();UIView*v=r.host->_contentView.subviews[0];v.frame=CGRectOffset(v.frame,0,80);r.did();near(r.y(),100);});
  test("unavailable resolution keeps original point across later transaction",[]{Rig r;r.begin();r.will();r.provider->statuses["111"]=PointStatus::Unavailable;r.provider->points["111"]-=38;r.did();near(r.y(),100);r.next();r.will();r.provider->statuses["111"]=PointStatus::Measured;r.did();near(r.y(),62);check(r.provider->captures==1);});
  test("confirmed removal persists and does not resurrect shifted primary",[]{Rig r;r.provider->initial.witnesses.push_back(next1);r.begin();r.will();r.provider->statuses["111"]=PointStatus::Removed;r.provider->points["112"]-=38;r.did();near(r.y(),62);r.next();r.will();r.provider->statuses["111"]=PointStatus::Measured;r.provider->points["111"]+=400;r.did();near(r.y(),62);check(std::count(r.provider->resolved.begin(),r.provider->resolved.end(),"111")==1);});
  test("same-row saved fallback precedes neighboring rows",[]{Rig r;r.provider->initial.witnesses.push_back({"111","row-edge",Role::SameRow,11,200});r.provider->initial.witnesses.push_back(next1);r.provider->pointStatuses["glyph:25"]=PointStatus::Removed;r.provider->pointPositions["row-edge"]=162;r.begin();r.will();r.did();near(r.y(),62);check(r.provider->resolvedPoints.back()=="row-edge");});
  test("ambiguous saved fallback order remains unavailable",[]{Rig r;r.provider->initial.witnesses.push_back(next1);auto duplicate=next2;duplicate.originalOrder=next1.originalOrder;r.provider->initial.witnesses.push_back(duplicate);r.begin();r.will();r.provider->points["111"]+=38;r.did();near(r.y(),100);check(r.provider->resolved.empty());});
  test("same-row fallback cannot name a different post",[]{Rig r;r.provider->initial.witnesses.push_back({"112","edge",Role::SameRow,11,480});r.begin();r.will();r.provider->points["111"]+=38;r.did();near(r.y(),100);check(r.provider->resolved.empty());});
  test("unavailable primary cannot be misclassified as removal",[]{Rig r;r.provider->initial.witnesses.push_back(next1);r.provider->statuses["111"]=PointStatus::Unavailable;r.begin();r.will();r.did();check(r.provider->resolved.size()==1);near(r.y(),100);});
  test("saved next chain precedes previous rows",[]{Rig r;r.provider->initial.witnesses.insert(r.provider->initial.witnesses.end(),{previous1,next2,next1});r.provider->statuses["111"]=PointStatus::Removed;r.provider->statuses["112"]=PointStatus::Removed;r.begin();r.will();r.provider->points["113"]-=38;r.did();near(r.y(),62);check(r.provider->resolved.back()=="113");});
  test("nearest saved previous survives removed forward chain",[]{Rig r;r.provider->initial.witnesses.insert(r.provider->initial.witnesses.end(),{previous2,next1,previous1});r.provider->statuses["111"]=PointStatus::Removed;r.provider->statuses["112"]=PointStatus::Removed;r.begin();r.will();r.provider->points["110"]-=38;r.did();near(r.y(),62);check(r.provider->resolved.back()=="110");});
  test("all confirmed removed candidates use actual adjusted-inset clamp",[]{Rig r;r.begin();r.will();r.provider->statuses["111"]=PointStatus::Removed;r.host->_scrollView.contentSize=CGSizeMake(400,400);r.did();near(r.y(),-20);});
  test("actual adjusted bottom inset limits point restoration",[]{Rig r;r.begin();r.will();r.host->_scrollView.contentSize=CGSizeMake(400,600);r.provider->points["111"]+=1000;r.did();near(r.y(),140);});
  test("actual adjusted top inset limits point restoration",[]{Rig r;r.begin();r.will();r.provider->points["111"]-=1000;r.did();near(r.y(),-20);});
  test("wrong did transaction cannot consume newer preparation",[]{Rig r;r.begin();r.will();r.next();r.will();r.provider->points["111"]+=38;[r.host mountingTransactionDidMount:MountingTransaction{11,1} withSurfaceTelemetry:SurfaceTelemetry{}];near(r.y(),100);r.did();near(r.y(),138);});
  test("stale will cannot replace newer preparation",[]{Rig r;r.begin();r.transaction=2;r.will();[r.host mountingTransactionWillMount:MountingTransaction{11,1} withSurfaceTelemetry:SurfaceTelemetry{}];r.provider->points["111"]+=38;r.did();near(r.y(),138);});
  test("public no-op command permanently revokes prepared READ",[]{Rig r;r.begin();r.will();[r.host scrollToOffset:CGPointMake(0,100) animated:NO];r.provider->points["111"]+=38;r.did();near(r.y(),100);check(r.host->_scrollView.writes==0);});
  test("public end command owns position over old READ",[]{Rig r;r.begin();r.will();[r.host scrollToEnd:NO];double end=r.y();r.provider->points["111"]+=38;r.did();near(r.y(),end);});
  test("callback command cannot publish retired first witness",[]{Rig r;r.begin();r.provider->beforeCapture=[&]{[r.host scrollToOffset:CGPointMake(0,500) animated:NO];};r.will();r.provider->beforeCapture={};r.did();near(r.y(),500);});
  test("callback command cannot restore old reading point",[]{Rig r;r.begin();r.will();r.provider->beforeResolve=[&]{[r.host scrollToOffset:CGPointMake(0,500) animated:NO];};r.did();near(r.y(),500);check(r.host->_scrollView.writes==1);});
  test("same-provider visit ABA cannot inherit old saved point",[]{Rig r;r.begin();r.will();r.provider->beforeResolve=[&]{[r.host invalidateReadPointLease];r.begin();};r.did();near(r.y(),100);r.provider->beforeResolve={};r.provider->initial.witnesses[0].savedWindowY=450;r.provider->points["111"]=450;r.next();r.will();r.did();near(r.y(),100);check(r.provider->captures==2);});
  test("reentrant prepare retains newer transaction",[]{Rig r;r.begin();r.will();r.provider->beforeResolve=[&]{r.provider->beforeResolve={};r.next();r.will();};r.did();near(r.y(),100);r.provider->points["111"]+=38;r.did();near(r.y(),138);});
  test("explicit covered-visit revocation suppresses pending READ",[]{Rig r;r.begin();r.will();[r.host invalidateReadPointLease];r.provider->points["111"]+=38;r.did();near(r.y(),100);});
  test("native drag revokes before optional event emitter",[]{Rig r;r.begin();r.will();[r.host scrollViewWillBeginDragging:r.host->_scrollView];r.provider->points["111"]+=38;r.did();near(r.y(),100);});
  test("native momentum revokes an old stationary witness",[]{Rig r;r.begin();r.will();[r.host scrollViewWillBeginDecelerating:r.host->_scrollView];r.provider->points["111"]+=38;r.did();near(r.y(),100);});
  test("native status-bar scroll-to-top revokes READ",[]{Rig r;r.begin();r.will();[r.host scrollViewShouldScrollToTop:r.host->_scrollView];r.provider->points["111"]+=38;r.did();near(r.y(),100);});
  test("window detach and same-window return cannot revive lease",[]{Rig r;r.begin();r.will();r.host.window=nil;[r.host didMoveToWindow];r.host.window=r.window;[r.host didMoveToWindow];r.provider->points["111"]+=38;r.did();near(r.y(),100);});
  test("native scroll-object ABA revokes despite returning original pointer",[]{Rig r;r.begin();r.will();UIScrollView*old=r.host.scrollView;r.host.scrollView=[UIScrollView new];r.host.scrollView=old;r.provider->points["111"]+=38;r.did();near(r.y(),100);});
  test("owner recheck after existing force-dispatch blocks old write",[]{Rig r;r.begin();r.will();r.provider->points["111"]+=38;r.host->onForce=[&]{r.host->onForce={};[r.host scrollToOffset:CGPointMake(0,500) animated:NO];};r.did();near(r.y(),500);check(r.host->_scrollView.writes==1);});
  test("capture viewport mutation is unavailable and can acquire fresh later",[]{Rig r;r.begin();r.provider->beforeCapture=[&]{r.host->_scrollView.bounds=CGRectMake(0,100,400,400);};r.will();r.provider->beforeCapture={};r.did();near(r.y(),100);r.next();r.will();r.provider->points["111"]+=38;r.did();near(r.y(),138);check(r.provider->captures==2);});
  test("resolve viewport mutation cannot use stale offset or bounds",[]{Rig r;r.begin();r.will();r.provider->beforeResolve=[&]{r.host->_scrollView.contentOffset=CGPointMake(0,150);};r.did();near(r.y(),150);check(r.host->_scrollView.writes==1);});
  test("nonfinite point remains unavailable",[]{Rig r;r.begin();r.will();r.provider->points["111"]=NAN;r.did();near(r.y(),100);});
  test("a saved point outside actual native viewport is unavailable",[]{Rig r;r.provider->initial.witnesses[0].savedWindowY=900;r.begin();r.will();r.did();near(r.y(),100);check(r.provider->resolved.empty());});
  test("nonfinite initial witness is not published",[]{Rig r;r.provider->initial.witnesses[0].savedWindowY=INFINITY;r.begin();r.will();r.did();near(r.y(),100);});
  test("nonfinite actual native viewport cannot authorize adjustment",[]{Rig r;r.begin();r.will();r.host->_scrollView.contentSize=CGSizeMake(400,INFINITY);r.did();near(r.y(),100);});
  test("hidden native ancestry leaves READ unavailable",[]{Rig r;r.begin();r.will();r.host.hidden=YES;r.provider->points["111"]+=38;r.did();near(r.y(),100);});
  test("provider exceptions never enable generic fallback",[]{Rig r;r.provider->throwCapture=true;r.begin();r.will();UIView*v=r.host->_contentView.subviews[0];v.frame=CGRectOffset(v.frame,0,38);r.did();near(r.y(),100);});
  test("persistent saved witness is independent of producer array mutation",[]{Rig r;r.begin();r.will();r.provider->initial.witnesses[0].savedWindowY+=1000;r.provider->points["111"]+=38;r.did();near(r.y(),138);});

  test("resident candidate alone preserves selected legacy writer",[]{Rig r;r.resident();r.will();r.shift(24,38);r.did();near(r.y(),124);check(r.provider->captures==1&&r.provider->admissions==0);});
  test("same-mount admission restores pre-mutation point not sentinel delta",[]{Rig r;r.resident();r.will();r.shift(24,38);r.admit();r.did();near(r.y(),138);check(r.provider->captures==1&&r.provider->admissions==1&&r.host->_scrollView.writes==1);});
  test("first late factory registration preserves current legacy transaction",[]{Rig r;r.will();r.shift(24,38);r.resident();r.admit();r.did();near(r.y(),124);check(r.provider->captures==0);});
  test("pending admission captures fresh before next mutation",[]{Rig r;r.will();r.resident();r.admit();r.did();r.next();r.will();r.shift(24,38);r.did();near(r.y(),138);check(r.provider->captures==1&&r.provider->admissions==1);});
  test("unavailable provisional capture does not suppress legacy",[]{Rig r;r.resident();r.provider->initial.available=false;r.will();r.shift(24,38);r.admit();r.did();near(r.y(),124);check(r.provider->admissions==0);});
  test("rejected admission does not suppress selected legacy",[]{Rig r;r.resident();r.provider->admissible=false;r.will();r.shift(24,38);r.admit();r.did();near(r.y(),124);check(r.provider->admissions==1);});
  test("admitted unavailable resolve remains exclusive",[]{Rig r;r.resident();r.will();r.admit();r.provider->statuses["111"]=PointStatus::Unavailable;r.shift(24,38);r.did();near(r.y(),100);check(r.host->_scrollView.writes==0);});
  test("active resident witness persists across data-only transactions",[]{Rig r;r.resident();r.will();r.admit();r.shift(24,38);r.did();r.next();r.will();r.shift(10,7);r.did();near(r.y(),145);check(r.provider->captures==1&&r.provider->admissions==1);});
  test("factory replacement cannot promote outgoing transaction candidate",[]{Rig r;r.resident();r.will();r.provider=std::make_shared<TestProvider>();r.resident();r.admit();r.shift(24,38);r.did();near(r.y(),124);check(r.provider->captures==0&&r.provider->admissions==0);});
  test("native no-op command invalidates candidate before READ admission",[]{Rig r;r.resident();r.will();[r.host scrollToOffset:CGPointMake(0,100) animated:NO];r.admit();r.shift(24,38);r.did();near(r.y(),100);check(r.provider->admissions==0);});
  test("native drag invalidates candidate and pending admission",[]{Rig r;r.resident();r.admit();r.will();[r.host scrollViewWillBeginDragging:r.host->_scrollView];r.shift(24,38);r.did();near(r.y(),100);r.next();r.will();check(r.provider->admissions==1);});
  test("same factory pointer after invalidation requires fresh capture",[]{Rig r;r.resident();r.will();[r.host invalidateReadPointLease];r.admit();r.shift(24,38);r.did();near(r.y(),124);check(r.provider->admissions==0);});
  test("late admission after did cannot reuse consumed candidate",[]{Rig r;r.resident();r.will();r.did();r.admit();r.shift(24,38);r.did();near(r.y(),100);check(r.provider->admissions==0);});
  test("stale did cannot consume newly promoted candidate",[]{Rig r;r.resident();r.will();r.next();r.will();r.admit();r.shift(24,38);[r.host mountingTransactionDidMount:MountingTransaction{11,1} withSurfaceTelemetry:SurfaceTelemetry{}];near(r.y(),100);r.did();near(r.y(),138);});
  test("reentrant capture command cannot promote outgoing candidate",[]{Rig r;r.resident();r.provider->beforeCapture=[&]{[r.host scrollToOffset:CGPointMake(0,500) animated:NO];};r.will();r.admit();r.shift(24,38);r.did();near(r.y(),500);check(r.provider->admissions==0);});
  test("reentrant admission command cannot publish READ authority",[]{Rig r;r.resident();r.will();r.provider->beforeAdmit=[&]{[r.host scrollToOffset:CGPointMake(0,500) animated:NO];};r.admit();r.shift(24,38);r.did();near(r.y(),500);});
  test("reentrant factory replacement cannot reuse old provider",[]{Rig r;r.resident();r.will();r.provider->beforeAdmit=[&]{r.provider=std::make_shared<TestProvider>();r.resident();};r.admit();r.shift(24,38);r.did();near(r.y(),124);check(r.provider->captures==0);});
  test("provisional viewport changes remain legacy not false READ",[]{Rig r;r.resident();r.provider->beforeCapture=[&]{r.host->_scrollView.bounds=CGRectMake(0,100,400,450);};r.will();r.admit();r.shift(24,38);r.did();near(r.y(),124);check(r.provider->admissions==0);});
  test("unregister resident prevents stale admission",[]{Rig r;r.resident();r.will();[r.host setReadPointProviderFactory:{}];r.admit();r.shift(24,38);r.did();near(r.y(),124);check(r.provider->admissions==0);});
  test("candidate captures once while admission itself acquires no geometry",[]{Rig r;r.resident();r.will();r.provider->beforeCapture=[] {throw std::runtime_error("must not recapture");};r.admit();r.shift(24,38);r.did();near(r.y(),138);check(r.provider->captures==1);});
  test("new owner cannot inherit prior native candidate",[]{Rig r;r.resident();r.will();UIScrollView*old=r.host.scrollView;r.host.scrollView=[UIScrollView new];r.host.scrollView=old;r.admit();r.shift(24,38);r.did();near(r.y(),124);check(r.provider->admissions==0);});
  test("fresh same-READ intent cannot inherit the older admitted witness",[]{Rig r;r.resident();r.will();r.admit();r.did();r.admit();r.provider->initial.witnesses[0].savedWindowY=420;r.provider->points["111"]=420;r.next();r.will();r.shift(24,38);r.did();near(r.y(),138);check(r.provider->captures==2&&r.provider->admissions==2);});

  test("factory reentry command cannot prepare later fallback for old mount",[]{Rig r;auto provider=r.provider;__strong Harness*host=r.host;[host setReadPointProviderFactory:[host,provider]{[host scrollToOffset:CGPointMake(0,500) animated:NO];return provider;}];r.will();r.shift(24,38);r.did();near(r.y(),500);});
  test("throwing provisional after command does not prepare competing legacy",[]{Rig r;r.resident();r.provider->beforeCapture=[&]{[r.host scrollToOffset:CGPointMake(0,500) animated:NO];throw std::runtime_error("old provider");};r.will();r.shift(24,38);r.did();near(r.y(),500);});
  test("pending admission callback command cannot prepare later fallback",[]{Rig r;r.resident();r.admit();r.provider->beforeAdmit=[&]{[r.host scrollToOffset:CGPointMake(0,500) animated:NO];};r.will();r.shift(24,38);r.did();near(r.y(),500);});
  test("read-only diagnostic identifies exact current legacy and admitted frame",[]{Rig r;r.resident();r.will();NSDictionary*d=[r.host readPointDiagnostic];check([d[@"preparedOwner"] isEqual:@"legacy"]&&[d[@"provisional"] boolValue]&&[d[@"transaction"] longLongValue]==1);r.admit();r.shift(24,38);r.did();int captures=r.provider->captures,admissions=r.provider->admissions,writes=r.host->_scrollView.writes;d=[r.host readPointDiagnostic];check([d[@"preparedOwner"] isEqual:@"read"]&&[d[@"lastDecision"] isEqual:@"adjust"]&&[d[@"consumed"] boolValue]&&[d[@"admitted"] boolValue]);check(captures==r.provider->captures&&admissions==r.provider->admissions&&writes==r.host->_scrollView.writes);});
  test("diagnostic distinguishes unavailable admitted owner from legacy fallback",[]{Rig r;r.resident();r.will();r.admit();r.provider->statuses["111"]=PointStatus::Unavailable;r.did();NSDictionary*d=[r.host readPointDiagnostic];check([d[@"preparedOwner"] isEqual:@"read"]&&[d[@"lastDecision"] isEqual:@"unavailable"]);[r.host invalidateReadPointLease];r.next();r.will();r.did();d=[r.host readPointDiagnostic];check([d[@"preparedOwner"] isEqual:@"legacy"]&&[d[@"lastDecision"] isEqual:@"default"]&&![d[@"admitted"] boolValue]);});

  test("known pre-mount pending intent uses tagged relative fallback",[]{Rig r;r.resident();r.provider->initial.available=false;r.admit();r.will();r.signal(@"A",24);r.did();near(r.y(),124);NSDictionary*d=[r.host readPointDiagnostic];check([d[@"lastDecision"] isEqual:@"legacy-adjust"]&&![d[@"admitted"] boolValue]);});
  test("unknown same-mount intent never gains relative fallback",[]{Rig r;r.resident();r.provider->initial.available=false;r.will();r.admit();r.signal(@"A",24);r.did();near(r.y(),100);});
  test("queued READ A cannot move native command delivered before its mount",[]{Rig r;r.resident();r.provider->initial.available=false;r.admit();[r.host scrollToOffset:CGPointMake(0,500) animated:NO];r.will();r.signal(@"A",24);r.did();near(r.y(),500);});
  test("queued READ A cannot move native command delivered during its mount",[]{Rig r;r.resident();r.provider->initial.available=false;r.admit();r.will();[r.host scrollToOffset:CGPointMake(0,500) animated:NO];r.signal(@"A",24);r.did();near(r.y(),500);});
  test("same-intent gesture reentry cannot replay old relative signal",[]{Rig r;r.resident();r.provider->initial.available=false;r.admit();[r.host scrollViewWillBeginDragging:r.host->_scrollView];r.admit();r.will();r.signal(@"A",24);r.did();near(r.y(),100);});
  test("same-intent gesture reentry can acquire a genuinely fresh READ witness",[]{Rig r;r.resident();r.admit();[r.host scrollViewWillBeginDragging:r.host->_scrollView];r.admit();r.will();r.signal(@"A",24);r.shift(0,38);r.did();near(r.y(),138);check(r.provider->captures==1&&r.provider->admissions==1);});
  test("fresh intent B ignores delayed A after command completion",[]{Rig r;r.resident();r.provider->initial.available=false;r.admit();[r.host scrollToOffset:CGPointMake(0,500) animated:NO];r.admit(@"B");r.will();r.signal(@"A",24);r.did();near(r.y(),500);});
  test("fresh intent B relative amount does not inherit old A cumulative amount",[]{Rig r;r.resident();r.provider->initial.available=false;r.admit();r.signal(@"A",90);[r.host scrollToOffset:CGPointMake(0,500) animated:NO];r.admit(@"B");r.will();r.signal(@"B",24);r.did();near(r.y(),524);});
  test("same intent applies only current mounted cumulative difference",[]{Rig r;r.resident();r.provider->initial.available=false;r.admit();r.will();r.signal(@"A",24);r.did();near(r.y(),124);r.next();r.will();r.signal(@"A",38);r.did();near(r.y(),138);r.next();r.will();r.did();near(r.y(),138);});
  test("factory detach and reattach cannot revive queued old intent",[]{Rig r;r.resident();r.provider->initial.available=false;r.admit();[r.host invalidateReadPointLease];[r.host setReadPointProviderFactory:{}];r.resident();r.admit();r.will();r.signal(@"A",24);r.did();near(r.y(),100);});
  test("native command during relative force-dispatch check wins",[]{Rig r;r.resident();r.provider->initial.available=false;r.admit();r.will();r.signal(@"A",24);r.host->onForce=[&]{r.host->onForce={};[r.host scrollToOffset:CGPointMake(0,500) animated:NO];};r.did();near(r.y(),500);check(r.host->_scrollView.writes==1);});
  test("reentrant new admission does not inherit old request authority",[]{Rig r;r.resident();r.admit();r.provider->beforeAdmit=[&]{r.provider->beforeAdmit={};r.admit(@"B");};r.will();r.signal(@"A",24);r.did();near(r.y(),100);r.next();r.will();r.shift(0,38);r.did();near(r.y(),138);});
  test("invalid serialized native signal is not a zero or trusted amount",[]{for(const std::string payload:{"{\"intent\":\"A\",\"amount\":true}","{\"intent\":\"A\",\"amount\":\"24\"}","{\"intent\":\"A\"}","{\"intent\":\"A\",\"amount\":24,\"extra\":0}","invalid"}){Rig r;r.resident();r.provider->initial.available=false;r.admit();r.will();r.host->_props->nativeReadPointAdjustment=payload;r.did();near(r.y(),100);}});
  test("exact scope and visit token is required for relative delivery",[]{Rig r;r.resident();r.provider->initial.available=false;r.admit(@"[\"scope1\",\"visit1\",1]");r.will();r.signal(@"[\"scope2\",\"visit1\",1]",24);r.did();near(r.y(),100);});
  test("malformed previous signal cannot invent a cumulative baseline",[]{Rig r;r.resident();r.provider->initial.available=false;r.admit();r.host->_props->nativeReadPointAdjustment="invalid";r.will();r.signal(@"A",24);r.did();near(r.y(),100);});

  // Modeled UIKit clamp; all owner and write decisions use extracted RN source.
  auto nearEnd=[](Rig &r) {
    r.host->_scrollView.bounds=CGRectMake(0,0,402,671);
    r.host->_scrollView.contentSize=CGSizeMake(402,11060.333333333334);
    r.host->_scrollView.contentInset={0,0,98,0};
    r.host->_scrollView.adjustedContentInset={0,0,98,0};
    r.host->_scrollView.contentOffset=CGPointMake(0,10376);
    r.resident();r.provider->initial.available=false;r.admit();
    r.operation=@{@"id":@1,@"startOffset":@10376,@"startAmount":@0};
  };
  auto shrink=[](Rig &r) {
    r.host->_scrollView.contentSize=CGSizeMake(402,10930.666666666666);
    r.host->_scrollView.contentOffset=CGPointMake(0,10357.666666666666);
  };
  test("relative unchanged-layout movement remains exact",[&]{Rig r;nearEnd(r);r.will();r.signal(@"A",-129.666666666668);r.did();near(r.y(),10246.333333333332);});
  test("same-mount automatic legal clamp is not compensated twice",[&]{Rig r;nearEnd(r);r.will();shrink(r);r.signal(@"A",-129.666666666668);r.did();near(r.y(),10246.333333333332);});
  test("earlier-mount legal clamp is not compensated twice at delayed signal",[&]{Rig r;nearEnd(r);r.will();shrink(r);r.did();near(r.y(),10357.666666666666);r.next();r.will();r.signal(@"A",-129.666666666668);r.did();near(r.y(),10246.333333333332);});
  test("cumulative second relative delivery does not reuse settled clamp",[&]{Rig r;nearEnd(r);r.will();shrink(r);r.signal(@"A",-129.666666666668);r.did();r.next();r.will();r.signal(@"A",-167.666666666668);r.did();near(r.y(),10208.333333333332);});
  test("public target after clamp retires queued old READ amount",[&]{Rig r;nearEnd(r);r.will();shrink(r);r.did();[r.host scrollToOffset:CGPointMake(0,500) animated:NO];r.next();r.will();r.signal(@"A",-129.666666666668);r.did();near(r.y(),500);});
  test("native drag after clamp retires queued old READ amount",[&]{Rig r;nearEnd(r);r.will();shrink(r);r.did();[r.host scrollViewWillBeginDragging:r.host->_scrollView];r.next();r.will();r.signal(@"A",-129.666666666668);r.did();near(r.y(),10357.666666666666);});
  test("fresh intent cannot inherit older intent clamp credit",[&]{Rig r;nearEnd(r);r.will();shrink(r);r.did();[r.host scrollToOffset:CGPointMake(0,500) animated:NO];r.admit(@"B");r.operation=@{@"id":@2,@"startOffset":@500,@"startAmount":@0};r.next();r.will();r.signal(@"B",24);r.did();near(r.y(),524);});
  test("operation downgrade cannot revive relative current-offset arithmetic",[&]{Rig r;nearEnd(r);r.will();r.signal(@"A",-50);r.did();double y=r.y();r.next();r.will();r.operation=nil;r.omitOperation=true;r.signal(@"A",-88);r.did();near(r.y(),y);});
  test("same operation cannot change its frozen actual native basis",[&]{Rig r;nearEnd(r);r.will();r.signal(@"A",-50);r.did();double y=r.y();r.next();r.will();r.operation=@{@"id":@1,@"startOffset":@9999,@"startAmount":@0};r.signal(@"A",-88);r.did();near(r.y(),y);});
  test("older operation ID cannot replace newer operation",[&]{Rig r;nearEnd(r);r.operation=@{@"id":@2,@"startOffset":@10376,@"startAmount":@0};r.will();r.signal(@"A",-50);r.did();double y=r.y();r.next();r.will();r.operation=@{@"id":@1,@"startOffset":@10376,@"startAmount":@0};r.signal(@"A",-88);r.did();near(r.y(),y);});
  test("new acknowledged operation uses its own actual native basis",[&]{Rig r;nearEnd(r);r.will();r.signal(@"A",-50);r.did();r.next();r.will();r.operation=@{@"id":@2,@"startOffset":@10326,@"startAmount":@(-50)};r.signal(@"A",-88);r.did();near(r.y(),10288);});
  test("malformed operation never falls back to legacy arithmetic",[&]{Rig r;nearEnd(r);r.operation=@{@"id":@YES,@"startOffset":@10376,@"startAmount":@0};r.will();r.signal(@"A",-50);r.did();near(r.y(),10376);});
  test("admitted READ remains sole writer with operation fallback present",[&]{Rig r;r.resident();r.will();r.admit();r.provider->points["111"]-=38;r.operation=@{@"id":@1,@"startOffset":@100,@"startAmount":@0};r.signal(@"A",-130);r.did();near(r.y(),62);check(r.host->_scrollView.writes==1);});
  test("operation duplicate does not reapply a settled target",[&]{Rig r;nearEnd(r);r.will();r.signal(@"A",-50);r.did();int writes=r.host->_scrollView.writes;r.next();r.will();r.signal(@"A",-50);r.did();near(r.y(),10326);check(r.host->_scrollView.writes==writes);});
  auto lastAck=[](Rig&r)->NativeReadPointAdjustmentAck {auto&q=r.host->_eventEmitter->queue.eventQueue_;check(!q.empty()&&q.back().event.nativeReadPointAdjustmentAck.has_value(),"missing exact native ACK");return *q.back().event.nativeReadPointAdjustmentAck;};
  test("terminal native clamp ACK reports actual adjusted legal target then fresh growth basis",[&]{Rig r;nearEnd(r);r.will();r.signal(@"A",500);r.did();auto ack=lastAck(r);near(ack.target,10487.333333333334);check(ack.operationId==1);near(ack.amount,500);r.operation=@{@"id":@2,@"startOffset":@(ack.target),@"startAmount":@500};r.next();r.host->_scrollView.contentSize=CGSizeMake(402,11260.333333333334);r.will();r.signal(@"A",600);r.did();near(r.y(),10587.333333333334);});
  test("bounded no-op explicitly acknowledges without another native write",[&]{Rig r;nearEnd(r);r.host->_scrollView.contentSize=CGSizeMake(402,10930.666666666666);r.host->_scrollView.contentOffset=CGPointMake(0,10357.666666666666);int writes=r.host->_scrollView.writes;r.will();r.signal(@"A",500);r.did();near(lastAck(r).target,10357.666666666666);check(r.host->_scrollView.writes==writes);});
  test("ignored native setter cannot acknowledge applied operation",[&]{Rig r;nearEnd(r);r.host->_scrollView.ignoreOffset=YES;r.will();r.signal(@"A",-50);r.did();check(r.host->_eventEmitter->queue.eventQueue_.empty());near(r.y(),10376);});
  test("reentrant native command after setter rejects old ACK",[&]{Rig r;nearEnd(r);r.will();r.signal(@"A",-50);r.host->_scrollView.afterOffset=^{r.host->_scrollView.afterOffset=nil;[r.host scrollToOffset:CGPointMake(0,500) animated:NO];};r.did();near(r.y(),500);check(r.host->_eventEmitter->queue.eventQueue_.empty());});
  test("new mounted transaction from setter rejects old ACK",[&]{Rig r;nearEnd(r);r.will();r.signal(@"A",-50);Rig *rig=&r;r.host->_scrollView.afterOffset=^{rig->host->_scrollView.afterOffset=nil;++rig->transaction;rig->will();};r.did();check(r.host->_eventEmitter->queue.eventQueue_.empty());});
  test("unavailable native emitter cannot invent ACK",[&]{Rig r;nearEnd(r);r.host->_eventEmitter.reset();r.will();r.signal(@"A",-50);r.did();check(!r.host->_eventEmitter);});
  test("admitted native READ never emits fallback acknowledgement",[&]{Rig r;r.resident();r.will();r.admit();r.provider->points["111"]-=38;r.operation=@{@"id":@1,@"startOffset":@100,@"startAmount":@0};r.signal(@"A",-130);r.did();near(r.y(),62);check(r.host->_eventEmitter->queue.eventQueue_.empty());});
  test("actual EventQueue cannot coalesce operation ACK behind next ordinary scroll",[&]{ScrollViewEventEmitter emitter;ScrollEvent ack;ack.nativeReadPointAdjustmentAck=NativeReadPointAdjustmentAck{"A",1,100,0,24,124};emitter.onScroll(ack);emitter.onScroll({});check(emitter.queue.eventQueue_.size()==2);check(emitter.queue.eventQueue_.front().event.nativeReadPointAdjustmentAck.has_value());});
  test("completed terminal clamp followed by same-operation growth before ACK cannot revive old debt",[&]{Rig r;nearEnd(r);r.will();r.signal(@"A",500);r.did();near(r.y(),10487.333333333334);r.next();r.host->_scrollView.contentSize=CGSizeMake(402,11260.333333333334);r.will();r.signal(@"A",600);r.did();near(r.y(),10587.333333333334);});
  test("same operation grow shrink repeated amount follows actual completion order",[&]{Rig r;nearEnd(r);r.will();r.signal(@"A",500);r.did();near(r.y(),10487.333333333334);r.next();r.host->_scrollView.contentSize=CGSizeMake(402,11260.333333333334);r.will();r.signal(@"A",600);r.did();near(r.y(),10587.333333333334);r.next();r.will();r.signal(@"A",500);r.did();near(r.y(),10487.333333333334);});
  test("no-delta observed native owner ABA cannot revive completed operation",[&]{Rig r;nearEnd(r);r.will();r.signal(@"A",500);r.did();const double completed=r.y();r.next();r.host.window=[UIWindow new];r.will();r.did();r.host.window=r.window;r.next();r.host->_scrollView.contentSize=CGSizeMake(402,11260.333333333334);r.will();r.signal(@"A",600);r.did();near(r.y(),completed);});
  NSDictionary *report=@{@"passed":@(records.count-failures),@"failed":@(failures),@"records":records,@"boundary":@"Actual staged C++ coordinator and extracted RN entry/writer methods; UIKit properties, native delivery and provider point geometry modeled. No glyph/provider/Fabric/presentation proof."};
  NSData *json=[NSJSONSerialization dataWithJSONObject:report options:NSJSONWritingPrettyPrinted error:nil];
  if(argc>1)[json writeToFile:@(argv[1]) atomically:YES];fwrite(json.bytes,1,json.length,stdout);fputc('\n',stdout);
  return failures?1:0;
}}
