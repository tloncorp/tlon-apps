/**
 * Hook to track user activity state.
 * Returns whether the user is actively using the app (not idle).
 *
 * On web: tracks mouse, keyboard, scroll, touch, and focus events
 * On mobile: always returns true (mobile has its own activity handling)
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** Idle threshold in milliseconds - user is "inactive" after this long without input */
const IDLE_THRESHOLD_MS = 60 * 1000; // 60 seconds

/** How often to check idle state (ms) */
const CHECK_INTERVAL_MS = 5000;

interface UserActivityState {
  /** Whether the user is currently active (not idle) */
  isActive: boolean;
  /** Milliseconds since last user input */
  idleMs: number;
}

/**
 * Hook that tracks user activity via DOM events.
 * On non-web platforms, always returns isActive: true.
 *
 * @returns Current user activity state
 */
export function useUserActivity(): UserActivityState {
  const [state, setState] = useState<UserActivityState>({
    isActive: true,
    idleMs: 0,
  });
  const lastActivityRef = useRef<number>(Date.now());

  // Update last activity timestamp
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Update state to active immediately (used for visibility/focus changes)
  const setActiveNow = useCallback(() => {
    lastActivityRef.current = Date.now();
    setState({ isActive: true, idleMs: 0 });
  }, []);

  useEffect(() => {
    // Guard: only run on web where window/document exist
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    // Track activity via DOM events
    const events = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'wheel',
    ];

    // Record initial activity
    recordActivity();

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, recordActivity, { passive: true });
    });

    // Track visibility and focus - set active immediately on return
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setActiveNow();
      }
    };
    const handleFocus = () => {
      setActiveNow();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Periodically check idle state
    const intervalId = setInterval(() => {
      const now = Date.now();
      const idleMs = now - lastActivityRef.current;
      const isActive = idleMs < IDLE_THRESHOLD_MS && !document.hidden;

      setState((prev) => {
        // Only update if changed to avoid unnecessary re-renders
        if (
          prev.isActive !== isActive ||
          Math.abs(prev.idleMs - idleMs) > 1000
        ) {
          return { isActive, idleMs };
        }
        return prev;
      });
    }, CHECK_INTERVAL_MS);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, recordActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(intervalId);
    };
  }, [recordActivity, setActiveNow]);

  return state;
}

/**
 * Simple hook that just returns whether the user is active.
 * Convenience wrapper around useUserActivity.
 */
export function useIsUserActive(): boolean {
  const { isActive } = useUserActivity();
  return isActive;
}
