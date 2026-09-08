import {
  batchEffects,
  withTransactionCtx,
  afterTransactionCommit,
} from '../../db/query';
import {
  hasReplySnapshots,
  beginReplySnapshot,
  endReplySnapshot,
} from '../../db/replySnapshot';
import { scry, toPostData, type PostDataResponse } from '@tloncorp/api';
import { expect, test, vi } from 'vitest';
import raw from '../../../../api/src/__tests__/fixtures/channelPostWithReplies.json';
import * as db from '../../db';
import { setupDatabaseTestSuite, resetDb } from '../../test/helpers';
import { handleChannelsUpdate, syncInitialPosts } from './sync';

setupDatabaseTestSuite();
vi.mock('../lure', () => ({
  useLureState: { getState: () => ({ start: () => ({}) }) },
}));
const channelId = 'chat/~zod/reply-race';
function snapshot(count: number) {
  // The retained endpoint fixture predates nullable blob fields in API types.
  const p: PostDataResponse = {
    ...structuredClone(raw),
    essay: {
      ...structuredClone(raw.essay),
      kind: 'chat',
      blob: null,
      meta: null,
    },
    seal: { ...structuredClone(raw.seal), replies: {} },
  };
  const template = Object.values(raw.seal.replies)[0];
  p.seal.replies = {};
  for (let i = 0; i < count; i++) {
    const id = String(BigInt(p.seal.id) + BigInt(i + 1) * 18446744073709552n);
    p.seal.replies[id] = {
      ...structuredClone(template),
      seal: { ...template.seal, id },
      'reply-essay': {
        ...template['reply-essay'],
        blob: null,
        sent: 1700000000000 + i * 1000,
        content: [{ inline: [`reply ${i} `] }],
      },
    };
  }
  p.seal.meta = {
    replyCount: count,
    lastReply: count ? 1700000000000 + (count - 1) * 1000 : null,
    lastRepliers: count ? ['~zod'] : [],
  };
  return p;
}
function data(count: number) {
  return toPostData(channelId, snapshot(count));
}
async function setup(count: number) {
  await db.insertChannels([{ id: channelId, type: 'chat' }]);
  const p = data(count);
  await db.insertChannelPosts({ posts: [p, ...(p.replies ?? [])] });
  return p;
}
async function parentCount() {
  const p = data(0);
  return (await db.getPostWithRelations({ id: p.id }))?.replyCount;
}
async function importSnapshot(count: number) {
  vi.mocked(scry).mockResolvedValueOnce({
    channels: { [channelId]: { [data(0).id]: snapshot(count) } },
    chat: {},
  });
  await syncInitialPosts({ syncSize: 'light' });
}
async function add(index: number) {
  await handleChannelsUpdate(
    { type: 'addPost', post: data(index + 1).replies![index] },
    undefined!
  );
}

test('full snapshot caches included identities before a delayed included reply event', async () => {
  await setup(0);
  await importSnapshot(6);
  expect(await parentCount()).toBe(6);
  await add(5);
  expect(await parentCount()).toBe(6);
});
test('full snapshot plus delayed included event then next reply remains exact', async () => {
  await setup(0);
  await importSnapshot(6);
  await add(5);
  await add(6);
  expect(await parentCount()).toBe(7);
});
test('stale initial snapshot cannot erase a reply accepted after its fetch started', async () => {
  await setup(9);
  let resolve!: (v: unknown) => void;
  let began!: () => void;
  const started = new Promise<void>((r) => (began = r));
  vi.mocked(scry).mockImplementationOnce(() => {
    began();
    return new Promise((r) => (resolve = r));
  });
  const importing = syncInitialPosts({ syncSize: 'light' });
  await started;
  await add(9);
  expect(await parentCount()).toBe(10);
  resolve({
    channels: { [channelId]: { [data(0).id]: snapshot(9) } },
    chat: {},
  });
  await importing;
  expect(await parentCount()).toBe(10);
});
test('a later authoritative deletion can lower the imported count', async () => {
  await setup(9);
  await importSnapshot(8);
  expect(await parentCount()).toBe(8);
});
test('partial-cache metadata does not collapse to local reply count', async () => {
  await setup(0);
  const p = { ...data(0), replyCount: 50, replies: null };
  await db.insertChannelPosts({ posts: [p] });
  await add(0);
  expect(await parentCount()).toBe(51);
});
test('an already cached reply event does not increment its parent', async () => {
  await setup(6);
  await add(5);
  expect(await parentCount()).toBe(6);
});

function initialResponse(p: ReturnType<typeof snapshot>) {
  return { channels: { [channelId]: { [data(0).id]: p } }, chat: {} };
}
function partial(count: number, bodies: number) {
  const p = snapshot(bodies);
  p.seal.meta.replyCount = count;
  return p;
}
async function pendingImport() {
  let resolve!: (v: unknown) => void;
  let begin!: () => void;
  const started = new Promise<void>((r) => (begin = r));
  vi.mocked(scry).mockImplementationOnce(() => {
    begin();
    return new Promise((r) => (resolve = r));
  });
  const importing = syncInitialPosts({ syncSize: 'light' });
  await started;
  return { importing, resolve };
}
test('a complete snapshot already containing the concurrent addition counts it once', async () => {
  await setup(2);
  const pending = await pendingImport();
  await add(2);
  pending.resolve(initialResponse(snapshot(3)));
  await pending.importing;
  expect(await parentCount()).toBe(3);
});
test('a same-ID tombstone with a different sentAt cannot leave a counted live reply', async () => {
  await setup(2);
  const pending = await pendingImport();
  const last = data(2).replies![1];
  await handleChannelsUpdate(
    {
      type: 'addPost',
      post: { ...last, sentAt: last.sentAt + 11, isDeleted: true },
    },
    undefined!
  );
  pending.resolve(initialResponse(snapshot(2)));
  await pending.importing;
  expect(await parentCount()).toBe(1);
});
test('a content/status-only edit during fetch cannot resurrect a later authoritative deletion', async () => {
  await setup(2);
  const pending = await pendingImport();
  const last = data(2).replies![1];
  await db.updatePost({
    id: last.id,
    content: JSON.stringify([{ inline: ['edited'] }]),
    deliveryStatus: 'sent',
  });
  pending.resolve(initialResponse(snapshot(1)));
  await pending.importing;
  expect(await parentCount()).toBe(1);
});
test('an unconfirmed merged addition retains its failed-send undo ownership', async () => {
  await setup(2);
  const pending = await pendingImport();
  const r = {
    ...data(3).replies![2],
    id: 'optimistic-reply-2',
    syncedAt: null,
    deliveryStatus: 'failed' as const,
  };
  await handleChannelsUpdate({ type: 'addPost', post: r }, undefined!);
  pending.resolve(initialResponse(snapshot(2)));
  await pending.importing;
  expect(await parentCount()).toBe(3);
  expect(
    (await db.getPostWithRelations({ id: data(0).id }))
      ?.optimisticReplyBumpCount
  ).toBe(1);
  await db.deletePost(r.id);
  await db.undoOptimisticReplyBump({ parentId: data(0).id });
  expect(await parentCount()).toBe(2);
});
test('an optimistic ID explicitly confirmed by the snapshot does not retain a phantom bump', async () => {
  await setup(2);
  const pending = await pendingImport();
  const r = {
    ...data(3).replies![2],
    id: 'optimistic-reply-2',
    syncedAt: null,
    deliveryStatus: 'pending' as const,
  };
  await handleChannelsUpdate({ type: 'addPost', post: r }, undefined!);
  pending.resolve(initialResponse(snapshot(3)));
  await pending.importing;
  expect(await parentCount()).toBe(3);
  expect(
    (await db.getPostWithRelations({ id: data(0).id }))
      ?.optimisticReplyBumpCount
  ).toBe(0);
  const replies = (await db.getPosts()).filter(
    (p) => p.parentId === data(0).id
  );
  expect(replies).toHaveLength(3);
  expect(replies.some((p) => p.id === r.id)).toBe(false);
});
test('a partial conflict uses exactly one complete authoritative reread', async () => {
  await setup(2);
  const before = vi.mocked(scry).mock.calls.length;
  const pending = await pendingImport();
  await add(2);
  vi.mocked(scry).mockResolvedValueOnce(snapshot(3));
  pending.resolve(initialResponse(partial(2, 1)));
  await expect(pending.importing).resolves.toEqual({
    unresolvedReplyParentIds: [],
  });
  expect(vi.mocked(scry).mock.calls.length - before).toBe(2);
  expect(await parentCount()).toBe(3);
});
test('a partial reread reports unresolved without retrying or replacing the current count', async () => {
  await setup(2);
  const before = vi.mocked(scry).mock.calls.length;
  const pending = await pendingImport();
  await add(2);
  vi.mocked(scry).mockResolvedValueOnce(partial(3, 1));
  pending.resolve(initialResponse(partial(2, 1)));
  await expect(pending.importing).resolves.toEqual({
    unresolvedReplyParentIds: [data(0).id],
  });
  expect(vi.mocked(scry).mock.calls.length - before).toBe(2);
  expect(await parentCount()).toBe(3);
});
test('an authoritative reread error is unresolved and not retried', async () => {
  await setup(2);
  const before = vi.mocked(scry).mock.calls.length;
  const pending = await pendingImport();
  await add(2);
  vi.mocked(scry).mockRejectedValueOnce(
    new Error('retained transport failure')
  );
  pending.resolve(initialResponse(partial(2, 1)));
  await expect(pending.importing).resolves.toEqual({
    unresolvedReplyParentIds: [data(0).id],
  });
  expect(vi.mocked(scry).mock.calls.length - before).toBe(2);
  expect(await parentCount()).toBe(3);
});

test('rolled-back reply membership never escapes into the pending snapshot', async () => {
  await setup(2);
  const pending = await pendingImport();
  await expect(
    batchEffects('rollback reply', (ctx) =>
      withTransactionCtx(ctx, async (tx) => {
        await handleChannelsUpdate(
          { type: 'addPost', post: data(3).replies![2] },
          tx
        );
        throw new Error('rollback after reply writes');
      })
    )
  ).rejects.toThrow('rollback after reply writes');
  pending.resolve(initialResponse(snapshot(2)));
  await pending.importing;
  expect(await parentCount()).toBe(2);
  expect(
    (await db.getPosts()).filter((p) => p.parentId === data(0).id)
  ).toHaveLength(2);
});
test('committed nested reply facts publish before the owner promise resolves', async () => {
  await setup(2);
  const pending = await pendingImport();
  await batchEffects('commit reply', (ctx) =>
    withTransactionCtx(ctx, (tx) =>
      handleChannelsUpdate({ type: 'addPost', post: data(3).replies![2] }, tx)
    )
  );
  pending.resolve(initialResponse(snapshot(2)));
  await pending.importing;
  expect(await parentCount()).toBe(3);
});
test('concurrent identical reply events share the identity-check and increment transaction', async () => {
  await setup(2);
  await Promise.all([add(2), add(2)]);
  expect(await parentCount()).toBe(3);
  expect(
    (await db.getPosts()).filter((p) => p.parentId === data(0).id)
  ).toHaveLength(3);
});
test('initial-fetch failure retires its active ticket without poisoning the next snapshot', async () => {
  await setup(2);
  let reject!: (e: Error) => void;
  let begin!: () => void;
  const started = new Promise<void>((r) => (begin = r));
  vi.mocked(scry).mockImplementationOnce(() => {
    begin();
    return new Promise((_, r) => (reject = r));
  });
  const importing = syncInitialPosts({ syncSize: 'light' });
  await started;
  await add(2);
  reject(new Error('initial failed'));
  await importing;
  expect(
    await batchEffects('inspect retired ticket', (ctx) =>
      Promise.resolve(hasReplySnapshots(ctx))
    )
  ).toBe(false);
  await importSnapshot(2);
  expect(await parentCount()).toBe(2);
});

test('a DB owner replacement during fetch cannot import the old account snapshot', async () => {
  await setup(2);
  const pending = await pendingImport();
  resetDb();
  await db.insertChannels([{ id: channelId, type: 'chat' }]);
  pending.resolve(initialResponse(snapshot(2)));
  await pending.importing;
  expect(await db.getPosts()).toHaveLength(0);
  expect(
    await batchEffects('inspect switched owner', (ctx) =>
      Promise.resolve(hasReplySnapshots(ctx))
    )
  ).toBe(false);
});

function tombstoneSnapshot() {
  const p = snapshot(1);
  const live = data(2).replies![1];
  p.seal.replies[live.id] = {
    type: 'tombstone',
    id: live.id,
    author: live.authorId,
    'deleted-at': live.sentAt + 100,
    seq: 0,
  };
  return p;
}
test('review: delayed live add cannot revive a canonical tombstone with different sentAt', async () => {
  await setup(0);
  vi.mocked(scry).mockResolvedValueOnce(initialResponse(tombstoneSnapshot()));
  await syncInitialPosts({ syncSize: 'light' });
  const reply = data(2).replies![1];
  expect((await db.getPost({ postId: reply.id }))?.isDeleted).toBe(true);
  await add(1);
  expect(await parentCount()).toBe(1);
  expect((await db.getPost({ postId: reply.id }))?.isDeleted).toBe(true);
});
test('review: committed failed-delete rollback replaces an older incoming tombstone', async () => {
  await setup(2);
  const reply = data(2).replies![1];
  await db.markPostAsDeleted(reply.id);
  const pending = await pendingImport();
  // Exact DB restoration operation used by postActions failed-delete rollback.
  await db.updatePost({ ...reply, isDeleted: false, deleteStatus: 'failed' });
  pending.resolve(initialResponse(tombstoneSnapshot()));
  await pending.importing;
  expect(await parentCount()).toBe(2);
  expect((await db.getPost({ postId: reply.id }))?.isDeleted).toBe(false);
});
test('review: committed old-owner facts cannot publish into a new database ticket', async () => {
  await setup(2);
  const old = beginReplySnapshot();
  let replacement: ReturnType<typeof beginReplySnapshot> | undefined;
  try {
    await batchEffects('publication owner switch', (ctx) =>
      withTransactionCtx(ctx, async (tx) => {
        afterTransactionCommit(tx, () => {
          resetDb();
          replacement = beginReplySnapshot();
        });
        await handleChannelsUpdate(
          { type: 'addPost', post: data(3).replies![2] },
          tx
        );
      })
    );
    expect(replacement?.mutations).toEqual([]);
    expect(await db.getPosts()).toHaveLength(0);
  } finally {
    endReplySnapshot(old);
    if (replacement) endReplySnapshot(replacement);
  }
});
test('review: an intervening complete membership deletion survives an older full snapshot', async () => {
  await setup(2);
  const pending = await pendingImport();
  await db.insertChannelPosts({ posts: [data(1)] });
  expect(await parentCount()).toBe(1);
  pending.resolve(initialResponse(snapshot(2)));
  await pending.importing;
  expect(await parentCount()).toBe(1);
});
