import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  type GestureMediaViewerProps,
  type GestureMediaViewerRenderHelpers,
  type GestureMediaViewerRenderItem,
  clampGestureMediaViewerIndex,
  generateGestureMediaViewerId,
  renderDefaultGestureMediaViewerItem,
} from './GestureMediaViewer.shared';

export * from './GestureMediaViewer.shared';

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
  const generatedIdRef = useRef<string>(undefined);
  if (!generatedIdRef.current) {
    generatedIdRef.current = generateGestureMediaViewerId();
  }

  const viewerId = id ?? generatedIdRef.current;
  void viewerId;

  const resolvedIndex = clampGestureMediaViewerIndex(items, initialIndex);
  const item = items[resolvedIndex];

  useEffect(() => {
    if (!item) {
      return;
    }

    onIndexChange?.(resolvedIndex);
  }, [item, onIndexChange, resolvedIndex]);

  useEffect(() => {
    if (!item) {
      return;
    }

    onZoomStateChange?.({
      isZoomed: false,
      scale: 1,
      previousScale: null,
    });
  }, [item, onZoomStateChange]);

  const dismiss = useCallback(() => {
    onDismissStart?.();
    onDismiss?.();
  }, [onDismiss, onDismissStart]);

  const helpers = useMemo<GestureMediaViewerRenderHelpers>(
    () => ({
      dismiss,
    }),
    [dismiss]
  );

  const resolvedRenderItem = useCallback<GestureMediaViewerRenderItem>(
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
  return <WebGestureMediaViewer {...props} />;
}
