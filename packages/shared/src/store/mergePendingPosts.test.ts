import { describe, expect, test } from 'vitest';

import { Post } from '../db';
import { mergePendingPosts } from './useMergePendingPosts';

function makePost(sentAt: number) {
  const id = `post-${sentAt}`;
  const post: Post = {
    id,
    type: 'chat',
    channelId: 'stub-channel',
    authorId: '~zod',
    sentAt,
    receivedAt: sentAt,
    content: null,
    deliveryStatus: 'sent',
    hidden: false,
  };
  return post;
}

describe('mergePendingPosts with hasNewest = true', () => {
  // Test Case: Simple merge
  test('should correctly interleave a newer pending post', () => {
    const existingPosts = [makePost(5), makePost(1)];
    const pendingPosts = [makePost(4)];

    const mergedSentAts = mergePendingPosts({
      pendingPosts,
      existingPosts,
      hasNewest: true,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([5, 4, 1]);
  });

  // Test Case: Pending posts are all newer than existing posts
  test('should insert all newer pending posts at the front', () => {
    const existingPosts = [makePost(3), makePost(2)];
    const pendingPosts = [makePost(5), makePost(4)];

    const mergedSentAts = mergePendingPosts({
      pendingPosts,
      existingPosts,
      hasNewest: true,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([5, 4, 3, 2]);
  });

  // Test Case: Deduplication with same sentAt
  test('should de-duplicate correctly, prioritizing the existing post', () => {
    const existingPosts = [makePost(3), makePost(2)];
    const pendingPosts = [makePost(4), makePost(3)]; // 3 is a duplicate

    const mergedSentAts = mergePendingPosts({
      pendingPosts,
      existingPosts,
      hasNewest: true,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([4, 3, 2]);
  });

  // Test Case: Pending posts older than the lowest existing post are filtered out
  test('should filter out pending posts with sentAts equal to or less than the lowest existing', () => {
    const existingPosts = [makePost(5), makePost(3)];
    const pendingPosts = [makePost(6), makePost(2), makePost(1)]; // 2 and 1 should be filtered

    const mergedSentAts = mergePendingPosts({
      pendingPosts,
      existingPosts,
      hasNewest: true,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([6, 5, 3]);
  });
});

describe('mergePendingPosts with hasNewest = false', () => {
  // Test Case: Pending posts newer than the newest existing post are filtered out
  test('should filter out pending posts newer than the highest existing post', () => {
    const existingPosts = [makePost(5), makePost(3), makePost(1)];
    const pendingPosts = [makePost(6), makePost(4), makePost(2)]; // 6 should be filtered out

    const mergedSentAts = mergePendingPosts({
      pendingPosts,
      existingPosts,
      hasNewest: false,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([5, 4, 3, 2, 1]);
  });

  // Test Case: Only pending posts within the existing posts' range are inserted
  test('should correctly interleave only pending posts within the sentAt window', () => {
    const existingPosts = [makePost(5), makePost(1)];
    const pendingPosts = [makePost(6), makePost(4), makePost(2)]; // 6 is filtered out

    const mergedSentAts = mergePendingPosts({
      pendingPosts,
      existingPosts,
      hasNewest: false,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([5, 4, 2, 1]);
  });

  // Test Case: Pending post older than lowest existing should still be filtered out
  test('should filter out pending posts older than the lowest existing, regardless of hasNewest', () => {
    const existingPosts = [makePost(5), makePost(3)];
    const pendingPosts = [makePost(6), makePost(2)]; // 6 filtered out, 2 filtered out

    const mergedSentAts = mergePendingPosts({
      pendingPosts,
      existingPosts,
      hasNewest: false,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([5, 3]);
  });
});

describe('mergePendingPosts Edge Cases', () => {
  // Test Case: `existingPosts` is empty
  test('should return all pending posts when existingPosts is empty', () => {
    const existingPosts: Post[] = [];
    const pendingPosts = [makePost(5), makePost(3)];

    const mergedSentAts = mergePendingPosts({
      pendingPosts,
      existingPosts,
      hasNewest: true,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([5, 3]);
  });

  // Test Case: `pendingPosts` is empty
  test('should return existing posts when pendingPosts is empty', () => {
    const existingPosts = [makePost(5), makePost(3)];
    const pendingPosts: Post[] = [];

    const mergedSentAts = mergePendingPosts({
      pendingPosts,
      existingPosts,
      hasNewest: true,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([5, 3]);
  });

  // Test Case: Both arrays are empty
  test('should return an empty array if both inputs are empty', () => {
    const existingPosts: Post[] = [];
    const pendingPosts: Post[] = [];

    const mergedSentAts = mergePendingPosts({
      pendingPosts,
      existingPosts,
      hasNewest: true,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([]);
  });

  // Test Case: No pending posts are relevant to the window after filtering
  test('should return only existing posts when all pending posts are filtered out', () => {
    const existingPosts = [makePost(5), makePost(3)];
    const pendingPosts = [makePost(1), makePost(0)]; // Both are filtered out

    const mergedSentAts = mergePendingPosts({
      pendingPosts,
      existingPosts,
      hasNewest: true,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([5, 3]);
  });
});
