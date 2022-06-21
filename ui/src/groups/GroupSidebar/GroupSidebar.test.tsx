/* eslint-disable import/no-extraneous-dependencies */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '../../../test/utils';
import GroupSidebar from './GroupSidebar';

describe('GroupSidebar', () => {
  it('renders as expected', () => {
    const { asFragment } = render(<GroupSidebar />);
    expect(asFragment()).toMatchSnapshot();
  });
});
