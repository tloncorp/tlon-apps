import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView as GorhomBottomSheetScrollView,
  BottomSheetView,
  useBottomSheetDynamicSnapPoints,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BottomSheetScrollViewProps,
  BottomSheetWrapperProps,
} from './BottomSheetWrapper.types';

// Main wrapper component
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
      snapPointsMode = 'fit',
      snapPoints: customSnapPoints,
      frameStyle,
      modal = false,
      showHandle = true,
      showOverlay = true,
      overlayOpacity = 0.5,
      enablePanDownToClose = true,
      keyboardBehavior = 'interactive',
      android_keyboardInputMode = 'adjustResize',
    },
    ref
  ) => {
    const insets = useSafeAreaInsets();
    const bottomSheetRef = useRef<BottomSheet>(null);
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Use internal refs and expose methods via imperative handle
    // This ensures refs are always valid
    React.useImperativeHandle(ref, () => {
      const modalRef = bottomSheetModalRef.current;
      const sheetRef = bottomSheetRef.current;

      return {
        present: () => modal ? modalRef?.present() : sheetRef?.expand(),
        dismiss: () => modal ? modalRef?.dismiss() : sheetRef?.close(),
        close: () => modal ? modalRef?.dismiss() : sheetRef?.close(),
        expand: () => modal ? modalRef?.present() : sheetRef?.expand(),
        collapse: () => modal ? modalRef?.dismiss() : sheetRef?.collapse(),
        snapToIndex: (index: number) => modal ? modalRef?.snapToIndex(index) : sheetRef?.snapToIndex(index),
        snapToPosition: (position: string | number) => modal ? modalRef?.snapToPosition(position) : sheetRef?.snapToPosition(position),
        forceClose: () => modal ? modalRef?.forceClose() : sheetRef?.forceClose(),
      } as any;
    }, [modal]);

    // Handle snap points
    const initialSnapPoints = useMemo(() => {
      // If custom snap points are provided, use them (for sheets with inputs)
      if (customSnapPoints) {
        return customSnapPoints;
      }
      // For fit mode, use dynamic content height
      if (snapPointsMode === 'fit') {
        return ['CONTENT_HEIGHT', '90%'];
      }
      // Default snap points
      return ['50%', '90%'];
    }, [snapPointsMode, customSnapPoints]);

    // Setup dynamic snap points handling
    const {
      animatedHandleHeight,
      animatedSnapPoints,
      animatedContentHeight,
      handleContentLayout,
    } = useBottomSheetDynamicSnapPoints(initialSnapPoints);

    // Animation config
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
        // Non-modal can expand immediately
        bottomSheetRef.current?.expand();
      }
    }, [open, modal]);

    // Callbacks
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

    // Common props for both Modal and regular BottomSheet
    const commonProps = {
      enablePanDownToClose,
      keyboardBehavior,
      keyboardBlurBehavior: 'restore' as const,
      android_keyboardInputMode,
      animationConfigs: animationConfigs[animation],
      onChange: handleSheetChanges,
      backdropComponent: renderBackdrop,
      handleComponent: renderHandle,
      bottomInset: insets.bottom,
      style: frameStyle,
    };

    // Props specific to non-modal sheets
    const nonModalProps = {
      ...commonProps,
      // Use animated snap points for fit mode, regular snap points otherwise
      snapPoints: snapPointsMode === 'fit' ? animatedSnapPoints as any : initialSnapPoints,
      // Add dynamic sizing properties for fit mode
      ...(snapPointsMode === 'fit' && {
        handleHeight: animatedHandleHeight,
        contentHeight: animatedContentHeight,
        enableDynamicSizing: true,
      }),
      index: 0, // Start at first snap point
    };

    // Props specific to modal sheets - keep it simple like the docs
    const modalProps = {
      onChange: handleSheetChanges,
      backdropComponent: renderBackdrop,
      handleComponent: renderHandle,
      snapPoints: customSnapPoints || ['50%', '90%'],
      // Don't set index - let modal manage its own state
      // Don't set enableDynamicSizing - use defaults
      // Keep it minimal like documentation examples
    };

    const content = modal ? (
      // Modal sheets should always use flex: 1
      <BottomSheetView style={{ flex: 1 }}>
        {children}
      </BottomSheetView>
    ) : (
      // Non-modal sheets can use dynamic sizing
      <BottomSheetView
        style={{ flex: snapPointsMode === 'fit' ? 0 : 1 }}
        onLayout={snapPointsMode === 'fit' ? handleContentLayout : undefined}
      >
        {children}
      </BottomSheetView>
    );

    if (modal) {
      return (
        <BottomSheetModal ref={bottomSheetModalRef} {...modalProps}>
          {content}
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
          {content}
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