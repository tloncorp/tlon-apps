import { PropsWithChildren, forwardRef } from 'react';
import { ScrollView, Sheet } from 'tamagui';

import {
  BottomSheetScrollViewProps,
  BottomSheetWrapperProps,
} from './BottomSheetWrapper.types';

// Web implementation using Tamagui Sheet as fallback
export const BottomSheetWrapper = forwardRef<
  any,
  PropsWithChildren<BottomSheetWrapperProps>
>(
  (
    {
      open,
      onOpenChange,
      children,
      dismissOnSnapToBottom = true,
      snapPointsMode = 'fit',
      snapPoints,
      showHandle = true,
    },
    ref
  ) => {
    return (
      <Sheet
        ref={ref}
        open={open}
        onOpenChange={onOpenChange}
        dismissOnSnapToBottom={dismissOnSnapToBottom}
        snapPointsMode={snapPointsMode}
        snapPoints={snapPoints}
        transition="quick"
      >
        <Sheet.Overlay transition="quick" opacity={0.5} />
        <Sheet.Frame pressStyle={{}}>
          {showHandle && <Sheet.Handle />}
          {children}
        </Sheet.Frame>
      </Sheet>
    );
  }
);

BottomSheetWrapper.displayName = 'BottomSheetWrapper';

// ScrollView wrapper - on web, use Tamagui's Sheet.ScrollView
export const BottomSheetScrollView = forwardRef<
  any,
  PropsWithChildren<BottomSheetScrollViewProps>
>((props, ref) => {
  // Use Sheet.ScrollView if available, otherwise fallback to regular ScrollView
  const ScrollComponent = (Sheet as any).ScrollView || ScrollView;
  return <ScrollComponent ref={ref} {...props} />;
});

BottomSheetScrollView.displayName = 'BottomSheetScrollView';
