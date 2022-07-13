/* eslint-disable import/no-extraneous-dependencies */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '../../../test/utils';
import NewChannel from './NewChannel';

describe('NewChannel', () => {
  it('renders as expected', () => {
    const { asFragment } = render(<NewChannel />);
    expect(asFragment()).toMatchSnapshot();
  });
});
