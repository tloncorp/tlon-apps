import {
  BottomSheet as ExpoBottomSheet,
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

import {
  BottomSheetScrollViewProps,
  BottomSheetWrapperProps,
} from './BottomSheetWrapper.types';

/**
 * The single native sheet adapter. Expo UI delegates presentation, gestures,
 * keyboard handling, and dismissal to SwiftUI on iOS and Compose on Android.
 */
export const BottomSheetWrapper = forwardRef<
  ExpoBottomSheet,
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
        if (typeof point !== 'number') return point;
        // Compose sizes a sheet against the whole window, status bar included,
        // and then lifts it above the navigation bar, so a tall sheet ends up
        // under the status bar. Size it against the app's own frame and take
        // the navigation bar back out, which leaves the top edge where the
        // percentage puts it. SwiftUI detents already account for both.
        return Platform.OS === 'android'
          ? (point / 100) * frameHeight - bottomInset
          : `${point}%`;
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

    const contentStyle = useMemo(
      () => ({
        ...(enableDynamicSizing ? null : { flex: 1 }),
        backgroundColor: theme.background.val,
        // The native host does not clip, so a list taller than the sheet
        // would otherwise show through below a footer on iOS.
        overflow: 'hidden' as const,
      }),
      [enableDynamicSizing, theme.background.val]
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

    return (
      <ExpoBottomSheet
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
      >
        <View
          style={contentStyle}
          accessible={false}
          onLayout={() => {
            if (open) onDidOpen?.();
          }}
        >
          {footerComponent ? (
            <>
              <View style={bodyStyle} accessible={false}>
                {children}
              </View>
              <View backgroundColor="$background">{footerComponent({})}</View>
            </>
          ) : (
            children
          )}
        </View>
      </ExpoBottomSheet>
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
