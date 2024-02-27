/* eslint-disable import/no-extraneous-dependencies */
import { Group } from '@tloncorp/shared/dist/urbit/groups';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { createMockGroup } from '@/mocks/groups';

import { render } from '../../../test/utils';
import Sidebar from './Sidebar';

const fakeFlag = '~zod/tlon';
const fakeGroup: Group = createMockGroup('Fake Group');

vi.mock('@/state/chat', () => ({
  useBriefs: () => ({}),
  usePinnedGroups: () => ({}),
  usePinned: () => [],
  useGetLatestCurio: () => () => 0,
  useMultiDms: () => [],
  usePinnedClubs: () => [],
  useDms: () => [],
}));

vi.mock('@/state/groups', () => ({
  useGroup: () => fakeGroup,
  useRouteGroup: () => fakeFlag,
  useGroupsInitialized: () => true,
  useGroups: () => [fakeFlag, fakeGroup],
  useGroupFlag: () => fakeFlag,
  usePendingInvites: () => [],
  useGangList: () => [],
}));

vi.mock('@/state/hark', () => ({
  useSkeins: () => ({}),
}));

vi.mock('@/logic/utils', () => ({
  createStorageKey: () => 'fake-key',
  randomIntInRange: () => 100,
  normalizeUrbitColor: () => '#ffffff',
  hasKeys: () => false,
  randomElement: (a: any[]) => a[0],
  storageVersion: () => 0,
  clearStorageMigration: () => ({}),
  createDevLogger: () => ({
    log: () => ({}),
  }),
}));

describe('Sidebar', () => {
  it.skip('renders as expected', () => {
    const { asFragment } = render(<Sidebar />);
    expect(asFragment()).toMatchSnapshot();
  });
});
