import React from 'react';
import { describe, expect, it } from 'vitest';

import { render } from '../../../test/utils';
import { mockGangs } from '../../mocks/groups';
import GangPreview from './GangPreview';

describe('GangPreview', () => {
  it('renders preview', () => {
    const { asFragment } = render(
      <GangPreview preview={mockGangs['~zod/structure'].preview!} />
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
