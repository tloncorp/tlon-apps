import * as React from 'react';
import {
  GestureViewer,
  useGestureViewerEvent,
} from 'react-native-gesture-image-viewer';
import { FlatList, StyleSheet } from 'react-native';

import { Image } from './Image';
import { View } from './View';

type GestureViewerEventData = {
  scale: number;
  previousScale: number | null;
};

const ZOOMED_SCALE_THRESHOLD = 1.001;

let nextGeneratedViewerId = 0;

function generateViewerId() {
  nextGeneratedViewerId += 1;
  return `gesture-media-viewer-${nextGeneratedViewerId}`;
}

export type GestureMediaViewerImageItem = {
  id?: string;
  type: 'image';
  uri: string;
};

export type GestureMediaViewerVideoItem = {
  id?: string;
  type: 'video';
  uri: string;
  posterUri?: string;
};

export type GestureMediaViewerItem =
  | GestureMediaViewerImageItem
  | GestureMediaViewerVideoItem;

export type GestureMediaViewerRenderHelpers = {
  dismiss: () => void;
};

export type GestureMediaViewerZoomState = {
  isZoomed: boolean;
  scale: number;
  previousScale: number | null;
};

export type GestureMediaViewerRenderContainer = (
  children: React.ReactElement,
  helpers: GestureMediaViewerRenderHelpers
) => React.ReactElement;

export type GestureMediaViewerRenderItem = (
  item: GestureMediaViewerItem,
  index: number
) => React.ReactElement;

export type GestureMediaViewerProps = {
  id?: string;
  items: GestureMediaViewerItem[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  onDismiss?: () => void;
  onDismissStart?: () => void;
  onZoomStateChange?: (state: GestureMediaViewerZoomState) => void;
  renderContainer?: GestureMediaViewerRenderContainer;
  renderItem?: GestureMediaViewerRenderItem;
  enableDismissGesture?: boolean;
  enableSwipeGesture?: boolean;
  enableZoomGesture?: boolean;
  enableDoubleTapGesture?: boolean;
  enableZoomPanGesture?: boolean;
  enableLoop?: boolean;
  maxZoomScale?: number;
};

function defaultKeyExtractor(item: GestureMediaViewerItem, index: number) {
  if (item.id) {
    return item.id;
  }

  if (item.type === 'video') {
    return `${item.type}:${item.posterUri ?? item.uri}:${index}`;
  }

  return `${item.type}:${item.uri}:${index}`;
}

function renderDefaultItem(item: GestureMediaViewerItem) {
  if (item.type === 'image') {
    return (
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={{ uri: item.uri }}
          contentFit="contain"
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} backgroundColor="$black">
      {item.posterUri ? (
        <Image
          source={{ uri: item.posterUri }}
          contentFit="contain"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}

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
    generatedIdRef.current = generateViewerId();
  }
  const viewerId = id ?? generatedIdRef.current;

  const handleZoomChange = React.useCallback(
    ({
      scale,
      previousScale,
    }: {
      scale: number;
      previousScale: number | null;
    }) => {
      onZoomStateChange?.({
        isZoomed: scale > ZOOMED_SCALE_THRESHOLD,
        scale,
        previousScale,
      });
    },
    [onZoomStateChange]
  );

  useGestureViewerEvent(viewerId, 'zoomChange', handleZoomChange);

  const resolvedRenderItem = React.useCallback<GestureMediaViewerRenderItem>(
    (item, index) => renderItem?.(item, index) ?? renderDefaultItem(item),
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
        keyExtractor: defaultKeyExtractor,
      }}
    />
  );
}
