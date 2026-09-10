import { expect, test } from 'vitest';

import { contentReferenceToCite, toContentReference } from '../client/postsApi';
import {
  getNoteReferencePath,
  noteToContentReference,
  postToContentReference,
  referenceLookupId,
} from '../client/references';
import type * as db from '../types/models';

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
