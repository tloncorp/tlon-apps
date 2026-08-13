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

import { ActivitySourceContent } from './ActivitySourceContent';

const mocks = vi.hoisted(() => ({
  channelProvider: vi.fn(({ children }) => children),
  liveChannel: undefined as undefined | { id: string; type: string },
}));

vi.mock('@tloncorp/shared/store', () => ({
  useChannel: () => ({ data: mocks.liveChannel }),
}));

vi.mock('../../contexts/channel', () => ({
  ChannelProvider: mocks.channelProvider,
}));

vi.mock('../ContactNameV2', () => ({
  useContactName: () => 'author',
}));

vi.mock('../ContentReference', () => ({
  ContentReferenceLoader: () => null,
  PostReference: () => null,
}));

vi.mock('../GalleryPost', () => ({
  GalleryPost: () => null,
}));

vi.mock('../PostContent', () => ({
  createContentRenderer: () => () => null,
}));

vi.mock('../PostContent/contentUtils', () => ({
  usePostContent: () => [],
}));

vi.mock('@tloncorp/ui', () => ({
  Icon: 'Icon',
  Text: 'Text',
}));

vi.mock('tamagui', () => ({
  ScrollView: 'ScrollView',
  YStack: 'YStack',
  styled: () => 'Styled',
}));

describe('ActivitySourceContent', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    mocks.channelProvider.mockClear();
    mocks.liveChannel = undefined;
  });

  it('waits for a missing channel relation instead of mounting a null provider', async () => {
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        <ActivitySourceContent
          summary={{
            sourceId: 'channel/example',
            type: 'post',
            newest: {
              id: 'event-id',
              bucketId: 'all',
              sourceId: 'channel/example',
              type: 'post',
              timestamp: Date.now(),
              channelId: 'chat/~host/example',
              channel: null,
            },
            all: [],
          }}
        />
      );
    });

    expect(renderer!.toJSON()).toBeNull();
    expect(mocks.channelProvider).not.toHaveBeenCalled();

    act(() => renderer!.unmount());
  });

  it('renders when the missing channel relation becomes available', async () => {
    const summary = {
      sourceId: 'channel/example',
      type: 'post' as const,
      newest: {
        id: 'event-id',
        bucketId: 'all' as const,
        sourceId: 'channel/example',
        type: 'post' as const,
        timestamp: Date.now(),
        channelId: 'chat/~host/example',
        channel: null,
      },
      all: [],
    };
    let renderer: ReactTestRenderer;

    mocks.liveChannel = undefined;
    await act(async () => {
      renderer = create(<ActivitySourceContent summary={summary} />);
    });
    expect(renderer!.toJSON()).toBeNull();

    mocks.liveChannel = {
      id: 'chat/~host/example',
      type: 'gallery',
    };
    await act(async () => {
      renderer!.update(<ActivitySourceContent summary={{ ...summary }} />);
    });

    expect(mocks.channelProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: {
          channel: mocks.liveChannel,
        },
      }),
      undefined
    );
    expect(renderer!.toJSON()).not.toBeNull();

    act(() => renderer!.unmount());
  });
});
