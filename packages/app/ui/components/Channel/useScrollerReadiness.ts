import type { InitialScrollRecovery } from './PostList/shared';
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';

/** Entry readiness and pagination belong to one visit, even when its ID repeats. */
export function useScrollerReadiness({
  scopeKey,
  onStartReached,
  onEndReached,
}: {
  scopeKey: string;
  onStartReached?: () => void;
  onEndReached?: () => void;
}) {
  const entry = useMemo(
    () => ({
      active: true,
      ready: false,
      recovery: null as InitialScrollRecovery | null,
      startPending: false,
      endPending: false,
    }),
    [scopeKey]
  );
  const [, render] = useReducer((revision: number) => revision + 1, 0);
  const callbacks = useRef({ onStartReached, onEndReached });

  useLayoutEffect(() => {
    callbacks.current = { onStartReached, onEndReached };
  }, [onStartReached, onEndReached]);

  useLayoutEffect(() => {
    entry.active = true;
    // Child layout callbacks may already have queued boundaries. Activation
    // must not clear them; Strict Mode also reactivates this same entry.
    return () => {
      entry.active = false;
    };
  }, [entry]);

  const handlers = useMemo(
    () => ({
      isEntryActive: () => entry.active,
      onStartReached: () => {
        if (!entry.active) return;
        if (entry.ready) callbacks.current.onStartReached?.();
        else entry.startPending = true;
      },
      onEndReached: () => {
        if (!entry.active) return;
        if (entry.ready) callbacks.current.onEndReached?.();
        else entry.endPending = true;
      },
      onInitialScrollCompleted: () => {
        if (!entry.active || entry.ready) return;
        entry.ready = true;
        entry.recovery = null;
        render();
      },
      onInitialScrollPending: () => {
        if (!entry.active || (!entry.ready && !entry.recovery)) return;
        entry.ready = false;
        entry.recovery = null;
        render();
      },
      onInitialScrollRecoveryChange: (
        recovery: InitialScrollRecovery | null
      ) => {
        if (!entry.active || entry.ready || entry.recovery === recovery) return;
        entry.recovery = recovery;
        render();
      },
    }),
    [entry]
  );

  useEffect(() => {
    if (!entry.active || !entry.ready) return;
    // Consume before calling out: the callback may synchronously deliver a
    // distinct boundary, change the scope, or unmount the list.
    if (entry.endPending) {
      entry.endPending = false;
      callbacks.current.onEndReached?.();
    }
    if (entry.active && entry.ready && entry.startPending) {
      entry.startPending = false;
      callbacks.current.onStartReached?.();
    }
  }, [entry, entry.ready, onStartReached, onEndReached]);

  return { ...handlers, isReady: entry.ready, recovery: entry.recovery };
}
