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

import { useDeskSupportsStewardBots } from './dbHooks';

const RESULT_NODE = 'Result';

// Unmounted after each test: a harness left mounted stays subscribed to the
// flag, and resetting it would then update a tree outside act.
const mounted: ReactTestRenderer[] = [];

function Harness() {
  return React.createElement(RESULT_NODE, {
    supported: useDeskSupportsStewardBots(),
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
  api.setDeskSupportsStewardBots(null);
  mocks.appInfo = { value: null, isLoading: false };
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((renderer) => renderer.unmount());
  });
  api.setDeskSupportsStewardBots(null);
});

test('is unsupported on a 12.3.1 ship', () => {
  mocks.appInfo = { value: { groupsVersion: '12.3.1' }, isLoading: false };

  expect(resultOf(render())).toBe(false);
});

test('waits for the stored version while the client flag is unknown', () => {
  mocks.appInfo = { value: null, isLoading: true };

  expect(resultOf(render())).toBeUndefined();
});

test('trusts the stored version before sync start sets the client flag', () => {
  mocks.appInfo = { value: { groupsVersion: '12.3.2' }, isLoading: false };

  expect(resultOf(render())).toBe(true);
});

test('follows the client flag when the stored version lags it', () => {
  mocks.appInfo = { value: { groupsVersion: '12.3.1' }, isLoading: false };
  const renderer = render();
  expect(resultOf(renderer)).toBe(false);

  act(() => {
    api.setDeskSupportsStewardBots(true);
  });

  expect(resultOf(renderer)).toBe(true);
});

test('a known-unsupported desk overrides stale stored app info', () => {
  mocks.appInfo = { value: { groupsVersion: '12.3.2' }, isLoading: false };
  api.setDeskSupportsStewardBots(false);

  expect(resultOf(render())).toBe(false);
});
