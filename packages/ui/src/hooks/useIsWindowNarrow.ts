import { useMemo, useSyncExternalStore } from 'react';
import { isWeb, useWindowDimensions } from 'tamagui';

let nativeSplitLayoutMounted = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getNativeSplitLayoutMounted() {
  return nativeSplitLayoutMounted;
}

/**
 * Records whether native is rendering the desktop navigators (the split
 * list and detail layout) instead of the mobile RootStack. Only the component
 * that swaps the two trees should call this.
 */
export function setNativeSplitLayoutMounted(mounted: boolean) {
  if (nativeSplitLayoutMounted === mounted) {
    return;
  }
  nativeSplitLayoutMounted = mounted;
  listeners.forEach((listener) => listener());
}

export function isNativeSplitLayoutMounted() {
  return nativeSplitLayoutMounted;
}

/**
 * False when the desktop navigators are mounted: on web from the window
 * width, on native only while the split layout is showing.
 */
export default function useIsWindowNarrow() {
  const { width } = useWindowDimensions();
  const splitLayoutMounted = useSyncExternalStore(
    subscribe,
    getNativeSplitLayoutMounted,
    getNativeSplitLayoutMounted
  );
  const isNarrow = useMemo(
    () => (isWeb ? width < 768 : !splitLayoutMounted),
    [width, splitLayoutMounted]
  );
  return isNarrow;
}
