import { expect, test } from 'vitest';

import { convertContent } from '../client/postContent';

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

test('convertContent renders an unrecognised cite as an upgrade blockquote with its path', () => {
  const content = convertContent(
    [{ block: { cite: { chan: { nest: 'notes/~zod/nb', where: '/' } } } }],
    null
  );

  expect(content).toEqual([
    {
      type: 'blockquote',
      content: [
        { type: 'text', text: 'Upgrade your app to see this reference' },
        { type: 'lineBreak' },
        { type: 'text', text: '/1/chan/notes/~zod/nb' },
      ],
    },
  ]);
});

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
