import * as $ from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { poke, scry } from '../api/urbit';
import * as db from '../db';
import { getClient, setupDatabaseTestSuite } from '../test/helpers';
import * as urbit from '../urbit';
import { sendPost } from './postActions';
import { updateSession } from './session';

const TEST_CHANNEL = '~zod';
function buildPostContent(): urbit.Story {
  return [];
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
      // ensure we're looking at the correct poke
      expect(payload).toMatchObject({
        app: 'chat',
        mark: 'chat-dm-action-1',
      });
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

async function fetchLatestPostFromDb() {
  return (
    await getClient()
      ?.select()
      .from(db.schema.posts)
      .orderBy($.desc(db.schema.posts.sentAt))
      .limit(1)
      .execute()
  )?.at(0);
}
