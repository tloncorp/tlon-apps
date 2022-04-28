/* eslint-disable import/no-extraneous-dependencies */
import React from 'react';
import { describe, expect, it } from 'vitest';
import renderer from 'react-test-renderer';
import Layout from './Layout';

describe('Layout', () => {
  it('renders as expected', () => {
    const tree = renderer
      .create(<Layout main={<p>content</p>}/>)
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
