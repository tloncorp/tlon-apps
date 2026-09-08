#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import "../TlonReadDescriptors.h"
#include "../TlonReadDurations.h"
namespace timing = tlon::read_durations;
#include <memory>
#include <functional>
#include <cstdio>

static NSUInteger timingClockReads=0;
static double CACurrentMediaTime() { ++timingClockReads; return 10; }

// These stand-ins deliver lifecycle callbacks to the exact production Registry
// implementation. They do not simulate UIKit layout or validate glyph pixels.
@interface UIView : NSObject
@property(nonatomic, weak) UIView *superview;
@property(nonatomic, weak) UIView *window;
@end
@implementation UIView @end
@interface UIScrollView : UIView
@property(nonatomic) BOOL isDragging,isDecelerating,isTracking;
@property(nonatomic) CGPoint contentOffset;
@property(nonatomic) CGRect bounds;
@property(nonatomic) CGSize contentSize;
@property(nonatomic) struct Insets { double top,left,bottom,right; } adjustedContentInset;
@end
@implementation UIScrollView @end
@class RNSScreenView;
@protocol UIScrollViewDelegate @end
@protocol RNSNativeReadingLifecycleListener
- (void)screen:(RNSScreenView *)screen readingVisibilityDidChange:(BOOL)visible;
@end
@interface RNSScreenView : UIView
@property(nonatomic) BOOL nativeReadingVisible;
@property(nonatomic) NSHashTable *listeners;
- (void)addNativeReadingLifecycleListener:(id)listener;
- (void)removeNativeReadingLifecycleListener:(id)listener;
@end
@implementation RNSScreenView
- (instancetype)init { if ((self=[super init])) _listeners=[NSHashTable weakObjectsHashTable]; return self; }
- (void)addNativeReadingLifecycleListener:(id)listener { [_listeners addObject:listener]; }
- (void)removeNativeReadingLifecycleListener:(id)listener { [_listeners removeObject:listener]; }
@end
namespace sr { class Provider { public: virtual ~Provider()=default; }; }
class TlonNativeReadProvider : public sr::Provider {
 public: TlonNativeReadProvider(id, id) {}
};
@interface RCTScrollViewComponentView : UIView { @public std::function<bool()> followValidator; }
@property(nonatomic) UIScrollView *scrollView;
@property(nonatomic) NSInteger begins, retires, factoryChanges, follows;
@property(nonatomic) BOOL active;
@property(nonatomic, copy) NSString *admittedIntent;
- (void)setReadPointProviderFactory:(std::function<std::shared_ptr<sr::Provider>()>)factory;
- (void)beginReadPointLeaseFromResident:(NSString *)intent;
- (void)beginFollowEndLease:(NSString *)intent isCurrent:(std::function<bool()>)isCurrent;
+ (RCTScrollViewComponentView *)findScrollViewComponentViewForView:(UIView *)view;
- (void)invalidateReadPointLease;
@end
@implementation RCTScrollViewComponentView
+ (RCTScrollViewComponentView *)findScrollViewComponentViewForView:(UIView *)view {for(UIView*v=view;v;v=v.superview)if([v isKindOfClass:self])return (RCTScrollViewComponentView*)v;return nil;}
- (void)beginFollowEndLease:(NSString *)intent isCurrent:(std::function<bool()>)isCurrent {++_follows;_active=YES;_admittedIntent=[intent copy];followValidator=std::move(isCurrent);}
- (void)setReadPointProviderFactory:(std::function<std::shared_ptr<sr::Provider>()>)factory { (void)factory; ++_factoryChanges; }
- (void)beginReadPointLeaseFromResident:(NSString *)intent { ++_begins; _active=YES; _admittedIntent=[intent copy]; }
- (void)invalidateReadPointLease { ++_retires; _active=NO; }
@end
@class TlonReadRegistry;
@interface TlonReadRegistration : NSObject
@property(nonatomic) BOOL scope;
@property(nonatomic) UIView *host;
@property(nonatomic, copy) NSDictionary *descriptor;
@property(nonatomic, weak) TlonReadRegistry *registry;
@end
@implementation TlonReadRegistration @end
#include "registry-actual.inc"
static int checks=0,failures=0;
static void check(BOOL value,const char *name) { ++checks; if(!value){fprintf(stderr,"FAIL %s\n",name);++failures;} }
static NSDictionary *scope(NSString *intent,NSString *phase,NSString *revision=@"1") {
 return @{@"version":@1,@"scope":@"a",@"visit":@"v1",@"intent":intent,@"phase":phase,@"dataRevision":revision,@"rows":@[]};
}
int main(){ @autoreleasepool {
 UIView *window=[UIView new]; window.window=window;
 RNSScreenView *screen=[RNSScreenView new];screen.nativeReadingVisible=YES;screen.window=window;
 RCTScrollViewComponentView *owner=[RCTScrollViewComponentView new];owner.superview=screen;owner.window=window;
 owner.scrollView=[UIScrollView new];owner.scrollView.window=window;owner.scrollView.contentSize=CGSizeMake(400,2000);owner.scrollView.bounds=CGRectMake(0,0,400,600);
 TlonReadRegistry *r=[TlonReadRegistry new];r.owner=owner;
 TlonReadRegistration *s=[TlonReadRegistration new];s.scope=YES;s.host=[UIView new];s.host.window=window;s.host.superview=owner;s.registry=r;s.descriptor=scope(@"1",@"read");[r.registrations addObject:s];
 [r update:YES];check(owner.active&&owner.begins==1,"visible-fresh-read-admission");
 check([r.providerDiagnostic[@"registration"][@"reason"] isEqual:@"admission-requested"],"cached registration records actual admission request");
 check([owner.admittedIntent isEqual:@"1"],"exact-descriptor-intent-reaches-native-admission");
 s.descriptor=scope(@"1",@"read",@"2");[r update:YES];check(owner.begins==1,"data-update-not-new-read");
 [owner invalidateReadPointLease];[r update:YES];check(!owner.active&&owner.begins==1,"native-command-cancellation-not-revived-by-data");
 s.descriptor=scope(@"2",@"read");[r update:YES];check(owner.active&&owner.begins==2,"new-explicit-intent-admits");
 screen.nativeReadingVisible=NO;[r screen:screen readingVisibilityDidChange:NO];check(!owner.active,"native-cover-immediate-revoke");
 s.descriptor=scope(@"2",@"read",@"3");[r update:YES];check(!owner.active&&owner.begins==2,"covered-data-does-not-admit");
 check([r.providerDiagnostic[@"registration"][@"reason"] isEqual:@"invisible-owner"],"cached registration identifies invisible owner");
 RNSScreenView *old=[RNSScreenView new];[r screen:old readingVisibilityDidChange:YES];check(!owner.active,"stale-screen-appearance-rejected");
 screen.nativeReadingVisible=YES;[r screen:screen readingVisibilityDidChange:YES];check(owner.active&&owner.begins==3,"appearance-new-lease");
 [r scrollViewWillBeginDragging:owner.scrollView];check(!owner.active,"native-drag-revokes");
 owner.scrollView.contentOffset=CGPointMake(0,500);[r scrollViewDidEndDragging:owner.scrollView willDecelerate:YES];check(!owner.active,"no-admission-before-deceleration-end");
 [r scrollViewDidEndDecelerating:owner.scrollView];check(owner.active&&owner.begins==4,"stationary-read-after-gesture");
 [r scrollViewWillBeginDragging:owner.scrollView];owner.scrollView.contentOffset=CGPointMake(0,1400);[r scrollViewDidEndDragging:owner.scrollView willDecelerate:NO];check(!owner.active&&owner.begins==4,"legal-end-does-not-create-read");
 s.descriptor=scope(@"3",@"target");[r update:YES];check(!owner.active,"explicit-target-retires-read");
 [r scrollViewWillBeginDragging:owner.scrollView];owner.scrollView.contentOffset=CGPointMake(0,300);[r scrollViewDidEndDragging:owner.scrollView willDecelerate:NO];check(!owner.active,"target-phase-cannot-rearm-on-gesture-end");
 s.descriptor=scope(@"4",@"read");[r update:YES];check(owner.active&&owner.begins==5,"explicit-read-after-target");
 s.descriptor=nil;[r update:YES];check(!owner.active,"invalid-descriptor-retains-unavailable");
 check([r.providerDiagnostic[@"registration"][@"reason"] isEqual:@"bad-current-descriptor"],"bad descriptor recorded without new capture");
 s.descriptor=scope(@"4",@"read",@"5");[r update:YES];check(!owner.active&&owner.begins==5,"invalid-then-data-does-not-revive-old-intent");
 s.descriptor=scope(@"5",@"follow");[r update:YES];NSInteger retired=owner.retires;
 s.descriptor=scope(@"5",@"follow",@"6");[r update:NO];check(owner.retires==retired,"follow-data-preserves-provisional-transaction");
 s.descriptor=scope(@"6",@"target");[r update:YES];retired=owner.retires;
 s.descriptor=scope(@"6",@"target",@"7");[r update:NO];check(owner.retires==retired,"target-data-preserves-provisional-transaction");
 s.descriptor=scope(@"timed-read",@"read");[r update:YES];
 NSInteger begins=owner.begins, retires=owner.retires, factories=owner.factoryChanges;
 auto members=r.registrations;NSUInteger memberCount=members.count;
 auto oldLease=r.leaseDescriptor;auto oldFactory=r.factoryDescriptor;
 NSUInteger clocks=timingClockReads;
 for(id token in @[@"r13:one",@"r13:two",@"bad token",NSNull.null]) {
  NSMutableDictionary *d=[s.descriptor mutableCopy];
  if(token==NSNull.null)[d removeObjectForKey:@"diagnosticTimingSession"];else d[@"diagnosticTimingSession"]=token;
  s.descriptor=d;[r update:YES];
  check(owner.active&&owner.begins==begins&&owner.retires==retires&&owner.factoryChanges==factories,"timing metadata preserves admission and native writer lifecycle");
  check(r.activeScope==s&&r.registrations==members&&r.registrations.count==memberCount&&r.leaseDescriptor==oldLease&&r.factoryDescriptor==oldFactory,"timing metadata preserves physical registrations and reading identity");
 }
 check(clocks==timingClockReads,"enabling and resetting timing takes no clock reading");
 NSMutableDictionary *d=[s.descriptor mutableCopy];d[@"diagnosticTimingSession"]=@"r13:one";s.descriptor=d;[r update:NO];auto timingA=r.durationCounters;
 check(timingA&&r.durationScope==s,"valid session bound to actual physical scope");
 d=[s.descriptor mutableCopy];d[@"visit"]=@"new-visit";s.descriptor=d;[r update:NO];
 check(r.durationCounters!=timingA&&!timingA->enabled,"visit replacement retires old timing ownership");
 TlonReadRegistration *replacement=[TlonReadRegistration new];replacement.scope=YES;replacement.host=s.host;replacement.registry=r;replacement.descriptor=s.descriptor;
 [r.registrations removeObject:s];[r.registrations addObject:replacement];auto oldCounter=r.durationCounters;[r update:NO];
 check(r.durationCounters!=oldCounter&&!oldCounter->enabled,"same descriptor new physical scope resets timing");
 [r.registrations removeObject:replacement];[r update:NO];check(!r.durationCounters,"detached scope disables timing");
 // Independent FOLLOW admission checks; the coordinator tests own native writes.
 [r.registrations removeAllObjects];[r update:NO];
 TlonReadRegistration *f=[TlonReadRegistration new];f.scope=YES;f.host=[UIView new];f.host.window=window;f.host.superview=owner;f.registry=r;f.descriptor=scope(@"follow-A",@"follow");[r.registrations addObject:f];
 NSInteger oldFollows=owner.follows,oldBegins=owner.begins;
 [r update:YES];check(owner.active&&owner.follows==oldFollows+1,"fresh completed FOLLOW admits native boundary");
 check(owner.begins==oldBegins,"FOLLOW does not manufacture READ admission");
 check([owner.admittedIntent isEqual:@"follow-A"],"FOLLOW exact serialized intent delivered");
 check(owner->followValidator&&owner->followValidator(),"FOLLOW actual current physical scope validator");
 f.descriptor=scope(@"follow-A",@"follow",@"2");[r update:YES];check(owner.follows==oldFollows+1,"FOLLOW data does not rearm");
 [owner invalidateReadPointLease];[r update:YES];check(!owner.active&&owner.follows==oldFollows+1,"native command tombstone survives same FOLLOW data");
 f.descriptor=scope(@"follow-B",@"target");[r update:YES];check(!owner.active&&owner.follows==oldFollows+1,"pending latest target cannot grant FOLLOW");
 f.descriptor=scope(@"follow-B",@"follow");[r update:YES];check(owner.active&&owner.follows==oldFollows+2,"fresh latest completion grants FOLLOW");
 auto previousValidator=owner->followValidator;
 f.descriptor=scope(@"follow-C",@"target");check(previousValidator&&!previousValidator(),"published target invalidates old native FOLLOW validator before registry callback");[r update:YES];
 f.descriptor=scope(@"follow-C",@"follow");[r update:YES];check(owner.active&&owner.follows==oldFollows+3,"next exact completion eligible");
 screen.nativeReadingVisible=NO;check(owner->followValidator&&!owner->followValidator(),"native screen visibility immediately rejects FOLLOW");[r screen:screen readingVisibilityDidChange:NO];
 screen.nativeReadingVisible=YES;[r screen:screen readingVisibilityDidChange:YES];check(!owner.active&&owner.follows==oldFollows+3,"screen appearance cannot revive same FOLLOW intent");
 f.descriptor=scope(@"follow-D",@"follow");[r update:YES];[r scrollViewWillBeginDragging:owner.scrollView];[r update:YES];check(!owner.active&&owner.follows==oldFollows+4,"native gesture cancellation not revived by data");
 f.descriptor=scope(@"follow-E",@"follow");[r update:YES];UIView*foreign=[UIView new];f.host.window=foreign;
 check(owner->followValidator&&!owner->followValidator(),"FOLLOW rejects physical scope window replacement");f.host.window=window;
 f.descriptor=scope(@"read-fresh",@"read");[r update:YES];check(owner.begins==oldBegins+1&&owner.active,"fresh READ after FOLLOW retains original path");
 [r scrollViewDidEndDragging:owner.scrollView willDecelerate:NO];
 NSInteger beforeFollow=owner.follows;
 f.descriptor=scope(@"follow-delivered",@"follow");[r update:NO];
 check(owner.follows==beforeFollow,"FOLLOW admission requires changed scope publication, not child data");
 [r update:YES];check(owner.follows==beforeFollow+1,"fresh scope completion admits after data-only update");
 auto attachedValidator=owner->followValidator;
 TlonReadRegistration *duplicate=[TlonReadRegistration new];duplicate.scope=YES;duplicate.host=f.host;duplicate.registry=r;duplicate.descriptor=f.descriptor;[r.registrations addObject:duplicate];
 [r update:YES];check(!owner.active&&attachedValidator&&!attachedValidator(),"ambiguous scope immediately retires native FOLLOW");
 [r.registrations removeObject:duplicate];[r update:YES];
 check(!owner.active&&owner.follows==beforeFollow+1,"restored same physical scope cannot revive ambiguous FOLLOW ticket");
 f.descriptor=scope(@"follow-next",@"follow");[r update:YES];auto pinnedWindowValidator=owner->followValidator;
 owner.window=foreign;f.host.window=foreign;
 check(pinnedWindowValidator&&!pinnedWindowValidator(),"FOLLOW pins admission window even when both current hosts move together");
 owner.window=window;f.host.window=window;
 // Fresh B can publish while momentum is active; native completion retries
 // admission without a JS descriptor re-publication. Same A stays retired.
 f.descriptor=scope(@"follow-momentum-A",@"follow");[r update:YES];NSInteger momentumFollows=owner.follows;
 [r scrollViewWillBeginDragging:owner.scrollView];owner.scrollView.isDecelerating=YES;
 f.descriptor=scope(@"follow-momentum-B",@"follow");[r update:YES];
 check(!owner.active&&owner.follows==momentumFollows,"fresh FOLLOW publication during deceleration waits");
 owner.scrollView.contentOffset=CGPointMake(0,1400);owner.scrollView.isDecelerating=NO;
 [r scrollViewDidEndDecelerating:owner.scrollView];
 check(owner.active&&owner.follows==momentumFollows+1&&[owner.admittedIntent isEqual:@"follow-momentum-B"],"native end completion admits already-published fresh FOLLOW without JS republish");
 NSInteger completedFollows=owner.follows;
 [r scrollViewWillBeginDragging:owner.scrollView];[r scrollViewDidEndDragging:owner.scrollView willDecelerate:NO];[r update:NO];
 check(!owner.active&&owner.follows==completedFollows,"same canceled FOLLOW never revives at legal end");
 f.descriptor=scope(@"follow-await-C",@"follow");[r scrollViewWillBeginDragging:owner.scrollView];[r update:YES];
 [r scrollViewDidEndDragging:owner.scrollView willDecelerate:NO];
 check(owner.active&&[owner.admittedIntent isEqual:@"follow-await-C"],"fresh FOLLOW publication before nondecelerating end also admits");
 [r scrollViewWillBeginDragging:owner.scrollView];f.descriptor=scope(@"target-await-D",@"target");[r update:YES];
 [r scrollViewDidEndDragging:owner.scrollView willDecelerate:NO];check(!owner.active,"gesture end cannot promote pending TARGET to FOLLOW");
 // A delayed FOLLOW descriptor cannot override an actual above-end finish.
 f.descriptor=scope(@"follow-away-A",@"follow");[r update:YES];NSInteger awayFollows=owner.follows;
 [r scrollViewWillBeginDragging:owner.scrollView];owner.scrollView.isDecelerating=YES;
 f.descriptor=scope(@"follow-away-B",@"follow");[r update:YES];owner.scrollView.contentOffset=CGPointMake(0,1360);
 owner.scrollView.isDecelerating=NO;[r scrollViewDidEndDecelerating:owner.scrollView];
 check(!owner.active&&owner.follows==awayFollows,"actual above-end completion cannot admit delayed FOLLOW B");
 [r update:NO];check(!owner.active&&owner.follows==awayFollows,"above-end rejected FOLLOW data stays retired");
 [r scrollViewWillBeginDragging:owner.scrollView];owner.scrollView.contentOffset=CGPointMake(0,1400);[r scrollViewDidEndDragging:owner.scrollView willDecelerate:NO];
 check(!owner.active&&owner.follows==awayFollows,"later end gesture cannot revive above-end rejected B");
 f.descriptor=scope(@"follow-after-away-C",@"follow");[r update:YES];
 check(owner.active&&owner.follows==awayFollows+1,"new completed FOLLOW C remains eligible after above-end B retirement");
 printf("%d PASS / %d FAIL actual Registry lifecycle controls; modeled UIKit delivery only\n",checks-failures,failures);
 return failures?1:0;
} }
