import { expect, test } from 'vitest';

import { convertContent, uploadedFileUrlsOf } from '../client/postContent';

function image(src: string) {
  return { block: { image: { src, width: 100, height: 100, alt: '' } } };
}

test('lists blob uploads, then story images, in display order', () => {
  const blob = JSON.stringify([
    {
      type: 'file',
      version: 1,
      fileUri: 'https://cdn.example.com/report.pdf',
      name: 'report.pdf',
      size: 1024,
    },
    {
      type: 'voicememo',
      version: 1,
      fileUri: 'https://cdn.example.com/memo.m4a',
      size: 2048,
    },
  ]);
  const story = [
    image('https://cdn.example.com/one.jpg'),
    { inline: ['caption'] },
    image('https://cdn.example.com/two.png'),
  ];

  expect(uploadedFileUrlsOf(story, blob)).toEqual([
    'https://cdn.example.com/report.pdf',
    'https://cdn.example.com/memo.m4a',
    'https://cdn.example.com/one.jpg',
    'https://cdn.example.com/two.png',
  ]);
});

test('matches the order convertContent displays', () => {
  const blob = JSON.stringify([
    {
      type: 'file',
      version: 1,
      fileUri: 'https://cdn.example.com/a.pdf',
      size: 1,
    },
  ]);
  const story = [image('https://cdn.example.com/b.jpg')];
  const displayed = convertContent(story, blob).flatMap((block) =>
    block.type === 'file'
      ? [block.file.fileUri]
      : block.type === 'image'
        ? [block.src]
        : []
  );

  expect(uploadedFileUrlsOf(story, blob)).toEqual(displayed);
});

test('reads content stored as a JSON string', () => {
  expect(
    uploadedFileUrlsOf(
      JSON.stringify([image('https://cdn.example.com/one.jpg')]),
      null
    )
  ).toEqual(['https://cdn.example.com/one.jpg']);
});

test('lists a video once when the blob and the story both carry it', () => {
  const src = 'https://cdn.example.com/clip.mp4';
  const blob = JSON.stringify([
    { type: 'video', version: 1, fileUri: src, size: 55 },
  ]);

  expect(uploadedFileUrlsOf([image(src)], blob)).toEqual([src]);
});

test('skips uploads that have not left the device', () => {
  const blob = JSON.stringify([
    {
      type: 'file',
      version: 1,
      fileUri: 'file:///var/mobile/report.pdf',
      size: 1024,
    },
  ]);
  const story = [
    image('blob:https://tlon.network/0f1e2d'),
    image('https://cdn.example.com/done.jpg'),
  ];

  expect(uploadedFileUrlsOf(story, blob)).toEqual([
    'https://cdn.example.com/done.jpg',
  ]);
});

test('ignores text and links, which are not uploads', () => {
  const story = [
    {
      inline: [
        'see ',
        { link: { href: 'https://example.com/page', content: 'this' } },
      ],
    },
  ];

  expect(uploadedFileUrlsOf(story, null)).toEqual([]);
});
