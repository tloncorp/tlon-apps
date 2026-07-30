import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks whether a screen reader (VoiceOver / TalkBack) is active.
 *
 * Native gesture recognizers never receive touches while a screen reader is
 * running, so any affordance driven purely by one is unreachable for those
 * users. Components that swap in a native gesture should fall back to their
 * regular touchable path when this is true.
 *
 * Backed by a single shared subscription: this is read per message in the chat
 * list, and one listener per row would be wasteful for a value that changes
 * roughly never.
 */

let isEnabled = false;
let subscription: { remove: () => void } | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function setEnabled(next: boolean) {
  if (next === isEnabled) {
    return;
  }
  isEnabled = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (listeners.size === 1) {
    void AccessibilityInfo.isScreenReaderEnabled?.()
      .then(setEnabled)
      .catch(() => {
        // Not all platforms implement the query; assume no screen reader.
      });
    subscription =
      AccessibilityInfo.addEventListener?.('screenReaderChanged', setEnabled) ??
      null;
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      subscription?.remove();
      subscription = null;
    }
  };
}

function getSnapshot() {
  return isEnabled;
}

export function useIsScreenReaderEnabled() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
