import { ComponentProps, ElementRef, forwardRef } from 'react';
import { Platform } from 'react-native';
import { ScrollView } from 'tamagui';

export const screenContentInsetAdjustmentBehavior =
  Platform.OS === 'ios' ? ('automatic' as const) : undefined;

/**
 * Root scroll container for screen content. React Native opts out of UIKit's
 * automatic safe-area adjustment, so restore it for iOS screens while leaving
 * nested and specialized scroll views unchanged.
 */
export const ScreenScrollView = forwardRef<
  ElementRef<typeof ScrollView>,
  ComponentProps<typeof ScrollView>
>(function ScreenScrollView({ contentInsetAdjustmentBehavior, ...props }, ref) {
  return (
    <ScrollView
      {...props}
      ref={ref}
      contentInsetAdjustmentBehavior={
        contentInsetAdjustmentBehavior ?? screenContentInsetAdjustmentBehavior
      }
    />
  );
});
