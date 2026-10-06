import type { BottomSheetMethods } from '@expo/ui/community/bottom-sheet';
import {
  Box,
  Column,
  Host,
  ModalBottomSheet,
  RNHostView,
} from '@expo/ui/jetpack-compose';
import type { ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  height as heightModifier,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import {
  type Context,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  View,
  VirtualizedList,
  processColor,
  useWindowDimensions,
} from 'react-native';

import type { NativeSheetHostProps } from './NativeSheetHost.types';

// How long the covered height has to hold still before a growth is reported.
// The keyboard grows it on every frame as it opens; only where it ends matters.
const COVER_SETTLE_MS = 120;

type SnapPoint = { type: 'height' | 'fraction'; value: number };

function parseSnapPoint(point: string | number): SnapPoint {
  if (typeof point === 'number') {
    return { type: 'height', value: point };
  }
  if (point.endsWith('%')) {
    return { type: 'fraction', value: parseFloat(point) / 100 };
  }
  return { type: 'height', value: parseFloat(point) };
}

function extractBackgroundColor(
  backgroundStyle: NativeSheetHostProps['backgroundStyle']
): string | undefined {
  if (!backgroundStyle) return undefined;
  return (StyleSheet.flatten(backgroundStyle) as any)?.backgroundColor;
}

// Material3 picks the status and navigation bar icon colors from the sheet's
// content color, and its default content color follows the system theme. Give
// it one that contrasts with the sheet's own background, so the icons stay
// readable under a sheet that reaches the top of the screen when the app's
// theme differs from the system's.
function getContrastingContentColor(
  containerColor: string | undefined
): string | undefined {
  const processed =
    containerColor == null ? null : processColor(containerColor);
  if (typeof processed !== 'number') return undefined;

  const red = (processed >> 16) & 0xff;
  const green = (processed >> 8) & 0xff;
  const blue = processed & 0xff;
  const isLight = (0.299 * red + 0.587 * green + 0.114 * blue) / 255 > 0.5;
  return isLight ? '#000000' : '#ffffff';
}

function findNearestSnapPointIndex(
  snapPoints: NativeSheetHostProps['snapPoints'],
  position: string | number
): number {
  if (!snapPoints || snapPoints.length === 0) return 0;

  const parsedTarget = parseSnapPoint(position);
  let nearestIndex = 0;
  let nearestDistance = Infinity;

  snapPoints.forEach((snapPoint, index) => {
    const parsedSnapPoint = parseSnapPoint(snapPoint);
    if (parsedSnapPoint.type !== parsedTarget.type) return;

    const distance = Math.abs(parsedSnapPoint.value - parsedTarget.value);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  if (nearestDistance !== Infinity) {
    return nearestIndex;
  }

  return typeof position === 'number' ? snapPoints.length - 1 : 0;
}

function getSingleSnapPointHeight(
  snapPoints: NativeSheetHostProps['snapPoints'],
  containerHeight: number,
  showDragHandle: boolean
): number | undefined {
  if (!snapPoints || snapPoints.length !== 1) return undefined;

  const parsed = parseSnapPoint(snapPoints[0]);
  const requestedHeight =
    parsed.type === 'fraction' ? parsed.value * containerHeight : parsed.value;
  // Material3's default handle occupies 48dp outside the React Native child:
  // a 4dp handle plus 22dp of vertical padding on each side. Subtract it so
  // the complete native sheet, rather than only its content, matches the snap
  // point.
  const nativeHandleHeight = showDragHandle ? 48 : 0;
  return Math.min(
    containerHeight,
    Math.max(1, requestedHeight - nativeHandleHeight)
  );
}

const VirtualizedListContext = (
  VirtualizedList as unknown as { contextType?: Context<unknown> }
).contextType;
const ScrollViewContext = (
  ScrollView as unknown as { Context?: Context<unknown> }
).Context;

// A list that finds itself inside another list's React context renders a plain
// view instead of a scroller. A sheet opened from a list row is in that
// context but is not inside the list on screen, so clear it. React Native's
// Modal does the same.
function SheetScrollContextReset({ children }: { children: ReactNode }) {
  let node: ReactNode = children;
  if (ScrollViewContext) {
    node = (
      <ScrollViewContext.Provider value={null}>
        {node}
      </ScrollViewContext.Provider>
    );
  }
  if (VirtualizedListContext) {
    node = (
      <VirtualizedListContext.Provider value={null}>
        {node}
      </VirtualizedListContext.Provider>
    );
  }
  return <>{node}</>;
}

/**
 * The Android sheet, on Material3's ModalBottomSheet. It follows the
 * `@gorhom/bottom-sheet` props that Expo UI's own adapter takes, so the two
 * platforms share a wrapper.
 *
 * Material3 has two open states: partially expanded (about half) and fully
 * expanded. With several snap points, `snapToIndex(0)` is partial and the last
 * index is expanded. A single snap point is a fixed height instead.
 */
export function NativeSheetHost(props: NativeSheetHostProps) {
  const {
    ref,
    snapPoints: snapPointsProp,
    index: indexProp = 0,
    onChange,
    onClose,
    onDismiss,
    enablePanDownToClose = false,
    enableContentPanningGesture = true,
    enableDynamicSizing = true,
    handleComponent,
    backgroundStyle,
    footer,
    onCoveredHeightChange,
    children,
  } = props;
  const { width, height } = useWindowDimensions();

  const hasMultipleSnapPoints =
    snapPointsProp != null && snapPointsProp.length > 1;
  const fitToContents =
    enableDynamicSizing && (!snapPointsProp || snapPointsProp.length === 0);
  const fixedHeight = enableDynamicSizing
    ? undefined
    : getSingleSnapPointHeight(
        snapPointsProp,
        height,
        handleComponent !== null
      );
  const skipPartially = fitToContents || !hasMultipleSnapPoints;
  const maxIndex = snapPointsProp ? snapPointsProp.length - 1 : 0;
  const containerColor = extractBackgroundColor(backgroundStyle);
  const contentColor = getContrastingContentColor(containerColor);
  const clampIndex = useCallback(
    (index: number) => Math.min(Math.max(index, 0), maxIndex),
    [maxIndex]
  );

  const [isOpen, setIsOpen] = useState(indexProp >= 0);
  // Mirrors isOpen for snapToIndex, which must not be rebuilt on every open
  // and close.
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const pendingIndexRef = useRef(indexProp >= 0 ? clampIndex(indexProp) : null);
  const sheetRef = useRef<ModalBottomSheetRef>(null);
  // Guards fireCloseCallbacks against firing twice when a programmatic hide
  // races a native onDismissRequest, such as a swipe during an auto-close.
  const closedRef = useRef(indexProp < 0);
  const dismissedRef = useRef(indexProp < 0);
  const operationRef = useRef(0);
  const hidingRef = useRef(false);
  const [mountKey, setMountKey] = useState(0);
  const mountKeyRef = useRef(0);
  useEffect(
    () => () => {
      ++operationRef.current;
    },
    []
  );

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const fireCloseCallbacks = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onCloseRef.current?.();
    onChangeRef.current?.(-1);
  }, []);

  const finishDismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    hidingRef.current = false;
    isOpenRef.current = false;
    pendingIndexRef.current = null;
    setIsOpen(false);
    fireCloseCallbacks();
    onDismissRef.current?.();
  }, [fireCloseCallbacks]);

  const close = useCallback(() => {
    if (!isOpenRef.current || hidingRef.current) return;
    const operation = ++operationRef.current;
    hidingRef.current = true;
    pendingIndexRef.current = null;
    fireCloseCallbacks();
    // Keep the native host alive until Compose's hide animation completes.
    const hidden = sheetRef.current?.hide() ?? Promise.resolve();
    void hidden.then(() => {
      if (operationRef.current === operation) finishDismiss();
    });
  }, [fireCloseCallbacks, finishDismiss]);

  const open = useCallback(() => {
    ++operationRef.current;
    if (hidingRef.current || !isOpenRef.current) {
      // New presentations must reject callbacks from the previous native host.
      mountKeyRef.current += 1;
      setMountKey(mountKeyRef.current);
    }
    hidingRef.current = false;
    closedRef.current = false;
    dismissedRef.current = false;
    isOpenRef.current = true;
    setIsOpen(true);
  }, []);

  useEffect(() => {
    if (indexProp === -1) {
      close();
    } else if (indexProp >= 0) {
      pendingIndexRef.current = clampIndex(indexProp);
      open();
    }
  }, [clampIndex, indexProp, close, open]);

  const handleDismiss = useCallback(() => {
    if (mountKeyRef.current !== mountKey) return;
    ++operationRef.current;
    finishDismiss();
  }, [finishDismiss, mountKey]);

  const methods: BottomSheetMethods = useMemo(() => {
    const snapToIndex = (index: number) => {
      if (index === -1) {
        close();
        return;
      }
      const clampedIndex = clampIndex(index);
      pendingIndexRef.current = clampedIndex;
      if (!isOpenRef.current || hidingRef.current) {
        open();
      } else if (hasMultipleSnapPoints) {
        if (clampedIndex === maxIndex) {
          sheetRef.current?.expand();
        } else {
          sheetRef.current?.partialExpand();
        }
        pendingIndexRef.current = null;
      }
      onChangeRef.current?.(clampedIndex);
    };

    return {
      snapToIndex,
      snapToPosition: (position: string | number) =>
        snapToIndex(findNearestSnapPointIndex(snapPointsProp, position)),
      expand: () => snapToIndex(maxIndex),
      collapse: () => snapToIndex(0),
      close,
      forceClose: close,
      present: () => snapToIndex(0),
      dismiss: close,
    };
  }, [
    clampIndex,
    maxIndex,
    hasMultipleSnapPoints,
    close,
    open,
    snapPointsProp,
  ]);

  useImperativeHandle(ref, () => methods, [methods]);

  const [footerHeight, setFooterHeight] = useState(0);
  const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
    setFooterHeight(event.nativeEvent.layout.height);
  }, []);

  const onCoveredHeightChangeRef = useRef(onCoveredHeightChange);
  onCoveredHeightChangeRef.current = onCoveredHeightChange;
  const coveredHeightRef = useRef(0);
  const coverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportCoveredHeight = useCallback((next: number) => {
    if (coverTimerRef.current) {
      clearTimeout(coverTimerRef.current);
      coverTimerRef.current = null;
    }
    if (next === coveredHeightRef.current) return;
    const commit = () => {
      coverTimerRef.current = null;
      coveredHeightRef.current = next;
      onCoveredHeightChangeRef.current?.(next);
    };
    // Shrinking uncovers content, which has to be there to be seen, so report
    // it at once. Growing only hides content, so it can wait for the keyboard
    // to stop.
    if (next < coveredHeightRef.current) {
      commit();
    } else {
      coverTimerRef.current = setTimeout(commit, COVER_SETTLE_MS);
    }
  }, []);
  useEffect(
    () => () => {
      if (coverTimerRef.current) clearTimeout(coverTimerRef.current);
    },
    []
  );
  const handleViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (fixedHeight == null) return;
      const covered = fixedHeight - event.nativeEvent.layout.height;
      reportCoveredHeight(covered < 1 ? 0 : covered);
    },
    [fixedHeight, reportCoveredHeight]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <Host style={{ position: 'absolute', width }} pointerEvents="none">
      <ModalBottomSheet
        key={mountKey}
        ref={sheetRef}
        onDismissRequest={handleDismiss}
        skipPartiallyExpanded={skipPartially}
        initialFullyExpanded={
          hasMultipleSnapPoints && pendingIndexRef.current === maxIndex
        }
        showDragHandle={handleComponent !== null}
        sheetGesturesEnabled={
          enablePanDownToClose && enableContentPanningGesture
        }
        containerColor={containerColor}
        contentColor={contentColor}
        properties={{
          shouldDismissOnBackPress: enablePanDownToClose,
          shouldDismissOnClickOutside: enablePanDownToClose,
        }}
      >
        {fixedHeight != null ? (
          // Material3 gives the sheet less room while the keyboard is up, and
          // this column gives way to it. What is inside does not: the content
          // keeps its full height and the column shows less of it, so the
          // keyboard slides over the content without React Native laying
          // anything out again. A relayout lands a few frames behind the
          // keyboard, which is long enough to see.
          <Column modifiers={[fillMaxWidth(), heightModifier(fixedHeight)]}>
            <Box modifiers={[weight(1), fillMaxWidth()]}>
              <RNHostView onLayout={handleViewportLayout}>
                <View style={[styles.pinnedToTop, { height: fixedHeight }]}>
                  <SheetScrollContextReset>{children}</SheetScrollContextReset>
                </View>
              </RNHostView>
            </Box>
            {footer !== undefined ? (
              // The footer is the column's own child so that Compose, not
              // React Native, keeps it on the keyboard's edge.
              <Box modifiers={[fillMaxWidth(), heightModifier(footerHeight)]}>
                <RNHostView>
                  <View
                    style={styles.pinnedToTop}
                    onLayout={handleFooterLayout}
                  >
                    {footer}
                  </View>
                </RNHostView>
              </Box>
            ) : null}
          </Column>
        ) : (
          <RNHostView matchContents={fitToContents}>
            {/* With matchContents, RNHostView lays the hosted view out at its
                own size, so `width` gives it the sheet width while its height
                stays content-sized. Otherwise flexGrow:1 + height:0
                (flex-basis 0) fills RNHostView's measured height without
                inheriting the scrollable child's content height, which would
                block scrolling to the end. */}
            <View
              style={fitToContents ? { width } : { flexGrow: 1, height: 0 }}
            >
              <SheetScrollContextReset>{children}</SheetScrollContextReset>
            </View>
          </RNHostView>
        )}
      </ModalBottomSheet>
    </Host>
  );
}

// A hosted view takes its host's height unless it is taken out of the flow.
// These two size themselves: the content to the sheet's full height, however
// little of it shows, and the footer to what is in it.
const styles = StyleSheet.create({
  pinnedToTop: { position: 'absolute', top: 0, left: 0, right: 0 },
});
