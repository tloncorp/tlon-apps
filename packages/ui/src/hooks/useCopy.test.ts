import { createElement, useEffect } from 'react';
import { type ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { useCopy } from './useCopy';

const mocks = vi.hoisted(() => ({
  setStringAsync: vi.fn<[string], Promise<boolean>>(),
}));

vi.mock('expo-clipboard', () => ({ setStringAsync: mocks.setStringAsync }));

let copy: ReturnType<typeof useCopy>;
let renderer: ReactTestRenderer;

function Harness() {
  const value = useCopy('copied text');
  useEffect(() => {
    copy = value;
  });
  return null;
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.setStringAsync.mockReset();
  act(() => {
    renderer = create(createElement(Harness));
  });
});

afterEach(() => {
  act(() => {
    renderer.unmount();
  });
  vi.unstubAllGlobals();
});

test('resolves true and marks the copy when the write succeeds', async () => {
  mocks.setStringAsync.mockResolvedValue(true);
  let result: boolean | undefined;
  await act(async () => {
    result = await copy.doCopy();
  });
  expect(result).toBe(true);
  expect(copy.didCopy).toBe(true);
});

test('resolves false without marking the copy when the platform refuses', async () => {
  mocks.setStringAsync.mockResolvedValue(false);
  let result: boolean | undefined;
  await act(async () => {
    result = await copy.doCopy();
  });
  expect(result).toBe(false);
  expect(copy.didCopy).toBe(false);
});
