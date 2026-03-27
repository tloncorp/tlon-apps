import * as React from 'react';
import { StyleSheet } from 'react-native';

import { Image } from './Image';
import { View } from './View';

const ZOOMED_SCALE_THRESHOLD = 1.001;

let nextGeneratedViewerId = 0;

export function generateGestureMediaViewerId() {
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

export function defaultGestureMediaViewerKeyExtractor(
  item: GestureMediaViewerItem,
  index: number
) {
  if (item.id) {
    return item.id;
  }

  if (item.type === 'video') {
    return `${item.type}:${item.posterUri ?? item.uri}:${index}`;
  }

  return `${item.type}:${item.uri}:${index}`;
}

export function renderDefaultGestureMediaViewerItem(
  item: GestureMediaViewerItem
) {
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

export function getGestureMediaViewerIsZoomed(scale: number) {
  return scale > ZOOMED_SCALE_THRESHOLD;
}

export function clampGestureMediaViewerIndex(
  items: GestureMediaViewerItem[],
  initialIndex: number
) {
  if (items.length === 0) {
    return 0;
  }

  return Math.min(Math.max(initialIndex, 0), items.length - 1);
}
