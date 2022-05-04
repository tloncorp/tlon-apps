import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ChatMessage from './ChatMessage';
import { makeChatWrit } from '../../fixtures/chat';

describe('ChatMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  it('renders as expected', () => {
    const writ = makeChatWrit(
      1,
      '~finned-palmer',
      {
        block: [],
        inline: [{ bold: 'A bold test message' }, 'with some more text'],
      },
      undefined,
      new Date(2021, 1, 1, 13)
    );
    const { asFragment } = render(<ChatMessage writ={writ} newAuthor newDay />);
    expect(asFragment()).toMatchSnapshot();
  });
});
