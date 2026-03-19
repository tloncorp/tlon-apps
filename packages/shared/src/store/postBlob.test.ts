import { expect, test } from 'vitest';

import { sanitizePostBlobForNetwork } from './postBlob';

test('sanitizePostBlobForNetwork strips local video poster uris from blob payloads', () => {
  const blob = JSON.stringify([
    {
      type: 'video',
      version: 1,
      fileUri: 'https://cdn.example.com/video.mp4',
      mimeType: 'video/mp4',
      name: 'clip.mp4',
      size: 12345,
      posterUri: 'blob:https://example.com/video-poster',
    },
  ]);

  expect(JSON.parse(sanitizePostBlobForNetwork(blob)!)).toEqual([
    {
      type: 'video',
      version: 1,
      fileUri: 'https://cdn.example.com/video.mp4',
      mimeType: 'video/mp4',
      name: 'clip.mp4',
      size: 12345,
    },
  ]);
});
