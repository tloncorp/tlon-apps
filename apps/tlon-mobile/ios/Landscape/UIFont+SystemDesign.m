// UIFont+SystemDesign.m

#import <objc/runtime.h>
#import "UIFont+SystemDesign.h"

@implementation UIFont (SystemDesign)

+ (void)load {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    Class class = object_getClass((id)self);
    
    SEL originalSelector = @selector(fontWithName:size:);
    Method originalMethod = class_getClassMethod(class, originalSelector);
    
    SEL swizzledSelector = @selector(_fontWithName:size:);
    Method swizzledMethod = class_getClassMethod(class, swizzledSelector);
    
    BOOL didAddMethod = class_addMethod(class, originalSelector, method_getImplementation(swizzledMethod), method_getTypeEncoding(swizzledMethod));
    if (didAddMethod) {
      class_replaceMethod(class, swizzledSelector, method_getImplementation(originalMethod), method_getTypeEncoding(originalMethod));
    }
    else {
      method_exchangeImplementations(originalMethod, swizzledMethod);
    }
  });
}

#pragma mark - Method Swizzling

+ (UIFont *)_fontWithName:(NSString *)fontName size:(CGFloat)fontSize {
  NSString* const systemRounded = @"System-Rounded";
  NSString* const systemSerif = @"System-Serif";
  NSString* const systemMonospaced = @"System-Monospaced";
  
  NSArray* fonts = @[systemRounded, systemSerif, systemMonospaced];
  
  if ([fonts containsObject:fontName]) {
    if (@available(iOS 13.0, *)) {
      NSDictionary* designs = @{systemRounded : UIFontDescriptorSystemDesignRounded,
                              systemSerif : UIFontDescriptorSystemDesignSerif,
                              systemMonospaced : UIFontDescriptorSystemDesignMonospaced
      };
      
      UIFontDescriptor *fontDescriptor ;

      fontDescriptor = [UIFont systemFontOfSize:fontSize].fontDescriptor;
      fontDescriptor = [fontDescriptor fontDescriptorWithDesign: designs[fontName]];
      return [UIFont fontWithDescriptor:fontDescriptor size:fontSize];
    }
    else {
      return [UIFont systemFontOfSize:fontSize];
    }
  }
  
  return [self _fontWithName:fontName size:fontSize];
}

@end
