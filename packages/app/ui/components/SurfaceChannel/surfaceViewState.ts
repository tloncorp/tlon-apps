import type { BundleResult, SurfaceHydrationState } from '@tloncorp/shared';
import type { JsonObject, SurfaceSpec } from '@tloncorp/api';

/**
 * Pure mapping from data-layer results to the §6 rendered states. Every
 * state is distinct; a partial fold is never presented as current; a spec
 * or bundle from the future renders refusal, not best-effort.
 */

export type SurfaceBundlePhase =
  | { status: 'idle' }
  | { status: 'loading' }
  | BundleResult;

export type SurfaceViewState =
  | { kind: 'loading' }
  | { kind: 'partial' }
  | { kind: 'migration-pending' }
  | { kind: 'no-spec' }
  | { kind: 'invalid' }
  | { kind: 'update-to-view'; reason: 'spec-version' | 'shell-version' }
  | { kind: 'bundle-unavailable' }
  | {
      kind: 'ready';
      spec: SurfaceSpec;
      state: JsonObject;
      stateFull: boolean;
      bundleSource: string;
    };

export function resolveSurfaceViewState({
  hydration,
  bundle,
  shellVersion,
}: {
  hydration: SurfaceHydrationState | undefined;
  bundle: SurfaceBundlePhase;
  /** the embedded shell artifact's major version */
  shellVersion: number;
}): SurfaceViewState {
  if (hydration === undefined) {
    return { kind: 'loading' };
  }
  switch (hydration.status) {
    case 'absent':
      return { kind: 'no-spec' };
    case 'invalid':
      return { kind: 'invalid' };
    case 'version-too-new':
      return { kind: 'update-to-view', reason: 'spec-version' };
    case 'partial':
      return { kind: 'partial' };
    case 'migration-pending':
      return { kind: 'migration-pending' };
    case 'hydrated':
      break;
  }

  const spec = hydration.spec;
  const state = hydration.state;
  if (spec === undefined || state === undefined) {
    // hydrated always carries both; treat a malformed result as loading
    // rather than presenting anything as current
    return { kind: 'loading' };
  }
  if (spec.bundle.shellVersion > shellVersion) {
    return { kind: 'update-to-view', reason: 'shell-version' };
  }
  if (bundle.status === 'idle' || bundle.status === 'loading') {
    return { kind: 'loading' };
  }
  if (bundle.status === 'unavailable') {
    return { kind: 'bundle-unavailable' };
  }
  return {
    kind: 'ready',
    spec,
    state,
    stateFull: hydration.stateFull === true,
    bundleSource: bundle.content,
  };
}
