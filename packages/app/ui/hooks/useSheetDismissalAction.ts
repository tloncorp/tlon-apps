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
  useLayoutEffect(() => {
    generation.current = presentationKey;
    openRef.current = open;
    if (open) {
      pendingAction.current = null;
      setRetained(true);
    } else if (!waitForDismissal) {
      pendingAction.current = null;
      setRetained(false);
    }
  }, [open, waitForDismissal, presentationKey]);

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
    if (
      !mounted.current ||
      openRef.current ||
      generation.current !== presentationKey
    )
      return;
    setRetained(false);
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  }, [presentationKey]);

  return {
    dismissThenRun,
    onDismissed,
    cancel,
    presentationKey,
    shouldRender: open || (waitForDismissal && retained),
  };
}
