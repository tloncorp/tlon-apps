import * as api from '@tloncorp/api';
import { poke, scry } from '@tloncorp/api';
import { Attachment, ImageAttachment } from '@tloncorp/api/types/attachment';
import { PostDataDraft } from '@tloncorp/api/types/post';
import * as $ from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import * as db from '../../db';
import { useDebugStore } from '../../debug';
import { AnalyticsEvent } from '../../domain';
import { toPostData } from '../../logic';
import { getClient, setupDatabaseTestSuite } from '../../test/helpers';
import { updateSession } from '../session';
import { setUploadState } from '../storage';
import * as sync from '../sync';
import { mergePendingPosts } from '../useMergePendingPosts';
import {
  deleteFailedPost,
  deletePost,
  finalizeAndSendPost,
} from './postActions';

const TEST_CHANNEL = '~zod';
const LOCAL_URI = 'LOCAL_URI';
const REMOTE_URI = 'REMOTE_URI';

function buildTestDraft(
  overrides: Partial<Omit<PostDataDraft, 'isEdit'>> = {}
): PostDataDraft {
  return {
    channelId: TEST_CHANNEL,
    content: ['test message'],
    attachments: [],
    channelType: 'chat',
    replyToPostId: null,
    isEdit: false as const,
    ...overrides,
  };
}

setupDatabaseTestSuite();

describe('sendPost', () => {
  beforeEach(async () => {
    // insert channel so we avoid a "missing channel" error
    await db.insertChannels([
      db.buildChannel({ id: TEST_CHANNEL, type: 'chat' }),
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(scry).mockClear();
    vi.mocked(poke).mockClear();
    useDebugStore.setState({ errorLogger: null });
    updateSession(null);
  });

  test('queue post when session is inactive', async () => {
    vi.useFakeTimers();

    // explicitly clear session so we'll enqueue the post
    updateSession(null);

    const sendPostPromise = finalizeAndSendPost(buildTestDraft());
    await vi.runOnlyPendingTimersAsync();
    // post starts as enqueued (since we don't have an active session)
    expect(await fetchLatestPostFromDb()).toMatchObject({
      deliveryStatus: 'enqueued',
    });

    updateSession({
      startTime: Date.now(),
      channelStatus: 'reconnecting',
    });
    await vi.runOnlyPendingTimersAsync();
    // still waiting for active session
    expect(await fetchLatestPostFromDb()).toMatchObject({
      deliveryStatus: 'enqueued',
    });

    updateSession({ channelStatus: 'active' });
    await vi.runOnlyPendingTimersAsync();
    // post is sent and we're awaiting echo
    expect(await fetchLatestPostFromDb()).toMatchObject({
      deliveryStatus: 'pending',
    });
    await sendPostPromise;
    expect(await fetchLatestPostFromDb()).toMatchObject({
      deliveryStatus: 'pending',
    });

    // directly after the message succeeds sending, sendPosts fetches the
    // channel posts to verify post was received - check for that scry
    expect(scry).toHaveBeenLastCalledWith(
      expect.objectContaining({
        app: 'chat',
        path: `/v4/dm/${TEST_CHANNEL}/writs/newest/20/light`,
      })
    );
  });

  test('session dies during send poke', async () => {
    vi.useFakeTimers();

    // explicitly clear session so we'll enqueue the post
    updateSession(null);

    const sendPostPromise = finalizeAndSendPost(buildTestDraft());
    await vi.runOnlyPendingTimersAsync();
    expect(await fetchLatestPostFromDb()).toMatchObject({
      deliveryStatus: 'enqueued',
    });

    let failPoke: (reason?: unknown) => void = () => {};
    const mockedPoke = vi.mocked(poke).mockImplementation(async (payload) => {
      if (payload.app !== 'chat' || payload.mark !== 'chat-dm-action-2') {
        // probably safe to just return here, but raising an error for now in caution
        throw new Error('Unrecognized poke');
      }
      // hang until manually rejecting via `failPoke()`
      await new Promise((_, reject) => {
        failPoke = reject;
      });
      throw new Error(
        "Shouldn't reach here - poke should hang or raise exception"
      );
    });

    // activate session
    updateSession({ startTime: Date.now(), channelStatus: 'active' });
    await vi.runOnlyPendingTimersAsync();

    // still pending because the poke is hanging
    expect(await fetchLatestPostFromDb()).toMatchObject({
      deliveryStatus: 'pending',
    });

    // simulate session dying
    updateSession({ channelStatus: 'errored' });
    failPoke(new Error('Manually failed poke'));
    await vi.runOnlyPendingTimersAsync();

    expect(mockedPoke).toHaveBeenCalledTimes(1);
    expect(mockedPoke).toHaveBeenLastCalledWith(
      expect.objectContaining({ mark: 'chat-dm-action-2' })
    );
    mockedPoke.mockClear();
    expect(await fetchLatestPostFromDb()).toMatchObject({
      deliveryStatus: 'failed',
    });

    // Even on failure, we return `undefined`
    await expect(sendPostPromise).resolves.toBeUndefined();
    // db still says failed after promise resolves
    expect(await fetchLatestPostFromDb()).toMatchObject({
      deliveryStatus: 'failed',
    });
    expect(mockedPoke).toHaveBeenCalledTimes(0);
  });

  test('tracks whether a sent post is going to a bot DM', async () => {
    const botDmId = '~pinser-botter-sampel';
    const capture = vi.fn();

    useDebugStore.getState().initializeErrorLogger({ capture });
    vi.useFakeTimers();
    vi.mocked(poke).mockResolvedValue(0);

    await db.insertChannels([
      db.buildChannel({
        id: botDmId,
        contactId: botDmId,
        type: 'dm',
      }),
    ]);

    updateSession({ startTime: Date.now(), channelStatus: 'active' });

    const sendPostPromise = finalizeAndSendPost({
      channelId: botDmId,
      content: ['hello bot'],
      attachments: [],
      channelType: 'dm',
      replyToPostId: null,
      isEdit: false,
    });

    await vi.runOnlyPendingTimersAsync();
    await sendPostPromise;

    const sendPostEvent = capture.mock.calls.find(
      ([eventId]) => eventId === AnalyticsEvent.ActionSendPost
    );

    expect(sendPostEvent).toBeDefined();
    expect(sendPostEvent?.[1]).toEqual(
      expect.objectContaining({
        channelId: expect.any(String),
        channelType: 'dm',
        groupId: null,
        isBotDm: true,
      })
    );
    expect(sendPostEvent?.[1]?.channelId).not.toBe(botDmId);
  });
});

describe('finalizeAndSendPost', () => {
  beforeEach(async () => {
    // insert channel so we avoid a "missing channel" error
    await db.insertChannels([
      db.buildChannel({ id: TEST_CHANNEL, type: 'chat' }),
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(scry).mockClear();
    vi.mocked(poke).mockClear();
    updateSession(null);
  });

  /**
   * Starts uploading image attachment and sending a post containing that
   * attachment, yielding control directly after calling `finalizeAndSendPost`.
   */
  function beginSendPostWithAttachments() {
    vi.useFakeTimers();
    vi.mocked(poke).mockResolvedValue(0);
    updateSession({ startTime: Date.now(), channelStatus: 'active' });
    const message = friendlyUniqueString();
    const fakeAsset = buildFakeImageAttachment(LOCAL_URI);

    // simulate upload start
    const uploadKey = unsafe_extractUploadKey(fakeAsset);
    setUploadState(uploadKey, {
      status: 'uploading',
      localUri: fakeAsset.file.uri,
    });

    const sendPostPromise = finalizeAndSendPost({
      channelId: TEST_CHANNEL,
      content: [message],
      attachments: [fakeAsset],
      channelType: 'chat',
      replyToPostId: null,
    });
    return {
      sendPostPromise,
      message,
      fakeAsset,
      uploadKey,
    };
  }

  test('happy path', async () => {
    const { sendPostPromise, message, uploadKey } =
      beginSendPostWithAttachments();
    await vi.runOnlyPendingTimersAsync();

    let latestPost = await fetchLatestPostFromDb();
    expect(latestPost).toMatchObject({
      channelId: TEST_CHANNEL,
      content: expect.stringContaining(message),
      deliveryStatus: 'enqueued',
    });
    // optimistic post has local URI
    expect(latestPost!.content).toEqual(expect.stringContaining(LOCAL_URI));

    // simulate upload success
    setUploadState(uploadKey, {
      status: 'success',
      remoteUri: REMOTE_URI,
    });

    await vi.runOnlyPendingTimersAsync();
    await expect(sendPostPromise).resolves.toBeUndefined();

    latestPost = await fetchLatestPostFromDb();
    expect(latestPost).toMatchObject({
      channelId: TEST_CHANNEL,
      content: expect.stringContaining(message),
      deliveryStatus: 'pending',
    });
    // after upload, post has remote URI
    expect(latestPost!.content).toEqual(expect.stringContaining(REMOTE_URI));
  });

  test('image upload fails', async () => {
    const { sendPostPromise, message, uploadKey } =
      beginSendPostWithAttachments();
    await vi.runOnlyPendingTimersAsync();

    // simulate upload failure
    setUploadState(uploadKey, {
      status: 'error',
      errorMessage: 'Simulated upload failure',
    });
    await vi.runOnlyPendingTimersAsync();

    // NB: finalizeAndSendPost will resolve even if the send fails!
    // This is matching legacy behavior of `sendPost`.
    await expect(sendPostPromise).resolves.toBeUndefined();

    // `Post#deliveryStatus` reflects failure
    expect(await fetchLatestPostFromDb()).toMatchObject({
      channelId: TEST_CHANNEL,
      content: expect.stringContaining(message),
      deliveryStatus: 'failed',
    });
  });

  test('session connection lost during upload', async () => {
    const { sendPostPromise, message, uploadKey } =
      beginSendPostWithAttachments();
    await vi.runOnlyPendingTimersAsync();

    // lose session
    updateSession(null);

    // but upload completes
    setUploadState(uploadKey, {
      status: 'success',
      remoteUri: REMOTE_URI,
    });
    await vi.runOnlyPendingTimersAsync();

    // maybe unexpectedly, send succeeds!
    await expect(sendPostPromise).resolves.toBeUndefined();
    expect(await fetchLatestPostFromDb()).toMatchObject({
      channelId: TEST_CHANNEL,
      content: expect.stringContaining(message),
      deliveryStatus: 'pending',
    });
  });

  test('send image attachment shortly before session reconnects', async () => {
    const { sendPostPromise, uploadKey } = beginSendPostWithAttachments();

    // immediately lose session so we enqueue the post
    updateSession({ channelStatus: 'reconnecting' });
    await vi.runOnlyPendingTimersAsync();

    // ensure we enqueued the send
    expect(await fetchLatestPostFromDb()).toMatchObject({
      deliveryStatus: 'enqueued',
    });

    // upload completes while session is still dead
    setUploadState(uploadKey, {
      status: 'success',
      remoteUri: REMOTE_URI,
    });
    await vi.runOnlyPendingTimersAsync();

    // still waiting for session to reconnect
    expect(await fetchLatestPostFromDb()).toMatchObject({
      deliveryStatus: 'enqueued',
    });

    // when session reconnects, post gets sent
    updateSession({ channelStatus: 'reconnected' });
    await vi.runOnlyPendingTimersAsync();
    expect(await fetchLatestPostFromDb()).toMatchObject({
      deliveryStatus: 'pending',
    });
    expect(sendPostPromise).resolves.toBeUndefined();
  });

  test('queuing multiple messages', async () => {
    vi.useFakeTimers();
    vi.mocked(poke).mockResolvedValue(0);
    const postData = new Array(2).fill(undefined).map((_, index) => ({
      message: friendlyUniqueString(),
      attachment: buildFakeImageAttachment([LOCAL_URI, index].join('#')),
      sendPromise: null as null | Promise<void>,
      id: null as null | string,
      latestFromDb: null as null | db.Post,
    }));

    updateSession({ startTime: Date.now(), channelStatus: 'active' });

    // simulate upload start for both posts
    postData.forEach((post) => {
      setUploadState(unsafe_extractUploadKey(post.attachment), {
        status: 'uploading',
        localUri: post.attachment.file.uri,
      });
    });

    // send both posts, waiting in between to ensure they have different `sentAt`s
    for (const pd of postData) {
      vi.advanceTimersByTime(1000);
      pd.sendPromise = finalizeAndSendPost({
        channelId: TEST_CHANNEL,
        content: [pd.message],
        attachments: [pd.attachment],
        channelType: 'chat',
        replyToPostId: null,
      });

      // HACK: we want to await _some_ of the async calls in the send post
      // method (like fetching the post's channel from DB) so that we can get
      // to the "build optimistic post" part, but we don't want to await the
      // entire thing, as we are manually coordinating the server response (so
      // `await sendPromise` would hang).
      //
      // Using a `runOnlyPendingTimersAsync` gives us the ticks we need. If
      // this fails, all the posts being sent here will be sent at the same
      // time, giving them the same post ID, and code below will fail expects.
      await vi.runOnlyPendingTimersAsync();
    }
    await vi.runOnlyPendingTimersAsync();

    // find IDs of the posts we just sent
    const latestPostsFromDb = (await fetchLatestPostsFromDb(postData.length))!;
    postData.forEach((pd) => {
      pd.id =
        latestPostsFromDb.find(
          (p) => typeof p.content === 'string' && p.content.includes(pd.message)
        )?.id ?? null;
      expect(pd.id).toBeTruthy();
    });

    // call this to update each `postData[].latestFromDb`
    async function pullLatestDbPosts() {
      for (const pd of postData) {
        const post = await fetchPost(pd.id!);
        if (post == null) {
          throw new Error('Missing post in DB');
        }
        pd.latestFromDb = post;
      }
    }

    await pullLatestDbPosts();

    expect(postData[0].latestFromDb).toMatchObject({
      deliveryStatus: 'enqueued',
    });
    expect(postData[1].latestFromDb).toMatchObject({
      deliveryStatus: 'enqueued',
    });

    // post0 is enqueued first, so it has an earlier sentAt than post1
    expect(postData[0].latestFromDb!.sentAt).toBeLessThan(
      postData[1].latestFromDb!.sentAt
    );

    // complete upload for post1 first
    setUploadState(unsafe_extractUploadKey(postData[1].attachment), {
      status: 'success',
      remoteUri: REMOTE_URI,
    });
    await vi.runOnlyPendingTimersAsync();
    await pullLatestDbPosts();

    // even with upload completed, post1 is still enqueued (because it's
    // waiting for post0 to complete)
    expect(postData[1].latestFromDb).toMatchObject({
      deliveryStatus: 'enqueued',
    });

    // complete upload for post0
    setUploadState(unsafe_extractUploadKey(postData[0].attachment), {
      status: 'success',
      remoteUri: REMOTE_URI,
    });
    await vi.runOnlyPendingTimersAsync();
    await pullLatestDbPosts();

    for (const pd of postData) {
      expect(pd.latestFromDb).toMatchObject({
        deliveryStatus: 'pending',
      });
      expect(pd.sendPromise).resolves.toBeUndefined();
    }

    expect(postData[0].latestFromDb!.sentAt).toBeLessThan(
      postData[1].latestFromDb!.sentAt
    );
  });

  // this is similar to the above test, but I was trying to model a bug that
  // was happening in the real app
  test('queuing multiple messages without attachments', async () => {
    vi.useFakeTimers();
    vi.mocked(poke).mockResolvedValue(0);
    const postData = new Array(3).fill(undefined).map((_, index) => ({
      message: friendlyUniqueString(),
      attachment: index === 0 ? buildFakeImageAttachment(LOCAL_URI) : null,
      sendPromise: null as null | Promise<void>,
      id: null as null | string,
      latestFromDb: null as null | db.Post,
    }));

    updateSession({ startTime: Date.now(), channelStatus: 'active' });

    setUploadState(unsafe_extractUploadKey(postData[0].attachment!), {
      status: 'uploading',
      localUri: postData[0].attachment!.file.uri,
    });

    for (const pd of postData) {
      vi.advanceTimersByTime(1000);
      pd.sendPromise = finalizeAndSendPost({
        channelId: TEST_CHANNEL,
        content: [pd.message],
        attachments: pd.attachment ? [pd.attachment] : [],
        channelType: 'chat',
        replyToPostId: null,
      });

      // HACK: we want to await _some_ of the async calls in the send post
      // method (like fetching the post's channel from DB) so that we can get
      // to the "build optimistic post" part, but we don't want to await the
      // entire thing, as we are manually coordinating the server response (so
      // `await sendPromise` would hang).
      //
      // Using a `runOnlyPendingTimersAsync` gives us the ticks we need. If
      // this fails, all the posts being sent here will be sent at the same
      // time, giving them the same post ID, and code below will fail expects.
      await vi.runOnlyPendingTimersAsync();
    }
    await vi.runOnlyPendingTimersAsync();

    // find IDs of the posts we just sent
    const latestPostsFromDb = (await fetchLatestPostsFromDb(postData.length))!;
    postData.forEach((pd) => {
      pd.id =
        latestPostsFromDb.find(
          (p) => typeof p.content === 'string' && p.content.includes(pd.message)
        )?.id ?? null;
      expect(pd.id).toBeTruthy();
    });

    for (const pd of postData) {
      const post = await fetchPost(pd.id!);
      if (post == null) {
        throw new Error('Missing post in DB');
      }
      pd.latestFromDb = post;
    }

    // check that sentAt is correctly ordered
    expect(postData[0].latestFromDb!.sentAt).toBeLessThan(
      postData[1].latestFromDb!.sentAt
    );
    expect(postData[1].latestFromDb!.sentAt).toBeLessThan(
      postData[2].latestFromDb!.sentAt
    );

    setUploadState(unsafe_extractUploadKey(postData[0].attachment!), {
      status: 'success',
      remoteUri: REMOTE_URI,
    });
    await vi.runOnlyPendingTimersAsync();

    // check that pokes happen in order of sending
    expect(
      vi.mocked(poke).mock.calls.map((params) => JSON.stringify(params[0].json))
    ).toMatchObject(postData.map((pd) => expect.stringContaining(pd.message)));

    await Promise.all(postData.map((pd) => pd.sendPromise!));
  });

  test('sendReply', async () => {
    await db.insertChannels([
      db.buildChannel({ id: 'zod/group/channel', type: 'chat' }),
    ]);
    const testChannel = (await db.getChannel({ id: 'zod/group/channel' }))!;

    vi.useFakeTimers();
    vi.mocked(poke).mockResolvedValue(0);
    updateSession({ startTime: Date.now(), channelStatus: 'active' });

    // create parent post
    const parentAuthorId = '~zod';
    const channel = await db.getChannel({ id: testChannel.id });
    const parentPost = db.buildPost({
      authorId: parentAuthorId,
      author: null,
      channel: channel!,
      sequenceNum: 1,
      content: [{ inline: ['Parent post'] }],
      deliveryStatus: 'sent',
    });
    await db.insertChannelPosts({ posts: [parentPost] });

    expect(poke).not.toHaveBeenCalled();

    // send reply
    const replyContent = friendlyUniqueString();
    const draft: PostDataDraft = {
      replyToPostId: parentPost.id,
      channelId: channel!.id,
      content: [replyContent],
      attachments: [],
      channelType: 'chat',
      isEdit: false,
    };
    const sendReplyPromise = finalizeAndSendPost(draft);

    await vi.runOnlyPendingTimersAsync();
    await sendReplyPromise;

    // reply was written to database
    const latestPost = await fetchLatestPostFromDb();
    expect(latestPost).toMatchObject({
      channelId: testChannel.id,
      parentId: parentPost.id,
      deliveryStatus: 'pending',
    });

    // reply action was sent
    expect(poke).toHaveBeenCalledWith(
      expect.objectContaining({
        app: 'channels',
        mark: 'channel-action-2',
        json: expect.objectContaining({
          channel: expect.objectContaining({
            action: {
              post: {
                reply: {
                  id: parentPost.id,
                  action: {
                    add: {
                      content: toPostData({ ...draft, attachments: [] }).story,
                      author: api.getCurrentUserId(),
                      sent: expect.any(Number),
                      blob: null,
                    },
                  },
                },
              },
            },
          }),
        }),
      })
    );
  });
});

async function fetchLatestPostsFromDb(limit: number) {
  return await getClient()!
    .select()
    .from(db.schema.posts)
    .orderBy($.desc(db.schema.posts.sentAt))
    .limit(limit)
    .execute();
}

async function fetchLatestPostFromDb() {
  return (await fetchLatestPostsFromDb(1))?.at(0);
}

async function fetchPost(id: string) {
  return getClient()!.query.posts.findFirst({
    where: (posts, { eq }) => eq(posts.id, id),
  });
}

const friendlyUniqueString = (() => {
  let counter = 0;
  return () => {
    return `(${counter++}) The time is now ${new Date().toString()}`;
  };
})();

function buildFakeImageAttachment(uri: string): ImageAttachment {
  return {
    type: 'image',
    file: { width: 1, height: 1, uri },
  };
}

function unsafe_extractUploadKey(att: Attachment): Attachment.UploadIntent.Key {
  const uploadIntent = Attachment.toUploadIntent(att);
  if (!uploadIntent.needsUpload) {
    throw new Error("Attachment doesn't need upload");
  }
  return Attachment.UploadIntent.extractKey(uploadIntent);
}

describe('clearing a failed optimistic post', () => {
  beforeEach(async () => {
    await db.insertChannels([
      db.buildChannel({ id: TEST_CHANNEL, type: 'chat' }),
    ]);
    vi.mocked(poke).mockResolvedValue(0);
    updateSession({ startTime: Date.now(), channelStatus: 'active' });
  });

  afterEach(() => {
    vi.mocked(poke).mockClear();
    updateSession(null);
  });

  async function seedFailedOptimisticPost(
    overrides: Partial<db.Post> = {}
  ): Promise<db.Post> {
    const channel = (await db.getChannel({ id: TEST_CHANNEL }))!;
    const post = db.buildPost({
      authorId: '~zod',
      author: null,
      channel,
      sequenceNum: 0,
      content: [{ inline: [friendlyUniqueString()] }],
      deliveryStatus: 'failed',
    });
    const merged = { ...post, ...overrides } as db.Post;
    await db.insertChannelPosts({ posts: [merged] });
    return merged;
  }

  test('action-menu deletePost() on a failed optimistic row hard-deletes the row', async () => {
    const post = await seedFailedOptimisticPost();

    expect((await db.getPendingPosts(TEST_CHANNEL)).map((p) => p.id)).toContain(
      post.id
    );

    await deletePost({ post });

    expect(await fetchPost(post.id)).toBeUndefined();
    expect(
      (await db.getPendingPosts(TEST_CHANNEL)).map((p) => p.id)
    ).not.toContain(post.id);
  });

  test('action-menu deletePost() on a confirmed post still marks deleted locally', async () => {
    const channel = (await db.getChannel({ id: TEST_CHANNEL }))!;
    const post = db.buildPost({
      authorId: '~zod',
      author: null,
      channel,
      sequenceNum: 5,
      content: [{ inline: ['confirmed post'] }],
      deliveryStatus: 'sent',
    });
    await db.insertChannelPosts({ posts: [post] });

    await deletePost({ post });

    const rowAfter = await fetchPost(post.id);
    expect(rowAfter).toBeTruthy();
    expect(rowAfter!.isDeleted).toBe(true);
    expect(rowAfter!.sequenceNum).toBe(5);
  });

  test('action-menu deletePost() on a failed optimistic reply removes the reply AND recomputes parent reply metadata', async () => {
    const channel = (await db.getChannel({ id: TEST_CHANNEL }))!;
    const parent = db.buildPost({
      authorId: '~zod',
      author: null,
      channel,
      sequenceNum: 1,
      content: [{ inline: ['parent'] }],
      deliveryStatus: 'sent',
    });
    await db.insertChannelPosts({ posts: [parent] });

    const failedReply = {
      ...db.buildPost({
        authorId: '~zod',
        author: null,
        channel,
        sequenceNum: 0,
        content: [{ inline: ['failed reply'] }],
        deliveryStatus: 'failed',
        parentId: parent.id,
      }),
      type: 'reply' as const,
    };
    await sync.handleAddPost(failedReply);

    expect((await fetchPost(parent.id))!.replyCount).toBe(1);

    await deletePost({ post: failedReply });

    expect(await fetchPost(failedReply.id)).toBeUndefined();
    const threadPosts = await db.getThreadPosts({ parentId: parent.id });
    expect(threadPosts.map((p) => p.id)).not.toContain(failedReply.id);

    const parentAfter = await fetchPost(parent.id);
    expect(parentAfter!.replyCount).toBe(0);
    expect(parentAfter!.replyTime).toBeNull();
    expect(parentAfter!.replyContactIds).toEqual([]);
  });

  test('deleteFailedPost on a failed-send row removes it from the DB', async () => {
    const post = await seedFailedOptimisticPost();

    await deleteFailedPost({ post });

    expect(await fetchPost(post.id)).toBeUndefined();
  });

  test('deleteFailedPost on a failed-send reply removes the reply AND restores parent reply metadata', async () => {
    const channel = (await db.getChannel({ id: TEST_CHANNEL }))!;
    const parent = db.buildPost({
      authorId: '~zod',
      author: null,
      channel,
      sequenceNum: 1,
      content: [{ inline: ['parent'] }],
      deliveryStatus: 'sent',
    });
    await db.insertChannelPosts({ posts: [parent] });

    const failedReply = {
      ...db.buildPost({
        authorId: '~zod',
        author: null,
        channel,
        sequenceNum: 0,
        content: [{ inline: ['failed reply'] }],
        deliveryStatus: 'failed',
        parentId: parent.id,
      }),
      type: 'reply' as const,
    };

    await sync.handleAddPost(failedReply);

    const parentBefore = await fetchPost(parent.id);
    expect(parentBefore!.replyCount).toBe(1);
    expect(parentBefore!.replyTime).toBe(failedReply.sentAt);
    expect(parentBefore!.replyContactIds).toEqual(['~zod']);

    await deleteFailedPost({ post: failedReply });

    expect(await fetchPost(failedReply.id)).toBeUndefined();
    const threadPosts = await db.getThreadPosts({ parentId: parent.id });
    expect(threadPosts.map((p) => p.id)).not.toContain(failedReply.id);

    const parentAfter = await fetchPost(parent.id);
    expect(parentAfter!.replyCount).toBe(0);
    expect(parentAfter!.replyTime).toBeNull();
    expect(parentAfter!.replyContactIds).toEqual([]);
  });

  test('deleteFailedPost on a failed reply leaves sibling reply metadata intact on the parent', async () => {
    const channel = (await db.getChannel({ id: TEST_CHANNEL }))!;
    const parent = db.buildPost({
      authorId: '~zod',
      author: null,
      channel,
      sequenceNum: 1,
      content: [{ inline: ['parent'] }],
      deliveryStatus: 'sent',
    });
    await db.insertChannelPosts({ posts: [parent] });

    const survivingReply = {
      ...db.buildPost({
        authorId: '~bus',
        author: null,
        channel,
        sequenceNum: 2,
        content: [{ inline: ['kept reply'] }],
        deliveryStatus: 'sent',
        parentId: parent.id,
      }),
      type: 'reply' as const,
    };
    await sync.handleAddPost(survivingReply);

    const failedReply = {
      ...db.buildPost({
        authorId: '~zod',
        author: null,
        channel,
        sequenceNum: 0,
        content: [{ inline: ['failed reply'] }],
        deliveryStatus: 'failed',
        parentId: parent.id,
      }),
      type: 'reply' as const,
      sentAt: survivingReply.sentAt + 1000,
    };
    await sync.handleAddPost(failedReply);

    await deleteFailedPost({ post: failedReply });

    const parentAfter = await fetchPost(parent.id);
    expect(parentAfter!.replyCount).toBe(1);
    expect(parentAfter!.replyTime).toBe(survivingReply.sentAt);
    expect(parentAfter!.replyContactIds).toEqual(['~bus']);
  });

  test('deleted failed optimistic rows are excluded from the live merge even when filterDeleted is false', async () => {
    const post = await seedFailedOptimisticPost();

    const merged = mergePendingPosts({
      newPosts: [post],
      pendingPosts: await db.getPendingPosts(TEST_CHANNEL),
      existingPosts: [],
      deletedPosts: { [post.id]: true },
      hasNewest: true,
      filterDeleted: false,
    });

    expect(merged.map((p) => p.id)).not.toContain(post.id);
  });

  test.each([
    {
      label: 'needs_verification row',
      postOverrides: { deliveryStatus: 'needs_verification' as const },
      seedExistingPost: undefined,
      expectedSequenceNum: 0,
    },
    {
      label: 'failed-edit confirmed row',
      postOverrides: { deliveryStatus: 'sent' as const, sequenceNum: 5 },
      seedExistingPost: async (id: string) =>
        db.updatePost({ id, editStatus: 'failed' }),
      expectedSequenceNum: 5,
    },
    {
      label: 'failed-delete confirmed row',
      postOverrides: { deliveryStatus: 'sent' as const, sequenceNum: 7 },
      seedExistingPost: async (id: string) =>
        db.updatePost({ id, deleteStatus: 'failed' }),
      expectedSequenceNum: 7,
    },
  ])(
    'deleteFailedPost() on a $label does not hard-delete',
    async ({ postOverrides, seedExistingPost, expectedSequenceNum }) => {
      const post = await seedFailedOptimisticPost(postOverrides);
      await seedExistingPost?.(post.id);

      await deleteFailedPost({ post: { ...post, ...postOverrides } });

      const rowAfter = await fetchPost(post.id);
      expect(rowAfter).toBeTruthy();
      expect(rowAfter!.isDeleted).toBe(true);
      expect(rowAfter!.sequenceNum).toBe(expectedSequenceNum);
    }
  );

  test('clearing a failed top-level post repoints channel preview to the previous previewable post', async () => {
    const channel = (await db.getChannel({ id: TEST_CHANNEL }))!;
    const previous = db.buildPost({
      authorId: '~zod',
      author: null,
      channel,
      sequenceNum: 5,
      content: [{ inline: ['previous previewable post'] }],
      deliveryStatus: 'sent',
    });
    await db.insertChannelPosts({ posts: [previous] });

    await db.updateChannel({
      id: TEST_CHANNEL,
      lastPostId: previous.id,
      lastPostAt: previous.receivedAt,
    });

    const failed = await seedFailedOptimisticPost();

    await deletePost({ post: failed });

    const chan = await db.getChannel({ id: TEST_CHANNEL });
    expect(chan!.lastPostId).toBe(previous.id);
    expect(chan!.lastPostAt).toBe(previous.receivedAt);
  });

  test('clearing a failed top-level post nulls channel preview when no previewable post remains', async () => {
    const failed = await seedFailedOptimisticPost();
    await db.updateChannel({
      id: TEST_CHANNEL,
      lastPostId: failed.id,
      lastPostAt: failed.receivedAt,
    });

    await deletePost({ post: failed });

    const chan = await db.getChannel({ id: TEST_CHANNEL });
    expect(chan!.lastPostId).toBeNull();
    expect(chan!.lastPostAt).toBeNull();
  });

  test('clearing a failed reply does NOT touch the channel preview fields', async () => {
    const channel = (await db.getChannel({ id: TEST_CHANNEL }))!;
    const parent = db.buildPost({
      authorId: '~zod',
      author: null,
      channel,
      sequenceNum: 3,
      content: [{ inline: ['parent'] }],
      deliveryStatus: 'sent',
    });
    await db.insertChannelPosts({ posts: [parent] });
    await db.updateChannel({
      id: TEST_CHANNEL,
      lastPostId: parent.id,
      lastPostAt: parent.receivedAt,
    });

    const failedReply = {
      ...db.buildPost({
        authorId: '~zod',
        author: null,
        channel,
        sequenceNum: 0,
        content: [{ inline: ['failed reply'] }],
        deliveryStatus: 'failed',
        parentId: parent.id,
      }),
      type: 'reply' as const,
    };
    await sync.handleAddPost(failedReply);

    await deletePost({ post: failedReply });

    const chan = await db.getChannel({ id: TEST_CHANNEL });
    expect(chan!.lastPostId).toBe(parent.id);
    expect(chan!.lastPostAt).toBe(parent.receivedAt);
  });

  test('clearing a failed reply against a partial thread cache preserves server-known reply summary', async () => {
    const channel = (await db.getChannel({ id: TEST_CHANNEL }))!;
    const parent = db.buildPost({
      authorId: '~zod',
      author: null,
      channel,
      sequenceNum: 3,
      content: [{ inline: ['parent'] }],
      deliveryStatus: 'sent',
    });
    await db.insertChannelPosts({ posts: [parent] });

    const serverReplyTime = Date.now() + 60_000;
    const serverContacts = ['~remote-1', '~remote-2'];
    await db.updatePost({
      id: parent.id,
      replyCount: 8,
      replyTime: serverReplyTime,
      replyContactIds: serverContacts,
    });

    const failedReply = {
      ...db.buildPost({
        authorId: '~zod',
        author: null,
        channel,
        sequenceNum: 0,
        content: [{ inline: ['failed reply'] }],
        deliveryStatus: 'failed',
        parentId: parent.id,
      }),
      type: 'reply' as const,
    };
    await sync.handleAddPost(failedReply);
    const parentBefore = await fetchPost(parent.id);
    expect(parentBefore!.replyCount).toBe(9);
    expect(parentBefore!.replyTime).toBe(serverReplyTime);
    expect(parentBefore!.replyContactIds).toEqual([...serverContacts, '~zod']);

    await deletePost({ post: failedReply });

    const parentAfter = await fetchPost(parent.id);
    expect(parentAfter!.replyCount).toBe(8);
    expect(parentAfter!.replyTime).toBe(serverReplyTime);
    expect(parentAfter!.replyContactIds).toEqual([...serverContacts, '~zod']);
  });

  test('clearing a failed top-level post in a grouped channel repairs both channel and parent group preview', async () => {
    const GROUP_ID = '~zod/group-preview-repair';
    const GROUPED_CHANNEL_ID = 'chat/~zod/group-preview-channel';
    await db.insertGroups({
      groups: [
        {
          id: GROUP_ID,
          currentUserIsMember: true,
          currentUserIsHost: false,
          hostUserId: '~zod',
          lastPostId: 'seeded-stale',
          lastPostAt: 2000,
        } as unknown as Parameters<typeof db.insertGroups>[0]['groups'][number],
      ],
    });
    await db.insertChannels([
      db.buildChannel({
        id: GROUPED_CHANNEL_ID,
        type: 'chat',
        groupId: GROUP_ID,
      }),
    ]);
    const groupedChannel = (await db.getChannel({ id: GROUPED_CHANNEL_ID }))!;

    const previous = db.buildPost({
      authorId: '~zod',
      author: null,
      channel: groupedChannel,
      sequenceNum: 5,
      content: [{ inline: ['previous previewable post'] }],
      deliveryStatus: 'sent',
    });
    await db.insertChannelPosts({ posts: [previous] });
    await db.updateChannel({
      id: GROUPED_CHANNEL_ID,
      lastPostId: previous.id,
      lastPostAt: previous.receivedAt,
    });

    const failed = db.buildPost({
      authorId: '~zod',
      author: null,
      channel: groupedChannel,
      sequenceNum: 0,
      content: [{ inline: [friendlyUniqueString()] }],
      deliveryStatus: 'failed',
    });
    await db.insertChannelPosts({ posts: [failed] });

    await deletePost({ post: failed });

    const chan = await db.getChannel({ id: GROUPED_CHANNEL_ID });
    expect(chan!.lastPostId).toBe(previous.id);
    expect(chan!.lastPostAt).toBe(previous.receivedAt);

    const group = await db.getGroup({ id: GROUP_ID });
    expect(group!.lastPostId).toBe(previous.id);
    expect(group!.lastPostAt).toBe(previous.receivedAt);
  });

  test('clearing a failed reply in a grouped channel does NOT disturb parent group last-post metadata', async () => {
    const GROUP_ID = '~zod/group-reply-isolate';
    const GROUPED_CHANNEL_ID = 'chat/~zod/group-reply-channel';
    await db.insertGroups({
      groups: [
        {
          id: GROUP_ID,
          currentUserIsMember: true,
          currentUserIsHost: false,
          hostUserId: '~zod',
        } as unknown as Parameters<typeof db.insertGroups>[0]['groups'][number],
      ],
    });
    await db.insertChannels([
      db.buildChannel({
        id: GROUPED_CHANNEL_ID,
        type: 'chat',
        groupId: GROUP_ID,
      }),
    ]);
    const groupedChannel = (await db.getChannel({ id: GROUPED_CHANNEL_ID }))!;

    const parent = db.buildPost({
      authorId: '~zod',
      author: null,
      channel: groupedChannel,
      sequenceNum: 4,
      content: [{ inline: ['parent'] }],
      deliveryStatus: 'sent',
    });
    await db.insertChannelPosts({ posts: [parent] });
    await db.updateChannel({
      id: GROUPED_CHANNEL_ID,
      lastPostId: parent.id,
      lastPostAt: parent.receivedAt,
    });
    await db.insertGroups({
      groups: [
        {
          id: GROUP_ID,
          currentUserIsMember: true,
          currentUserIsHost: false,
          hostUserId: '~zod',
          lastPostId: parent.id,
          lastPostAt: parent.receivedAt,
        } as unknown as Parameters<typeof db.insertGroups>[0]['groups'][number],
      ],
    });

    const failedReply = {
      ...db.buildPost({
        authorId: '~zod',
        author: null,
        channel: groupedChannel,
        sequenceNum: 0,
        content: [{ inline: ['failed reply'] }],
        deliveryStatus: 'failed',
        parentId: parent.id,
      }),
      type: 'reply' as const,
    };
    await sync.handleAddPost(failedReply);

    const groupBefore = await db.getGroup({ id: GROUP_ID });
    await deletePost({ post: failedReply });
    const groupAfter = await db.getGroup({ id: GROUP_ID });

    expect(groupAfter!.lastPostId).toBe(groupBefore!.lastPostId);
    expect(groupAfter!.lastPostAt).toBe(groupBefore!.lastPostAt);
  });

  test('deletePost() re-reads the DB row before hard-delete classification', async () => {
    const post = await seedFailedOptimisticPost();
    const staleSnapshot: db.Post = {
      ...post,
      deliveryStatus: 'failed',
      sequenceNum: 0,
    };
    await db.updatePost({ id: post.id, deliveryStatus: 'enqueued' });

    await deletePost({ post: staleSnapshot });

    const rowAfter = await fetchPost(post.id);
    expect(rowAfter).toBeTruthy();
    expect(rowAfter!.isDeleted).toBe(true);
  });

  test('deleteFailedPost() re-reads the DB row before hard-delete classification', async () => {
    const post = await seedFailedOptimisticPost();
    const staleSnapshot: db.Post = {
      ...post,
      deliveryStatus: 'failed',
      sequenceNum: 0,
    };
    await db.updatePost({
      id: post.id,
      deliveryStatus: 'sent',
      sequenceNum: 42,
    });

    await deleteFailedPost({ post: staleSnapshot });

    const rowAfter = await fetchPost(post.id);
    expect(rowAfter).toBeTruthy();
    expect(rowAfter!.sequenceNum).toBe(42);
  });

  test('deletePost() is a no-op when the row is already gone; does not re-run clearUnsentPost on stale snapshot', async () => {
    const channel = (await db.getChannel({ id: TEST_CHANNEL }))!;
    const parent = db.buildPost({
      authorId: '~zod',
      author: null,
      channel,
      sequenceNum: 3,
      content: [{ inline: ['parent'] }],
      deliveryStatus: 'sent',
    });
    await db.insertChannelPosts({ posts: [parent] });
    await db.updatePost({
      id: parent.id,
      replyCount: 5,
      replyTime: 9999,
      replyContactIds: ['~alfa', '~bravo'],
    });

    const staleReplySnapshot: db.Post = {
      ...db.buildPost({
        authorId: '~zod',
        author: null,
        channel,
        sequenceNum: 0,
        content: [{ inline: ['ghost reply'] }],
        deliveryStatus: 'failed',
        parentId: parent.id,
      }),
      type: 'reply' as const,
    };
    await deletePost({ post: staleReplySnapshot });

    const parentAfter = await fetchPost(parent.id);
    expect(parentAfter!.replyCount).toBe(5);
    expect(parentAfter!.replyTime).toBe(9999);
    expect(parentAfter!.replyContactIds).toEqual(['~alfa', '~bravo']);
  });

  test('deleteFailedPost() is a no-op when the row is already gone', async () => {
    const channel = (await db.getChannel({ id: TEST_CHANNEL }))!;
    const parent = db.buildPost({
      authorId: '~zod',
      author: null,
      channel,
      sequenceNum: 3,
      content: [{ inline: ['parent'] }],
      deliveryStatus: 'sent',
    });
    await db.insertChannelPosts({ posts: [parent] });
    await db.updatePost({
      id: parent.id,
      replyCount: 5,
      replyTime: 9999,
      replyContactIds: ['~alfa', '~bravo'],
    });

    const staleReplySnapshot: db.Post = {
      ...db.buildPost({
        authorId: '~zod',
        author: null,
        channel,
        sequenceNum: 0,
        content: [{ inline: ['ghost reply'] }],
        deliveryStatus: 'failed',
        parentId: parent.id,
      }),
      type: 'reply' as const,
    };

    await deleteFailedPost({ post: staleReplySnapshot });

    const parentAfter = await fetchPost(parent.id);
    expect(parentAfter!.replyCount).toBe(5);
    expect(parentAfter!.replyTime).toBe(9999);
    expect(parentAfter!.replyContactIds).toEqual(['~alfa', '~bravo']);
  });
});
