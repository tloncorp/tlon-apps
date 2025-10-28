import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView as GorhomBottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import React, {
  PropsWithChildren,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Keyboard, View } from 'react-native';

import {
  BottomSheetScrollViewProps,
  BottomSheetWrapperProps,
} from './BottomSheetWrapper.types';

export const BottomSheetWrapper = forwardRef<
  BottomSheet,
  PropsWithChildren<BottomSheetWrapperProps>
>(
  (
    {
      open,
      onOpenChange,
      children,
      animation = 'quick',
      dismissOnSnapToBottom = true,
      handleDisableScroll: _handleDisableScroll,
      frameStyle,
      modal = false,
      showHandle = true,
      showOverlay = true,
      overlayOpacity = 0.5,
      enablePanDownToClose = true,
      keyboardBehavior = 'interactive',
      android_keyboardInputMode = 'adjustResize',
      snapPointsMode = 'fit',
      snapPoints,
    },
    ref
  ) => {
    const bottomSheetRef = useRef<BottomSheet>(null);
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Transform snapPoints based on snapPointsMode for compatibility with Tamagui Sheet API
    const transformedSnapPoints = useMemo(() => {
      if (!snapPoints) return snapPoints;

      // When in percent mode, convert numbers to percentage strings
      if (snapPointsMode === 'percent') {
        return snapPoints.map(point =>
          typeof point === 'number' ? `${point}%` : point
        );
      }

      return snapPoints;
    }, [snapPoints, snapPointsMode]);


    React.useImperativeHandle(
      ref,
      () => {
        const modalRef = bottomSheetModalRef.current;
        const sheetRef = bottomSheetRef.current;

        return {
          present: () => (modal ? modalRef?.present() : sheetRef?.expand()),
          dismiss: () => (modal ? modalRef?.dismiss() : sheetRef?.close()),
          close: () => (modal ? modalRef?.dismiss() : sheetRef?.close()),
          expand: () => (modal ? modalRef?.present() : sheetRef?.expand()),
          collapse: () => (modal ? modalRef?.dismiss() : sheetRef?.collapse()),
          snapToIndex: (index: number) =>
            modal ? modalRef?.snapToIndex(index) : sheetRef?.snapToIndex(index),
          snapToPosition: (position: string | number) =>
            modal
              ? modalRef?.snapToPosition(position)
              : sheetRef?.snapToPosition(position),
          forceClose: () =>
            modal ? modalRef?.forceClose() : sheetRef?.forceClose(),
        } as any;
      },
      [modal]
    );

    const animationConfigs = useMemo(
      () => ({
        quick: { duration: 250 },
        medium: { duration: 350 },
        slow: { duration: 500 },
      }),
      []
    );

    // Handle open/close
    useEffect(() => {
      if (!open) {
        // Close/dismiss the sheet
        if (modal) {
          bottomSheetModalRef.current?.dismiss();
        } else {
          bottomSheetRef.current?.close();
        }
        Keyboard.dismiss();
        return;
      }

      // Open the sheet
      if (modal) {
        // For modal, delay presentation to ensure it's fully mounted
        const timer = setTimeout(() => {
          const modalRef = bottomSheetModalRef.current;
          if (modalRef) {
            modalRef.present();
          } else {
            console.warn('BottomSheetModal ref is not available');
          }
        }, 100); // Increased delay for modal to be ready
        return () => clearTimeout(timer);
      } else {
        // Non-modal: use snapToIndex if snapPoints are defined, otherwise expand
        if (transformedSnapPoints && transformedSnapPoints.length > 0) {
          bottomSheetRef.current?.snapToIndex(0);
        } else {
          bottomSheetRef.current?.expand();
        }
      }
    }, [open, modal, transformedSnapPoints]);

    const handleSheetChanges = useCallback(
      (index: number) => {
        // When sheet is closed (index -1), notify parent
        if (index === -1 && dismissOnSnapToBottom) {
          onOpenChange(false);
        }
      },
      [dismissOnSnapToBottom, onOpenChange]
    );

    const renderBackdrop = useCallback(
      (props: any) =>
        showOverlay ? (
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            opacity={overlayOpacity}
            pressBehavior="close"
          />
        ) : null,
      [showOverlay, overlayOpacity]
    );

    const renderHandle = useCallback(
      () => (showHandle ? <BottomSheetHandle /> : null),
      [showHandle]
    );

    const commonProps = {
      enablePanDownToClose,
      keyboardBehavior,
      keyboardBlurBehavior: 'restore' as const,
      android_keyboardInputMode,
      animationConfigs: animationConfigs[animation],
      onChange: handleSheetChanges,
      backdropComponent: renderBackdrop,
      handleComponent: renderHandle,
      style: frameStyle,
      snapPointsMode,
      snapPoints: transformedSnapPoints,
    };

    const nonModalProps = {
      ...commonProps,
      index: 0, // Start at first snap point
    };

    const modalProps = {
      onChange: handleSheetChanges,
      backdropComponent: renderBackdrop,
      handleComponent: renderHandle,
      snapPoints: transformedSnapPoints,
      snapPointsMode,
      enablePanDownToClose,
      keyboardBehavior,
      keyboardBlurBehavior: 'restore' as const,
      android_keyboardInputMode,
      animationConfigs: animationConfigs[animation],
      style: frameStyle,
    };

    if (modal) {
      return (
        <BottomSheetModal ref={bottomSheetModalRef} {...modalProps}>
          <BottomSheetView style={{ flex: 1 }}>{children}</BottomSheetView>
        </BottomSheetModal>
      );
    }

    // For non-modal, we need to handle visibility ourselves
    if (!open) {
      return null;
    }

    return (
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 999,
        }}
        pointerEvents="box-none"
      >
        <BottomSheet ref={bottomSheetRef} {...nonModalProps}>
          <BottomSheetView style={{ flex: 1 }}>{children}</BottomSheetView>
        </BottomSheet>
      </View>
    );
  }
);

BottomSheetWrapper.displayName = 'BottomSheetWrapper';

// Custom handle component that matches the Tamagui Sheet handle style
const BottomSheetHandle = () => {
  return (
    <View
      style={{
        alignSelf: 'center',
        marginVertical: 12,
        width: 48,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#D1D5DB',
      }}
    />
  );
};

// ScrollView wrapper
export const BottomSheetScrollView = forwardRef<
  typeof GorhomBottomSheetScrollView,
  PropsWithChildren<BottomSheetScrollViewProps>
>((props, ref) => {
  return <GorhomBottomSheetScrollView ref={ref as any} {...props} />;
});

BottomSheetScrollView.displayName = 'BottomSheetScrollView';

// Export TextInput from gorhom for proper keyboard handling
export { BottomSheetTextInput } from '@gorhom/bottom-sheet';
