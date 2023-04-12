import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '../../../test/utils';
import ChatInput from './ChatInput';

vi.mock('@/components/Leap/useLeap', () => ({
  default: () => ({
    isOpen: false,
  }),
}));

vi.mock('@/state/groups', () => ({
  useGroupFlag: () => ({}),
  useGroups: () => ({}),
}));

describe('ChatInput', () => {
  it('renders as expected', () => {
    const { asFragment } = render(
      <ChatInput
        whom="~zod/test"
        sendMessage={() => {
          // placeholder;
        }}
      />
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
