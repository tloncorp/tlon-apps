/* eslint-disable import/no-extraneous-dependencies */
import fetch from 'cross-fetch';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '../../../test/utils';
import GroupSidebar from './GroupSidebar';

vi.stubGlobal('fetch', (url: string, init: any) =>
  fetch(`http://localhost:3000${url}`, init)
);

describe('GroupSidebar', () => {
  it.skip('renders as expected', () => {
    const { asFragment } = render(<GroupSidebar />);
    expect(asFragment()).toMatchSnapshot();
  });
});
