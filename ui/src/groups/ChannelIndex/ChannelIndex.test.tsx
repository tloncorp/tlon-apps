/* eslint-disable import/no-extraneous-dependencies */
import { createChannel, createMockGroup } from '@/mocks/groups';
import { Group } from '@/types/groups';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '../../../test/utils';
import ChannelIndex from './ChannelIndex';

const fakeGroup: Group = createMockGroup('Fake Group');
fakeGroup.channels[`~zod/tlon`] = createChannel('Fake Channel');

vi.mock('@/state/groups', () => ({
  useGroup: () => fakeGroup,
  useRouteGroup: () => null,
  useAmAdmin: () => true,
}));

describe('ChannelIndex', () => {
  it('renders as expected', () => {
    const { asFragment } = render(<ChannelIndex />);
    expect(asFragment()).toMatchSnapshot();
  });
});
