import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView as GorhomBottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { ActionSheetContext, View } from '@tloncorp/ui';
import React, {
  PropsWithChildren,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Keyboard } from 'react-native';
import { useTheme } from 'tamagui';

import {
  BottomSheetScrollViewProps,
  BottomSheetWrapperProps,
} from './BottomSheetWrapper.types';

const MemoizedBackdrop = React.memo(
  ({
    backdropStyle,
    overlayOpacity,
    ...props
  }: {
    backdropStyle: any;
    overlayOpacity: number;
  } & any) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={overlayOpacity}
      pressBehavior="close"
      style={backdropStyle}
    />
  )
);

MemoizedBackdrop.displayName = 'MemoizedBackdrop';

const MemoizedHandle = React.memo(() => <BottomSheetHandle />);

MemoizedHandle.displayName = 'MemoizedHandle';

const ModalChildrenWrapper = React.memo(
  ({
    useBottomSheetView,
    style,
    children,
  }: {
    useBottomSheetView: boolean;
    style: { flex: number };
    children: React.ReactNode;
  }) => {
    if (useBottomSheetView) {
      return <BottomSheetView style={style}>{children}</BottomSheetView>;
    }
    return <View style={style}>{children}</View>;
  }
);

ModalChildrenWrapper.displayName = 'ModalChildrenWrapper';

const NonModalChildrenWrapper = React.memo(
  ({
    useBottomSheetView,
    style,
    children,
  }: {
    useBottomSheetView: boolean;
    style: { flex: number; backgroundColor: string };
    children: React.ReactNode;
  }) => {
    if (useBottomSheetView) {
      return <BottomSheetView style={style}>{children}</BottomSheetView>;
    }
    return <View style={style}>{children}</View>;
  }
);

NonModalChildrenWrapper.displayName = 'NonModalChildrenWrapper';

const ANIMATION_CONFIGS = {
  quick: { duration: 250 },
  medium: { duration: 350 },
  slow: { duration: 500 },
} as const;

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
      footerComponent,
      hasScrollableContent = false,
    },
    ref
  ) => {
    const bottomSheetRef = useRef<BottomSheet>(null);
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const theme = useTheme();

    const backgroundColor = useMemo(
      () => theme.background.val,
      [theme.background.val]
    );
    const overlayBackgroundColor = useMemo(
      () => theme.overlayBackground.val,
      [theme.overlayBackground.val]
    );

    const backdropStyle = useMemo(
      () => ({
        backgroundColor: overlayBackgroundColor,
      }),
      [overlayBackgroundColor]
    );

    const flexStyle = useMemo(() => ({ flex: 1 }), []);

    const flexWithBackgroundStyle = useMemo(
      () => ({ flex: 1, backgroundColor }),
      [backgroundColor]
    );

    // Transform snapPoints based on snapPointsMode for compatibility with Tamagui Sheet API
    const transformedSnapPoints = useMemo(() => {
      if (!snapPoints) return snapPoints;

      // When in percent mode, convert numbers to percentage strings
      if (snapPointsMode === 'percent') {
        return snapPoints.map((point) =>
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

    // Handle modal sheet open/close
    useEffect(() => {
      if (!modal) return;

      if (open) {
        // Small delay to ensure modal is mounted before presenting
        const timer = setTimeout(() => {
          bottomSheetModalRef.current?.present();
        }, 50);
        return () => clearTimeout(timer);
      } else {
        bottomSheetModalRef.current?.dismiss();
      }
    }, [open, modal]);

    // Handle non-modal sheet open/close
    useEffect(() => {
      if (modal) return;

      if (!open) {
        bottomSheetRef.current?.close();
      } else {
        bottomSheetRef.current?.expand();
      }
    }, [open, modal]);

    useEffect(() => {
      if (!open) {
        Keyboard.dismiss();
      }
    }, [open]);

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
          <MemoizedBackdrop
            {...props}
            backdropStyle={backdropStyle}
            overlayOpacity={overlayOpacity}
          />
        ) : null,
      [showOverlay, overlayOpacity, backdropStyle]
    );

    const renderHandle = useCallback(
      () => (showHandle ? <MemoizedHandle /> : null),
      [showHandle]
    );

    const commonProps = useMemo(
      () => ({
        enablePanDownToClose,
        keyboardBehavior,
        keyboardBlurBehavior: 'restore' as const,
        android_keyboardInputMode,
        animationConfigs: ANIMATION_CONFIGS[animation],
        onChange: handleSheetChanges,
        backdropComponent: renderBackdrop,
        handleComponent: renderHandle,
        footerComponent,
        style: frameStyle,
        snapPointsMode,
        snapPoints: transformedSnapPoints,
        backgroundStyle: {
          backgroundColor: backgroundColor,
        },
      }),
      [
        enablePanDownToClose,
        keyboardBehavior,
        android_keyboardInputMode,
        animation,
        handleSheetChanges,
        renderBackdrop,
        renderHandle,
        footerComponent,
        frameStyle,
        snapPointsMode,
        transformedSnapPoints,
        backgroundColor,
      ]
    );

    const nonModalProps = useMemo(
      () => ({
        ...commonProps,
        index: open ? 0 : -1, // Control visibility via index instead of conditional rendering
      }),
      [commonProps, open]
    );

    const isNested = useContext(ActionSheetContext).isInsideSheet;

    const useBottomSheetViewForModal = !(
      footerComponent ||
      isNested ||
      hasScrollableContent
    );
    const useBottomSheetViewForNonModal = !footerComponent;

    if (modal) {
      return (
        <BottomSheetModal ref={bottomSheetModalRef} {...commonProps}>
          {/* BottomSheetView is only for simple static content. Use plain View for:
              - footerComponent: BottomSheetView interferes with gorhom's footer layout system
              - isNested: Avoids gesture conflicts between parent/child sheets
              - hasScrollableContent: Scrollables (BottomSheetScrollView) should be direct children,
                not wrapped in BottomSheetView per gorhom's architecture */}
          <ModalChildrenWrapper
            useBottomSheetView={useBottomSheetViewForModal}
            style={flexStyle}
          >
            {children}
          </ModalChildrenWrapper>
        </BottomSheetModal>
      );
    }

    return (
      <View
        position="absolute"
        left={0}
        right={0}
        top={0}
        bottom={0}
        zIndex={9999}
        pointerEvents="box-none"
      >
        <BottomSheet ref={bottomSheetRef} {...nonModalProps}>
          {/* BottomSheetView only for simple static content, not for layouts with footers */}
          <NonModalChildrenWrapper
            useBottomSheetView={useBottomSheetViewForNonModal}
            style={flexWithBackgroundStyle}
          >
            {children}
          </NonModalChildrenWrapper>
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
      alignSelf="center"
      marginVertical="$l"
      width="$4xl"
      height="$xs"
      borderRadius="$2xs"
      backgroundColor="$border"
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
