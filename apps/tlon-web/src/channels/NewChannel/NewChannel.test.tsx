/* eslint-disable import/no-extraneous-dependencies */
import React from 'react';
import { describe, expect, it } from 'vitest';

import { render } from '../../../test/utils';
import NewChannelModal from './NewChannelModal';

vi.mock('@/state/groups', () => ({
  useRouteGroup: () => ({}),
  useAddChannelMutation: () => ({}),
}));

describe('NewChannelModal', () => {
  it.skip('renders as expected', () => {
    const { asFragment } = render(<NewChannelModal />);
    expect(asFragment()).toMatchSnapshot();
  });
});
