import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BrowserSecureEntryAction } from './BrowserSecureEntryAction';
const mock = vi.hoisted(() => ({
  visible: true,
  state: undefined as string | undefined,
  fetch: vi.fn(),
  remember: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ trackError: mock.error }),
}));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('./useBrowserPreviewVisible', () => ({
  useBrowserPreviewVisible: () => mock.visible,
}));
vi.mock('./browserSecureEntryState', () => ({
  fetchSecureEntryState: mock.fetch,
  rememberSecureEntry: mock.remember,
  secureEntryCache: {
    useStorageItem: () => ({
      value: mock.state
        ? { 'https://viewer.test/s/cap': { state: mock.state } }
        : {},
      isLoading: false,
    }),
  },
}));
let tree: ReactTestRenderer;
const card = () => (
  <BrowserSecureEntryAction viewerUrl="https://viewer.test/s/cap" enabled>
    <button>Add</button>
  </BrowserSecureEntryAction>
);
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.clearAllMocks();
  mock.visible = true;
  mock.state = undefined;
  mock.fetch.mockResolvedValue(undefined);
});
afterEach(() => {
  act(() => tree?.unmount());
  vi.useRealTimers();
});
it('hides Add immediately for a cached completed entry and never checks again on remount', async () => {
  mock.state = 'used';
  await act(async () => {
    tree = create(card());
  });
  expect(tree.root.findAllByType('button')).toHaveLength(0);
  expect(tree.toJSON()).toBeNull();
  act(() => tree.unmount());
  await act(async () => {
    tree = create(card());
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(mock.fetch).not.toHaveBeenCalled();
});
it('checks only visible cards and saves completion once discovered', async () => {
  mock.visible = false;
  await act(async () => {
    tree = create(card());
  });
  expect(mock.fetch).not.toHaveBeenCalled();
  mock.visible = true;
  mock.fetch.mockResolvedValue('used');
  await act(async () => {
    tree.update(card());
  });
  expect(mock.remember).toHaveBeenCalledWith(
    'https://viewer.test/s/cap',
    'used'
  );
});
it('keeps Add and retries after a temporary failure', async () => {
  mock.fetch.mockRejectedValueOnce(new Error('offline'));
  await act(async () => {
    tree = create(card());
  });
  expect(tree.root.findAllByType('button')).toHaveLength(1);
  expect(mock.remember).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(mock.fetch).toHaveBeenCalledTimes(2);
});
