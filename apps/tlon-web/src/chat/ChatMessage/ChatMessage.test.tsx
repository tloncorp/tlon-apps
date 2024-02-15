import * as useMedia from '@/logic/useMedia';
import { makeFakeChatWrit, unixToDaStr } from '@/mocks/chat';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { unixToDa } from '@urbit/api';
import React, { ReactPortal } from 'react';
import { SpyInstance, beforeEach, describe, expect, it } from 'vitest';

import { fireEvent, render, screen, userEvent } from '../../../test/utils';
import ChatMessage from './ChatMessage';

vi.mock('lodash/debounce', () => ({
  default: (fn: any) => fn,
}));

vi.mock('@/state/emoji', () => ({
  default: () => ({
    data: undefined,
    load: (fn: any) => fn,
  }),
}));

vi.mock('react-router-dom', async () => {
  const mod = await vi.importActual('react-router-dom');
  const date = new Date(2021, 1, 1, 13);

  return {
    ...(mod as any),
    useParams: () => ({
      idShip: '~finned-palmer',
      idTime: unixToDaStr(date.valueOf()),
    }),
  };
});

vi.mock('react-dom', () => {
  const mod = vi.importActual('react-dom');
  return {
    ...(mod as any),
    createPortal: (node: React.ReactNode) => node as ReactPortal,
  };
});

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
    debug: vi.fn(),
    init: vi.fn(),
  },
}));

class MockPointerEvent extends Event {
  button: number;

  ctrlKey: boolean;

  pointerType: string;

  constructor(type: string, props: PointerEventInit) {
    super(type, props);
    this.button = props.button || 0;
    this.ctrlKey = props.ctrlKey || false;
    this.pointerType = props.pointerType || 'mouse';
  }
}

window.PointerEvent = MockPointerEvent as any;
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();

describe('ChatMessage', () => {
  beforeEach(() => {
    // vi.useFakeTimers();
  });

  afterEach(() => {
    // vi.useRealTimers();
    vi.resetAllMocks();
  });
  it.skip('renders as expected', () => {
    const date = new Date(2021, 1, 1, 13);
    const writ = makeFakeChatWrit(
      1,
      '~finned-palmer',
      [
        {
          inline: [{ bold: ['A bold test message'] }, 'with some more text'],
        },
      ],
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

  it.skip('renders the ChatMessageOptions when hovered', async () => {
    const date = new Date(2021, 1, 1, 13);
    const writ = makeFakeChatWrit(
      1,
      '~finned-palmer',
      [
        {
          inline: [{ bold: ['A bold test message'] }, 'with some more text'],
        },
      ],
      undefined
    );
    const da = unixToDa(date.valueOf());
    const { getByTestId, queryByTestId, findByTestId } = render(
      <TooltipProvider>
        <ChatMessage time={da} whom="~zod/test" writ={writ} newAuthor newDay />
      </TooltipProvider>
    );
    const chatMessage = getByTestId('chat-message');
    const chatMessageOptions = queryByTestId('chat-message-options');

    expect(chatMessage).toBeInTheDocument();
    expect(chatMessageOptions).not.toBeInTheDocument();

    fireEvent.mouseEnter(chatMessage);

    const chatMessageOptionsAfterHover = await findByTestId(
      'chat-message-options'
    );

    expect(chatMessageOptionsAfterHover).toBeInTheDocument();
  });

  it.skip('renders the ChatMessageOptions when the message is clicked', async () => {
    const date = new Date(2021, 1, 1, 13);
    const writ = makeFakeChatWrit(
      1,
      '~finned-palmer',
      [
        {
          inline: [{ bold: ['A bold test message'] }, 'with some more text'],
        },
      ],
      undefined
    );
    const da = unixToDa(date.valueOf());
    const { getByTestId, queryByTestId, findByTestId } = render(
      <TooltipProvider>
        <ChatMessage time={da} whom="~zod/test" writ={writ} newAuthor newDay />
      </TooltipProvider>
    );
    const chatMessage = getByTestId('chat-message');
    const chatMessageOptions = queryByTestId('chat-message-options');

    expect(chatMessage).toBeInTheDocument();
    expect(chatMessageOptions).not.toBeInTheDocument();

    fireEvent.click(chatMessage);

    const chatMessageOptionsAfterHover = await findByTestId(
      'chat-message-options'
    );

    expect(chatMessageOptionsAfterHover).toBeInTheDocument();
  });

  it.skip("does not render ChatMesssageOptions when the message is a thread op, we're in a thread and we're not on mobile", async () => {
    const date = new Date(2021, 1, 1, 13);
    const da = unixToDa(date.valueOf());
    const writ = makeFakeChatWrit(
      1,
      '~finned-palmer',
      [
        {
          inline: [{ bold: ['A bold test message'] }, 'with some more text'],
        },
      ],
      undefined,
      date
    );
    const { getByTestId, queryByTestId } = render(
      <TooltipProvider>
        <ChatMessage
          time={da}
          whom="~zod/test"
          writ={writ}
          newAuthor
          newDay
          hideReplies
        />
      </TooltipProvider>
    );
    const chatMessage = getByTestId('chat-message');
    const chatMessageOptions = queryByTestId('chat-message-options');

    expect(chatMessage).toBeInTheDocument();
    expect(chatMessageOptions).not.toBeInTheDocument();

    fireEvent.mouseEnter(chatMessage);

    expect(chatMessageOptions).not.toBeInTheDocument();
  });

  it.skip('renders the ChatMessageOptions when the message is a thread op and we are in a thread on mobile', async () => {
    vi.spyOn(useMedia, 'useIsMobile').mockReturnValue(true);
    const date = new Date(2021, 1, 1, 13);
    const da = unixToDa(date.valueOf());
    const writ = makeFakeChatWrit(
      1,
      '~finned-palmer',
      [
        {
          inline: [{ bold: ['A bold test message'] }, 'with some more text'],
        },
      ],
      undefined,
      date
    );
    const { getByTestId, queryByTestId, findByTestId } = render(
      <TooltipProvider>
        <ChatMessage
          time={da}
          whom="~zod/test"
          writ={writ}
          newAuthor
          newDay
          hideReplies
        />
      </TooltipProvider>
    );
    const chatMessage = getByTestId('chat-message');
    const chatMessageOptions = queryByTestId('chat-message-options');

    expect(chatMessage).toBeInTheDocument();
    expect(chatMessageOptions).not.toBeInTheDocument();

    fireEvent.mouseEnter(chatMessage);

    const chatMessageOptionsAfterHover = await findByTestId(
      'chat-message-options'
    );

    expect(chatMessageOptionsAfterHover).toBeInTheDocument();
  });
});
