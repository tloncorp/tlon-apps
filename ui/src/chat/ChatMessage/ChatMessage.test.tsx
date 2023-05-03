import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { unixToDa } from '@urbit/api';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import ChatMessage from './ChatMessage';
import { makeFakeChatWrit } from '../../mocks/chat';
import { render } from '../../../test/utils';

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
      <TooltipProvider>
        <ChatMessage time={da} whom="~zod/test" writ={writ} newAuthor newDay />
      </TooltipProvider>
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
