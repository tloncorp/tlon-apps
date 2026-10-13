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

import { useDeskSupportsAutomations } from './dbHooks';

const RESULT_NODE = 'Result';

// Unmounted after each test: a harness left mounted stays subscribed to the
// flag, and resetting it would then update a tree outside act.
const mounted: ReactTestRenderer[] = [];

function Harness() {
  return React.createElement(RESULT_NODE, {
    supported: useDeskSupportsAutomations(),
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
  api.setDeskSupportsAutomations(null);
  mocks.appInfo = { value: null, isLoading: false };
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((renderer) => renderer.unmount());
  });
  api.setDeskSupportsAutomations(null);
});

test('is unsupported on a ship whose desk has the routes but not delivery', () => {
  mocks.appInfo = { value: { groupsVersion: '12.3.0' }, isLoading: false };

  expect(resultOf(render())).toBe(false);
});

test('is supported from the release that added delivery', () => {
  mocks.appInfo = { value: { groupsVersion: '12.3.1' }, isLoading: false };

  expect(resultOf(render())).toBe(true);
});

test('waits for the stored version while the client flag is unset', () => {
  mocks.appInfo = { value: null, isLoading: true };

  expect(resultOf(render())).toBeUndefined();
});

test('follows the client flag once sync start has set it', () => {
  mocks.appInfo = { value: { groupsVersion: '12.3.0' }, isLoading: false };
  const renderer = render();
  expect(resultOf(renderer)).toBe(false);

  act(() => api.setDeskSupportsAutomations(true));
  expect(resultOf(renderer)).toBe(true);

  act(() => api.setDeskSupportsAutomations(false));
  expect(resultOf(renderer)).toBe(false);
});
