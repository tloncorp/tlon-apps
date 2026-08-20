import { expect, test } from 'vitest';

import { contentReferenceToCite, toContentReference } from '../client/postsApi';
import {
  extractReferencePaths,
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

const GROUP_PATH = '/1/group/~zod/test';
const GROUP_CITE = { group: '~zod/test' };

test('extractReferencePaths accepts a bare group path', () => {
  expect(extractReferencePaths(GROUP_PATH)).toEqual({
    text: '',
    cites: [GROUP_CITE],
  });
});

test('extractReferencePaths removes an accepted token from prose and tidies whitespace', () => {
  expect(extractReferencePaths(`Check ${GROUP_PATH} out`)).toEqual({
    text: 'Check out',
    cites: [GROUP_CITE],
  });
  expect(extractReferencePaths(`${GROUP_PATH}\nhello`)).toEqual({
    text: 'hello',
    cites: [GROUP_CITE],
  });
  expect(extractReferencePaths(`hello\n\n${GROUP_PATH}\nworld`)).toEqual({
    text: 'hello\n\nworld',
    cites: [GROUP_CITE],
  });
});

test('extractReferencePaths keeps multiple refs in encounter order', () => {
  const second = '/1/group/~sampel-palnet/other';
  expect(extractReferencePaths(`first ${GROUP_PATH} then ${second}`)).toEqual({
    text: 'first then',
    cites: [GROUP_CITE, { group: '~sampel-palnet/other' }],
  });
});

test('extractReferencePaths strips surrounding punctuation from accepted tokens', () => {
  expect(extractReferencePaths(`(${GROUP_PATH})`)).toEqual({
    text: '',
    cites: [GROUP_CITE],
  });
  expect(extractReferencePaths(`See ${GROUP_PATH}.`)).toEqual({
    text: 'See',
    cites: [GROUP_CITE],
  });
  expect(extractReferencePaths(`"${GROUP_PATH}", yes`)).toEqual({
    text: 'yes',
    cites: [GROUP_CITE],
  });
});

test('extractReferencePaths strips balanced emphasis pairs and removes the whole token', () => {
  for (const decorated of [
    `**${GROUP_PATH}**`,
    `*${GROUP_PATH}*`,
    `_${GROUP_PATH}_`,
    `__${GROUP_PATH}__`,
  ]) {
    expect(extractReferencePaths(`join ${decorated} now`)).toEqual({
      text: 'join now',
      cites: [GROUP_CITE],
    });
  }
});

test('extractReferencePaths leaves ref-free text untouched', () => {
  const text = 'Nothing to see **here**.\n\nhttps://example.com/1/group/~zod/x';
  expect(extractReferencePaths(text)).toEqual({ text, cites: [] });
});

test('extractReferencePaths accepts the canonical chan forms', () => {
  expect(
    extractReferencePaths('/1/chan/notes/~zod/my-notebook/note/3')
  ).toEqual({
    text: '',
    cites: [{ chan: { nest: NOTES_CHANNEL_ID, where: '/note/3' } }],
  });
  expect(
    extractReferencePaths('/1/chan/notes/~zod/my-notebook/note/1.234')
  ).toEqual({
    text: '',
    cites: [{ chan: { nest: NOTES_CHANNEL_ID, where: '/note/1.234' } }],
  });
  expect(
    extractReferencePaths(`/1/chan/${CHANNEL_ID}/msg/${PARENT_ID}`)
  ).toEqual({
    text: '',
    cites: [{ chan: { nest: CHANNEL_ID, where: `/msg/${PARENT_ID}` } }],
  });
  expect(
    extractReferencePaths(
      `/1/chan/${CHANNEL_ID}/msg/170.141.184.505.979.681.243.072.382.329.337.971.474`
    )
  ).toEqual({
    text: '',
    cites: [
      {
        chan: {
          nest: CHANNEL_ID,
          where: '/msg/170.141.184.505.979.681.243.072.382.329.337.971.474',
        },
      },
    ],
  });
  expect(
    extractReferencePaths(`/1/chan/${CHANNEL_ID}/msg/${PARENT_ID}/${REPLY_ID}`)
  ).toEqual({
    text: '',
    cites: [
      {
        chan: { nest: CHANNEL_ID, where: `/msg/${PARENT_ID}/${REPLY_ID}` },
      },
    ],
  });
  expect(
    extractReferencePaths(
      `/1/chan/${CHANNEL_ID}/msg/~sogrum-savluc/${PARENT_ID}`
    )
  ).toEqual({
    text: '',
    cites: [
      {
        chan: {
          nest: CHANNEL_ID,
          where: `/msg/~sogrum-savluc/${PARENT_ID}`,
        },
      },
    ],
  });
  expect(extractReferencePaths('/1/chan/heap/~zod/links/msg/5')).toEqual({
    text: '',
    cites: [{ chan: { nest: 'heap/~zod/links', where: '/msg/5' } }],
  });
});

test('extractReferencePaths rejects invalid candidates and leaves them as text', () => {
  const rejected = [
    // fake ship
    '/1/group/~foobar/test',
    // invalid slugs
    '/1/group/~zod/Test',
    '/1/group/~zod/proj_ect',
    // unbalanced trailing emphasis is never trimmed, so the malformed slug
    // stays part of the token
    '/1/group/~zod/project_',
    '/1/group/~zod/project*',
    // a mixed marker prefix is not an emphasis wrapper
    '*_/1/group/~zod/test**',
    // wrong segment counts
    '/1/group/~zod',
    '/1/group/~zod/test/extra',
    `/1/chan/${CHANNEL_ID}/msg`,
    // desk paths are unsupported
    '/1/desk/~zod/app',
    // unknown chan kind
    '/1/chan/unknown/~zod/test/msg/1',
    // chan host and name are validated separately from group refs
    '/1/chan/chat/~foobar/test/msg/1',
    '/1/chan/chat/~zod/Bad/msg/1',
    // /note/ on a non-notes nest
    `/1/chan/${CHANNEL_ID}/note/3`,
    // free-form chan where with no post id
    `/1/chan/${CHANNEL_ID}/some/free-form/where`,
    // channel-itself refs do not exist
    `/1/chan/${CHANNEL_ID}`,
    // a URL is one token whose core does not start with /1/
    `https://example.com${GROUP_PATH}`,
  ];
  for (const token of rejected) {
    expect(extractReferencePaths(token), token).toEqual({
      text: token,
      cites: [],
    });
  }
});

test('extractReferencePaths rejects malformed ids so recipients cannot resolve a different post', () => {
  const rejected = [
    `/1/chan/${CHANNEL_ID}/msg/1..2`,
    `/1/chan/${CHANNEL_ID}/msg/1.2`,
    `/1/chan/${CHANNEL_ID}/msg/012`,
    // a zero leading group dot-strips to a different id (0.001 -> post 1)
    `/1/chan/${CHANNEL_ID}/msg/0.001`,
    `/1/chan/notes/~zod/my-notebook/note/0.001`,
    `/1/chan/notes/~zod/my-notebook/note/01.234`,
    // trailing dot over a non-canonical remainder
    `/1/chan/${CHANNEL_ID}/msg/1.2.`,
    `/1/chan/notes/~zod/my-notebook/note/1..2.`,
  ];
  for (const token of rejected) {
    expect(extractReferencePaths(token), token).toEqual({
      text: token,
      cites: [],
    });
  }
});

test('extractReferencePaths preserves surrounding line structure', () => {
  // Indentation is structural in Markdown: a ref inside a nested list item
  // must not dedent it, and an indented line must stay indented.
  expect(
    extractReferencePaths('- parent\n  - child /1/group/~zod/test')
  ).toEqual({
    text: '- parent\n  - child',
    cites: [{ group: '~zod/test' }],
  });
  expect(extractReferencePaths('    keep /1/group/~zod/test')).toEqual({
    text: '    keep',
    cites: [{ group: '~zod/test' }],
  });
});

test('extractReferencePaths strips code and typographic decorations', () => {
  const accepted = [
    '`/1/group/~zod/test`',
    '\u2018/1/group/~zod/test\u2019',
    '\u201c/1/group/~zod/test\u201d',
    '/1/group/~zod/test\u2026',
  ];
  for (const token of accepted) {
    expect(extractReferencePaths(token), token).toEqual({
      text: '',
      cites: [{ group: '~zod/test' }],
    });
  }
});
