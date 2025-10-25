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

    // Forward ref to the appropriate component
    React.useImperativeHandle(
      ref,
      () => (modal ? bottomSheetModalRef : bottomSheetRef).current as BottomSheet,
      [modal]
    );

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
      if (modal) {
        if (open) {
          // Delay presentation to ensure modal is mounted with index=-1
          const timer = setTimeout(() => {
            bottomSheetModalRef.current?.present();
          }, 10);
          return () => clearTimeout(timer);
        } else {
          bottomSheetModalRef.current?.dismiss();
          Keyboard.dismiss();
        }
      } else {
        // Non-modal sheets use expand/close
        if (open) {
          bottomSheetRef.current?.expand();
        } else {
          bottomSheetRef.current?.close();
          Keyboard.dismiss();
        }
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

    // Props specific to modal sheets
    const modalProps = {
      ...commonProps,
      index: -1, // Start closed
      // ALWAYS provide snapPoints for modal sheets to avoid enableDynamicSizing bugs
      snapPoints: customSnapPoints || ['50%', '90%'],
      // Disable dynamic sizing for modals due to known bugs
      enableDynamicSizing: false,
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