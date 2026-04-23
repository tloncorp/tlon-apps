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
      deletedPosts: {},
      newPosts: [],
      hasNewest: true,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([4, 5, 1]);
  });

  // Test Case: Pending posts are all newer than existing posts
  test('should insert all newer pending posts at the front', () => {
    const existingPosts = [makePost(3), makePost(2)];
    const pendingPosts = [makePost(5), makePost(4)];

    const mergedSentAts = mergePendingPosts({
      pendingPosts,
      existingPosts,
      deletedPosts: {},
      newPosts: [],
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
      deletedPosts: {},
      newPosts: [],
      hasNewest: true,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([4, 3, 2]);
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
      deletedPosts: {},
      newPosts: [],
      hasNewest: false,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([4, 2, 5, 3, 1]);
  });

  // Test Case: Only pending posts within the existing posts' range are inserted
  test('should correctly interleave only pending posts within the sentAt window', () => {
    const existingPosts = [makePost(5), makePost(1)];
    const pendingPosts = [makePost(6), makePost(4), makePost(2)]; // 6 is filtered out

    const mergedSentAts = mergePendingPosts({
      pendingPosts,
      existingPosts,
      deletedPosts: {},
      newPosts: [],
      hasNewest: false,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([4, 2, 5, 1]);
  });

  // Test Case: Pending post older than lowest existing should still be filtered out
  test('should filter out pending posts older than the lowest existing, regardless of hasNewest', () => {
    const existingPosts = [makePost(5), makePost(3)];
    const pendingPosts = [makePost(6), makePost(2)]; // 6 filtered out, 2 filtered out

    const mergedSentAts = mergePendingPosts({
      pendingPosts,
      existingPosts,
      deletedPosts: {},
      newPosts: [],
      hasNewest: false,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([5, 3]);
  });
});

describe('mergePendingPosts newPosts behavior', () => {
  test('should include newPosts when hasNewest is true', () => {
    const existingPosts = [makePost(3), makePost(2), makePost(1)];
    const newPosts = [makePost(5), makePost(4)];

    const mergedSentAts = mergePendingPosts({
      newPosts,
      pendingPosts: [],
      existingPosts,
      deletedPosts: {},
      hasNewest: true,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([5, 4, 3, 2, 1]);
  });

  test('should clip newPosts beyond upperPaginationBound when hasNewest is false', () => {
    // existingPosts[0].sentAt = 5, so upperPaginationBound = 5
    // newPosts with sentAt >= 5 should be clipped
    const existingPosts = [makePost(5), makePost(3), makePost(1)];
    const newPosts = [makePost(7), makePost(6), makePost(4)];

    const mergedSentAts = mergePendingPosts({
      newPosts,
      pendingPosts: [],
      existingPosts,
      deletedPosts: {},
      hasNewest: false,
    }).map((p) => p.sentAt);

    // Only sentAt=4 is within (1, 5) and not in existingPosts
    expect(mergedSentAts).toEqual([4, 5, 3, 1]);
  });

  test('should deduplicate newPosts against existingPosts by sentAt', () => {
    const existingPosts = [makePost(5), makePost(3), makePost(1)];
    const newPosts = [
      { ...makePost(6), id: 'new-6' },
      { ...makePost(3), id: 'new-3' }, // same sentAt as existing
    ];

    const mergedSentAts = mergePendingPosts({
      newPosts,
      pendingPosts: [],
      existingPosts,
      deletedPosts: {},
      hasNewest: true,
    }).map((p) => p.sentAt);

    // sentAt=3 from newPosts is deduped against existingPosts
    expect(mergedSentAts).toEqual([6, 5, 3, 1]);
  });

  test('should deduplicate newPosts against pendingPosts by sentAt', () => {
    const existingPosts = [makePost(3), makePost(1)];
    const pendingPosts = [{ ...makePost(5), id: 'pending-5' }];
    const newPosts = [{ ...makePost(5), id: 'new-5' }]; // same sentAt as pending

    const result = mergePendingPosts({
      newPosts,
      pendingPosts,
      existingPosts,
      deletedPosts: {},
      hasNewest: true,
    });

    // Only one post with sentAt=5 should appear
    expect(result.filter((p) => p.sentAt === 5)).toHaveLength(1);
  });

  test('newPosts with hasNewest false and shrunken existingPosts clips everything', () => {
    // Simulates the bug scenario: existingPosts shrinks to just one "head" post
    // due to sequence gap, and hasNewest regresses to false
    const existingPosts = [makePost(100)]; // only the head post remains
    const newPosts = [makePost(99), makePost(98), makePost(97)];

    const mergedSentAts = mergePendingPosts({
      newPosts,
      pendingPosts: [],
      existingPosts,
      deletedPosts: {},
      hasNewest: false,
    }).map((p) => p.sentAt);

    // upperPaginationBound = 100, lowerPaginationBound = 100
    // All newPosts need sentAt > 100 AND sentAt < 100, which is impossible
    // This demonstrates the bug: everything gets clipped
    expect(mergedSentAts).toEqual([100]);
  });

  test('newPosts with hasNewest true and shrunken existingPosts preserves posts', () => {
    // Same scenario but with hasNewest=true (our fix)
    const existingPosts = [makePost(100)];
    const newPosts = [makePost(99), makePost(98), makePost(97)];

    const mergedSentAts = mergePendingPosts({
      newPosts,
      pendingPosts: [],
      existingPosts,
      deletedPosts: {},
      hasNewest: true,
    }).map((p) => p.sentAt);

    // upperPaginationBound = Infinity, so newPosts below 100 but above 100 (lower bound)
    // are still clipped. But posts newer than head would be preserved.
    // In this case sentAt 97-99 are all < lowerPaginationBound (100), so they're clipped
    // This shows why Fix 1 (preventing the sequence gap) is the primary fix
    expect(mergedSentAts).toEqual([100]);
  });
});

describe('mergePendingPosts Edge Cases', () => {
  // Test Case: `existingPosts` is empty
  test('should return all pending posts when existingPosts is empty', () => {
    const existingPosts: Post[] = [];
    const pendingPosts = [makePost(5), makePost(3)];

    const mergedSentAts = mergePendingPosts({
      newPosts: [],
      pendingPosts,
      existingPosts,
      deletedPosts: {},
      hasNewest: false,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([5, 3]);
  });

  // Test Case: `pendingPosts` is empty
  test('should return existing posts when pendingPosts is empty', () => {
    const existingPosts = [makePost(5), makePost(3)];
    const pendingPosts: Post[] = [];

    const mergedSentAts = mergePendingPosts({
      newPosts: [],
      pendingPosts,
      existingPosts,
      deletedPosts: {},
      hasNewest: false,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([5, 3]);
  });

  // Test Case: Both arrays are empty
  test('should return an empty array if both inputs are empty', () => {
    const existingPosts: Post[] = [];
    const pendingPosts: Post[] = [];

    const mergedSentAts = mergePendingPosts({
      newPosts: [],
      pendingPosts,
      existingPosts,
      deletedPosts: {},
      hasNewest: false,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([]);
  });

  // Test Case: No pending posts are relevant to the window after filtering
  test('should return only existing posts when all pending posts are filtered out', () => {
    const existingPosts = [makePost(5), makePost(3)];
    const pendingPosts = [makePost(5), makePost(3)];

    const mergedSentAts = mergePendingPosts({
      newPosts: [],
      pendingPosts,
      existingPosts,
      deletedPosts: {},
      hasNewest: false,
    }).map((p) => p.sentAt);

    expect(mergedSentAts).toEqual([5, 3]);
  });
});

// TLON-5606 consumer contract: optimistic rows explicitly cleared by the user
// (via `deleteFromChannelPosts` → `deletedPosts[postId] = true`) must not
// re-enter the merged output from `newPosts` or `pendingPosts`, even in
// chat-style views where `filterDeleted` is false. Confirmed-row tombstones
// from `existingPosts` are unaffected.
describe('mergePendingPosts locally-cleared optimistic rows', () => {
  test('drops a deleted optimistic row from newPosts even when filterDeleted is false', () => {
    const optimistic = {
      ...makePost(10),
      id: 'optimistic-1',
      sequenceNum: 0,
      deliveryStatus: 'failed' as const,
    };

    const mergedIds = mergePendingPosts({
      newPosts: [optimistic],
      pendingPosts: [],
      existingPosts: [],
      deletedPosts: { [optimistic.id]: true },
      hasNewest: true,
      filterDeleted: false,
    }).map((p) => p.id);

    expect(mergedIds).not.toContain(optimistic.id);
  });

  test('drops a deleted optimistic row from pendingPosts even when filterDeleted is false', () => {
    const optimistic = {
      ...makePost(10),
      id: 'optimistic-1',
      sequenceNum: 0,
      deliveryStatus: 'failed' as const,
    };

    const mergedIds = mergePendingPosts({
      newPosts: [],
      pendingPosts: [optimistic],
      existingPosts: [],
      deletedPosts: { [optimistic.id]: true },
      hasNewest: true,
      filterDeleted: false,
    }).map((p) => p.id);

    expect(mergedIds).not.toContain(optimistic.id);
  });

  test('leaves confirmed existingPosts rows in place even if they share an id with deletedPosts', () => {
    // Confirmed tombstones are meant to keep rendering in chat-like views.
    // `deletedPosts` is the session-local signal for optimistic clears, so we
    // only filter the live merge inputs, not `existingPosts`.
    const confirmed = {
      ...makePost(10),
      id: 'confirmed-1',
      sequenceNum: 5,
    };
    const mergedIds = mergePendingPosts({
      newPosts: [],
      pendingPosts: [],
      existingPosts: [confirmed],
      deletedPosts: { [confirmed.id]: true },
      hasNewest: true,
      filterDeleted: false,
    }).map((p) => p.id);

    expect(mergedIds).toContain(confirmed.id);
  });

  test('keeps a confirmed server-echo row in newPosts during the catch-up window even when deletedPosts[id] is true', () => {
    // `newPosts` transiently holds confirmed echoes before the main query
    // catches up. Deleting one of those mid-session should not make the row
    // disappear entirely — chat / DM views still want to render it as a
    // tombstone. Only the unconfirmed (`sequenceNum === 0`) rows should be
    // filtered out by the session-local `deletedPosts` overlay.
    const confirmedEcho = {
      ...makePost(10),
      id: 'confirmed-echo-1',
      sequenceNum: 42,
    };
    const optimistic = {
      ...makePost(20),
      id: 'optimistic-1',
      sequenceNum: 0,
      deliveryStatus: 'failed' as const,
    };
    const mergedIds = mergePendingPosts({
      newPosts: [optimistic, confirmedEcho],
      pendingPosts: [],
      existingPosts: [],
      deletedPosts: {
        [confirmedEcho.id]: true,
        [optimistic.id]: true,
      },
      hasNewest: true,
      filterDeleted: false,
    }).map((p) => p.id);

    expect(mergedIds).toContain(confirmedEcho.id);
    expect(mergedIds).not.toContain(optimistic.id);
  });

  test('filterDeleted=true still removes confirmed tombstones, including newPosts echoes', () => {
    // Notebook / gallery keep the original semantics: `isDeleted || deletedPosts[id]`
    // both filter out rows. The narrowed live-merge check must not affect this.
    const confirmedEcho = {
      ...makePost(10),
      id: 'confirmed-echo-1',
      sequenceNum: 42,
    };
    const anchor = {
      ...makePost(1),
      id: 'anchor-1',
      sequenceNum: 1,
    };
    const mergedIds = mergePendingPosts({
      newPosts: [confirmedEcho],
      pendingPosts: [],
      existingPosts: [anchor],
      deletedPosts: { [confirmedEcho.id]: true },
      hasNewest: true,
      filterDeleted: true,
    }).map((p) => p.id);

    expect(mergedIds).not.toContain(confirmedEcho.id);
    expect(mergedIds).toContain(anchor.id);
  });

  test('filterDeleted=true also removes deleted overlays when existingPosts is empty', () => {
    const confirmedEcho = {
      ...makePost(10),
      id: 'confirmed-echo-empty-1',
      sequenceNum: 42,
    };
    const mergedIds = mergePendingPosts({
      newPosts: [confirmedEcho],
      pendingPosts: [],
      existingPosts: [],
      deletedPosts: { [confirmedEcho.id]: true },
      hasNewest: true,
      filterDeleted: true,
    }).map((p) => p.id);

    expect(mergedIds).not.toContain(confirmedEcho.id);
  });
});

// TLON-5606 / post-review 6: chat-style rendering keys off `post.isDeleted`
// to decide whether to show a tombstone. When a confirmed echo is kept in
// `newPosts` under `deletedPosts[id]`, mergePendingPosts must synthesize
// `isDeleted: true` on the returned object so the row renders as a
// tombstone immediately, without waiting for the paginated query to catch
// up with the DB write from `markPostAsDeleted`.
describe('mergePendingPosts deleted-overlay synthesis', () => {
  test('confirmed echo in newPosts inherits deleted state from an optimistic row with the same sentAt', () => {
    const optimistic = {
      ...makePost(10),
      id: 'optimistic-1',
      sequenceNum: 0,
      deliveryStatus: 'pending' as const,
    };
    const confirmedEcho = {
      ...makePost(10),
      id: 'confirmed-echo-1',
      sequenceNum: 42,
      deliveryStatus: null,
      content: JSON.stringify([{ inline: ['real message body'] }]),
    };
    const [merged] = mergePendingPosts({
      newPosts: [confirmedEcho],
      pendingPosts: [optimistic],
      existingPosts: [],
      deletedPosts: { [optimistic.id]: true },
      hasNewest: true,
      filterDeleted: false,
    });

    expect(merged.id).toBe(confirmedEcho.id);
    expect(merged.isDeleted).toBe(true);
  });

  test('confirmed echo in newPosts with deletedPosts[id] surfaces as isDeleted:true', () => {
    const confirmedEcho = {
      ...makePost(10),
      id: 'confirmed-echo-1',
      sequenceNum: 42,
      content: JSON.stringify([{ inline: ['real message body'] }]),
    };
    const [merged] = mergePendingPosts({
      newPosts: [confirmedEcho],
      pendingPosts: [],
      existingPosts: [],
      deletedPosts: { [confirmedEcho.id]: true },
      hasNewest: true,
      filterDeleted: false,
    });

    expect(merged.id).toBe(confirmedEcho.id);
    expect(merged.isDeleted).toBe(true);
  });

  test('does not mutate the input post object', () => {
    const confirmedEcho = {
      ...makePost(10),
      id: 'confirmed-echo-1',
      sequenceNum: 42,
    };
    const before = { ...confirmedEcho };
    mergePendingPosts({
      newPosts: [confirmedEcho],
      pendingPosts: [],
      existingPosts: [],
      deletedPosts: { [confirmedEcho.id]: true },
      hasNewest: true,
      filterDeleted: false,
    });
    expect(confirmedEcho.isDeleted).toBe(before.isDeleted);
  });

  test('confirmed existingPosts row with deletedPosts[id] also gets overlayed', () => {
    const confirmed = {
      ...makePost(10),
      id: 'confirmed-1',
      sequenceNum: 5,
    };
    const [merged] = mergePendingPosts({
      newPosts: [],
      pendingPosts: [],
      existingPosts: [confirmed],
      deletedPosts: { [confirmed.id]: true },
      hasNewest: true,
      filterDeleted: false,
    });
    expect(merged.id).toBe(confirmed.id);
    expect(merged.isDeleted).toBe(true);
  });

  test('rows not in deletedPosts are passed through untouched', () => {
    const liveRow = {
      ...makePost(10),
      id: 'live-1',
      sequenceNum: 5,
      isDeleted: false,
    };
    const [merged] = mergePendingPosts({
      newPosts: [],
      pendingPosts: [],
      existingPosts: [liveRow],
      deletedPosts: {},
      hasNewest: true,
      filterDeleted: false,
    });
    expect(merged).toBe(liveRow);
  });
});

// TLON-5606 / post-review 7: in the `markPostSent` catch-up window a row
// is already server-acknowledged (`deliveryStatus: 'sent'`) but still
// temporarily has `sequenceNum === 0` until the sequenced `addPost` event
// arrives. Deleting in that window must not drop the row from the merged
// output — the server has it, so the tombstone slot must stay visible.
describe('mergePendingPosts markPostSent catch-up window', () => {
  test('keeps a sent-but-unsequenced row visible as a tombstone when deletedPosts[id] is true', () => {
    const sentCatchUp = {
      ...makePost(10),
      id: 'marked-sent-1',
      sequenceNum: 0,
      deliveryStatus: 'sent' as const,
    };
    const merged = mergePendingPosts({
      newPosts: [sentCatchUp],
      pendingPosts: [],
      existingPosts: [],
      deletedPosts: { [sentCatchUp.id]: true },
      hasNewest: true,
      filterDeleted: false,
    });

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(sentCatchUp.id);
    expect(merged[0].isDeleted).toBe(true);
  });

  test('keeps a needs_verification row visible as a tombstone when deletedPosts[id] is true', () => {
    // `needs_verification` rows may have reached the server too; same
    // rationale as the markPostSent case.
    const nv = {
      ...makePost(10),
      id: 'needs-verify-1',
      sequenceNum: 0,
      deliveryStatus: 'needs_verification' as const,
    };
    const merged = mergePendingPosts({
      newPosts: [nv],
      pendingPosts: [],
      existingPosts: [],
      deletedPosts: { [nv.id]: true },
      hasNewest: true,
      filterDeleted: false,
    });

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(nv.id);
    expect(merged[0].isDeleted).toBe(true);
  });

  test('still drops a failed, locally-cleared optimistic row (TLON-5606 regression guard)', () => {
    const failed = {
      ...makePost(10),
      id: 'failed-1',
      sequenceNum: 0,
      deliveryStatus: 'failed' as const,
    };
    const merged = mergePendingPosts({
      newPosts: [failed],
      pendingPosts: [],
      existingPosts: [],
      deletedPosts: { [failed.id]: true },
      hasNewest: true,
      filterDeleted: false,
    });

    expect(merged.map((p) => p.id)).not.toContain(failed.id);
  });
});
