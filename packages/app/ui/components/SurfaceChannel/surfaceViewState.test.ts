import { expect, test } from 'vitest';

import { resolveSurfaceViewState } from './surfaceViewState';

const SPEC = {
  version: 1 as const,
  surfaceId: 'srf-1',
  specRevision: 2,
  bundle: {
    assetRef: 'https://x/b',
    sha256: 'a'.repeat(64),
    size: 64,
    shellVersion: 1,
  },
  initialState: {},
  actions: {},
};

const hydrated = {
  status: 'hydrated' as const,
  spec: SPEC,
  state: { votes: {} },
  stateFull: false,
};

test('spec-read and hydration statuses map to distinct states', () => {
  const shellVersion = 1;
  const bundle = { status: 'idle' as const };
  expect(
    resolveSurfaceViewState({ hydration: undefined, bundle, shellVersion })
  ).toEqual({ kind: 'loading' });
  for (const [status, kind] of [
    ['absent', 'no-spec'],
    ['invalid', 'invalid'],
    ['partial', 'partial'],
    ['migration-pending', 'migration-pending'],
  ] as const) {
    expect(
      resolveSurfaceViewState({ hydration: { status }, bundle, shellVersion })
    ).toEqual({ kind });
  }
  expect(
    resolveSurfaceViewState({
      hydration: { status: 'version-too-new', specVersion: 9 },
      bundle,
      shellVersion,
    })
  ).toEqual({ kind: 'update-to-view', reason: 'spec-version' });
});

test('a bundle pinned to a newer shell major refuses before any fetch', () => {
  const result = resolveSurfaceViewState({
    hydration: {
      ...hydrated,
      spec: { ...SPEC, bundle: { ...SPEC.bundle, shellVersion: 2 } },
    },
    bundle: { status: 'idle' },
    shellVersion: 1,
  });
  expect(result).toEqual({ kind: 'update-to-view', reason: 'shell-version' });
});

test('hydrated maps through bundle phases to ready', () => {
  const shellVersion = 1;
  expect(
    resolveSurfaceViewState({
      hydration: hydrated,
      bundle: { status: 'loading' },
      shellVersion,
    })
  ).toEqual({ kind: 'loading' });
  expect(
    resolveSurfaceViewState({
      hydration: hydrated,
      bundle: { status: 'unavailable', reason: 'hash-mismatch' },
      shellVersion,
    })
  ).toEqual({ kind: 'bundle-unavailable' });
  const ready = resolveSurfaceViewState({
    hydration: { ...hydrated, stateFull: true },
    bundle: { status: 'ok', content: '<app>', fromCache: true },
    shellVersion,
  });
  expect(ready).toMatchObject({
    kind: 'ready',
    stateFull: true,
    bundleSource: '<app>',
    state: { votes: {} },
  });
});
