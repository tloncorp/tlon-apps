/* eslint-disable import/no-extraneous-dependencies */
import React from 'react';
import { describe, expect, it } from 'vitest';
import renderer from 'react-test-renderer';
import Layout from './Layout';

describe('Layout', () => {
  it('renders as expected', () => {
    const tree = renderer
      .create(
        <Layout>
          <p>content</p>
        </Layout>
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
