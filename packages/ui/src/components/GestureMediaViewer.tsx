import * as React from 'react';
import { Platform } from 'react-native';

import {
  clampGestureMediaViewerIndex,
  generateGestureMediaViewerId,
  renderDefaultGestureMediaViewerItem,
  type GestureMediaViewerProps,
  type GestureMediaViewerRenderHelpers,
  type GestureMediaViewerRenderItem,
} from './GestureMediaViewer.shared';

export * from './GestureMediaViewer.shared';

type GestureMediaViewerComponent = (
  props: GestureMediaViewerProps
) => React.ReactElement | null;

let NativeGestureMediaViewer: GestureMediaViewerComponent | null = null;

if (Platform.OS !== 'web') {
  NativeGestureMediaViewer = (
    require('./GestureMediaViewer.native') as {
      GestureMediaViewer: GestureMediaViewerComponent;
    }
  ).GestureMediaViewer;
}

function WebGestureMediaViewer({
  id,
  items,
  initialIndex = 0,
  onIndexChange,
  onDismiss,
  onDismissStart,
  onZoomStateChange,
  renderContainer,
  renderItem,
}: GestureMediaViewerProps) {
  const generatedIdRef = React.useRef<string>();
  if (!generatedIdRef.current) {
    generatedIdRef.current = generateGestureMediaViewerId();
  }

  const viewerId = id ?? generatedIdRef.current;
  void viewerId;

  const resolvedIndex = clampGestureMediaViewerIndex(items, initialIndex);
  const item = items[resolvedIndex];

  React.useEffect(() => {
    if (!item) {
      return;
    }

    onIndexChange?.(resolvedIndex);
  }, [item, onIndexChange, resolvedIndex]);

  React.useEffect(() => {
    if (!item) {
      return;
    }

    onZoomStateChange?.({
      isZoomed: false,
      scale: 1,
      previousScale: null,
    });
  }, [item, onZoomStateChange]);

  const dismiss = React.useCallback(() => {
    onDismissStart?.();
    onDismiss?.();
  }, [onDismiss, onDismissStart]);

  const helpers = React.useMemo<GestureMediaViewerRenderHelpers>(
    () => ({
      dismiss,
    }),
    [dismiss]
  );

  const resolvedRenderItem = React.useCallback<GestureMediaViewerRenderItem>(
    (currentItem, index) =>
      renderItem?.(currentItem, index) ??
      renderDefaultGestureMediaViewerItem(currentItem),
    [renderItem]
  );

  if (!item) {
    return null;
  }

  const content = resolvedRenderItem(item, resolvedIndex);
  return renderContainer ? renderContainer(content, helpers) : content;
}

export function GestureMediaViewer(props: GestureMediaViewerProps) {
  if (Platform.OS === 'web') {
    return <WebGestureMediaViewer {...props} />;
  }

  if (!NativeGestureMediaViewer) {
    return null;
  }

  return <NativeGestureMediaViewer {...props} />;
}
