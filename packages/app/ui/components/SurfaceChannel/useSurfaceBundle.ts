import { SURFACE_CAPS } from '@tloncorp/api';
import type { SurfaceBundleRef, SurfaceSpec } from '@tloncorp/api';
import { getOrFetchBundle } from '@tloncorp/shared';
import { useCallback, useEffect, useState } from 'react';

import type { SurfaceBundlePhase } from './surfaceViewState';

/**
 * Host-side bundle resolution: the fetch happens OUTSIDE the sandbox on
 * the host's own network stack, and the shared cache hash-verifies before
 * anything is returned — the sandbox only ever receives verified bytes.
 */
export async function fetchBundleText(ref: SurfaceBundleRef): Promise<string> {
  const response = await fetch(ref.assetRef);
  if (!response.ok) {
    throw new Error(`bundle fetch failed: ${response.status}`);
  }

  // Cheap first line of defence against a hostile asset host: refuse an
  // over-cap body on its declared length so we never buffer or decode it.
  // The header is advisory — it may be absent, or a lie — so this can only
  // ever short-circuit. `getOrFetchBundle` measures the decoded bytes
  // against the same cap and remains the authoritative check.
  //
  // DEFERRED: streaming enforcement (reading the body in chunks and
  // bailing once the running total crosses the cap) would also bound a
  // body that omits or under-reports Content-Length. Until that lands, a
  // lying host can still make us buffer one oversize body before the
  // post-buffer check rejects it. This is a known gap, not an oversight.
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    const declaredBytes = Number(declaredLength);
    if (
      Number.isFinite(declaredBytes) &&
      declaredBytes > SURFACE_CAPS.bundleSize
    ) {
      throw new Error(
        `bundle too large: ${declaredBytes} bytes declared, cap ${SURFACE_CAPS.bundleSize}`
      );
    }
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
