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
let subscriptionGeneration = 0;
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
    const generation = ++subscriptionGeneration;
    let eventVersion = 0;
    subscription =
      AccessibilityInfo.addEventListener?.(
        'screenReaderChanged',
        (nextEnabled) => {
          eventVersion += 1;
          if (generation === subscriptionGeneration) {
            setEnabled(nextEnabled);
          }
        }
      ) ?? null;
    const queryEventVersion = eventVersion;
    void AccessibilityInfo.isScreenReaderEnabled?.()
      .then((nextEnabled) => {
        if (
          generation === subscriptionGeneration &&
          eventVersion === queryEventVersion
        ) {
          setEnabled(nextEnabled);
        }
      })
      .catch(() => {
        // Not all platforms implement the query; assume no screen reader.
      });
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      subscriptionGeneration += 1;
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
