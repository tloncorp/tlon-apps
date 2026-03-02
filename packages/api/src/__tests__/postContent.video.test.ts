import { afterEach, expect, test, vi } from 'vitest';

import { useDebugStore } from '@tloncorp/shared/debug';

import { AnalyticsEvent } from '../types/analytics';
import { convertContent } from '../lib/postContent';

afterEach(() => {
  useDebugStore.setState({ errorLogger: null });
});

test('convertContent prefers blob video when blob/story contain same src', () => {
  const src = 'https://cdn.example.com/clip.mp4';
  const blob = JSON.stringify([
    {
      type: 'video',
      version: 1,
      fileUri: src,
      size: 55,
      width: 100,
      height: 200,
      name: 'blob-clip',
    },
  ]);
  const story = [
    {
      block: {
        image: {
          src,
          width: 1,
          height: 1,
          alt: 'story-clip',
        },
      },
    },
  ];

  const content = convertContent(story, blob);
  const videos = content.filter((block) => block.type === 'video');
  expect(videos).toHaveLength(1);
  expect(videos[0]).toMatchObject({
    type: 'video',
    src,
    width: 100,
    height: 200,
    alt: 'blob-clip',
  });
});

test('convertContent keeps distinct blob and story videos when src differs', () => {
  const blob = JSON.stringify([
    {
      type: 'video',
      version: 1,
      fileUri: 'https://cdn.example.com/blob.mp4',
      size: 55,
    },
  ]);
  const story = [
    {
      block: {
        image: {
          src: 'https://cdn.example.com/story.mp4',
          width: 1,
          height: 1,
          alt: 'story-clip',
        },
      },
    },
  ];

  const content = convertContent(story, blob);
  const videoSrcs = content
    .filter(
      (
        block
      ): block is Extract<(typeof content)[number], { type: 'video' }> =>
        block.type === 'video'
    )
    .map((block) => block.src)
    .sort();
  expect(videoSrcs).toEqual([
    'https://cdn.example.com/blob.mp4',
    'https://cdn.example.com/story.mp4',
  ]);
});

test('convertContent tracks legacy file-video views by MIME type', () => {
  const capture = vi.fn();
  useDebugStore.setState({
    errorLogger: {
      capture,
    } as any,
  });

  const blob = JSON.stringify([
    {
      type: 'file',
      version: 1,
      fileUri: 'https://cdn.example.com/legacy.mp4',
      mimeType: 'video/mp4',
      size: 99,
    },
  ]);

  convertContent(null, blob);

  expect(capture).toHaveBeenCalledWith(
    AnalyticsEvent.LegacyVideoBlobViewed,
    expect.objectContaining({
      fileUri: 'https://cdn.example.com/legacy.mp4',
      mimeType: 'video/mp4',
      logger: 'postContent',
    })
  );
});

test('convertContent tracks legacy file-video views by extension fallback', () => {
  const capture = vi.fn();
  useDebugStore.setState({
    errorLogger: {
      capture,
    } as any,
  });

  const blob = JSON.stringify([
    {
      type: 'file',
      version: 1,
      fileUri: 'https://cdn.example.com/legacy-no-mime.webm',
      size: 99,
    },
  ]);

  convertContent(null, blob);

  expect(capture).toHaveBeenCalledWith(
    AnalyticsEvent.LegacyVideoBlobViewed,
    expect.objectContaining({
      fileUri: 'https://cdn.example.com/legacy-no-mime.webm',
      logger: 'postContent',
    })
  );
});
