import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/** Keeps modal handoffs behind the sheet's native dismissal completion. */
export function useSheetDismissalAction({
  open,
  onOpenChange,
  waitForDismissal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  waitForDismissal: boolean;
}) {
  const pendingAction = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const openRef = useRef(open);
  useLayoutEffect(() => {
    openRef.current = open;
    if (open) pendingAction.current = null;
  }, [open]);

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
    if (!mounted.current || openRef.current) return;
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  }, []);

  return { dismissThenRun, onDismissed };
}
