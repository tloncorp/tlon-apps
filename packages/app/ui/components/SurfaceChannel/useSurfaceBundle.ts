import type { SurfaceBundleRef, SurfaceSpec } from '@tloncorp/api';
import { getOrFetchBundle } from '@tloncorp/shared';
import { useCallback, useEffect, useState } from 'react';

import type { SurfaceBundlePhase } from './surfaceViewState';

/**
 * Host-side bundle resolution: the fetch happens OUTSIDE the sandbox on
 * the host's own network stack, and the shared cache hash-verifies before
 * anything is returned — the sandbox only ever receives verified bytes.
 */
async function fetchBundleText(ref: SurfaceBundleRef): Promise<string> {
  const response = await fetch(ref.assetRef);
  if (!response.ok) {
    throw new Error(`bundle fetch failed: ${response.status}`);
  }
  return response.text();
}

export function useSurfaceBundle(spec: SurfaceSpec | undefined): {
  phase: SurfaceBundlePhase;
  retry: () => void;
} {
  const [phase, setPhase] = useState<SurfaceBundlePhase>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const sha256 = spec?.bundle.sha256;

  useEffect(() => {
    if (spec === undefined || sha256 === undefined) {
      setPhase({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setPhase({ status: 'loading' });
    getOrFetchBundle(spec.bundle, fetchBundleText).then(
      (result) => {
        if (!cancelled) {
          setPhase(result);
        }
      },
      () => {
        // getOrFetchBundle is total, but keep the hook total regardless
        if (!cancelled) {
          setPhase({ status: 'unavailable', reason: 'fetch-failed' });
        }
      }
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sha256, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  return { phase, retry };
}
