import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';

/**
 * Native implementation detail: React Navigation only refreshes `headerTitle`
 * when its screen options change. Capturing the latest React node in a ref
 * would leave the mounted title stale, while putting that node in the options
 * dependencies would call `setOptions` on most screen renders and churn the
 * native header. This small store keeps the installed header renderer stable
 * while letting custom title content update independently.
 */
export interface NativeHeaderTitleStore {
  getSnapshot: () => ReactNode;
  set: (title: ReactNode) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createNativeHeaderTitleStore(
  initialTitle: ReactNode
): NativeHeaderTitleStore {
  let title = initialTitle;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => title,
    set(nextTitle) {
      if (Object.is(title, nextTitle)) {
        return;
      }
      title = nextTitle;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function NativeHeaderTitle({
  store,
}: {
  store: NativeHeaderTitleStore;
}) {
  const title = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
  return <>{title}</>;
}
