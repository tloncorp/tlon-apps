import { ComponentProps, ElementRef, forwardRef } from 'react';
import { ScrollView } from 'tamagui';

import { useScreenScrollProps } from './useScreenScrollProps';

/**
 * Root scroll container for screen content. On iOS it restores UIKit's
 * automatic safe-area adjustment and installs the native header's transparent
 * scroll-edge appearance for the lifetime of the screen.
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
