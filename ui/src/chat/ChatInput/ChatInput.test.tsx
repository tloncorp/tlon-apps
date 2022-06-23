import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '../../../test/utils';
import ChatInput from './ChatInput';

describe('ChatInput', () => {
  it('renders as expected', () => {
    const { asFragment } = render(
      <ChatInput
        whom="~zod/test"
        replying={null}
        sendMessage={() => {
          // placeholder;
        }}
      />
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
