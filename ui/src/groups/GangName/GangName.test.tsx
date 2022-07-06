import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import GangName from './GangName';
import { mockGangs } from '../../mocks/groups';
import { useGroupState } from '../../state/groups/groups';

describe('ChatInput', () => {
  it('renders default', () => {
    const { asFragment } = render(<GangName flag="~zod/structure" />);
    expect(asFragment()).toMatchSnapshot();
  });
  it('renders preview', () => {
    useGroupState.getState().set((draft) => {
      draft.gangs = mockGangs;
    });
    const { asFragment } = render(<GangName flag="~zod/structure" />);
    expect(asFragment()).toMatchSnapshot();
  });
});
