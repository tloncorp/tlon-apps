import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import GangPreview from './GangPreview';
import { mockGangs } from '../../mocks/groups';

describe('ChatInput', () => {
  it('renders preview', () => {
    const { asFragment } = render(
      <GangPreview preview={mockGangs['~zod/structure'].preview!} />
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
