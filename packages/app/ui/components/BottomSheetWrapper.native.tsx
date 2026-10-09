import {
  type BottomSheetMethods,
  BottomSheetScrollView as ExpoBottomSheetScrollView,
} from '@expo/ui/community/bottom-sheet';
import { View } from '@tloncorp/ui';
import React, {
  PropsWithChildren,
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, Platform } from 'react-native';
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useTheme } from 'tamagui';

import { SheetCoverContext } from '../hooks/useSheetCoveredHeight';
import {
  BottomSheetScrollViewProps,
  BottomSheetWrapperProps,
} from './BottomSheetWrapper.types';
import { NativeSheetHost } from './NativeSheetHost';

const HANDLELESS_TOP_PADDING = 28;

/**
 * The single native sheet adapter. Presentation, gestures, keyboard handling,
 * and dismissal belong to SwiftUI on iOS, through Expo UI's sheet, and to
 * Compose on Android, through our own host.
 */
export const BottomSheetWrapper = forwardRef<
  BottomSheetMethods,
  PropsWithChildren<BottomSheetWrapperProps>
>(
  (
    {
      open,
      onOpenChange,
      onDidOpen,
      onDismiss,
      children,
      dismissOnSnapToBottom = true,
      snapPointsMode = 'fit',
      snapPoints,
      showHandle = true,
      enablePanDownToClose = true,
      enableContentPanningGesture = true,
      footerComponent,
      unmountOnClose = false,
    },
    ref
  ) => {
    const theme = useTheme();
    const [mounted, setMounted] = useState(open || !unmountOnClose);
    const [mountKey, setMountKey] = useState(0);
    const previousOpen = useRef(open);
    const openRef = useRef(open);
    const mountKeyRef = useRef(mountKey);
    const dismissalHandled = useRef(!open);
    useLayoutEffect(() => {
      openRef.current = open;
      mountKeyRef.current = mountKey;
      if (open) dismissalHandled.current = false;
    }, [open, mountKey]);

    const { height: frameHeight } = useSafeAreaFrame();
    const { bottom: bottomInset } = useSafeAreaInsets();
    const transformedSnapPoints = useMemo(() => {
      if (!snapPoints) return undefined;
      if (snapPointsMode !== 'percent') return snapPoints;
      return snapPoints.map((point) => {
        // A percentage may come as 90 or as '90%'.
        const percent =
          typeof point === 'number'
            ? point
            : point.trim().endsWith('%')
              ? parseFloat(point)
              : NaN;
        if (Number.isNaN(percent)) return point;
        // Compose sizes a sheet against the whole window, status bar included,
        // and then lifts it above the navigation bar, so a tall sheet ends up
        // under the status bar. Size it against the app's own frame and take
        // the navigation bar back out, which leaves the top edge where the
        // percentage puts it. SwiftUI detents already account for both.
        return Platform.OS === 'android'
          ? (percent / 100) * frameHeight - bottomInset
          : `${percent}%`;
      });
    }, [snapPoints, snapPointsMode, frameHeight, bottomInset]);

    const enableDynamicSizing = snapPointsMode !== 'percent';
    // Compose cannot separate content-originated sheet pans from handle pans.
    // When nested content owns vertical gestures, hide the disabled handle and
    // keep standard back/scrim dismissal available instead of showing inert UI.
    const resolvedShowHandle =
      showHandle &&
      (Platform.OS !== 'android' || enableContentPanningGesture !== false);

    const handleChange = useCallback(
      (index: number) => {
        if (index === -1 && open && dismissOnSnapToBottom) {
          openRef.current = false;
          onOpenChange(false);
        } else if (index >= 0 && open) {
          onDidOpen?.();
        }
      },
      [dismissOnSnapToBottom, onOpenChange, onDidOpen, open]
    );

    const handleDismiss = useCallback(() => {
      if (
        openRef.current ||
        mountKeyRef.current !== mountKey ||
        dismissalHandled.current
      ) {
        return;
      }
      dismissalHandled.current = true;
      if (unmountOnClose) setMounted(false);
      onDismiss?.();
    }, [mountKey, onDismiss, unmountOnClose]);

    useEffect(() => {
      if (!open) {
        Keyboard.dismiss();
      }
    }, [open]);

    useEffect(() => {
      if (!unmountOnClose) {
        setMounted(true);
        previousOpen.current = open;
        return;
      }

      if (open) {
        setMounted(true);
        if (!previousOpen.current) {
          setMountKey((key) => key + 1);
        }
      }
      previousOpen.current = open;
    }, [open, unmountOnClose]);

    // The drag handle's strip is what holds a sheet's header off its top
    // edge on Android. A sheet that hides the handle loses that strip, so give
    // some of the space back.
    const needsTopSpace =
      Platform.OS === 'android' && showHandle && !resolvedShowHandle;
    // A fixed-height Android sheet keeps its content at full size and lets the
    // footer and the keyboard cover the bottom of it. The footer goes to the
    // host, which pins it natively.
    const hostsFooter =
      Platform.OS === 'android' &&
      !enableDynamicSizing &&
      transformedSnapPoints?.length === 1 &&
      !!footerComponent;
    const [coveredHeight, setCoveredHeight] = useState(0);
    const [coverClaims, setCoverClaims] = useState(0);
    const claimCover = useCallback(() => {
      setCoverClaims((count) => count + 1);
      return () => setCoverClaims((count) => count - 1);
    }, []);
    const cover = useMemo(
      () => ({ height: coveredHeight, claim: claimCover }),
      [coveredHeight, claimCover]
    );
    // Content that does not inset itself is padded clear of what covers it.
    const coverPadding = coverClaims === 0 ? coveredHeight : 0;

    const contentStyle = useMemo(
      () => ({
        ...(enableDynamicSizing ? null : { flex: 1 }),
        ...(needsTopSpace ? { paddingTop: HANDLELESS_TOP_PADDING } : null),
        ...(coverPadding > 0 ? { paddingBottom: coverPadding } : null),
        backgroundColor: theme.background.val,
      }),
      [enableDynamicSizing, needsTopSpace, coverPadding, theme.background.val]
    );
    const bodyStyle = useMemo(
      () =>
        footerComponent && !enableDynamicSizing
          ? ({ flex: 1 } as const)
          : undefined,
      [footerComponent, enableDynamicSizing]
    );

    if (unmountOnClose && !mounted) {
      return null;
    }

    const footerElement = footerComponent ? (
      <View backgroundColor="$background">{footerComponent({})}</View>
    ) : null;

    return (
      <NativeSheetHost
        key={mountKey}
        ref={ref as any}
        index={open ? 0 : -1}
        snapPoints={transformedSnapPoints}
        enableDynamicSizing={enableDynamicSizing}
        enablePanDownToClose={enablePanDownToClose}
        enableContentPanningGesture={enableContentPanningGesture}
        handleComponent={resolvedShowHandle ? BottomSheetHandle : null}
        backgroundStyle={{ backgroundColor: theme.background.val }}
        onChange={handleChange}
        onDismiss={handleDismiss}
        footer={hostsFooter ? footerElement : undefined}
        onCoveredHeightChange={setCoveredHeight}
      >
        <SheetCoverContext.Provider value={cover}>
          <View
            style={contentStyle}
            accessible={false}
            onLayout={() => {
              if (open) onDidOpen?.();
            }}
          >
            {footerElement && !hostsFooter ? (
              <>
                <View style={bodyStyle} accessible={false}>
                  {children}
                </View>
                {footerElement}
              </>
            ) : (
              children
            )}
          </View>
        </SheetCoverContext.Provider>
      </NativeSheetHost>
    );
  }
);

BottomSheetWrapper.displayName = 'BottomSheetWrapper';

// Any non-null handle component asks Expo UI to render the platform-native
// drag indicator. Its React content is intentionally not rendered on native.
const BottomSheetHandle = () => null;

export const BottomSheetScrollView = forwardRef<
  typeof ExpoBottomSheetScrollView,
  PropsWithChildren<BottomSheetScrollViewProps>
>((props, ref) => (
  <ExpoBottomSheetScrollView ref={ref as any} nestedScrollEnabled {...props} />
));

BottomSheetScrollView.displayName = 'BottomSheetScrollView';
