import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useIsNativeSheet } from './useIsNativeSheet';

/** Keeps modal handoffs behind the sheet's native dismissal completion. */
export function useSheetDismissalAction({
  open,
  onOpenChange,
  waitForDismissal: waitForDismissalOverride,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Defaults to wherever `ActionSheet` presents natively. Pass it for a sheet
   * that forces `mode="sheet"`, which is native on wide windows too.
   */
  waitForDismissal?: boolean;
}) {
  const isNativeSheet = useIsNativeSheet();
  const waitForDismissal = waitForDismissalOverride ?? isNativeSheet;
  const pendingAction = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const openRef = useRef(open);
  const generation = useRef(0);
  const [presentation, setPresentation] = useState({ open, key: 0 });
  // Derive the key before children commit, not after a native host opens.
  if (presentation.open !== open) {
    setPresentation({ open, key: presentation.key + (open ? 1 : 0) });
  }
  const presentationKey = presentation.key;
  const [retained, setRetained] = useState(open);
  // The presentation whose native dismissal was reported while it still
  // counted as open. Android reports a dismissal the user started (back,
  // scrim, swipe) in the same call that asks to close, before `open` has
  // turned false.
  const dismissedAhead = useRef<number | null>(null);

  const finishDismissal = useCallback(() => {
    setRetained(false);
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  }, []);

  useLayoutEffect(() => {
    generation.current = presentationKey;
    openRef.current = open;
    if (open) {
      pendingAction.current = null;
      dismissedAhead.current = null;
      setRetained(true);
    } else if (!waitForDismissal) {
      pendingAction.current = null;
      setRetained(false);
    } else if (dismissedAhead.current === presentationKey) {
      dismissedAhead.current = null;
      finishDismissal();
    }
  }, [open, waitForDismissal, presentationKey, finishDismissal]);

  const cancel = useCallback(() => {
    pendingAction.current = null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingAction.current = null;
    };
  }, []);

  const dismissThenRun = useCallback(
    (action: () => void) => {
      if (!mounted.current || !openRef.current) return;
      if (waitForDismissal) pendingAction.current = action;
      onOpenChange(false);
      // Browser pickers must retain the original user activation.
      if (!waitForDismissal) action();
    },
    [onOpenChange, waitForDismissal]
  );

  const onDismissed = useCallback(() => {
    if (!mounted.current || generation.current !== presentationKey) return;
    if (openRef.current) {
      // Not closed yet as far as React knows. Finish once it is, or the
      // sheet's content would be kept, with its state, into the next open.
      dismissedAhead.current = presentationKey;
      return;
    }
    finishDismissal();
  }, [presentationKey, finishDismissal]);

  return {
    dismissThenRun,
    onDismissed,
    cancel,
    presentationKey,
    shouldRender: open || (waitForDismissal && retained),
  };
}
