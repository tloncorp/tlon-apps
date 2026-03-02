import { expect, test } from 'vitest';

import { getHydratedVideoBlocks } from './videoHydration';

test('returns no video blocks when feature flag is disabled', () => {
  const editingPost = {
    content: [{ inline: ['hello'] }],
    blob: JSON.stringify([
      {
        type: 'video',
        version: 1,
        fileUri: 'https://cdn.example.com/blob.mp4',
        size: 123,
      },
    ]),
  };

  expect(getHydratedVideoBlocks(editingPost, false)).toEqual([]);
});

test('hydrates video blocks from blob when feature flag is enabled', () => {
  const editingPost = {
    content: [{ inline: ['hello'] }],
    blob: JSON.stringify([
      {
        type: 'video',
        version: 1,
        fileUri: 'https://cdn.example.com/blob.mp4',
        size: 123,
        width: 320,
        height: 240,
        name: 'clip.mp4',
      },
    ]),
  };

  expect(getHydratedVideoBlocks(editingPost, true)).toEqual([
    {
      type: 'video',
      src: 'https://cdn.example.com/blob.mp4',
      width: 320,
      height: 240,
      alt: 'clip.mp4',
    },
  ]);
});

test('returns no video blocks when editing post has no content', () => {
  const editingPost = {
    content: null,
    blob: JSON.stringify([
      {
        type: 'video',
        version: 1,
        fileUri: 'https://cdn.example.com/blob.mp4',
        size: 123,
      },
    ]),
  };

  expect(getHydratedVideoBlocks(editingPost, true)).toEqual([]);
});
