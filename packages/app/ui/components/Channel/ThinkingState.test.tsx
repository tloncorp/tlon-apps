import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ConversationComputingState } from './useConversationComputingState';
import { ThinkingState } from './ThinkingState';

const mocks = vi.hoisted(() => ({
  computing: null as ConversationComputingState | null,
}));

vi.mock('./useConversationComputingState', () => ({
  useConversationComputingState: () => mocks.computing,
}));

vi.mock('../Avatar', () => ({ ContactAvatar: 'ContactAvatar' }));
vi.mock('@tloncorp/ui', () => ({ Text: 'Text' }));
vi.mock('tamagui', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  Spinner: 'Spinner',
  View: 'View',
  XStack: 'XStack',
}));

const computing = (): ConversationComputingState => ({
  ships: [{ ship: '~bot', label: 'Thinking...', toolCalls: [] }],
  label: 'Thinking...',
  toolCalls: [],
});

describe('ThinkingState', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    mocks.computing = null;
  });

  it('does not mount an animated spinner while hidden', async () => {
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <ThinkingState conversationId="chat" channelType="chat" />
      );
    });

    expect(
      renderer!.root.findAll((node) => (node.type as unknown) === 'Spinner')
    ).toHaveLength(0);
    expect(
      renderer!.root.find((node) => (node.type as unknown) === 'View').props
        .height
    ).toBe(0);
    act(() => renderer!.unmount());
  });

  it('does not let a prior response satisfy an overlapping computing cycle', async () => {
    let renderer: ReactTestRenderer;
    mocks.computing = computing();
    await act(async () => {
      renderer = create(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-0"
          latestPostAuthorId="~ten"
        />
      );
    });

    mocks.computing = null;
    await act(async () => {
      renderer!.update(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-0"
          latestPostAuthorId="~ten"
        />
      );
    });

    mocks.computing = computing();
    await act(async () => {
      renderer!.update(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-0"
          latestPostAuthorId="~ten"
        />
      );
    });

    // The first run finally responds while the second is already computing.
    await act(async () => {
      renderer!.update(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-1"
          latestPostAuthorId="~bot"
        />
      );
    });
    mocks.computing = null;
    await act(async () => {
      renderer!.update(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-1"
          latestPostAuthorId="~bot"
        />
      );
    });

    expect(
      renderer!.root.find((node) => (node.type as unknown) === 'View').props
        .height
    ).toBe(52);

    await act(async () => {
      renderer!.update(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-2"
          latestPostAuthorId="~bot"
        />
      );
    });
    expect(
      renderer!.root.find((node) => (node.type as unknown) === 'View').props
        .height
    ).toBe(0);
    act(() => renderer!.unmount());
  });
});
