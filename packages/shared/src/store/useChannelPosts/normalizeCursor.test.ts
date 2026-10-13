import { beforeEach, expect, test, vi } from 'vitest';

import { normalizeCursor } from './normalizeCursor';

const mocks = vi.hoisted(() => ({ read: vi.fn(), sync: vi.fn() }));
vi.mock('../../db', () => ({ getPost: mocks.read }));
vi.mock('../sync', () => ({ syncPosts: mocks.sync }));

const options = {
  channelId: 'chat/~zod/test',
  cursorPostId: 'anchor',
  mode: 'around' as const,
  count: 30,
};
const anchor = { id: 'anchor', channelId: options.channelId, sequenceNum: 7 };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue(null);
  mocks.sync.mockResolvedValue({ posts: [], deletedPosts: [] });
});

test('uses a locally available sequence without a server request', async () => {
  mocks.read.mockResolvedValue(anchor);
  await expect(normalizeCursor(options)).resolves.toEqual({
    ...options,
    cursorPostId: null,
    cursorSequenceNum: 7,
  });
  expect(mocks.sync).not.toHaveBeenCalled();
});

test('reads the anchor again after the around fetch persists it', async () => {
  mocks.read.mockResolvedValueOnce(null).mockResolvedValueOnce(anchor);
  mocks.sync.mockResolvedValue({ posts: [anchor] });
  await expect(normalizeCursor(options)).resolves.toMatchObject({
    cursorSequenceNum: 7,
  });
  expect(mocks.sync).toHaveBeenCalledWith(
    {
      channelId: options.channelId,
      cursor: 'anchor',
      mode: 'around',
      count: 30,
    },
    { priority: 10 }
  );
});

test('classifies an unavailable anchor separately from fetch and database errors', async () => {
  await expect(normalizeCursor(options)).rejects.toMatchObject({
    name: 'CursorNormalizationError',
    message: 'Failed to normalize cursor',
    diagnostics: {
      cursorPostId: 'anchor',
      fetchedPostCount: 0,
      after: { present: false },
    },
  });
});

test.each([0, null, -1])(
  'does not use an unusable sequence (%s)',
  async (sequenceNum) => {
    mocks.read.mockResolvedValue({ ...anchor, sequenceNum });
    await expect(normalizeCursor(options)).rejects.toMatchObject({
      name: 'CursorNormalizationError',
    });
  }
);

test('distinguishes a returned anchor from a missing persisted row without recording content', async () => {
  mocks.sync.mockResolvedValue({
    posts: [{ ...anchor, textContent: 'private text' }],
  });
  const error = await normalizeCursor(options).catch((e) => e);
  expect(error.diagnostics).toMatchObject({
    fetchedPostCount: 1,
    returned: { present: true, sequenceNum: 7 },
    after: { present: false },
  });
  expect(JSON.stringify(error.diagnostics)).not.toContain('private text');
});

test('records a deletion returned for the anchor', async () => {
  mocks.sync.mockResolvedValue({
    posts: [],
    deletedPosts: [{ ...anchor, isDeleted: true }],
  });
  await expect(normalizeCursor(options)).rejects.toMatchObject({
    diagnostics: {
      fetchedDeletedCount: 1,
      returned: { present: true, isDeleted: true },
    },
  });
});

test.each(['fetch', 'initial read', 'readback'])(
  'preserves a genuine %s failure',
  async (stage) => {
    const error = new Error(stage);
    if (stage === 'fetch') mocks.sync.mockRejectedValue(error);
    if (stage === 'initial read') mocks.read.mockRejectedValue(error);
    if (stage === 'readback')
      mocks.read.mockResolvedValueOnce(null).mockRejectedValueOnce(error);
    await expect(normalizeCursor(options)).rejects.toBe(error);
  }
);

test('leaves a newest-page request unchanged', async () => {
  const newest = { channelId: options.channelId, mode: 'newest' as const };
  await expect(normalizeCursor(newest)).resolves.toBe(newest);
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.sync).not.toHaveBeenCalled();
});
