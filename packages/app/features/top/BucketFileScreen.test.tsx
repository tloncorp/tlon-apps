import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';
import { BucketFileScreen } from './BucketFileScreen';

const file = vi.hoisted(() =>
  vi.fn((_props: { onSelectEntry: (entryId: number) => void }) => null)
);
vi.mock('../../features/buckets/BucketsLiveFile', () => ({
  BucketsLiveFile: file,
}));
vi.mock('../../ui/components/BucketsChannel/BucketsPostCollection', () => ({
  BucketsGate: ({
    children,
  }: {
    children: (flag: object) => React.ReactNode;
  }) => children({ host: '~zod', name: 'files' }),
}));
vi.mock('tamagui', () => ({
  YStack: ({ children }: { children: React.ReactNode }) => children,
}));
setupReactTestEnvironment();

it('updates the existing file route params when paging without pushing another screen', () => {
  const setParams = vi.fn();
  const push = vi.fn();
  const props = {
    route: { params: { channelId: 'bucket/~zod/files', entryId: 2 } },
    navigation: { goBack: vi.fn(), setParams, push },
  } as unknown as Parameters<typeof BucketFileScreen>[0];
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<BucketFileScreen {...props} />);
  });
  act(() => file.mock.calls.at(-1)![0].onSelectEntry(3));
  expect(setParams).toHaveBeenCalledWith({ entryId: 3 });
  expect(push).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
