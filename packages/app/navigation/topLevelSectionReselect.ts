import { useEffect } from 'react';

import type { TopLevelTabName } from './topLevelTabs';

type Listener = (section: TopLevelTabName) => void;

const listeners = new Set<Listener>();

/**
 * Announce that the section already showing was chosen again.
 *
 * The drawer sits above the navigator that holds the sections, so it cannot
 * emit that navigator's own `tabPress` — which is the event `useScrollToTop`
 * listens for, and the only way a list learns it should return to the top.
 * This carries the press across that gap; `TopLevelNavigator` turns it back
 * into a `tabPress` from inside.
 */
export function announceTopLevelSectionReselected(section: TopLevelTabName) {
  // Copied, so a listener that unsubscribes while running cannot skip another.
  for (const listener of [...listeners]) {
    listener(section);
  }
}

export function subscribeToTopLevelSectionReselected(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTopLevelSectionReselected(listener: Listener) {
  useEffect(() => subscribeToTopLevelSectionReselected(listener), [listener]);
}
