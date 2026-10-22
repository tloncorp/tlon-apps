import React, { useEffect } from 'react';
import { type ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { useCopyChannelLink } from './useCopyChannelLink';

const mocks = vi.hoisted(() => ({
  doCopy: vi.fn<[], Promise<boolean>>(),
  copied: undefined as string | undefined,
  toast: vi.fn(),
}));

// useCopy resolves false when the platform refuses the write and rejects when
// the write throws; its own tests cover that contract.
vi.mock('@tloncorp/shared/logic', () => ({
  getChannelReferencePath: (channelId: string) => `/1/chan/${channelId}`,
}));
vi.mock('@tloncorp/ui', () => ({
  useCopy: (copied: string) => {
    mocks.copied = copied;
    return { doCopy: mocks.doCopy, didCopy: false };
  },
  useToast: () => mocks.toast,
}));

let copyLink: () => Promise<void>;
let renderer: ReactTestRenderer;

function Harness() {
  const value = useCopyChannelLink('chat/~zod/general');
  useEffect(() => {
    copyLink = value;
  });
  return null;
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.doCopy.mockReset();
  mocks.toast.mockReset();
  act(() => {
    renderer = create(<Harness />);
  });
});

afterEach(() => {
  act(() => {
    renderer.unmount();
  });
  vi.unstubAllGlobals();
});

test('copies the channel path and confirms', async () => {
  mocks.doCopy.mockResolvedValue(true);
  await act(() => copyLink());
  expect(mocks.copied).toBe('/1/chan/chat/~zod/general');
  expect(mocks.toast).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Copied!' })
  );
});

test('reports a clipboard write the platform refused', async () => {
  mocks.doCopy.mockResolvedValue(false);
  await act(() => copyLink());
  expect(mocks.toast).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Couldn't copy link" })
  );
});

test('reports a rejected clipboard write without rejecting', async () => {
  mocks.doCopy.mockRejectedValue(new Error('denied'));
  // A rejection escaping the handler would fail the test here.
  await act(() => copyLink());
  expect(mocks.toast).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Couldn't copy link" })
  );
});
