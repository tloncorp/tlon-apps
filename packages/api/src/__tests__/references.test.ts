import { expect, test } from 'vitest';

import {
  channelToContentReference,
  contentReferenceToCite,
  getChannelReferencePath,
  getNoteReferencePath,
  noteToContentReference,
  postToContentReference,
  referenceLookupId,
  toContentReference,
} from '../client/references';
import type * as db from '../types/models';
import { citeToPath, pathToCite } from '../urbit/utils';

test('referenceLookupId returns replyId when present', () => {
  expect(referenceLookupId({ postId: 'parent', replyId: 'reply' })).toBe(
    'reply'
  );
});

test('referenceLookupId falls back to postId when no replyId', () => {
  expect(referenceLookupId({ postId: 'parent' })).toBe('parent');
  expect(referenceLookupId({ postId: 'parent', replyId: undefined })).toBe(
    'parent'
  );
});

const CHANNEL_ID = 'chat/~zod/test';
const PARENT_ID = '170141184506535164684262900635183087616';
const REPLY_ID = '170141184506535176367510061158978551808';

function makePost(overrides: Partial<db.Post>): db.Post {
  return {
    id: PARENT_ID,
    channelId: CHANNEL_ID,
    authorId: '~zod',
    type: 'chat',
    sentAt: 0,
    receivedAt: 0,
    ...overrides,
  } as db.Post;
}

test('postToContentReference emits parent/reply ids and path for a reply', () => {
  const post = makePost({ id: REPLY_ID, parentId: PARENT_ID, type: 'reply' });
  const [path, reference] = postToContentReference(post);

  expect(reference).toMatchObject({
    referenceType: 'channel',
    type: 'reference',
    channelId: CHANNEL_ID,
    postId: PARENT_ID,
    replyId: REPLY_ID,
  });
  expect(path).toBe(`/1/chan/${CHANNEL_ID}/msg/${PARENT_ID}/${REPLY_ID}`);
});

test('postToContentReference emits only postId and path for a top-level post', () => {
  const post = makePost({ id: PARENT_ID, parentId: null });
  const [path, reference] = postToContentReference(post);

  expect(reference).toMatchObject({
    referenceType: 'channel',
    type: 'reference',
    channelId: CHANNEL_ID,
    postId: PARENT_ID,
  });
  expect('replyId' in reference).toBe(false);
  expect(path).toBe(`/1/chan/${CHANNEL_ID}/msg/${PARENT_ID}`);
});

const NOTES_CHANNEL_ID = 'notes/~zod/my-notebook';

test('toContentReference parses a notes chan cite as a note reference', () => {
  const reference = toContentReference({
    chan: { nest: NOTES_CHANNEL_ID, where: '/note/3' },
  });
  expect(reference).toEqual({
    type: 'reference',
    referenceType: 'note',
    channelId: NOTES_CHANNEL_ID,
    noteId: '3',
  });
});

test('toContentReference strips dot-grouping from note ids', () => {
  const reference = toContentReference({
    chan: { nest: NOTES_CHANNEL_ID, where: '/note/1.234' },
  });
  expect(reference).toEqual({
    type: 'reference',
    referenceType: 'note',
    channelId: NOTES_CHANNEL_ID,
    noteId: '1234',
  });
});

test('toContentReference rejects a notes cite with a non-note where path', () => {
  expect(
    toContentReference({
      chan: { nest: NOTES_CHANNEL_ID, where: '/msg/123' },
    })
  ).toBeNull();
});

test('contentReferenceToCite round-trips a note reference', () => {
  const [path, reference] = noteToContentReference(NOTES_CHANNEL_ID, 3);
  expect(path).toBe(`/1/chan/${NOTES_CHANNEL_ID}/note/3`);
  expect(getNoteReferencePath(NOTES_CHANNEL_ID, 3)).toBe(path);
  const cite = contentReferenceToCite(reference);
  expect(cite).toEqual({
    chan: { nest: NOTES_CHANNEL_ID, where: '/note/3' },
  });
  expect(toContentReference(cite)).toEqual(reference);
});

test.each(['/', '', '//'])(
  'toContentReference parses a bare chan cite (where %j) as a channel link',
  (where) => {
    expect(toContentReference({ chan: { nest: CHANNEL_ID, where } })).toEqual({
      type: 'reference',
      referenceType: 'channelLink',
      channelId: CHANNEL_ID,
    });
  }
);

test('toContentReference rejects a chan cite with an empty /msg/ path', () => {
  expect(
    toContentReference({ chan: { nest: CHANNEL_ID, where: '/msg/' } })
  ).toBeNull();
});

test('toContentReference keeps a bare notes cite unparsed', () => {
  expect(
    toContentReference({ chan: { nest: NOTES_CHANNEL_ID, where: '/' } })
  ).toBeNull();
});

test('channelToContentReference round-trips through a cite', () => {
  const [path, reference] = channelToContentReference(CHANNEL_ID);
  expect(path).toBe(`/1/chan/${CHANNEL_ID}`);
  expect(getChannelReferencePath(CHANNEL_ID)).toBe(path);
  const cite = contentReferenceToCite(reference);
  expect(cite).toEqual({ chan: { nest: CHANNEL_ID, where: '/' } });
  expect(toContentReference(cite)).toEqual(reference);
});

test('pathToCite and citeToPath round-trip a bare channel path', () => {
  const path = `/1/chan/${CHANNEL_ID}`;
  const cite = pathToCite(path);
  expect(cite).toEqual({ chan: { nest: CHANNEL_ID, where: '/' } });
  expect(citeToPath(cite!)).toBe(path);
});

const DOTTED_PARENT = '170.141.184.506.535.164.684.262.900.635.183.087.616';
const DOTTED_REPLY = '170.141.184.506.535.176.367.510.061.158.978.551.808';

test.each<[string, Parameters<typeof toContentReference>[0], unknown]>([
  [
    'post /msg/<id>',
    { chan: { nest: CHANNEL_ID, where: `/msg/${PARENT_ID}` } },
    {
      type: 'reference',
      referenceType: 'channel',
      channelId: CHANNEL_ID,
      postId: DOTTED_PARENT,
      replyId: undefined,
    },
  ],
  [
    'reply /msg/<parent>/<reply>',
    { chan: { nest: CHANNEL_ID, where: `/msg/${PARENT_ID}/${REPLY_ID}` } },
    {
      type: 'reference',
      referenceType: 'channel',
      channelId: CHANNEL_ID,
      postId: DOTTED_PARENT,
      replyId: DOTTED_REPLY,
    },
  ],
  [
    'author-prefixed /msg/~ship/<dotted.id>',
    {
      chan: { nest: CHANNEL_ID, where: `/msg/~sogrum-savluc/${DOTTED_PARENT}` },
    },
    {
      type: 'reference',
      referenceType: 'channel',
      channelId: CHANNEL_ID,
      postId: DOTTED_PARENT,
      replyId: undefined,
    },
  ],
  [
    'gallery /curio/<id> on a heap nest',
    { chan: { nest: 'heap/~zod/gallery', where: `/curio/${PARENT_ID}` } },
    {
      type: 'reference',
      referenceType: 'channel',
      channelId: 'heap/~zod/gallery',
      postId: DOTTED_PARENT,
      replyId: undefined,
    },
  ],
  [
    'diary /note/<id> on a diary nest',
    { chan: { nest: 'diary/~zod/blog', where: `/note/${PARENT_ID}` } },
    {
      type: 'reference',
      referenceType: 'channel',
      channelId: 'diary/~zod/blog',
      postId: DOTTED_PARENT,
      replyId: undefined,
    },
  ],
  [
    'note /note/<id> on a notes nest',
    { chan: { nest: NOTES_CHANNEL_ID, where: '/note/42' } },
    {
      type: 'reference',
      referenceType: 'note',
      channelId: NOTES_CHANNEL_ID,
      noteId: '42',
    },
  ],
  [
    'group',
    { group: '~zod/my-group' },
    { type: 'reference', referenceType: 'group', groupId: '~zod/my-group' },
  ],
  [
    'desk/app',
    { desk: { flag: '~zod/landscape', where: '' } },
    {
      type: 'reference',
      referenceType: 'app',
      userId: '~zod',
      appId: 'landscape',
    },
  ],
])('toContentReference parses a %s cite', (_label, cite, expected) => {
  expect(toContentReference(cite)).toStrictEqual(expected);
});
