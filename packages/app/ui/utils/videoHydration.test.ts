import { expect, test } from 'vitest';

import { getHydratedVideoAttachments } from './videoHydration';

test('returns no video attachments when feature flag is disabled', () => {
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

  expect(getHydratedVideoAttachments(editingPost, false)).toEqual([]);
});

test('hydrates video attachments from blob when feature flag is enabled', () => {
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

  expect(getHydratedVideoAttachments(editingPost, true)).toEqual([
    {
      type: 'video',
      localFile: 'https://cdn.example.com/blob.mp4',
      size: -1,
      mimeType: undefined,
      name: 'clip.mp4',
      width: 320,
      height: 240,
    },
  ]);
});

test('returns no video attachments when editing post has no content', () => {
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

  expect(getHydratedVideoAttachments(editingPost, true)).toEqual([]);
});
