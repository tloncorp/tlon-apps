import { PropsWithChildren, forwardRef } from 'react';
import { Input, ScrollView, Sheet } from 'tamagui';

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
      animation = 'quick',
      dismissOnSnapToBottom = true,
      handleDisableScroll,
      snapPointsMode = 'fit',
      snapPoints,
      frameStyle,
      modal = false,
      showHandle = true,
      showOverlay = true,
      overlayOpacity = 0.5,
      // Platform-specific props ignored on web
      enablePanDownToClose: _enablePanDownToClose,
      keyboardBehavior: _keyboardBehavior,
      android_keyboardInputMode: _android_keyboardInputMode,
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
        animation={animation as any}
        handleDisableScroll={handleDisableScroll}
        modal={modal}
      >
        {showOverlay && <Sheet.Overlay animation={animation as any} opacity={overlayOpacity} />}
        <Sheet.Frame style={frameStyle} pressStyle={{}}>
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

// On web, we can use regular Input from Tamagui
export const BottomSheetTextInput = Input;