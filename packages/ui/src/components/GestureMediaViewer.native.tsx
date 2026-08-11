import { useCallback, useEffect, useRef } from 'react';
import { FlatList } from 'react-native';
import {
  GestureViewer,
  useGestureViewerEvent,
  useGestureViewerState,
} from 'react-native-gesture-image-viewer';

import {
  type GestureMediaViewerProps,
  type GestureMediaViewerRenderItem,
  defaultGestureMediaViewerKeyExtractor,
  generateGestureMediaViewerId,
  getGestureMediaViewerIsZoomed,
  renderDefaultGestureMediaViewerItem,
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
  const generatedIdRef = useRef<string>(undefined);
  if (!generatedIdRef.current) {
    generatedIdRef.current = generateGestureMediaViewerId();
  }
  const viewerId = id ?? generatedIdRef.current;
  const { currentIndex, totalCount } = useGestureViewerState(viewerId);

  const handleZoomChange = useCallback(
    ({ scale, previousScale }: GestureViewerEventData) => {
      const nextIsZoomed = getGestureMediaViewerIsZoomed(scale);

      onZoomStateChange?.({
        isZoomed: nextIsZoomed,
        scale,
        previousScale,
      });
    },
    [onZoomStateChange]
  );

  useGestureViewerEvent(viewerId, 'zoomChange', handleZoomChange);

  useEffect(() => {
    if (totalCount > 0) {
      onIndexChange?.(currentIndex);
    }
  }, [currentIndex, onIndexChange, totalCount]);

  const resolvedRenderItem = useCallback<GestureMediaViewerRenderItem>(
    (item, index) =>
      renderItem?.(item, index) ?? renderDefaultGestureMediaViewerItem(item),
    [renderItem]
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <GestureViewer
      id={viewerId}
      data={items}
      initialIndex={initialIndex}
      onDismiss={onDismiss}
      onDismissStart={onDismissStart}
      onSingleTap={onSingleTap}
      renderItem={resolvedRenderItem}
      renderContainer={renderContainer}
      ListComponent={FlatList}
      dismiss={
        enableDismissGesture === undefined
          ? undefined
          : { enabled: enableDismissGesture }
      }
      enableHorizontalSwipe={enableSwipeGesture}
      enablePinchZoom={enableZoomGesture}
      enableDoubleTapZoom={enableDoubleTapGesture}
      enablePanWhenZoomed={enableZoomPanGesture}
      enableLoop={enableLoop}
      maxZoomScale={maxZoomScale}
      listProps={{
        keyExtractor: defaultGestureMediaViewerKeyExtractor,
      }}
    />
  );
}
