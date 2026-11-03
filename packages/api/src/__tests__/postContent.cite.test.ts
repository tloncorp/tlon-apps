import { expect, test } from 'vitest';

import { convertContent } from '../client/postContent';
import type { Cite } from '../urbit';

test('convertContent renders a bare chan cite as a channel link reference', () => {
  const content = convertContent(
    [{ block: { cite: { chan: { nest: 'chat/~zod/foo', where: '/' } } } }],
    null
  );

  expect(content).toEqual([
    {
      type: 'reference',
      referenceType: 'channelLink',
      channelId: 'chat/~zod/foo',
    },
  ]);
});

test('convertContent renders a bare notes cite as a channel link reference', () => {
  const content = convertContent(
    [{ block: { cite: { chan: { nest: 'notes/~zod/nb', where: '/' } } } }],
    null
  );

  expect(content).toEqual([
    {
      type: 'reference',
      referenceType: 'channelLink',
      channelId: 'notes/~zod/nb',
    },
  ]);
});

test('convertContent renders an unknown cite kind as an upgrade blockquote', () => {
  const content = convertContent(
    [
      {
        block: {
          cite: { future: { where: '/x' } } as unknown as Cite,
        },
      },
    ],
    null
  );

  expect(content).toEqual([
    {
      type: 'blockquote',
      content: [
        { type: 'text', text: 'Upgrade your app to see this reference' },
      ],
    },
  ]);
});

test.each<[string, Cite, string]>([
  [
    'a malformed post cite',
    { chan: { nest: 'chat/~zod/foo', where: '/msg/' } },
    '/1/chan/chat/~zod/foo/msg/',
  ],
  [
    'a notes cite with a non-note path',
    { chan: { nest: 'notes/~zod/nb', where: '/msg/123' } },
    '/1/chan/notes/~zod/nb/msg/123',
  ],
  [
    'a bait cite',
    { bait: { group: '~zod/g', graph: '~zod/c', where: '/1' } },
    '/1/bait/~zod/g/~zod/c//1',
  ],
])(
  'convertContent renders %s as an unshowable reference with its path',
  (_label, cite, path) => {
    const content = convertContent([{ block: { cite } }], null);

    expect(content).toEqual([
      {
        type: 'blockquote',
        content: [
          { type: 'text', text: "This reference can't be shown" },
          { type: 'lineBreak' },
          { type: 'text', text: path },
        ],
      },
    ]);
  }
);

test('convertContent renders a post cite as a channel reference', () => {
  const content = convertContent(
    [
      {
        block: {
          cite: {
            chan: {
              nest: 'chat/~zod/foo',
              where: '/msg/170141184506535164684262900635183087616',
            },
          },
        },
      },
    ],
    null
  );

  expect(content).toEqual([
    {
      type: 'reference',
      referenceType: 'channel',
      channelId: 'chat/~zod/foo',
      postId: '170.141.184.506.535.164.684.262.900.635.183.087.616',
    },
  ]);
});
