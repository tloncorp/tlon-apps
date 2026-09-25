import {
  BottomSheet as ExpoBottomSheet,
  BottomSheetScrollView as ExpoBottomSheetScrollView,
  BottomSheetTextInput as ExpoBottomSheetTextInput,
} from '@expo/ui/community/bottom-sheet';
import { View } from '@tloncorp/ui';
import React, {
  ComponentProps,
  PropsWithChildren,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, Platform } from 'react-native';
import { useTheme } from 'tamagui';

import {
  BottomSheetScrollViewProps,
  BottomSheetWrapperProps,
} from './BottomSheetWrapper.types';

const ANIMATION_DURATIONS = {
  quick: 250,
  medium: 350,
  slow: 500,
} as const;

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
      children,
      transition = 'quick',
      dismissOnSnapToBottom = true,
      snapPointsMode = 'fit',
      snapPoints,
      showHandle = true,
      enablePanDownToClose = true,
      enableContentPanningGesture = true,
      enableDynamicSizing,
      frameStyle,
      footerComponent,
      unmountOnClose = false,
    },
    ref
  ) => {
    const theme = useTheme();
    const [mounted, setMounted] = useState(open || !unmountOnClose);
    const [mountKey, setMountKey] = useState(0);
    const previousOpen = useRef(open);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const transformedSnapPoints = useMemo(() => {
      if (!snapPoints) return undefined;
      if (snapPointsMode === 'percent') {
        return snapPoints.map((point) =>
          typeof point === 'number' ? `${point}%` : point
        );
      }
      return snapPoints;
    }, [snapPoints, snapPointsMode]);

    const resolvedEnableDynamicSizing =
      enableDynamicSizing ?? snapPointsMode !== 'percent';
    // Compose cannot separate content-originated sheet pans from handle pans.
    // When nested content owns vertical gestures, hide the disabled handle and
    // keep standard back/scrim dismissal available instead of showing inert UI.
    const resolvedShowHandle =
      showHandle &&
      (Platform.OS !== 'android' || enableContentPanningGesture !== false);

    const handleChange = useCallback(
      (index: number) => {
        if (index === -1 && open && dismissOnSnapToBottom) {
          onOpenChange(false);
        }
      },
      [dismissOnSnapToBottom, onOpenChange, open]
    );

    useEffect(() => {
      if (!open) {
        Keyboard.dismiss();
      }
    }, [open]);

    useEffect(() => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }

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
      } else {
        closeTimer.current = setTimeout(() => {
          setMounted(false);
          closeTimer.current = null;
        }, ANIMATION_DURATIONS[transition] + 100);
      }
      previousOpen.current = open;

      return () => {
        if (closeTimer.current) {
          clearTimeout(closeTimer.current);
          closeTimer.current = null;
        }
      };
    }, [open, transition, unmountOnClose]);

    const contentStyle = useMemo(
      () => ({
        ...(resolvedEnableDynamicSizing ? null : { flex: 1 }),
        backgroundColor: theme.background.val,
      }),
      [resolvedEnableDynamicSizing, theme.background.val]
    );
    const bodyStyle = useMemo(
      () =>
        footerComponent && !resolvedEnableDynamicSizing
          ? ({ flex: 1 } as const)
          : undefined,
      [footerComponent, resolvedEnableDynamicSizing]
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
        enableDynamicSizing={resolvedEnableDynamicSizing}
        enablePanDownToClose={enablePanDownToClose}
        enableContentPanningGesture={enableContentPanningGesture}
        handleComponent={resolvedShowHandle ? BottomSheetHandle : null}
        backgroundStyle={{ backgroundColor: theme.background.val }}
        style={frameStyle}
        onChange={handleChange}
      >
        <View style={contentStyle} accessible={false}>
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

export const BottomSheetTextInput = forwardRef<
  React.ElementRef<typeof ExpoBottomSheetTextInput>,
  ComponentProps<typeof ExpoBottomSheetTextInput>
>((props, ref) => <ExpoBottomSheetTextInput ref={ref} {...props} />);

BottomSheetTextInput.displayName = 'BottomSheetTextInput';
