import { RefObject, useCallback, useRef } from 'react';

// The subset of scroll methods exposed by the list/scroll components used by
// the main tabs: FlashList/FlatList expose `scrollToOffset`, ScrollView exposes
// `scrollTo`, and SectionList exposes neither but returns its underlying
// ScrollView via `getScrollResponder`.
type ScrollableNode = {
  scrollToTop?: () => void;
  scrollTo?: (opts: { x?: number; y?: number; animated?: boolean }) => void;
  scrollToOffset?: (opts: { offset: number; animated?: boolean }) => void;
  getScrollResponder?: () => ScrollableNode | null | undefined;
};

export function scrollContainerToTop(node: ScrollableNode | null | undefined) {
  if (!node) {
    return;
  }

  const scrollable =
    typeof node.scrollToTop === 'function' ||
    typeof node.scrollTo === 'function' ||
    typeof node.scrollToOffset === 'function'
      ? node
      : (node.getScrollResponder?.() ?? node);

  if (typeof scrollable.scrollToTop === 'function') {
    scrollable.scrollToTop();
  } else if (typeof scrollable.scrollToOffset === 'function') {
    scrollable.scrollToOffset({ offset: 0, animated: true });
  } else if (typeof scrollable.scrollTo === 'function') {
    scrollable.scrollTo({ x: 0, y: 0, animated: true });
  }
}

// Tapping the already-active tab in the bottom NavBar scrolls that tab's list
// back to the top. The app uses a custom NavBar over a stack navigator (not a
// tab navigator), so React Navigation's `useScrollToTop` — which relies on the
// `tabPress` event — doesn't apply; the NavBar invokes `onPressActiveTab`
// directly instead.
export function useScrollTabToTop<T>(): {
  scrollRef: RefObject<T | null>;
  onPressActiveTab: () => void;
} {
  const scrollRef = useRef<T | null>(null);

  const onPressActiveTab = useCallback(() => {
    scrollContainerToTop(scrollRef.current as ScrollableNode | null);
  }, []);

  return { scrollRef, onPressActiveTab };
}
