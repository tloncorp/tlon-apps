import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { invokeContactsMatchedHandler } from '@tloncorp/shared/store';
import { useCallback, useRef, useState } from 'react';

import { useStore } from '../ui/contexts/storeContext';

const logger = createDevLogger('useContactDiscovery', false);

/**
 * Drives a single lanyard discovery run from the foreground (e.g. the
 * InvitePane during onboarding). Owns the state needed to render an
 * inline match list — `isDiscovering` and `discoveredMatches` — and
 * handles the "advance early" path: if the user dismisses the UI
 * before discovery resolves, callers invoke `notifyPendingMatches` to
 * surface matches via the registered handler instead of dropping them
 * on the floor.
 *
 * `invokeHandler: false` is passed to discovery so we never double-announce
 * — when the UI has shown matches inline (`hasShownMatchesRef`), we
 * suppress the handler; when it hasn't, `notifyPendingMatches` invokes
 * it directly.
 */
export function useContactDiscovery() {
  const storeContext = useStore();
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredMatches, setDiscoveredMatches] = useState<
    db.SystemContact[]
  >([]);
  const pendingDiscoveryRef = useRef<Promise<{
    newMatches: [string, string][];
  }> | null>(null);
  const hasShownMatchesRef = useRef(false);

  const runDiscovery = useCallback(
    async (contacts: db.SystemContact[]) => {
      setIsDiscovering(true);
      // Reset per-run state so a re-fired discovery doesn't inherit the
      // "matches already shown" flag from a previous run.
      hasShownMatchesRef.current = false;
      const promise = storeContext.syncContactDiscovery(undefined, {
        invokeHandler: false,
      });
      pendingDiscoveryRef.current = promise;
      try {
        const { newMatches } = await promise;
        // Bail if a newer run has superseded us — its results are
        // authoritative, and ours would clobber state.
        if (pendingDiscoveryRef.current !== promise) return;
        if (newMatches.length > 0) {
          const matchedPhones = new Set(newMatches.map(([phone]) => phone));
          const matched = contacts.filter(
            (c) => c.phoneNumber && matchedPhones.has(c.phoneNumber)
          );
          setDiscoveredMatches(matched);
          hasShownMatchesRef.current = true;
        }
      } catch (err) {
        if (pendingDiscoveryRef.current !== promise) return;
        logger.trackError('Foreground contact discovery failed', {
          error: err instanceof Error ? err : undefined,
        });
      } finally {
        if (pendingDiscoveryRef.current === promise) {
          setIsDiscovering(false);
        }
      }
    },
    [storeContext]
  );

  const notifyPendingMatches = useCallback(() => {
    const pending = pendingDiscoveryRef.current;
    if (!pending || hasShownMatchesRef.current) return;
    pending
      .then(({ newMatches }) => {
        if (newMatches.length === 0) return;
        return invokeContactsMatchedHandler(newMatches.map(([, id]) => id));
      })
      .catch(() => {
        // errors already tracked in runDiscovery
      });
  }, []);

  return {
    isDiscovering,
    discoveredMatches,
    runDiscovery,
    notifyPendingMatches,
  };
}
