/* eslint-disable import/no-extraneous-dependencies */
import { createChannel, createMockGroup } from '@/mocks/groups';
import { Group } from '@/types/groups';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '../../../test/utils';
import ChannelIndex from './ChannelIndex';

const fakeGroup: Group = createMockGroup('Fake Group');
fakeGroup.channels[`chat/~zod/tlon`] = createChannel('Fake Channel');
const fakeVessel = fakeGroup.fleet['~hastuc-dibtux'];

vi.mock('@/state/groups', () => ({
  useGroup: () => fakeGroup,
  useRouteGroup: () => null,
  useAmAdmin: () => true,
  useVessel: () => fakeVessel,
  useGroupState: () => ({}),
}));

describe('ChannelIndex', () => {
  it('renders as expected', () => {
    const { asFragment } = render(<ChannelIndex />);
    expect(asFragment()).toMatchSnapshot();
  });
});
