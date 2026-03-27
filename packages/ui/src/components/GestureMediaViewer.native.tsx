import * as React from 'react';
import {
  GestureViewer,
  useGestureViewerEvent,
} from 'react-native-gesture-image-viewer';
import { FlatList } from 'react-native';

import {
  defaultGestureMediaViewerKeyExtractor,
  generateGestureMediaViewerId,
  getGestureMediaViewerIsZoomed,
  renderDefaultGestureMediaViewerItem,
  type GestureMediaViewerProps,
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

  const handleZoomChange = React.useCallback(
    ({ scale, previousScale }: GestureViewerEventData) => {
      onZoomStateChange?.({
        isZoomed: getGestureMediaViewerIsZoomed(scale),
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
      renderContainer={renderContainer}
      ListComponent={FlatList}
      enableDismissGesture={enableDismissGesture}
      enableSwipeGesture={enableSwipeGesture}
      enableZoomGesture={enableZoomGesture}
      enableDoubleTapGesture={enableDoubleTapGesture}
      enableZoomPanGesture={enableZoomPanGesture}
      enableLoop={enableLoop}
      maxZoomScale={maxZoomScale}
      listProps={{
        keyExtractor: defaultGestureMediaViewerKeyExtractor,
      }}
    />
  );
}
