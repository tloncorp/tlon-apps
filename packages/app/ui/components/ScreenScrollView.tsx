import { ComponentProps, ElementRef, forwardRef } from 'react';
import { ScrollView } from 'tamagui';

import { useScreenScrollProps } from './useScreenScrollProps';

/**
 * Root scroll container for screen content. React Native opts out of UIKit's
 * automatic safe-area adjustment, so restore it for iOS screens.
 */
export const ScreenScrollView = forwardRef<
  ElementRef<typeof ScrollView>,
  ComponentProps<typeof ScrollView>
>(function ScreenScrollView({ contentInsetAdjustmentBehavior, ...props }, ref) {
  const screenScrollProps = useScreenScrollProps();

  return (
    <ScrollView
      {...props}
      ref={ref}
      contentInsetAdjustmentBehavior={
        contentInsetAdjustmentBehavior ??
        screenScrollProps.contentInsetAdjustmentBehavior
      }
    />
  );
});
