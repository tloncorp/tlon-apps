import * as React from 'react';

import {
  type ScrollDiagNoteOptions,
  hasScrollDiagRowListeners,
  isScrollDiagnosticsEnabled,
  noteScrollDiagnostics,
  reportScrollDiagRow,
  shortListLabel,
} from './scrollDiagnostics';
import { describeChanges } from './scrollDiagnosticsCore';

type WatchedValues = Record<string, string | number | boolean | undefined>;

/**
 * Timeline access for the components around a list (the Scroller, its
 * chrome). `watch` records whichever of the given values changed.
 */
export function useScrollDiagnosticsScope(channelId: string) {
  const [enabled] = React.useState(isScrollDiagnosticsEnabled);
  // One set of last-seen values per entry type, so a component can watch
  // more than one group of values.
  const previousRef = React.useRef(new Map<string, WatchedValues>());
  const label = shortListLabel(channelId);

  const note = React.useCallback(
    (type: string, message: string, options?: ScrollDiagNoteOptions) => {
      if (enabled) {
        noteScrollDiagnostics(label, type, message, options);
      }
    },
    [enabled, label]
  );
  const watch = React.useCallback(
    (type: string, values: WatchedValues) => {
      if (!enabled) {
        return;
      }
      const previous = previousRef.current.get(type);
      const changes = previous ? describeChanges(previous, values) : [];
      previousRef.current.set(type, values);
      if (changes.length > 0) {
        noteScrollDiagnostics(label, type, changes.join(', '));
      }
    },
    [enabled, label]
  );

  // Stable for the life of the component, so it is safe in dependency arrays.
  return React.useMemo(
    () => ({ enabled, note, watch }),
    [enabled, note, watch]
  );
}

/** Reports a conversation row mounting and unmounting to its list's timeline. */
export function useScrollDiagnosticsRow(channelId: string, key: string) {
  React.useEffect(() => {
    if (!hasScrollDiagRowListeners(channelId)) {
      return;
    }
    reportScrollDiagRow(channelId, key, 'mount');
    return () => reportScrollDiagRow(channelId, key, 'unmount');
  }, [channelId, key]);
}
