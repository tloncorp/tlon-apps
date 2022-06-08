/* eslint-disable import/no-extraneous-dependencies */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Sidebar from './Sidebar';


describe('Sidebar', () => {
  it('renders as expected', () => {
    const { asFragment } = render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
