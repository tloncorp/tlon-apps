#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <objc/runtime.h>
#import "../TlonReadDescriptors.h"
#include "../TlonReadDurations.h"
namespace timing = tlon::read_durations;
#include "RCTScrollViewReadPointCoordinator.h"
#include <cstdio>
#include <thread>

// Actual capture/admit/exposure/cache bodies; modeled native geometry and
// Paragraph responses. No UIKit, Fabric, glyph, or presentation qualification.
static NSUInteger geometryQueries=0, textQueries=0, timingClockReads=0;
static double timingNow=10;
static std::function<void()> duringTextQuery, duringOwnerLookup;
static NSUInteger ownerLookupCountdown=0;
[[maybe_unused]] static double CACurrentMediaTime() { ++timingClockReads; timingNow+=0.001; return timingNow; }
@class UIWindow;
@interface UIView : NSObject
@property(nonatomic, weak) UIView *superview;
@property(nonatomic, copy) NSString *accessibilityIdentifier, *accessibilityValue;
@property(nonatomic, weak) UIWindow *window;
@property(nonatomic) CGRect bounds;
@property(nonatomic) CGPoint origin;
@property(nonatomic) BOOL hidden, clipsToBounds;
@property(nonatomic) CGFloat alpha;
@property(nonatomic) CGAffineTransform transform;
@property(nonatomic, copy) NSArray<UIView *> *subviews;
- (CGRect)convertRect:(CGRect)r toView:(UIView *)view;
- (CGPoint)convertPoint:(CGPoint)p fromView:(UIView *)view;
@end
@implementation UIView
- (instancetype)init { if((self=[super init])){_alpha=1;_transform=CGAffineTransformIdentity;_subviews=@[];_bounds=CGRectMake(0,0,400,600);}return self; }
- (CGRect)convertRect:(CGRect)r toView:(UIView *)view { (void)view;++geometryQueries;return CGRectOffset(r,_origin.x,_origin.y); }
- (CGPoint)convertPoint:(CGPoint)p fromView:(UIView *)view { (void)view;++geometryQueries;return CGPointMake(p.x-_origin.x,p.y-_origin.y); }
@end
@interface UIWindow : UIView @end
@implementation UIWindow @end
@protocol UIScrollViewDelegate @end
@interface UIScrollView : UIView
@property(nonatomic) BOOL isDragging,isDecelerating,isTracking;
@end
@implementation UIScrollView @end
@class RNSScreenView;
@protocol RNSNativeReadingLifecycleListener @end
@interface RNSScreenView : UIView
@property(nonatomic) BOOL nativeReadingVisible;
@end
@implementation RNSScreenView @end
namespace facebook::react {
struct TextReadingPointQuery {};
enum class TextReadingPointStatus { Measured, Unavailable, Removed };
enum class TextReadingPointReason { None, NoLayout };
struct Fragment { CGRect rect; NSRange characterRange; };
struct TextReadingPointResult {
 TextReadingPointStatus status{TextReadingPointStatus::Measured};
 TextReadingPointReason reason{TextReadingPointReason::None};
 NSString *__strong sourceText{nil}; id __strong owner{nil};
 NSRange characterRange{0,1}; std::vector<Fragment> fragments;
};
}
using facebook::react::TextReadingPointResult;
using facebook::react::TextReadingPointStatus;
namespace sr=facebook::react::scroll_read;
static bool useControlledFragments=false;
static std::vector<facebook::react::Fragment> controlledFragments;
@interface RCTParagraphComponentView : UIView
@property(nonatomic) BOOL unavailable, noGlyph;
- (TextReadingPointResult)readingPointAtPoint:(CGPoint)point;
- (TextReadingPointResult)readingPointForRange:(NSRange)range expectedCurrentText:(NSString *)text owner:(id)owner;
- (TextReadingPointResult)readingPointAtPoint:(CGPoint)point query:(facebook::react::TextReadingPointQuery *)query;
- (TextReadingPointResult)readingPointForRange:(NSRange)range expectedCurrentText:(NSString *)text owner:(id)owner query:(facebook::react::TextReadingPointQuery *)query;
@end
@implementation RCTParagraphComponentView
- (TextReadingPointResult)readingPointAtPoint:(CGPoint)p {
 (void)p;++textQueries;if(duringTextQuery){auto callback=std::move(duringTextQuery);duringTextQuery={};callback();}TextReadingPointResult r;r.owner=self;r.sourceText=@"private sample must never enter diagnostic";
 if(_unavailable){r.status=TextReadingPointStatus::Unavailable;r.reason=facebook::react::TextReadingPointReason::NoLayout;}
 if(useControlledFragments) { r.fragments=controlledFragments; r.sourceText=[@"x" stringByPaddingToLength:2000 withString:@"x" startingAtIndex:0]; }
 else if(!_noGlyph)r.fragments.push_back({CGRectMake(20,25,200,20),NSMakeRange(0,1)});return r;
}
- (TextReadingPointResult)readingPointForRange:(NSRange)range expectedCurrentText:(NSString *)text owner:(id)owner {
 (void)range;(void)text;(void)owner;return [self readingPointAtPoint:CGPointZero];
}
- (TextReadingPointResult)readingPointAtPoint:(CGPoint)point query:(facebook::react::TextReadingPointQuery *)query {
 (void)query; return [self readingPointAtPoint:point];
}
- (TextReadingPointResult)readingPointForRange:(NSRange)range expectedCurrentText:(NSString *)text owner:(id)owner query:(facebook::react::TextReadingPointQuery *)query {
 (void)query; return [self readingPointForRange:range expectedCurrentText:text owner:owner];
}
@end
@interface UIImage : NSObject @property(nonatomic) CGSize size; @end
@implementation UIImage @end
enum { UIViewContentModeScaleToFill,UIViewContentModeScaleAspectFit,UIViewContentModeScaleAspectFill,UIViewContentModeCenter };
@interface UIImageView : UIView @property(nonatomic) UIImage *image; @property(nonatomic) NSInteger contentMode; @end
@implementation UIImageView @end
@interface RCTScrollViewComponentView : UIView
@property(nonatomic) UIScrollView *scrollView;
+ (instancetype)findScrollViewComponentViewForView:(UIView *)view;
- (NSDictionary *)readPointDiagnostic;
@end
@implementation RCTScrollViewComponentView
+ (instancetype)findScrollViewComponentViewForView:(UIView *)view { if(duringOwnerLookup&&--ownerLookupCountdown==0){auto callback=std::move(duringOwnerLookup);duringOwnerLookup={};callback();} for(UIView*v=view;v;v=v.superview)if([v isKindOfClass:self])return(id)v;return nil; }
- (NSDictionary *)readPointDiagnostic { return @{@"resident":@YES,@"admitted":@NO,@"generation":@27}; }
@end
#include "provider-actual.inc"
@interface TlonReadRegistration (BindingControls)
+ (NSDictionary *)diagnosticForScrollView:(UIScrollView *)scrollView measuredRows:(NSDictionary<NSString *, NSArray<UIView *> *> *)rows indexedCells:(NSDictionary<NSString *, NSArray<UIView *> *> *)cells;
+ (NSString *)diagnosticIdentityForView:(UIView *)view;
@end
@interface TlonReadRegistry (TimingControls)
- (void)updateDurationsForScope:(TlonReadRegistration *)scope;
@end
static void syncTiming(TlonReadRegistry *registry, TlonReadRegistration *scope) {
 if ([registry respondsToSelector:@selector(updateDurationsForScope:)]) [registry updateDurationsForScope:scope];
}
static int checks=0;
static void check(BOOL value,const char *name){++checks;if(!value){fprintf(stderr,"FAIL %s\n",name);exit(1);}}
static NSDictionary *scope(){return @{@"version":@1,@"dataRevision":@"1",@"scope":@"secret-scope",@"visit":@"secret-visit",@"phase":@"read",@"intent":@"secret-intent",@"rows":@[@{@"key":@"secret-key",@"revision":@"1"}]};}
static void attach(UIView *view,UIView *parent,UIWindow *window){view.superview=parent;view.window=window;}
int main(){@autoreleasepool {
 UIWindow*w=[UIWindow new];w.window=w;RNSScreenView*screen=[RNSScreenView new];attach(screen,w,w);screen.nativeReadingVisible=YES;
 RCTScrollViewComponentView*owner=[RCTScrollViewComponentView new];attach(owner,screen,w);owner.scrollView=[UIScrollView new];attach(owner.scrollView,owner,w);
 TlonReadRegistry*r=[TlonReadRegistry new];r.owner=owner;r.screen=screen;r.registrations=[NSHashTable weakObjectsHashTable];objc_setAssociatedObject(owner,&RegistryKey,r,OBJC_ASSOCIATION_RETAIN_NONATOMIC);
 UIView*scopeHost=[UIView new];TlonReadRegistration*s=[TlonReadRegistration new];s.scope=YES;s.host=scopeHost;attach(s.host,owner.scrollView,w);s.registry=r;s.descriptor=scope();objc_setAssociatedObject(s.host,&RegistrationKey,s,OBJC_ASSOCIATION_ASSIGN);r.activeScope=s;[r.registrations addObject:s];
 UIView*rowHost=[UIView new];TlonReadRegistration*row=[TlonReadRegistration new];row.host=rowHost;attach(row.host,owner.scrollView,w);row.host.origin=CGPointMake(0,250);row.host.bounds=CGRectMake(0,0,400,100);row.registry=r;
 row.descriptor=@{@"scope":@"secret-scope",@"visit":@"secret-visit",@"key":@"secret-key",@"revision":@"1",@"kind":@"row",@"blocks":@[@{@"id":@"secret-block",@"revision":@"1",@"kind":@"text"}]};[r.registrations addObject:row];
 UIView*innerHost=[UIView new];TlonReadRegistration*inner=[TlonReadRegistration new];inner.host=innerHost;attach(inner.host,row.host,w);inner.host.origin=row.host.origin;inner.host.bounds=row.host.bounds;inner.registry=r;
 inner.descriptor=@{@"scope":@"secret-scope",@"visit":@"secret-visit",@"key":@"secret-key",@"rowRevision":@"1",@"blockId":@"secret-block",@"revision":@"1",@"kind":@"text"};[r.registrations addObject:inner];
 RCTParagraphComponentView*p=[RCTParagraphComponentView new];attach(p,inner.host,w);p.origin=inner.host.origin;p.bounds=inner.host.bounds;inner.host.subviews=@[p];
 sr::Mount m{1,1,(__bridge void*)owner,(__bridge void*)owner.scrollView,(__bridge void*)w};sr::Viewport v{0,0,0,1400,400,600,0,0,400,2000,0,0,0,0};
 TlonNativeReadProvider provider(r,s);
 check([r.providerDiagnostic[@"capture"][@"reason"] isEqual:@"not-attempted"],"no invented acquisition");
 auto capture=[&]{return provider.capture(m,v);};
 auto reason=[&](NSString*x){return [r.lastCapture[@"reason"] isEqual:x];};
 check(capture().available&&reason(@"captured"),"healthy actual capture retained");
 check([r.lastCapture[@"counts"][@"measuredRows"] integerValue]==1,"counts from existing walk");
 NSDictionary *snapshot=[TlonReadRegistration diagnosticForScrollView:owner.scrollView];NSUInteger g=geometryQueries,t=textQueries;
 for(int i=0;i<10;i++)(void)[TlonReadRegistration diagnosticForScrollView:owner.scrollView];
 check(g==geometryQueries&&t==textQueries,"cached getter performs no geometry or TextKit query");
 check([snapshot[@"generation"] isEqual:@27]&&[snapshot[@"resident"] boolValue],"original RN fields preserved");
 NSMutableDictionary *legacy=[snapshot mutableCopy];[legacy removeObjectForKey:@"committedMembership"];
 NSString*json=[[NSString alloc]initWithData:[NSJSONSerialization dataWithJSONObject:legacy options:0 error:nil] encoding:NSUTF8StringEncoding];
 check(![json containsString:@"secret-"]&&![json containsString:@"private sample"],"no metadata or text payload");
 screen.nativeReadingVisible=NO;check(!capture().available&&reason(@"invisible-owner"),"invisible owner exact rejection");screen.nativeReadingVisible=YES;
 check([snapshot[@"provider"][@"capture"][@"reason"] isEqual:@"captured"],"earlier snapshot immutable");
 NSDictionary*old=s.descriptor;s.descriptor=nil;check(!capture().available&&reason(@"bad-current-descriptor"),"invalid current descriptor");s.descriptor=old;
 auto savedMount=m;m.transaction++;m.component=nullptr;check(!capture().available&&reason(@"mount-mismatch"),"wrong native owner");m=savedMount;
 inner.host.subviews=@[];check(!capture().available&&reason(@"unexpected-paragraph"),"actual missing Paragraph branch");inner.host.subviews=@[p];
 // A code frame remains outside its nested horizontal owner. Header metadata
 // forms a search boundary without declaring the Code/Copy labels as content.
 UIView *header=[UIView new];attach(header,inner.host,w);header.origin=inner.host.origin;
 RCTParagraphComponentView *codeLabel=[RCTParagraphComponentView new], *copyLabel=[RCTParagraphComponentView new];
 attach(codeLabel,header,w);attach(copyLabel,header,w);header.subviews=@[codeLabel,copyLabel];
 RCTScrollViewComponentView *horizontal=[RCTScrollViewComponentView new];attach(horizontal,inner.host,w);
 horizontal.scrollView=[UIScrollView new];attach(horizontal.scrollView,horizontal,w);horizontal.subviews=@[horizontal.scrollView];
 attach(p,horizontal.scrollView,w);horizontal.scrollView.subviews=@[p];inner.host.subviews=@[header,horizontal];
 check(!capture().available&&reason(@"unexpected-paragraph"),"code without header boundary cannot borrow a label Paragraph");
 TlonReadRegistration *headerBoundary=[TlonReadRegistration new];headerBoundary.host=header;headerBoundary.registry=r;
 objc_setAssociatedObject(header,&RegistrationKey,headerBoundary,OBJC_ASSOCIATION_ASSIGN);[r.registrations addObject:headerBoundary];
 check(capture().available&&uniqueDescendant(inner.host,RCTParagraphComponentView.class)==p,"code frame sees only actual code Paragraph across horizontal scroll");
 check(belongsTo(inner.host,owner)&&!belongsTo(p,owner),"code metadata host stays on vertical owner despite nested horizontal Paragraph");
 check(!headerBoundary.descriptor&&[r.lastCapture[@"counts"][@"inners"] integerValue]==1,"header boundary has no content authority or extra candidate");
 horizontal.scrollView.subviews=@[];check(!capture().available&&reason(@"unexpected-paragraph"),"missing code cannot fall back to header labels");
 horizontal.scrollView.subviews=@[p,codeLabel];check(!capture().available&&reason(@"unexpected-paragraph"),"ambiguous code body retains unique Paragraph requirement");
 horizontal.scrollView.subviews=@[p];CGRect horizontalBounds=horizontal.scrollView.bounds;horizontal.scrollView.clipsToBounds=YES;horizontal.scrollView.bounds=CGRectMake(0,0,1,1);check(!capture().available,"code preserves nested horizontal clipping");horizontal.scrollView.bounds=horizontalBounds;horizontal.scrollView.clipsToBounds=NO;
 p.hidden=YES;check(!capture().available,"hidden code cannot be certified through header boundary");p.hidden=NO;
 [r.registrations removeObject:headerBoundary];objc_setAssociatedObject(header,&RegistrationKey,nil,OBJC_ASSOCIATION_ASSIGN);inner.host.subviews=@[p];attach(p,inner.host,w);
 p.unavailable=YES;check(!capture().available&&reason(@"capture-api-unavailable")&&[r.lastCapture[@"counts"][@"textAPIReason"] integerValue]==1,"actual TextKit unavailable branch and enum");p.unavailable=NO;
 p.noGlyph=YES;check(!capture().available&&reason(@"no-exposed-glyph"),"actual unexposed glyph branch");p.noGlyph=NO;
 inner.host.transform=CGAffineTransformMakeTranslation(0,1);check(!capture().available&&[r.lastCapture[@"rejected"][@"unexpected-transform"] unsignedIntegerValue]>0,"transform rejection retained");inner.host.transform=CGAffineTransformIdentity;
 [r.registrations removeObject:inner];check(!capture().available&&reason(@"no-eligible-central-block"),"central row cannot fall back to row edge");[r.registrations addObject:inner];
 NSDictionary*oldInner=inner.descriptor;NSMutableDictionary*bad=[oldInner mutableCopy];bad[@"rowRevision"]=@"2";inner.descriptor=bad;check(!capture().available&&reason(@"central-inner-membership"),"central stale inner rejects");inner.descriptor=oldInner;
 check(provider.admit()&&[r.lastAdmission[@"reason"] isEqual:@"admitted"],"actual healthy admit");owner.scrollView.isDragging=YES;
 check(!provider.admit()&&[r.lastAdmission[@"reason"] isEqual:@"admission-rejected"],"actual gesture admission rejection");owner.scrollView.isDragging=NO;
 check([snapshot[@"provider"][@"captureAttempts"] unsignedIntegerValue]==1&&r.captureAttempts>1,"per-owner monotonic attempts and old count immutable");
 // Run the same actual capture with and without timing. This first missing
 // counter assertion is also executable against unchanged production source.
 NSUInteger reads=timingClockReads;
 g=geometryQueries;t=textQueries;auto before=capture();NSUInteger baselineGeometry=geometryQueries-g, baselineText=textQueries-t;g=geometryQueries;t=textQueries;
 check(!r.providerDiagnostic[@"durations"]&&reads==timingClockReads,"default has no timing payload or clock reads");
 NSMutableDictionary *timedScope=[s.descriptor mutableCopy];timedScope[@"diagnosticTimingSession"]=@"r13.capture:1";s.descriptor=timedScope;syncTiming(r,s);
 auto after=capture();NSDictionary *duration=r.providerDiagnostic[@"durations"];
 check([duration[@"phases"][@"capture"][@"count"] integerValue]==1,"enabled actual capture records a duration");
 check(before.available==after.available&&before.witnesses.size()==after.witnesses.size(),"timing preserves capture membership");
 for(size_t i=0;i<before.witnesses.size();++i)check(before.witnesses[i].pointKey==after.witnesses[i].pointKey&&before.witnesses[i].savedWindowY==after.witnesses[i].savedWindowY,"timing preserves exact witness identity and geometry");
 check(geometryQueries-g==baselineGeometry&&textQueries-t==baselineText,"timing does not add Paragraph queries");
 check([duration[@"phases"][@"query"][@"count"] integerValue]==2&&[duration[@"phases"][@"exposure"][@"count"] integerValue]>0,"actual query and exposure calls timed");
 check([duration[@"nested"] boolValue]&&[duration[@"valid"] boolValue]&&[duration[@"activeSpans"] integerValue]==0,"inclusive nested spans settle");
 check([duration[@"phases"][@"capture"][@"totalMs"] doubleValue]>[duration[@"phases"][@"query"][@"totalMs"] doubleValue],"nested total is elapsed rather than additive CPU");
 g=geometryQueries;t=textQueries;reads=timingClockReads;
 (void)r.providerDiagnostic;(void)r.providerDiagnostic;
 check(g==geometryQueries&&t==textQueries&&reads==timingClockReads,"timing getter remains cached and clock-free");
 syncTiming(r,s);capture();
 check([r.providerDiagnostic[@"durations"][@"phases"][@"capture"][@"count"] integerValue]==2,"same session does not reset");
 check([duration[@"phases"][@"capture"][@"count"] integerValue]==1,"earlier timing snapshot immutable");
 timedScope=[s.descriptor mutableCopy];timedScope[@"diagnosticTimingSession"]=@"r13.capture:2";s.descriptor=timedScope;syncTiming(r,s);
 check([r.providerDiagnostic[@"durations"][@"phases"][@"capture"][@"count"] integerValue]==0,"session change resets only durations");
 check(provider.admit(),"diagnostic-only session change preserves admission");
 for(id invalid in @[@"",@"bad token",@"bad/char",@"é",@4,[@"x" stringByPaddingToLength:129 withString:@"x" startingAtIndex:0]]) {
  timedScope=[s.descriptor mutableCopy];timedScope[@"diagnosticTimingSession"]=invalid;s.descriptor=timedScope;syncTiming(r,s);reads=timingClockReads;
  check(capture().available&&!r.providerDiagnostic[@"durations"]&&reads==timingClockReads,"invalid timing token disables without rejecting READ");
 }
 timedScope=[s.descriptor mutableCopy];timedScope[@"diagnosticTimingSession"]=@"r13.old";s.descriptor=timedScope;syncTiming(r,s);
 duringTextQuery=[&]{timedScope=[s.descriptor mutableCopy];timedScope[@"diagnosticTimingSession"]=@"r13.new";s.descriptor=timedScope;syncTiming(r,s);};
 check(capture().available&&[r.providerDiagnostic[@"durations"][@"phases"][@"capture"][@"count"] integerValue]==0&&[r.providerDiagnostic[@"durations"][@"phases"][@"query"][@"count"] integerValue]==0,"session replaced during query cannot receive old in-flight accounting");
 TlonReadRegistration *newScope=[TlonReadRegistration new];newScope.scope=YES;newScope.host=s.host;newScope.registry=r;newScope.descriptor=s.descriptor;r.activeScope=newScope;syncTiming(r,newScope);reads=timingClockReads;
 check(!capture().available&&[r.providerDiagnostic[@"durations"][@"phases"][@"capture"][@"count"] integerValue]==0&&reads==timingClockReads,"old provider cannot attribute work to replacement physical scope");
 r.activeScope=s;syncTiming(r,s);
 // Fixed counter core: deterministic inclusive durations, exceptions and
 // retired in-flight spans. No modeled timer delivery is needed.
 static double milliseconds=0;
 auto counter=std::make_shared<timing::State>([] { return milliseconds; });
 { timing::Span outer(counter,timing::Phase::Capture);milliseconds=3;
   { timing::Span innerSpan(counter,timing::Phase::Query);milliseconds=8; }
   milliseconds=12; }
 check(counter->phases[0].totalMs==12&&counter->phases[1].totalMs==5&&counter->activeSpans==0,"exact inclusive nested elapsed accounting");
 milliseconds=20;{timing::Span shortSpan(counter,timing::Phase::Capture);milliseconds=21;}
 check(counter->phases[0].maxMs==12&&counter->phases[0].maxStartedAtMs==0&&counter->phases[0].maxFinishedAtMs==12&&counter->phases[0].lastFinishedAtMs==21,"peak timestamps survive later fast operation");
 milliseconds=30;try {timing::query(counter,[&]() -> int {milliseconds=34;throw 7;});}catch(int){}
 check(counter->phases[1].count==2&&counter->phases[1].totalMs==9&&counter->activeSpans==0,"exception finalizes exact existing call once");
 auto next=std::make_shared<timing::State>([] { return milliseconds; });
 {timing::Span retired(counter,timing::Phase::Capture);counter->enabled=false;milliseconds=90;}
 check(counter->phases[0].count==2&&next->phases[0].count==0&&counter->activeSpans==0,"retired span cannot write into replacement session");
 milliseconds=40;{timing::Span badClock(next,timing::Phase::Query);milliseconds=39;}
 check(!next->valid&&next->phases[1].count==0,"reversed clock stays explicitly invalid");
 auto nonfinite=std::make_shared<timing::State>([]() -> double {return NAN;});{timing::Span badClock(nonfinite,timing::Phase::Capture);}
 check(!nonfinite->valid&&nonfinite->activeSpans==0,"nonfinite clock is never serialized as valid geometry");
 reads=timingClockReads;std::shared_ptr<timing::State> disabled;
 {timing::Span off(disabled,timing::Phase::Capture);check(timing::query(disabled,[]{return 42;})==42,"disabled wrapper preserves return");}
 check(timingClockReads==reads,"disabled spans do not read clock or create counter state");
 // Multi-fragment optimization controls preserve the actual provider, candidate,
 // exposure and coordinator. Only UIKit conversion and Paragraph delivery are modeled.
 useControlledFragments=true;
 auto emitWitnesses=[&](const char *label,const sr::Capture &value) {
   NSMutableArray *witnesses=[NSMutableArray new];
   for(const auto &item:value.witnesses) [witnesses addObject:@{@"row":@(item.rowKey.c_str()),@"point":@(item.pointKey.c_str()),@"role":@((int)item.role),@"order":@(item.originalOrder),@"y":@(item.savedWindowY)}];
   NSDictionary *result=@{@"case":@(label),@"available":@(value.available),@"witnesses":witnesses,@"reason":r.lastCapture[@"reason"]};
   NSString *encoded=[[NSString alloc]initWithData:[NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingSortedKeys error:nil] encoding:NSUTF8StringEncoding];
   printf("WITNESSES %s\n",encoded.UTF8String);
 };
 auto resetGeometry=[&] {
   p.hidden=NO;inner.host.hidden=NO;row.host.hidden=NO;p.alpha=1;inner.host.alpha=1;
   p.transform=CGAffineTransformIdentity;inner.host.transform=CGAffineTransformIdentity;
   p.bounds=CGRectMake(0,0,400,100);p.origin=CGPointMake(0,250);
   inner.host.bounds=p.bounds;inner.host.origin=p.origin;inner.host.clipsToBounds=NO;
   row.host.bounds=p.bounds;row.host.origin=p.origin;row.host.clipsToBounds=NO;
   controlledFragments={{CGRectMake(20,2,200,8),NSMakeRange(0,1)},{CGRectMake(20,43,200,10),NSMakeRange(1,1)},{CGRectMake(20,78,200,10),NSMakeRange(2,1)}};
 };
 resetGeometry();auto fragments=capture();check(fragments.available,"multi-fragment healthy capture");emitWitnesses("multiple",fragments);
 inner.host.clipsToBounds=YES;inner.host.bounds=CGRectMake(0,53,400,40);
 fragments=capture();check(fragments.available,"partial clipping selects current exposed fragment");emitWitnesses("clipped",fragments);
 resetGeometry();p.bounds=CGRectMake(.375,.125,399.625,99.6669921875);p.origin=CGPointMake(.25,250.3333333333333);
 controlledFragments={{CGRectMake(20.125,42.66666666666667,200.3333333333333,10.6669921875),NSMakeRange(0,1)},{CGRectMake(20,74,200,8),NSMakeRange(1,1)}};
 fragments=capture();check(fragments.available,"fractional bounds-origin fragments remain available");emitWitnesses("fractional",fragments);
 resetGeometry();duringTextQuery=[&]{inner.host.clipsToBounds=YES;inner.host.bounds=CGRectMake(0,53,400,40);p.origin=CGPointMake(0,253.25);};
 fragments=capture();check(fragments.available,"post-query clip and origin mutation is measured freshly");emitWitnesses("query-reflow",fragments);
 resetGeometry();duringTextQuery=[&]{inner.host.hidden=YES;};
 fragments=capture();check(!fragments.available,"query hides ancestor before fragment scan");emitWitnesses("query-hidden",fragments);
 resetGeometry();duringTextQuery=[&]{p.transform=CGAffineTransformMakeTranslation(0,1);};
 fragments=capture();check(!fragments.available,"query adds transform before fragment scan");emitWitnesses("query-transform",fragments);
 resetGeometry();controlledFragments.push_back({CGRectMake(NAN,0,1,1),NSMakeRange(9,1)});
 controlledFragments.push_back({CGRectMake(0,0,0,1),NSMakeRange(10,1)});
 fragments=capture();check(fragments.available,"invalid extra fragments cannot displace valid nearest fragment");emitWitnesses("invalid-fragments",fragments);
 resetGeometry();auto firstFresh=capture();inner.host.clipsToBounds=YES;inner.host.bounds=CGRectMake(0,53,400,40);auto secondFresh=capture();
 check(firstFresh.available&&secondFresh.available&&firstFresh.witnesses.front().savedWindowY!=secondFresh.witnesses.front().savedWindowY,"later capture cannot reuse old clipping");emitWitnesses("fresh-second",secondFresh);
 resetGeometry();
 // TARGET still prepares actual current candidates and can admit during that
 // exact same mount without another capture. No mode-only optimization.
 NSMutableDictionary *targetScope=[s.descriptor mutableCopy];targetScope[@"phase"]=@"target";s.descriptor=targetScope;
 sr::Coordinator coordinator;coordinator.setResident([&]{return std::make_shared<TlonNativeReadProvider>(r,s);});
 auto readMount=[&]{return m;};auto readViewport=[&]() -> std::optional<sr::Viewport>{return v;};
 check(!coordinator.prepare(readMount,readViewport)&&coordinator.diagnostic().provisional,"TARGET retains real provisional capture");
 NSUInteger beforeAdmit=r.captureAttempts;targetScope=[s.descriptor mutableCopy];targetScope[@"phase"]=@"read";targetScope[@"intent"]=@"new-read";s.descriptor=targetScope;
 coordinator.beginResident("new-read");check(coordinator.diagnostic().admitted&&r.captureAttempts==beforeAdmit,"same-mount admission preserves candidate without recapture");
 coordinator.setResident([&]{return std::make_shared<TlonNativeReadProvider>(r,s);});m.transaction++;
 duringTextQuery=[&]{coordinator.invalidate();};coordinator.prepare(readMount,readViewport);coordinator.beginResident("after-cancel");
 check(!coordinator.diagnostic().admitted&&!coordinator.diagnostic().provisional,"reentrant cancellation cannot publish old capture");
 check(!owner.scrollView.isDragging,"control native dragging remains false");owner.scrollView.isDragging=YES;
 TlonNativeReadProvider freshProvider(r,s);check(!freshProvider.admit(),"gesture still rejects native admission");owner.scrollView.isDragging=NO;
 // Both small and large scans must preserve exact witnesses. Conversion count
 // is work evidence, not a device-time target. Original source fails only the
 // bounded redundant-traversal assertion below after semantic outputs persist.
 resetGeometry();controlledFragments.clear();for(NSUInteger i=0;i<700;i++)controlledFragments.push_back({CGRectMake(20,i*2,200,1),NSMakeRange(i,1)});
 g=geometryQueries;t=textQueries;fragments=capture();NSUInteger manyGeometry=geometryQueries-g,manyText=textQueries-t;
 check(fragments.available&&manyText==2,"many fragments retain the actual two-query candidate path");emitWitnesses("many-fragments",fragments);
 printf("WORK geometry=%lu text=%lu checksBeforeBound=%d\n",(unsigned long)manyGeometry,(unsigned long)manyText,checks);fflush(stdout);
 check(manyGeometry<100,"multi-fragment scan performs one shared ancestor traversal rather than one per fragment");


 resetGeometry();useControlledFragments=false;controlledFragments.clear();
 // Actual bridge controls: no provider geometry or membership request state
 // supplies this snapshot; it comes from the currently attached native scope.
 auto membership=[&]{return [TlonReadRegistration diagnosticForScrollView:owner.scrollView][@"committedMembership"];};
 auto unavailable=[&]{NSDictionary*x=membership();return [x[@"status"] isEqual:@"unavailable"]&&[x[@"issues"] count]>0&&!x[@"rows"]&&!x[@"scopeIdentity"];};
 s.descriptor=scope();syncTiming(r,s);g=geometryQueries;t=textQueries;reads=timingClockReads;
 NSDictionary *first=membership();
 check([first[@"status"] isEqual:@"ok"],"native bridge exposes committed membership");
 check([first[@"scope"] isEqual:s.descriptor[@"scope"]]&&[first[@"visit"] isEqual:s.descriptor[@"visit"]]&&[first[@"dataRevision"] isEqual:@"1"]&&[first[@"rows"] isEqual:s.descriptor[@"rows"]],"exact current parsed descriptor copied");
 check(g==geometryQueries&&t==textQueries&&reads==timingClockReads,"membership getter performs no geometry TextKit or timing read");
 check([first[@"scopeIdentity"] isEqual:membership()[@"scopeIdentity"]],"same physical registration and host identity stable");
 auto publish=[&](NSDictionary *d){NSData*data=[NSJSONSerialization dataWithJSONObject:d options:0 error:nil];s.descriptor=TlonReadParseDescriptor([[NSString alloc]initWithData:data encoding:NSUTF8StringEncoding],YES);};
 NSMutableDictionary *d=[scope() mutableCopy];d[@"dataRevision"]=@"2";d[@"rows"]=@[@{@"key":@"unmounted",@"revision":@"9"},@{@"key":@"secret-key",@"revision":@"1"}];publish(d);
 check([membership()[@"rows"] isEqual:d[@"rows"]],"ordered loaded membership includes unmounted rows");
 check([first[@"rows"] count]==1&&[first[@"dataRevision"] isEqual:@"1"],"prior membership snapshot immutable after publication");
 NSArray *currentRows=membership()[@"rows"];NSDictionary *saveInner=inner.descriptor;inner.descriptor=@{@"kind":@"text",@"revision":@"cache-only"};
 check([membership()[@"rows"] isEqual:currentRows]&&[membership()[@"dataRevision"] isEqual:@"2"],"cache-only inner semantics do not invent membership revisions");inner.descriptor=saveInner;
 d[@"dataRevision"]=@"3";d[@"rows"]=@[@{@"key":@"unmounted",@"revision":@"9"}];publish(d);
 check([membership()[@"rows"] count]==1&&[membership()[@"rows"][0][@"key"] isEqual:@"unmounted"],"committed removal changes membership despite old mounted row");
 d[@"dataRevision"]=@"4";d[@"rows"]=@[@{@"key":@"secret-key",@"revision":@"10"}];publish(d);
 check([membership()[@"rows"][0][@"revision"] isEqual:@"10"],"reinsert incarnation copied without reusing old revision");
 d[@"phase"]=@"follow";publish(d);check([membership()[@"status"] isEqual:@"ok"],"FOLLOW membership does not require READ admission");
 d[@"phase"]=@"target";publish(d);check([membership()[@"status"] isEqual:@"ok"],"TARGET membership does not require READ admission");
 d[@"phase"]=@"inactive";publish(d);check(unavailable(),"inactive app ownership unavailable while native screen is retained");
 d=[scope() mutableCopy];d[@"extra"]=@"private-content";d[@"rows"]=@[@{@"key":@"secret-key",@"revision":@"1",@"content":@"do-not-copy"}];publish(d);
 check([membership() count]==7&&[membership()[@"rows"][0] count]==2,"only declared scope and row fields exposed");
 for(id bad in @[@[],@[@{@"key":@"same",@"revision":@"1"},@{@"key":@"same",@"revision":@"2"}],@[@{@"key":@"x"}],@[@{@"key":@4,@"revision":@"1"}]]) {
  NSMutableDictionary *badScope=[scope() mutableCopy];badScope[@"rows"]=bad;
  if([bad count]==0)badScope[@"dataRevision"]=@"";
  publish(badScope);check(unavailable(),"malformed or duplicate parsed scope unavailable");
 }
 s.descriptor=scope();s.registry=nil;check(unavailable(),"retired registration unavailable");s.registry=r;
 r.activeScope=nil;check(unavailable(),"no active scope unavailable");r.activeScope=s;
 [r.registrations removeObject:s];check(unavailable(),"unregistered active scope unavailable");[r.registrations addObject:s];
 objc_setAssociatedObject(s.host,&RegistrationKey,nil,OBJC_ASSOCIATION_ASSIGN);check(unavailable(),"host association retired unavailable");objc_setAssociatedObject(s.host,&RegistrationKey,s,OBJC_ASSOCIATION_ASSIGN);
 auto actualWindow=s.host.window;s.host.window=nil;check(unavailable(),"detached physical scope unavailable");s.host.window=actualWindow;
 UIWindow *otherWindow=[UIWindow new];otherWindow.window=otherWindow;s.host.window=otherWindow;check(unavailable(),"different scope window unavailable");s.host.window=actualWindow;
 UIView *parent=s.host.superview;s.host.superview=w;check(unavailable(),"scope moved outside owning scroll unavailable");s.host.superview=parent;
 auto oldOwner=r.owner;r.owner=nil;check(unavailable(),"registry owner retired unavailable");r.owner=oldOwner;
 screen.nativeReadingVisible=NO;check(unavailable(),"covered actual screen unavailable");screen.nativeReadingVisible=YES;
 auto actualScreen=r.screen;RNSScreenView *wrongScreen=[RNSScreenView new];r.screen=wrongScreen;check(unavailable(),"stale registered screen unavailable");r.screen=actualScreen;
 TlonReadRegistration *duplicate=[TlonReadRegistration new];duplicate.scope=YES;duplicate.registry=r;duplicate.descriptor=s.descriptor;UIView*duplicateHost=[UIView new];duplicate.host=duplicateHost;attach(duplicate.host,owner.scrollView,w);objc_setAssociatedObject(duplicate.host,&RegistrationKey,duplicate,OBJC_ASSOCIATION_ASSIGN);[r.registrations addObject:duplicate];
 check(unavailable(),"duplicate attached scope unavailable");[r.registrations removeObject:duplicate];
 UIScrollView *nested=[UIScrollView new];attach(nested,owner.scrollView,w);
 check([[TlonReadRegistration diagnosticForScrollView:nested][@"committedMembership"][@"status"] isEqual:@"unavailable"],"nested scroll cannot stand in for measured owned scroll");
 NSDictionary *oldSnapshot=membership();NSString *oldIdentity=oldSnapshot[@"scopeIdentity"];
 TlonReadRegistration *replacement=[TlonReadRegistration new];replacement.scope=YES;replacement.host=s.host;replacement.registry=r;replacement.descriptor=s.descriptor;objc_setAssociatedObject(s.host,&RegistrationKey,replacement,OBJC_ASSOCIATION_ASSIGN);[r.registrations removeObject:s];[r.registrations addObject:replacement];r.activeScope=replacement;
 check([membership()[@"status"] isEqual:@"ok"]&&![membership()[@"scopeIdentity"] isEqual:oldIdentity],"same native host new registration cannot alias scope identity");
 [r.registrations removeObject:replacement];[r.registrations addObject:s];r.activeScope=s;objc_setAssociatedObject(s.host,&RegistrationKey,s,OBJC_ASSOCIATION_ASSIGN);
 check([membership()[@"scopeIdentity"] isEqual:oldIdentity],"observed registration ABA remains visible as old exact identity");
 UIView *newHost=[UIView new];attach(newHost,owner.scrollView,w);s.host=newHost;objc_setAssociatedObject(newHost,&RegistrationKey,s,OBJC_ASSOCIATION_ASSIGN);
 check(![membership()[@"scopeIdentity"] isEqual:oldIdentity],"new physical host cannot alias retained registration identity");
 check([oldSnapshot[@"scopeIdentity"] isEqual:oldIdentity]&&[oldSnapshot[@"rows"] count]==1,"old copied scope identity and rows remain immutable");
 d=[scope() mutableCopy];d[@"rows"]=@[];publish(d);check([membership()[@"status"] isEqual:@"ok"]&&[membership()[@"rows"] count]==0,"valid committed empty list is distinct from unavailable");
 s.descriptor=scope();ownerLookupCountdown=3;
 duringOwnerLookup=[&]{NSMutableDictionary *changed=[scope() mutableCopy];changed[@"dataRevision"]=@"99";s.descriptor=changed;};
 check(unavailable(),"publication during native owner verification cannot return mixed membership");
 check([membership()[@"dataRevision"] isEqual:@"99"],"next atomic capture sees the new committed descriptor");
 NSDictionary *background=nil;
 std::thread worker([&]{@autoreleasepool{background=[TlonReadRegistration diagnosticForScrollView:owner.scrollView];}});worker.join();
 check([background[@"committedMembership"][@"status"] isEqual:@"unavailable"]&&![background[@"available"] boolValue],"off-main capture unavailable before touching native geometry");

 // Same-operation physical row/cell binding. Actual bridge/helper bodies;
 // UIKit view tree and native callback reentrancy remain explicitly modeled.
 s.descriptor=scope();s.host=newHost;s.registry=r;r.activeScope=s;
 UIView *cell=[UIView new], *wrapper=[UIView new];attach(cell,owner.scrollView,w);attach(wrapper,cell,w);attach(rowHost,wrapper,w);
 cell.subviews=@[wrapper];wrapper.subviews=@[rowHost];rowHost.subviews=@[innerHost];
 row.host=rowHost;row.registry=r;[r.registrations addObject:row];
 objc_setAssociatedObject(rowHost,&RegistrationKey,row,OBJC_ASSOCIATION_ASSIGN);
 NSDictionary *goodRow=@{@"version":@1,@"scope":@"secret-scope",@"visit":@"secret-visit",@"key":@"secret-key",@"revision":@"1",@"kind":@"row",@"blocks":@[]};row.descriptor=goodRow;
 NSString *rowID=@"scroll-row-secret-key", *cellID=@"scroll-cell-secret-key";
 wrapper.accessibilityIdentifier=rowID;cell.accessibilityIdentifier=cellID;
 auto semantic=[](NSString *key, NSString *scope){return [[NSString alloc]initWithData:[NSJSONSerialization dataWithJSONObject:@{@"version":@1,@"scope":scope,@"key":key,@"signature":@{@"content":@"rendered",@"reactions":@"",@"replies":@0}} options:0 error:nil] encoding:NSUTF8StringEncoding];};
 wrapper.accessibilityValue=semantic(@"secret-key",@"fixture-scope");cell.accessibilityValue=wrapper.accessibilityValue;
 NSDictionary *rowViews=@{rowID:@[wrapper]}, *cellViews=@{cellID:@[cell]};
 auto boundSnapshot=[&]{
  if (![TlonReadRegistration respondsToSelector:@selector(diagnosticForScrollView:measuredRows:indexedCells:)])
   return @{@"rowBindings":@{@"version":@1,@"status":@"unavailable",@"issues":@[@"binding-api-unavailable"]}};
  return [TlonReadRegistration diagnosticForScrollView:owner.scrollView measuredRows:rowViews indexedCells:cellViews];
 };
 auto binding=[&]{NSDictionary *x=boundSnapshot()[@"rowBindings"];return [x[@"status"] isEqual:@"ok"]?[x[@"rows"] firstObject]:x;};
 auto bound=[&]{return [binding()[@"status"] isEqual:@"ok"];};
 auto notBound=[&]{NSDictionary*x=binding();return [x[@"status"] isEqual:@"unavailable"]&&[x[@"issues"] count]>0&&!x[@"revision"]&&!x[@"rowViewIdentity"];};
 g=geometryQueries;t=textQueries;reads=timingClockReads;NSDictionary *firstBinding=binding();
 check([firstBinding[@"status"] isEqual:@"ok"],"actual associated row binds exact measured wrapper and cell");
 check([firstBinding[@"key"] isEqual:@"secret-key"]&&[firstBinding[@"revision"] isEqual:@"1"]&&[firstBinding[@"fixtureScope"] isEqual:@"fixture-scope"],"incarnation and fixture scope are distinct native evidence");
 check([firstBinding[@"rowViewIdentity"] isEqual:[TlonReadRegistration diagnosticIdentityForView:wrapper]]&&[firstBinding[@"cellViewIdentity"] isEqual:[TlonReadRegistration diagnosticIdentityForView:cell]],"native UUIDs join the actual measured UIKit views");
 check(g==geometryQueries&&t==textQueries&&reads==timingClockReads,"binding adds no provider geometry query TextKit work or timing read");
 check([boundSnapshot()[@"committedMembership"][@"scopeIdentity"] isEqual:boundSnapshot()[@"rowBindings"][@"scopeIdentity"]],"binding copies exact current membership scope identity");
 NSString *oldSemantic=wrapper.accessibilityValue;
 wrapper.accessibilityValue=semantic(@"wrong-key",@"fixture-scope");check(notBound(),"wrong inner key unavailable");wrapper.accessibilityValue=oldSemantic;
 cell.accessibilityValue=semantic(@"wrong-key",@"fixture-scope");check(notBound(),"wrong outer key unavailable");cell.accessibilityValue=oldSemantic;
 cell.accessibilityValue=semantic(@"secret-key",@"other-fixture");check(notBound(),"inner outer fixture scope disagreement unavailable");cell.accessibilityValue=oldSemantic;
 wrapper.accessibilityValue=@"{}";check(notBound(),"malformed native row metadata unavailable");wrapper.accessibilityValue=oldSemantic;
 wrapper.accessibilityIdentifier=@"stale-row-tag";check(notBound(),"actual row ID must match sampler inventory");wrapper.accessibilityIdentifier=rowID;
 cell.accessibilityIdentifier=@"scroll-cell-wrong";check(notBound(),"actual cell ID must match sampler inventory");cell.accessibilityIdentifier=cellID;
 rowViews=@{rowID:@[wrapper,wrapper]};check(notBound(),"duplicate measured rows unavailable");rowViews=@{rowID:@[wrapper]};
 cellViews=@{cellID:@[cell,cell]};check(notBound(),"duplicate indexed cells unavailable");cellViews=@{cellID:@[cell]};
 rowViews=@{rowID:@[]};check(notBound(),"loaded unmounted row unavailable never deleted");rowViews=@{rowID:@[wrapper]};
 NSMutableDictionary *changed=[goodRow mutableCopy];changed[@"revision"]=@"old";row.descriptor=changed;check(notBound(),"stale registered incarnation cannot bind current membership");row.descriptor=goodRow;
 changed=[goodRow mutableCopy];changed[@"visit"]=@"old-visit";row.descriptor=changed;check(notBound(),"row registration from another visit unavailable");row.descriptor=goodRow;
 changed=[scope() mutableCopy];changed[@"rows"]=@[];s.descriptor=changed;check(notBound(),"old native row remaining after committed deletion is unavailable");
 changed=[scope() mutableCopy];changed[@"rows"]=@[@{@"key":@"secret-key",@"revision":@"2"}];s.descriptor=changed;check(notBound(),"reinserted key cannot reuse old native incarnation");
 changed=[goodRow mutableCopy];changed[@"revision"]=@"2";row.descriptor=changed;check(bound()&&[binding()[@"revision"] isEqual:@"2"],"fresh reinsert incarnation binds same retained physical host");s.descriptor=scope();row.descriptor=goodRow;
 objc_setAssociatedObject(rowHost,&RegistrationKey,nil,OBJC_ASSOCIATION_ASSIGN);check(notBound(),"missing native host registration association unavailable");objc_setAssociatedObject(rowHost,&RegistrationKey,row,OBJC_ASSOCIATION_ASSIGN);
 [r.registrations removeObject:row];check(notBound(),"associated but unregistered row unavailable");[r.registrations addObject:row];
 row.registry=nil;check(notBound(),"retired registry row unavailable");row.registry=r;
 rowHost.window=nil;check(notBound(),"detached row host unavailable");rowHost.window=w;
 wrapper.superview=owner.scrollView;check(notBound(),"measured wrapper must belong to exact indexed cell");wrapper.superview=cell;
 UIView *nestedCell=[UIView new];nestedCell.accessibilityIdentifier=@"scroll-cell-nested";attach(nestedCell,cell,w);wrapper.superview=nestedCell;check(notBound(),"nearest indexed cell cannot be replaced by outer ancestor");wrapper.superview=cell;
 rowHost.superview=cell;check(notBound(),"registration physically outside measured row unavailable");rowHost.superview=wrapper;
 TlonReadRegistration *another=[TlonReadRegistration new];UIView *anotherHost=[UIView new];another.host=anotherHost;another.registry=r;another.descriptor=goodRow;attach(anotherHost,owner.scrollView,w);objc_setAssociatedObject(anotherHost,&RegistrationKey,another,OBJC_ASSOCIATION_ASSIGN);[r.registrations addObject:another];
 check(notBound(),"duplicate same-key current registration elsewhere unavailable");[r.registrations removeObject:another];
 attach(anotherHost,wrapper,w);wrapper.subviews=@[rowHost,anotherHost];check(notBound(),"unregistered extra associated row in wrapper unavailable");wrapper.subviews=@[rowHost];
 screen.nativeReadingVisible=NO;check(notBound(),"covered screen makes binding unavailable");screen.nativeReadingVisible=YES;
 changed=[goodRow mutableCopy];changed[@"blocks"]=@[@{@"id":@"changed",@"revision":@"2",@"kind":@"text"}];row.descriptor=changed;check(bound(),"cache content update preserves row incarnation binding");row.descriptor=goodRow;
 another.host=rowHost;another.descriptor=goodRow;objc_setAssociatedObject(rowHost,&RegistrationKey,another,OBJC_ASSOCIATION_ASSIGN);[r.registrations removeObject:row];[r.registrations addObject:another];
 check(bound()&&![binding()[@"registrationIdentity"] isEqual:firstBinding[@"registrationIdentity"]],"same host replacement registration has fresh lifetime identity");
 [r.registrations removeObject:another];[r.registrations addObject:row];objc_setAssociatedObject(rowHost,&RegistrationKey,row,OBJC_ASSOCIATION_ASSIGN);
 check([binding()[@"registrationIdentity"] isEqual:firstBinding[@"registrationIdentity"]],"observed registration ABA is explicitly identifiable");
 UIView *replacementRowHost=[UIView new];attach(replacementRowHost,wrapper,w);row.host=replacementRowHost;objc_setAssociatedObject(replacementRowHost,&RegistrationKey,row,OBJC_ASSOCIATION_ASSIGN);wrapper.subviews=@[replacementRowHost];
 check(bound()&&![binding()[@"hostIdentity"] isEqual:firstBinding[@"hostIdentity"]],"same registration replacement physical host has fresh lifetime identity");row.host=rowHost;wrapper.subviews=@[rowHost];
 check([firstBinding[@"revision"] isEqual:@"1"]&&[firstBinding[@"rowViewIdentity"] isEqual:[TlonReadRegistration diagnosticIdentityForView:wrapper]],"old copied binding immutable across replacement");
 ownerLookupCountdown=5;duringOwnerLookup=[&]{NSMutableDictionary *next=[scope() mutableCopy];next[@"dataRevision"]=@"different";s.descriptor=next;};
 check(notBound(),"scope publication during binding cannot publish mixed membership");duringOwnerLookup={};s.descriptor=scope();
 ownerLookupCountdown=5;duringOwnerLookup=[&]{row.descriptor=@{@"kind":@"row",@"scope":@"secret-scope",@"visit":@"secret-visit",@"key":@"secret-key",@"revision":@"retired"};};
 check(notBound(),"row publication during binding cannot publish stale incarnation");duringOwnerLookup={};row.descriptor=goodRow;
 ownerLookupCountdown=9;duringOwnerLookup=[&]{row.descriptor=@{@"kind":@"row",@"scope":@"secret-scope",@"visit":@"secret-visit",@"key":@"secret-key",@"revision":@"late-retired"};};
 check(notBound(),"selected row publication during final owner validation unavailable");duringOwnerLookup={};row.descriptor=goodRow;
 another.host=anotherHost;another.registry=r;another.descriptor=goodRow;attach(anotherHost,owner.scrollView,w);objc_setAssociatedObject(anotherHost,&RegistrationKey,another,OBJC_ASSOCIATION_ASSIGN);
 ownerLookupCountdown=9;duringOwnerLookup=[&]{[r.registrations addObject:another];};
 check(notBound(),"late duplicate registration cannot bypass snapshot index");duringOwnerLookup={};[r.registrations removeObject:another];
 NSMutableDictionary *otherRow=[goodRow mutableCopy];otherRow[@"key"]=@"other";another.descriptor=otherRow;[r.registrations addObject:another];
 ownerLookupCountdown=9;duringOwnerLookup=[&]{another.descriptor=goodRow;};
 check(notBound(),"late descriptor retarget cannot bypass snapshot key index");duringOwnerLookup={};[r.registrations removeObject:another];
 rowHost.hidden=YES;check(notBound(),"hidden registered body unavailable despite visible measured wrapper");rowHost.hidden=NO;
 ownerLookupCountdown=9;duringOwnerLookup=[&]{wrapper.accessibilityIdentifier=@"recycled-row-id";};
 check(notBound(),"late measured-row retag cannot publish old inventory binding");duringOwnerLookup={};wrapper.accessibilityIdentifier=rowID;
 ownerLookupCountdown=9;duringOwnerLookup=[&]{objc_setAssociatedObject(owner,&RegistryKey,nil,OBJC_ASSOCIATION_RETAIN_NONATOMIC);};
 check(notBound(),"late actual registry association retirement unavailable");duringOwnerLookup={};objc_setAssociatedObject(owner,&RegistryKey,r,OBJC_ASSOCIATION_RETAIN_NONATOMIC);
 changed=[goodRow mutableCopy];[changed removeObjectForKey:@"version"];row.descriptor=changed;check(notBound(),"malformed native row descriptor unavailable");row.descriptor=goodRow;
 check(bound(),"later fresh observation recovers without changing native authority");

 printf("PASS %d actual provider diagnostic controls; modeled UIKit/TextKit delivery only\n",checks);
}}
