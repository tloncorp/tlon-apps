import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// Wait for BottomSheetWrapper's `quick` (250ms) dismiss animation to complete
// — and for Gorhom to remove the sheet from the modal stack — before running a
// follow-up action (unmounting the React tree, or closing a parent sheet).
// Running the follow-up first races Gorhom's teardown and leaves a visible
// orphan modal. On web there is no Gorhom modal stack, so close immediately;
// the previous 300ms delay caused the group-ban-core.spec.ts e2e race.
// See TLON-5891.
export const SHEET_CLOSE_ANIMATION_MS = Platform.OS === 'web' ? 0 : 300;

/**
 * Defers a close-related action until a Gorhom bottom sheet has had time to
 * play its dismiss animation and leave the modal stack. Returns a scheduler
 * that runs the action after the grace window (immediately when the window is
 * `0`, e.g. web) plus a `cancel` to drop a pending action when a competing
 * close/open path takes over. The pending action is also cancelled on unmount,
 * so a stale timer can't fire into a later reopened sheet.
 */
export function useSheetCloseAfterAnimation(
  delayMs: number = SHEET_CLOSE_ANIMATION_MS
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const closeAfterAnimation = useCallback(
    (onClosed: () => void) => {
      cancel();

      if (delayMs === 0) {
        onClosed();
        return;
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onClosed();
      }, delayMs);
    },
    [cancel, delayMs]
  );

  useEffect(() => cancel, [cancel]);

  return { closeAfterAnimation, cancel };
}
