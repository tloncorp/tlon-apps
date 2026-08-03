import { ComponentProps, ElementRef, forwardRef } from 'react';
import { ScrollView } from 'tamagui';

import { useScreenScrollProps } from './useScreenScrollProps';

type ScreenScrollViewProps = ComponentProps<typeof ScrollView> & {
  useScreenChrome?: boolean;
};

/**
 * Root scroll container for screen content. React Native opts out of UIKit's
 * automatic safe-area adjustment, so restore it for iOS screens while leaving
 * nested and specialized scroll views unchanged.
 */
export const ScreenScrollView = forwardRef<
  ElementRef<typeof ScrollView>,
  ScreenScrollViewProps
>(function ScreenScrollView(
  { contentInsetAdjustmentBehavior, useScreenChrome = true, ...props },
  ref
) {
  const screenScrollProps = useScreenScrollProps({ enabled: useScreenChrome });

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
