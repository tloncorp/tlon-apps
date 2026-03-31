import * as React from 'react';
import {
  GestureViewer,
  useGestureViewerController,
  useGestureViewerEvent,
} from 'react-native-gesture-image-viewer';
import { FlatList } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import {
  defaultGestureMediaViewerKeyExtractor,
  generateGestureMediaViewerId,
  getGestureMediaViewerIsZoomed,
  renderDefaultGestureMediaViewerItem,
  type GestureMediaViewerProps,
  type GestureMediaViewerRenderContainer,
  type GestureMediaViewerRenderItem,
} from './GestureMediaViewer.shared';

type GestureViewerEventData = {
  scale: number;
  previousScale: number | null;
};

export * from './GestureMediaViewer.shared';

export function GestureMediaViewer({
  id,
  items,
  initialIndex = 0,
  onIndexChange,
  onDismiss,
  onDismissStart,
  onSingleTap,
  onDoubleTap,
  onZoomStateChange,
  renderContainer,
  renderItem,
  enableDismissGesture,
  enableSwipeGesture,
  enableZoomGesture,
  enableDoubleTapGesture,
  enableZoomPanGesture,
  enableLoop,
  maxZoomScale,
}: GestureMediaViewerProps) {
  const generatedIdRef = React.useRef<string>();
  if (!generatedIdRef.current) {
    generatedIdRef.current = generateGestureMediaViewerId();
  }
  const viewerId = id ?? generatedIdRef.current;
  const [isZoomed, setIsZoomed] = React.useState(false);
  const controller = useGestureViewerController(viewerId);
  const usesCustomTap = onSingleTap != null || onDoubleTap != null;

  const handleZoomChange = React.useCallback(
    ({ scale, previousScale }: GestureViewerEventData) => {
      const nextIsZoomed = getGestureMediaViewerIsZoomed(scale);

      setIsZoomed(nextIsZoomed);
      onZoomStateChange?.({
        isZoomed: nextIsZoomed,
        scale,
        previousScale,
      });
    },
    [onZoomStateChange]
  );

  useGestureViewerEvent(viewerId, 'zoomChange', handleZoomChange);

  const resolvedRenderItem = React.useCallback<GestureMediaViewerRenderItem>(
    (item, index) =>
      renderItem?.(item, index) ?? renderDefaultGestureMediaViewerItem(item),
    [renderItem]
  );

  const handleSingleTap = React.useCallback(() => {
    onSingleTap?.();
  }, [onSingleTap]);

  const handleDoubleTap = React.useCallback(() => {
    if (isZoomed) {
      controller.resetZoom();
    } else {
      controller.resetZoom(maxZoomScale ?? 2);
    }

    onDoubleTap?.();
  }, [controller, isZoomed, maxZoomScale, onDoubleTap]);

  const tapGesture = React.useMemo(
    () =>
      Gesture.Exclusive(
        Gesture.Tap()
          .numberOfTaps(2)
          .onEnd((_event, success) => {
            if (success) {
              runOnJS(handleDoubleTap)();
            }
          }),
        Gesture.Tap().onEnd((_event, success) => {
          if (success) {
            runOnJS(handleSingleTap)();
          }
        })
      ),
    [handleDoubleTap, handleSingleTap]
  );

  const resolvedRenderContainer = React.useMemo(
    () =>
      !usesCustomTap
        ? renderContainer
        : ((children, helpers) => {
            const tappableChildren = (
              <GestureDetector gesture={tapGesture}>{children}</GestureDetector>
            );

            return renderContainer
              ? renderContainer(tappableChildren, helpers)
              : tappableChildren;
          }) satisfies GestureMediaViewerRenderContainer,
    [renderContainer, tapGesture, usesCustomTap]
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <GestureViewer
      id={viewerId}
      data={items}
      initialIndex={initialIndex}
      onIndexChange={onIndexChange}
      onDismiss={onDismiss}
      onDismissStart={onDismissStart}
      renderItem={resolvedRenderItem}
      renderContainer={resolvedRenderContainer}
      ListComponent={FlatList}
      enableDismissGesture={enableDismissGesture}
      enableSwipeGesture={enableSwipeGesture}
      enableZoomGesture={enableZoomGesture}
      enableDoubleTapGesture={
        usesCustomTap ? false : enableDoubleTapGesture
      }
      enableZoomPanGesture={enableZoomPanGesture}
      enableLoop={enableLoop}
      maxZoomScale={maxZoomScale}
      listProps={{
        keyExtractor: defaultGestureMediaViewerKeyExtractor,
      }}
    />
  );
}
