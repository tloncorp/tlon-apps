import type * as db from '@tloncorp/shared/db';
import React from 'react';
import { type ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ContextLensEvent } from './Channel/ContextLens';
import { DetailView } from './DetailView';

const mocks = vi.hoisted(() => ({
  scroller: vi.fn((_props: Record<string, unknown>) => null),
}));

vi.mock('@tloncorp/ui', () => ({
  Text: 'Text',
}));

vi.mock('tamagui', () => ({
  View: 'View',
  YStack: 'YStack',
  getTokenValue: () => 12,
}));

vi.mock('./Channel/Scroller', () => ({
  default: mocks.scroller,
}));

vi.mock('./Channel/ThinkingState', () => ({
  ThinkingState: 'ThinkingState',
}));

vi.mock('./Channel/useShouldShowThinkingState', () => ({
  useShouldShowThinkingState: () => false,
}));

vi.mock('./ChatMessage', () => ({
  ChatMessage: 'ChatMessage',
}));

vi.mock('./GalleryPost/GalleryPost', () => ({
  GalleryPostDetailView: 'GalleryPostDetailView',
}));

vi.mock('./NotebookPost/NotebookPost', () => ({
  NotebookPostDetailView: 'NotebookPostDetailView',
}));

function post(id: string): db.Post {
  return {
    id,
    authorId: '~owner',
    channelId: '~bus',
    type: 'reply',
    receivedAt: 1,
    sentAt: 1,
    isDeleted: false,
    replyCount: 0,
  } as db.Post;
}

describe('DetailView', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    mocks.scroller.mockClear();
  });

  it('forwards the live Lens stream and event navigation into a chat thread', async () => {
    const contextLensEvents = [{ seq: 1 }] as ContextLensEvent[];
    const onOpenContextLensEvent = vi.fn();
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        <DetailView
          post={post('thread-root')}
          posts={[post('thread-reply')]}
          channel={{ id: '~bus', type: 'dm' } as db.Channel}
          contextLensEvents={contextLensEvents}
          onOpenContextLensEvent={onOpenContextLensEvent}
          onPressDelete={vi.fn()}
          activeMessage={null}
          setActiveMessage={vi.fn()}
        />
      );
    });

    expect(mocks.scroller).toHaveBeenCalled();
    const scrollerProps = mocks.scroller.mock.calls.at(-1)![0];
    expect(scrollerProps.contextLensEvents).toBe(contextLensEvents);
    expect(scrollerProps.onOpenContextLensEvent).toBe(onOpenContextLensEvent);

    act(() => renderer!.unmount());
  });
});
