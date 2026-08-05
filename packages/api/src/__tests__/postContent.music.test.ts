import { expect, test } from 'vitest';

import { appendMusicToPostBlob } from '../client/content-helpers';
import { convertContent, plaintextPreviewOf } from '../client/postContent';

test('convertContent renders supported music blob entries before story content', () => {
  const music = {
    kind: 'playlist' as const,
    title: 'Chat Warmers',
    creatorName: 'eleanor',
    trackCount: 2,
    tracks: [
      {
        title: 'Signal Bloom',
        artists: [{ name: 'The Orchard Keys' }],
        releaseTitle: 'Packet Garden',
        previewUrl: 'https://cdn.example.com/signal-bloom.mp3',
      },
      {
        title: 'Low Latency Love',
        artists: [{ name: 'Direct Message' }],
        releaseTitle: 'Routing Table for Two',
      },
    ],
  };

  const blob = appendMusicToPostBlob(undefined, music);
  const content = convertContent([{ inline: ['Listen to this'] }], blob);

  expect(content[0]).toEqual({
    type: 'music',
    music: {
      type: 'music',
      version: 1,
      ...music,
    },
  });
  expect(content[1]).toMatchObject({ type: 'paragraph' });
  expect(plaintextPreviewOf(content)).toContain('(Music: Chat Warmers)');
});
