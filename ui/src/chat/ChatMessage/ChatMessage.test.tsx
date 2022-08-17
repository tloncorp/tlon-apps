import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { render } from '@testing-library/react';
import { unixToDa } from '@urbit/api';
import ChatMessage from './ChatMessage';
import { makeFakeChatWrit } from '../../mocks/chat';

describe('ChatMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  it('renders as expected', () => {
    const date = new Date(2021, 1, 1, 13);
    const writ = makeFakeChatWrit(
      1,
      '~finned-palmer',
      {
        block: [],
        inline: [{ bold: ['A bold test message'] }, 'with some more text'],
      },
      undefined
    );
    const da = unixToDa(date.valueOf());
    const { asFragment } = render(
      <MemoryRouter>
        <ChatMessage time={da} whom="~zod/test" writ={writ} newAuthor newDay />
      </MemoryRouter>
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
