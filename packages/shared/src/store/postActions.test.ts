import * as $ from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { poke, scry } from '../api/urbit';
import * as db from '../db';
import { ImageAttachment } from '../domain/attachment';
import { getClient, setupDatabaseTestSuite } from '../test/helpers';
import * as urbit from '../urbit';
import { finalizeAndSendPost, sendPost } from './postActions';
import { updateSession } from './session';
import { setUploadState } from './storage';

const TEST_CHANNEL = '~zod';
const LOCAL_URI = 'LOCAL_URI';
const REMOTE_URI = 'REMOTE_URI';

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
    updateSession(null);
  });

  test('queue post when session is inactive', async () => {
    vi.useFakeTimers();

    // explicitly clear session so we'll enqueue the post
    updateSession(null);

    const sendPostPromise = sendPost({
      channelId: TEST_CHANNEL,
      content: buildPostContent(),
    });
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
        path: `/v1/dm/${TEST_CHANNEL}/writs/newest/20/light`,
      })
    );
  });

  test('session dies during send poke', async () => {
    vi.useFakeTimers();

    // explicitly clear session so we'll enqueue the post
    updateSession(null);

    const sendPostPromise = sendPost({
      channelId: TEST_CHANNEL,
      content: buildPostContent(),
    });
    await vi.runOnlyPendingTimersAsync();
    expect(await fetchLatestPostFromDb()).toMatchObject({
      deliveryStatus: 'enqueued',
    });

    let failPoke: (reason?: unknown) => void = () => {};
    const mockedPoke = vi.mocked(poke).mockImplementation(async (payload) => {
      if (payload.app !== 'chat' || payload.mark !== 'chat-dm-action-1') {
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
      expect.objectContaining({ mark: 'chat-dm-action-1' })
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
    setUploadState(fakeAsset.file.uri, {
      status: 'uploading',
      localUri: fakeAsset.file.uri,
    });

    const sendPostPromise = finalizeAndSendPost({
      channelId: TEST_CHANNEL,
      content: [message],
      attachments: [fakeAsset],
      channelType: 'chat',
    });
    return {
      sendPostPromise,
      message,
      fakeAsset,
    };
  }

  test('happy path', async () => {
    const { sendPostPromise, message, fakeAsset } =
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
    setUploadState(fakeAsset.file.uri, {
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
    const { sendPostPromise, message, fakeAsset } =
      beginSendPostWithAttachments();
    await vi.runOnlyPendingTimersAsync();

    // simulate upload failure
    setUploadState(fakeAsset.file.uri, {
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
    const { sendPostPromise, message, fakeAsset } =
      beginSendPostWithAttachments();
    await vi.runOnlyPendingTimersAsync();

    // lose session
    updateSession(null);

    // but upload completes
    setUploadState(fakeAsset.file.uri, {
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
    const { sendPostPromise, fakeAsset } = beginSendPostWithAttachments();

    // immediately lose session so we enqueue the post
    updateSession({ channelStatus: 'reconnecting' });
    await vi.runOnlyPendingTimersAsync();

    // ensure we enqueued the send
    expect(await fetchLatestPostFromDb()).toMatchObject({
      deliveryStatus: 'enqueued',
    });

    // upload completes while session is still dead
    setUploadState(fakeAsset.file.uri, {
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
      setUploadState(post.attachment.file.uri, {
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
    setUploadState(postData[1].attachment.file.uri, {
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
    setUploadState(postData[0].attachment.file.uri, {
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

    setUploadState(postData[0].attachment!.file.uri, {
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

    setUploadState(postData[0].attachment!.file.uri, {
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

function buildPostContent(): urbit.Story {
  return [{ inline: [friendlyUniqueString()] }];
}
