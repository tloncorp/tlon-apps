#import <UIKit/UIKit.h>
NS_ASSUME_NONNULL_BEGIN
// A nonvisual binding owned by one physical Expo host. All calls are main-thread.
@interface TlonReadRegistration : NSObject
+ (NSDictionary *)diagnosticForScrollView:(UIScrollView *)scrollView NS_SWIFT_NAME(readPointDiagnostic(for:));
// Explicit fixture capture only. Inventories contain the actual measured UIKit views.
+ (NSDictionary *)diagnosticForScrollView:(UIScrollView *)scrollView
                           measuredRows:(NSDictionary<NSString *, NSArray<UIView *> *> *)rows
                           indexedCells:(NSDictionary<NSString *, NSArray<UIView *> *> *)cells
    NS_SWIFT_NAME(readPointDiagnostic(for:measuredRows:indexedCells:));
+ (NSString *)diagnosticIdentityForView:(UIView *)view NS_SWIFT_NAME(readPointIdentity(for:));
- (instancetype)initWithHost:(UIView *)host scope:(BOOL)scope;
- (void)publishDescriptor:(nullable NSString *)descriptor;
- (void)refreshAttachment;
- (void)detach;
@end
NS_ASSUME_NONNULL_END
