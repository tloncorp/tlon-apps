import { describe, it, expect } from 'vitest';
import React from 'react';
import GangPreview from './GangPreview';
import { mockGangs } from '../../mocks/groups';
import { render } from '../../../test/utils';

describe('GangPreview', () => {
  it('renders preview', () => {
    const { asFragment } = render(
      <GangPreview preview={mockGangs['~zod/structure'].preview!} />
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
