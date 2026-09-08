#import <Foundation/Foundation.h>
#import "RNSNativeReadingLifecycle.h"
#include <memory>

static NSMutableArray<NSString *> *events;
namespace react {
struct Emitter { virtual ~Emitter() = default; };
struct RNSScreenEventEmitter : Emitter {
  struct OnAppear {};
  struct OnWillDisappear {};
  struct OnGestureCancel {};
  void onGestureCancel(OnGestureCancel) const { [events addObject:@"js-cancel"]; }
  void onAppear(OnAppear) const { [events addObject:@"js-appear"]; }
  void onWillDisappear(OnWillDisappear) const { [events addObject:@"js-disappear"]; }
};
}
@interface TestInteractionManager : NSObject
- (void)enableInteractionsForLastSubtree;
@end
@implementation TestInteractionManager
- (void)enableInteractionsForLastSubtree {}
@end

@interface RNSScreenView : NSObject {
  BOOL _nativeReadingVisible;
  RNSNativeReadingLifecycle *_nativeReadingLifecycle;
  BOOL _hideKeyboardOnSwipe;
  std::shared_ptr<react::Emitter> _eventEmitter;
}
@property (nonatomic, readonly) BOOL nativeReadingVisible;
- (void)addNativeReadingLifecycleListener:(id<RNSNativeReadingLifecycleListener>)listener;
- (void)removeNativeReadingLifecycleListener:(id<RNSNativeReadingLifecycleListener>)listener;
- (BOOL)setNativeReadingVisible:(BOOL)visible;
- (void)notifyWillDisappear;
- (void)notifyAppear;
- (void)removeEmitter;
- (void)notifyGestureCancel;
+ (TestInteractionManager *)viewInteractionManagerInstance;
@end
@implementation RNSScreenView
- (instancetype)init {
  if (self = [super init]) {
    _hideKeyboardOnSwipe = YES;
    _eventEmitter = std::make_shared<react::RNSScreenEventEmitter>();
  }
  return self;
}
+ (TestInteractionManager *)viewInteractionManagerInstance { return [TestInteractionManager new]; }
- (void)removeEmitter { _eventEmitter.reset(); }
- (BOOL)endEditing:(BOOL)force {
  [events addObject:_nativeReadingVisible ? @"keyboard-before-retirement" : @"keyboard"];
  return YES;
}
#include "actual-screen-methods.inc"
@end

@interface TestViewController : NSObject
- (void)viewDidAppear:(BOOL)animated;
@end
@implementation TestViewController
- (void)viewDidAppear:(BOOL)animated {}
@end
@interface RNSScreen : TestViewController {
  BOOL _isSwiping, _shouldNotify, _goingForward;
}
@property(nonatomic) RNSScreenView *screenView;
- (void)setCancelledSwipe:(BOOL)cancelled;
- (void)notifyTransitionProgress:(double)progress closing:(BOOL)closing goingForward:(BOOL)goingForward;
@end
@implementation RNSScreen
- (void)setCancelledSwipe:(BOOL)cancelled { _isSwiping = cancelled; _shouldNotify = !cancelled; }
- (void)notifyTransitionProgress:(double)progress closing:(BOOL)closing goingForward:(BOOL)goingForward {
  [events addObject:@"progress"];
}
#include "actual-controller-methods.inc"
@end

@interface Probe : NSObject <RNSNativeReadingLifecycleListener>
@property (copy) void (^callback)(RNSScreenView *, BOOL);
@property NSUInteger count;
@end
@implementation Probe
- (void)screen:(RNSScreenView *)screen readingVisibilityDidChange:(BOOL)visible {
  self.count++;
  if (self.callback) self.callback(screen, visible);
}
@end

int main() {
  @autoreleasepool {
    events = [NSMutableArray new];
    NSMutableArray *records = [NSMutableArray new];
    __block NSUInteger failed = 0;
    void (^check)(NSString *, BOOL (^)(void)) = ^(NSString *name, BOOL (^body)(void)) {
      [events removeAllObjects];
      BOOL pass = body();
      if (!pass) failed++;
      [records addObject:@{@"name":name,@"passed":@(pass)}];
    };
    check(@"ordinary keyboard and JS order unchanged without observers", ^BOOL {
      RNSScreenView *s = [RNSScreenView new];
      if (s.nativeReadingVisible) return NO;
      [s notifyAppear]; if (!s.nativeReadingVisible) return NO;
      [s notifyWillDisappear];
      return !s.nativeReadingVisible && [events isEqualToArray:@[@"js-appear",@"keyboard",@"js-disappear"]];
    });
    check(@"late registration reads visibility without fabricated event", ^BOOL {
      RNSScreenView *s = [RNSScreenView new]; [s notifyAppear];
      Probe *p = [Probe new]; [s addNativeReadingLifecycleListener:p];
      return s.nativeReadingVisible && p.count == 0;
    });
    check(@"retirement precedes keyboard and JS with exact sender", ^BOOL {
      RNSScreenView *s = [RNSScreenView new]; [s notifyAppear]; [events removeAllObjects];
      Probe *p = [Probe new]; __weak RNSScreenView *weak = s;
      p.callback = ^(RNSScreenView *sender, BOOL visible) {
        [events addObject:sender == weak && !visible && !sender.nativeReadingVisible ? @"retired" : @"bad"];
      };
      [s addNativeReadingLifecycleListener:p]; [s notifyWillDisappear];
      return [events isEqualToArray:@[@"retired",@"keyboard",@"js-disappear"]];
    });
    check(@"appearance updates property before exact callback", ^BOOL {
      RNSScreenView *s = [RNSScreenView new]; Probe *p = [Probe new];
      p.callback = ^(RNSScreenView *sender, BOOL visible) {
        [events addObject:visible && sender.nativeReadingVisible ? @"visible" : @"bad"];
      };
      [s addNativeReadingLifecycleListener:p]; [s notifyAppear];
      return [events isEqualToArray:@[@"visible",@"js-appear"]];
    });
    check(@"duplicate registration delivers once", ^BOOL {
      RNSScreenView *s = [RNSScreenView new]; Probe *p = [Probe new];
      [s addNativeReadingLifecycleListener:p]; [s addNativeReadingLifecycleListener:p]; [s notifyAppear];
      return p.count == 1;
    });
    check(@"removed observer cannot receive later transition", ^BOOL {
      RNSScreenView *s = [RNSScreenView new]; Probe *p = [Probe new];
      [s addNativeReadingLifecycleListener:p]; [s removeNativeReadingLifecycleListener:p]; [s notifyAppear];
      return p.count == 0;
    });
    check(@"screen does not retain its observer", ^BOOL {
      RNSScreenView *s = [RNSScreenView new]; __weak Probe *weak;
      @autoreleasepool { Probe *p = [Probe new]; weak = p; [s addNativeReadingLifecycleListener:p]; }
      [s notifyAppear]; return weak == nil;
    });
    check(@"self-removal during callback prevents subsequent delivery", ^BOOL {
      RNSScreenView *s = [RNSScreenView new]; Probe *p = [Probe new]; __weak Probe *weak = p;
      p.callback = ^(RNSScreenView *sender, BOOL visible) { [sender removeNativeReadingLifecycleListener:weak]; };
      [s addNativeReadingLifecycleListener:p]; [s notifyAppear]; [s notifyWillDisappear];
      return p.count == 1;
    });
    check(@"removal of remaining snapshot observer wins", ^BOOL {
      RNSScreenView *s = [RNSScreenView new]; Probe *a = [Probe new], *b = [Probe new];
      __weak Probe *wa = a, *wb = b;
      a.callback = ^(RNSScreenView *sender, BOOL visible) { [sender removeNativeReadingLifecycleListener:wb]; };
      b.callback = ^(RNSScreenView *sender, BOOL visible) { [sender removeNativeReadingLifecycleListener:wa]; };
      [s addNativeReadingLifecycleListener:a]; [s addNativeReadingLifecycleListener:b]; [s notifyAppear];
      return a.count + b.count == 1;
    });
    check(@"new observer is not backdated into current snapshot", ^BOOL {
      RNSScreenView *s = [RNSScreenView new]; Probe *a = [Probe new], *b = [Probe new];
      a.callback = ^(RNSScreenView *sender, BOOL visible) { [sender addNativeReadingLifecycleListener:b]; };
      [s addNativeReadingLifecycleListener:a]; [s notifyAppear];
      if (b.count != 0) return NO;
      [s notifyWillDisappear]; return b.count == 1;
    });
    check(@"new visibility prevents stale remaining callbacks", ^BOOL {
      RNSScreenView *s = [RNSScreenView new]; Probe *a = [Probe new], *b = [Probe new];
      __block NSUInteger invisible = 0, visible = 0;
      void (^callback)(RNSScreenView *, BOOL) = ^(RNSScreenView *sender, BOOL value) {
        if (value) { visible++; } else { invisible++; [sender notifyAppear]; }
      };
      a.callback = callback; b.callback = callback;
      [s addNativeReadingLifecycleListener:a]; [s addNativeReadingLifecycleListener:b]; [s notifyWillDisappear];
      return invisible == 1 && visible == 2 && s.nativeReadingVisible &&
          ![events containsObject:@"keyboard-before-retirement"] &&
          ![events containsObject:@"js-disappear"];
    });
    check(@"native retirement does not depend on JS emitter", ^BOOL {
      RNSScreenView *s = [RNSScreenView new]; [s removeEmitter]; Probe *p = [Probe new];
      [s addNativeReadingLifecycleListener:p]; [s notifyAppear]; [s notifyWillDisappear];
      return p.count == 2 && !s.nativeReadingVisible && [events isEqualToArray:@[@"keyboard"]];
    });
    check(@"completed canceled swipe restores native visibility without JS appear", ^BOOL {
      RNSScreenView *s = [RNSScreenView new]; RNSScreen *controller = [RNSScreen new];
      controller.screenView = s; [controller setCancelledSwipe:YES];
      [s notifyAppear]; [s notifyWillDisappear]; [events removeAllObjects];
      Probe *p = [Probe new];
      p.callback = ^(RNSScreenView *sender, BOOL visible) { [events addObject:visible && sender.nativeReadingVisible ? @"visible" : @"bad"]; };
      [s addNativeReadingLifecycleListener:p]; [controller viewDidAppear:YES];
      return s.nativeReadingVisible && [events isEqualToArray:@[@"visible",@"js-cancel"]];
    });
    check(@"ordinary controller appearance publishes one native transition", ^BOOL {
      RNSScreenView *s = [RNSScreenView new]; RNSScreen *controller = [RNSScreen new];
      controller.screenView = s; [controller setCancelledSwipe:NO];
      Probe *p = [Probe new]; [s addNativeReadingLifecycleListener:p];
      [controller viewDidAppear:YES];
      return s.nativeReadingVisible && p.count == 1 && [events isEqualToArray:@[@"js-appear",@"progress"]];
    });
    NSData *data = [NSJSONSerialization dataWithJSONObject:@{@"passed":@(records.count-failed),@"failed":@(failed),@"records":records} options:NSJSONWritingPrettyPrinted error:nil];
    fwrite(data.bytes, 1, data.length, stdout); puts("");
    return failed ? 1 : 0;
  }
}
