import * as api from '@tloncorp/api';
import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  return {
    appInfo: {
      value: null as { groupsVersion: string } | null,
      isLoading: false,
    },
  };
});

vi.mock('../db', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('../db');
  return {
    ...actual,
    appInfo: { ...actual.appInfo, useStorageItem: () => mocks.appInfo },
  };
});

import { useDeskSupportsBuckets } from './dbHooks';

const RESULT_NODE = 'Result';

// Unmounted after each test: a harness left mounted stays subscribed to the
// flag, and resetting it would then update a tree outside act.
const mounted: ReactTestRenderer[] = [];

function Harness() {
  return React.createElement(RESULT_NODE, {
    supported: useDeskSupportsBuckets(),
  });
}

function render() {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(React.createElement(Harness));
  });
  mounted.push(renderer);
  return renderer;
}

function resultOf(renderer: ReactTestRenderer) {
  return renderer.root.find((node) => (node.type as unknown) === RESULT_NODE)
    .props.supported as boolean | undefined;
}

beforeEach(() => {
  api.setDeskSupportsBuckets(null);
  mocks.appInfo = { value: null, isLoading: false };
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((renderer) => renderer.unmount());
  });
  api.setDeskSupportsBuckets(null);
});

test('is unsupported on a 12.2 ship', () => {
  mocks.appInfo = { value: { groupsVersion: '12.2.0' }, isLoading: false };

  expect(resultOf(render())).toBe(false);
});

test('waits for the stored version while the client flag is off', () => {
  mocks.appInfo = { value: null, isLoading: true };

  expect(resultOf(render())).toBeUndefined();
});

test('trusts the stored version before sync start sets the client flag', () => {
  mocks.appInfo = { value: { groupsVersion: '12.3.0' }, isLoading: false };

  expect(resultOf(render())).toBe(true);
});

// syncAppInfo sets the flag and then persists; a failed write leaves the
// stored version behind while the rest of the session runs with Buckets on.
test('follows the client flag when the stored version lags it', () => {
  mocks.appInfo = { value: { groupsVersion: '12.2.0' }, isLoading: false };
  const renderer = render();
  expect(resultOf(renderer)).toBe(false);

  act(() => {
    api.setDeskSupportsBuckets(true);
  });

  expect(resultOf(renderer)).toBe(true);
});

// A fresh probe outranks a stored version it contradicts, even when the
// write that would have corrected the store failed.
test('a known-unsupported desk overrides stale stored app info', () => {
  mocks.appInfo = { value: { groupsVersion: '12.3.0' }, isLoading: false };
  api.setDeskSupportsBuckets(false);

  expect(resultOf(render())).toBe(false);
});
