import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetFooterProps,
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
  useState,
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
      accessible={false}
      accessibilityElementsHidden={true}
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

const MemoizedBackground = React.memo(({ style }: { style: any }) => (
  <View style={style} accessible={false} pointerEvents="none" />
));

MemoizedBackground.displayName = 'MemoizedBackground';

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
      return (
        <BottomSheetView style={style} accessible={false}>
          {children}
        </BottomSheetView>
      );
    }
    return (
      <View style={style} accessible={false}>
        {children}
      </View>
    );
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
      return (
        <BottomSheetView style={style} accessible={false}>
          {children}
        </BottomSheetView>
      );
    }
    return (
      <View style={style} accessible={false}>
        {children}
      </View>
    );
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
      transition = 'quick',
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
      enableContentPanningGesture,
      enableDynamicSizing,
      unmountOnClose = false,
    },
    ref
  ) => {
    const bottomSheetRef = useRef<BottomSheet>(null);
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    /**
     * Tracks whether the current sheet state change was triggered programmatically
     * (via prop changes) vs user-initiated (via gestures). This prevents feedback
     * loops where programmatic dismissals trigger onOpenChange callbacks during
     * sheet transitions.
     */
    const isProgrammaticChange = useRef(false);
    // Default-path callers (unmountOnClose=false) start mounted=true regardless
    // of `open`, mirroring today's render-immediately behavior. Opt-in callers
    // start mounted === open.
    const [mounted, setMounted] = useState<boolean>(open || !unmountOnClose);
    const [mountKey, setMountKey] = useState(0);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevOpenRef = useRef<boolean>(open);
    const theme = useTheme();

    const clearCloseTimer = useCallback(() => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    }, []);

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

    const wrappedFooterComponent = useMemo(
      () =>
        footerComponent
          ? (props: BottomSheetFooterProps) => {
              const content = footerComponent(props);
              return content ? (
                <BottomSheetFooter {...props}>
                  <View backgroundColor={backgroundColor}>{content}</View>
                </BottomSheetFooter>
              ) : null;
            }
          : undefined,
      [backgroundColor, footerComponent]
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

    // Resolve enableDynamicSizing: explicit prop takes precedence, otherwise
    // default to false for percent-mode sheets (they should expand to the percentage,
    // not fit content) and true for fit/constant modes (gorhom's default behavior)
    const resolvedEnableDynamicSizing = useMemo(() => {
      if (enableDynamicSizing !== undefined) {
        return enableDynamicSizing;
      }
      if (snapPointsMode === 'percent') {
        return false;
      }
      return true;
    }, [enableDynamicSizing, snapPointsMode]);

    // Read `.current` at call time so methods stay correct across `mountKey`
    // remounts under `unmountOnClose`.
    React.useImperativeHandle(
      ref,
      () => {
        const m = () => bottomSheetModalRef.current;
        const s = () => bottomSheetRef.current;
        return {
          present: () => (modal ? m()?.present() : s()?.expand()),
          dismiss: () => (modal ? m()?.dismiss() : s()?.close()),
          close: () => (modal ? m()?.dismiss() : s()?.close()),
          expand: () => (modal ? m()?.present() : s()?.expand()),
          collapse: () => (modal ? m()?.dismiss() : s()?.collapse()),
          snapToIndex: (index: number) =>
            modal ? m()?.snapToIndex(index) : s()?.snapToIndex(index),
          snapToPosition: (position: string | number) =>
            modal
              ? m()?.snapToPosition(position)
              : s()?.snapToPosition(position),
          forceClose: () => (modal ? m()?.forceClose() : s()?.forceClose()),
        } as any;
      },
      [modal]
    );

    // Opt-in lifecycle: when `unmountOnClose === true`, mount the subtree on
    // open, schedule an unmount after the close-grace window on close, and bump
    // `mountKey` on every real `false → true` transition so each subsequent
    // open mounts a fresh Gorhom instance. Default path (unmountOnClose=false)
    // snaps `mounted=true` and is otherwise inert.
    useEffect(() => {
      if (!unmountOnClose) {
        clearCloseTimer();
        setMounted(true);
        prevOpenRef.current = open;
        return;
      }
      clearCloseTimer();
      if (open) {
        setMounted(true);
        if (!prevOpenRef.current) {
          // Real false → true edge.
          //
          // Note: for the current ActionSheet-mounted consumer, the very first
          // open does not bump key 0 because ActionSheet does not mount this
          // wrapper until first `open=true` (so `prevOpenRef.current` was
          // initialised to `true` by `useRef(open)` above). For a future
          // direct BottomSheetWrapper consumer that mounts with `open=false`
          // initially, the first `false → true` transition would bump key 0
          // to key 1; that is harmless because the render gate keeps
          // `mounted=false` until this same effect run sets it `true`, so
          // the bumped key is the first key actually rendered.
          setMountKey((k) => k + 1);
        }
        prevOpenRef.current = open;
        return;
      }
      // open === false
      closeTimerRef.current = setTimeout(() => {
        setMounted(false);
        closeTimerRef.current = null;
      }, ANIMATION_CONFIGS[transition].duration + 100);
      prevOpenRef.current = open;
      return () => clearCloseTimer();
    }, [open, unmountOnClose, transition, clearCloseTimer]);

    // Cancel any pending close timer when the wrapper unmounts.
    useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

    // Handle modal sheet open/close
    useEffect(() => {
      if (!modal) return;

      if (open) {
        // Small delay to ensure modal is mounted before presenting
        const timer = setTimeout(() => {
          isProgrammaticChange.current = true;
          bottomSheetModalRef.current?.present();
        }, 50);
        return () => clearTimeout(timer);
      } else {
        isProgrammaticChange.current = true;
        bottomSheetModalRef.current?.dismiss();
      }
    }, [open, modal, mountKey]);

    // Handle non-modal sheet open/close
    useEffect(() => {
      if (modal) return;

      isProgrammaticChange.current = true;
      if (!open) {
        bottomSheetRef.current?.close();
      } else {
        bottomSheetRef.current?.expand();
      }
    }, [open, modal, mountKey]);

    useEffect(() => {
      if (!open) {
        Keyboard.dismiss();
      }
    }, [open]);

    const handleSheetChanges = useCallback(
      (index: number) => {
        // When sheet is closed (index -1), handle cleanup and callbacks
        if (index === -1) {
          // Only notify parent if dismissOnSnapToBottom is true and it's user-initiated
          if (dismissOnSnapToBottom && !isProgrammaticChange.current) {
            onOpenChange(false);
          }
          // Reset flag when reaching closed state
          isProgrammaticChange.current = false;
        } else if (index >= 0) {
          // Reset flag when sheet reaches any open snap point
          // This ensures the flag only protects the specific operation that set it
          isProgrammaticChange.current = false;
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
    const renderBackground = useCallback(
      (props: any) => <MemoizedBackground {...props} />,
      []
    );

    const commonProps = useMemo(
      () => ({
        // Keep the sheet container itself out of the accessibility tree so
        // nested actionable content remains discoverable.
        accessible: false,
        enablePanDownToClose,
        enableDynamicSizing: resolvedEnableDynamicSizing,
        keyboardBehavior,
        keyboardBlurBehavior: 'restore' as const,
        android_keyboardInputMode,
        animationConfigs: ANIMATION_CONFIGS[transition],
        onChange: handleSheetChanges,
        backdropComponent: renderBackdrop,
        handleComponent: renderHandle,
        backgroundComponent: renderBackground,
        footerComponent: wrappedFooterComponent,
        style: frameStyle,
        snapPointsMode,
        snapPoints: transformedSnapPoints,
        backgroundStyle: {
          backgroundColor: backgroundColor,
        },
        // Prevents pan gesture from being activated unless user has scrolled
        // this much vertical distance. Important for nested horizontal
        // scrollviews.
        activeOffsetY: [-10, 10] as [number, number],
      }),
      [
        enablePanDownToClose,
        resolvedEnableDynamicSizing,
        keyboardBehavior,
        android_keyboardInputMode,
        transition,
        handleSheetChanges,
        renderBackdrop,
        renderHandle,
        renderBackground,
        wrappedFooterComponent,
        frameStyle,
        snapPointsMode,
        transformedSnapPoints,
        backgroundColor,
      ]
    );

    const commonOverrides = useMemo(() => {
      return {
        enableContentPanningGesture,
      };
    }, [enableContentPanningGesture]);

    const nonModalProps = useMemo(
      () => ({
        ...commonProps,
        ...commonOverrides,
        index: open ? 0 : -1, // Control visibility via index instead of conditional rendering
      }),
      [commonOverrides, commonProps, open]
    );

    const isNested = useContext(ActionSheetContext).isInsideSheet;

    const useBottomSheetViewForModal = !(
      footerComponent ||
      isNested ||
      hasScrollableContent
    );
    const useBottomSheetViewForNonModal = !(
      footerComponent || hasScrollableContent
    );

    // Opt-in render gate: only return null when the caller explicitly asked for
    // unmount-on-close AND the close-grace timer has already fired. Default
    // callers (unmountOnClose=false) never hit this branch.
    const gateUnmounted = unmountOnClose && !mounted;

    if (modal) {
      return gateUnmounted ? null : (
        <BottomSheetModal
          key={mountKey}
          ref={bottomSheetModalRef}
          accessibilityViewIsModal={true}
          {...commonProps}
          {...commonOverrides}
        >
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

    return gateUnmounted ? null : (
      <View
        position="absolute"
        left={0}
        right={0}
        top={0}
        bottom={0}
        zIndex={9999}
        pointerEvents="box-none"
        accessible={false}
      >
        <BottomSheet key={mountKey} ref={bottomSheetRef} {...nonModalProps}>
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
