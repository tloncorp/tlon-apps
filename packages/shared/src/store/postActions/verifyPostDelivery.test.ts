import * as api from '@tloncorp/api';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import * as db from '../../db';
import { setupDatabaseTestSuite } from '../../test/helpers';
import {
  DeletedPostState,
  subscribeToDeletedPosts,
} from '../useChannelPosts/subscriptions';
import { verifyPostDelivery } from './verifyPostDelivery';

const CHANNEL = 'chat/~zod/verify';

setupDatabaseTestSuite();

// A user can delete an in-flight send while it is still `pending`, so the
// delete-time hard-delete guard (which matches acknowledged delivery states)
// finds nothing. If that send later times out to `needs_verification` and
// verification confirms it landed, delivery resolves to `sent` HERE rather
// than through `markPostSent`. The settled-delete cleanup must run on this
// path too, or the row lingers as a live tombstone until remount.
describe('verifyPostDelivery settled-delete cleanup', () => {
  beforeEach(async () => {
    await db.insertChannels([db.buildChannel({ id: CHANNEL, type: 'chat' })]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function seedNeedsVerification(
    id: string,
    overrides: Partial<db.Post> = {}
  ): Promise<db.Post> {
    const post = {
      id,
      type: 'chat',
      channelId: CHANNEL,
      authorId: '~zod',
      sentAt: 1000,
      receivedAt: 1000,
      sequenceNum: 0,
      deliveryStatus: 'needs_verification',
      content: JSON.stringify([{ inline: ['delivered while sending'] }]),
      syncedAt: Date.now(),
      ...overrides,
    } as db.Post;
    await db.insertChannelPosts({ posts: [post] });
    return post;
  }

  test('hard-deletes a settled delete once verification confirms delivery', async () => {
    const post = await seedNeedsVerification('settled-delete-verified', {
      isDeleted: true,
      deleteStatus: 'sent',
    });
    vi.spyOn(api, 'getChannelPosts').mockResolvedValue({
      posts: [{ authorId: post.authorId, sentAt: post.sentAt } as db.Post],
      totalPosts: 1,
      numStubs: 0,
      numDeletes: 0,
      newestSequenceNum: null,
      older: null,
      newer: null,
    });

    const removed: string[] = [];
    const unsubscribe = subscribeToDeletedPosts(
      (id: string, state: DeletedPostState) => {
        if (state === 'removed') removed.push(id);
      }
    );

    const verified = await verifyPostDelivery(post);
    unsubscribe();

    expect(verified).toBe(true);
    expect(await db.getPost({ postId: post.id })).toBeNull();
    expect(removed).toContain(post.id);
  });

  test('leaves a live delivered post untouched', async () => {
    const post = await seedNeedsVerification('live-verified');
    vi.spyOn(api, 'getChannelPosts').mockResolvedValue({
      posts: [{ authorId: post.authorId, sentAt: post.sentAt } as db.Post],
      totalPosts: 1,
      numStubs: 0,
      numDeletes: 0,
      newestSequenceNum: null,
      older: null,
      newer: null,
    });

    const verified = await verifyPostDelivery(post);

    expect(verified).toBe(true);
    // Not a settled delete, so the cleanup guard leaves it in place; only the
    // delivery status advanced.
    expect(await db.getPost({ postId: post.id })).toMatchObject({
      id: post.id,
      deliveryStatus: 'sent',
    });
  });
});
