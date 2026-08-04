import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';

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
