import { expect, test } from 'vitest';

import { convertContent } from '../client/postContent';

test('convertContent keeps both blob and story videos when src matches', () => {
  const src = 'https://cdn.example.com/clip.mp4';
  const blob = JSON.stringify([
    {
      type: 'video',
      version: 1,
      fileUri: src,
      size: 55,
      width: 100,
      height: 200,
      duration: 12.25,
      name: 'blob-clip',
      posterUri: 'https://cdn.example.com/blob-clip-poster.jpg',
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
  expect(videos).toHaveLength(2);
  expect(videos[0]).toMatchObject({
    type: 'video',
    video: {
      src,
      width: 100,
      height: 200,
      duration: 12.25,
      alt: 'blob-clip',
      posterUri: 'https://cdn.example.com/blob-clip-poster.jpg',
    },
  });
  expect(videos[1]).toMatchObject({
    type: 'video',
    video: {
      src,
      width: 1,
      height: 1,
      alt: 'story-clip',
    },
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
    .flatMap((block) => (block.type === 'video' ? [block.video.src] : []))
    .sort();
  expect(videoSrcs).toEqual([
    'https://cdn.example.com/blob.mp4',
    'https://cdn.example.com/story.mp4',
  ]);
});

test.each([
  ['missing', {}, undefined],
  ['partial (width only)', { width: 640 }, undefined],
  ['partial (height only)', { height: 480 }, undefined],
  ['zero', { width: 0, height: 480 }, undefined],
  ['known', { width: 640, height: 480 }, { width: 640, height: 480 }],
])(
  'convertContent treats %s blob video dimensions as known only when both are positive',
  (_name, dims, expected) => {
    const blob = JSON.stringify([
      {
        type: 'video',
        version: 1,
        fileUri: 'https://cdn.example.com/clip.mp4',
        size: -1,
        ...dims,
      },
    ]);

    const [block] = convertContent([], blob);
    expect(block.type).toBe('video');
    if (block.type !== 'video') return;
    expect(block.video.width).toBe(expected?.width);
    expect(block.video.height).toBe(expected?.height);
  }
);
