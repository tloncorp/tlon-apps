import {
  editPost as apiEditPost,
  getChannelPosts,
  getPostWithReplies,
} from '@tloncorp/api';
import {
  type ParticipantAgentActivityProjectionV1,
  ParticipantAgentActivityProjectionV1Schema,
} from '@tloncorp/api/client/participantAgentActivity';

import type { BotProfile } from './urbit/send.js';
import { allocateChannelSentAt, sendChannelPost } from './urbit/send.js';
import type { Story } from './urbit/story.js';

export type GroupAgentActivityPost = {
  postId: string;
  sentAt: number;
  parentId?: string;
};

export type GroupAgentActivityPostDraft = {
  conversationId: string;
  authorId: string;
  parentId?: string;
  story: Story;
  blob: string;
  participantActivity: ParticipantAgentActivityProjectionV1;
  botProfile?: BotProfile;
};

export type GroupAgentActivityTransport = {
  create: (
    draft: GroupAgentActivityPostDraft
  ) => Promise<GroupAgentActivityPost>;
  update: (
    post: GroupAgentActivityPost,
    draft: GroupAgentActivityPostDraft
  ) => Promise<void>;
  resolve: (
    sentAt: number,
    draft: Pick<
      GroupAgentActivityPostDraft,
      'conversationId' | 'authorId' | 'parentId'
    > &
      Pick<GroupAgentActivityPostDraft, 'participantActivity'>
  ) => Promise<GroupAgentActivityPost>;
};

const DEFAULT_RESOLVE_DELAYS_MS = [0, 100, 300, 1_000, 2_000] as const;
const DEFAULT_RESOLVE_PAGE_SIZE = 100;
const DEFAULT_MAX_RESOLVE_PAGES = 10;
const RESERVED_SENT_AT_TTL_MS = 60 * 60_000;
const MAX_RESERVED_SENT_AT_ENTRIES = 1_000;

function normalizedShip(ship: string) {
  return ship.trim().replace(/^~/, '').toLowerCase();
}

function delay(ms: number) {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function participantActivityFromBlob(
  blob: string | null | undefined
): ParticipantAgentActivityProjectionV1 | null {
  if (!blob) {
    return null;
  }
  try {
    const entries: unknown = JSON.parse(blob);
    if (!Array.isArray(entries)) {
      return null;
    }
    const projections: ParticipantAgentActivityProjectionV1[] = [];
    for (const entry of entries) {
      if (
        !entry ||
        typeof entry !== 'object' ||
        (entry as { type?: unknown }).type !== 'tlon-context-lens' ||
        (entry as { version?: unknown }).version !== 1
      ) {
        continue;
      }
      const parsed = ParticipantAgentActivityProjectionV1Schema.safeParse(
        (entry as { participantActivity?: unknown }).participantActivity
      );
      if (parsed.success) {
        projections.push(parsed.data);
      }
    }
    // A carrier/final post is protocol-owned by exactly one projection. Fail
    // closed when a malformed combined blob would make correlation depend on
    // entry order.
    return projections.length === 1 ? projections[0] : null;
  } catch {
    // Malformed unrelated post blobs are not correlation candidates.
  }
  return null;
}

function hasExpectedParticipantActivity(
  blob: string | null | undefined,
  expected: ParticipantAgentActivityProjectionV1
) {
  const actual = participantActivityFromBlob(blob);
  return Boolean(actual && JSON.stringify(actual) === JSON.stringify(expected));
}

function hasExpectedParticipantActivityIdentity(
  blob: string | null | undefined,
  expected: ParticipantAgentActivityProjectionV1
) {
  const actual = participantActivityFromBlob(blob);
  return Boolean(
    actual &&
      actual.publicRunId === expected.publicRunId &&
      actual.surface === expected.surface &&
      actual.triggerPostId === expected.triggerPostId
  );
}

type ResolvablePost = {
  id: string;
  authorId: string;
  sentAt: number;
  blob?: string | null;
};

function findCreatedPost(
  candidates: readonly ResolvablePost[],
  params: {
    authorId: string;
    sentAt: number;
    participantActivity: ParticipantAgentActivityProjectionV1;
  }
) {
  return candidates.find(
    (candidate) =>
      normalizedShip(candidate.authorId) === normalizedShip(params.authorId) &&
      candidate.sentAt === params.sentAt &&
      hasExpectedParticipantActivityIdentity(
        candidate.blob,
        params.participantActivity
      )
  );
}

async function resolveCreatedPost(params: {
  conversationId: string;
  authorId: string;
  sentAt: number;
  parentId?: string;
  participantActivity: ParticipantAgentActivityProjectionV1;
  delaysMs: readonly number[];
  pageSize: number;
  maxPages: number;
}) {
  let lastError: unknown;
  for (const delayMs of params.delaysMs) {
    await delay(delayMs);
    try {
      if (params.parentId) {
        const candidates =
          (
            await getPostWithReplies({
              channelId: params.conversationId,
              postId: params.parentId,
              // Channel reply lookup does not use the parent author, but the API
              // keeps it required for the DM variants of the same endpoint.
              authorId: params.authorId,
            })
          ).replies ?? [];
        const match = findCreatedPost(candidates, params);
        if (match) {
          return match.id;
        }
        continue;
      }

      let cursor: string | undefined;
      for (let page = 0; page < params.maxPages; page += 1) {
        const response = await getChannelPosts({
          channelId: params.conversationId,
          mode: cursor ? 'older' : 'newest',
          ...(cursor ? { cursor } : {}),
          count: params.pageSize,
          skipGapFill: true,
        });
        const match = findCreatedPost(response.posts, params);
        if (match) {
          return match.id;
        }
        if (!response.older || response.older === cursor) {
          break;
        }
        cursor = response.older;
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Could not resolve agent activity post sent at ${params.sentAt}`,
    {
      ...(lastError ? { cause: lastError } : {}),
    }
  );
}

async function confirmUpdatedPost(params: {
  post: GroupAgentActivityPost;
  draft: GroupAgentActivityPostDraft;
  delaysMs: readonly number[];
}) {
  let lastError: unknown;
  for (const delayMs of params.delaysMs) {
    await delay(delayMs);
    try {
      const candidate = params.post.parentId
        ? (
            await getPostWithReplies({
              channelId: params.draft.conversationId,
              postId: params.post.parentId,
              authorId: params.draft.authorId,
            })
          ).replies?.find((reply) => reply.id === params.post.postId)
        : await getPostWithReplies({
            channelId: params.draft.conversationId,
            postId: params.post.postId,
            authorId: params.draft.authorId,
          });
      if (
        candidate &&
        normalizedShip(candidate.authorId) ===
          normalizedShip(params.draft.authorId) &&
        candidate.sentAt === params.post.sentAt &&
        hasExpectedParticipantActivity(
          candidate.blob,
          params.draft.participantActivity
        )
      ) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Could not confirm agent activity post ${params.post.postId}`,
    {
      ...(lastError ? { cause: lastError } : {}),
    }
  );
}

/**
 * Channel posts are the authorization boundary for participant activity: the
 * host applies the channel's reader roles to both root posts and thread
 * replies. The create poke returns no host seal id, so resolve that id by the
 * bot-authored essay's exact `sent` timestamp before editing it.
 */
export function createTlonGroupAgentActivityTransport(options?: {
  resolveDelaysMs?: readonly number[];
  resolvePageSize?: number;
  maxResolvePages?: number;
}): GroupAgentActivityTransport {
  const resolveDelaysMs = options?.resolveDelaysMs ?? DEFAULT_RESOLVE_DELAYS_MS;
  const resolvePageSize = Math.max(
    1,
    options?.resolvePageSize ?? DEFAULT_RESOLVE_PAGE_SIZE
  );
  const maxResolvePages = Math.max(
    1,
    options?.maxResolvePages ?? DEFAULT_MAX_RESOLVE_PAGES
  );
  // Reuse the same host-deduplication timestamp if a create poke fails after
  // remote acceptance. Retrying with a fresh timestamp could create a second
  // carrier for the same public run.
  const reservedSentAtByRunId = new Map<
    string,
    { sentAt: number; reservedAt: number }
  >();

  const reservedSentAt = (publicRunId: string) => {
    const now = Date.now();
    for (const [candidateRunId, reservation] of reservedSentAtByRunId) {
      if (now - reservation.reservedAt >= RESERVED_SENT_AT_TTL_MS) {
        reservedSentAtByRunId.delete(candidateRunId);
      }
    }
    const existing = reservedSentAtByRunId.get(publicRunId);
    if (existing) {
      return existing.sentAt;
    }
    while (reservedSentAtByRunId.size >= MAX_RESERVED_SENT_AT_ENTRIES) {
      const oldestRunId = reservedSentAtByRunId.keys().next().value;
      if (typeof oldestRunId !== 'string') break;
      reservedSentAtByRunId.delete(oldestRunId);
    }
    const sentAt = allocateChannelSentAt();
    reservedSentAtByRunId.set(publicRunId, { sentAt, reservedAt: now });
    return sentAt;
  };

  const ensureResolved = async (
    post: GroupAgentActivityPost,
    draft: Pick<
      GroupAgentActivityPostDraft,
      'conversationId' | 'authorId' | 'parentId' | 'participantActivity'
    >
  ) => {
    if (post.postId) {
      return post;
    }
    const resolved = await resolveCreatedPost({
      conversationId: draft.conversationId,
      authorId: draft.authorId,
      sentAt: post.sentAt,
      parentId: post.parentId ?? draft.parentId,
      participantActivity: draft.participantActivity,
      delaysMs: resolveDelaysMs,
      pageSize: resolvePageSize,
      maxPages: maxResolvePages,
    });
    // Keep the publisher's retained object usable for every later edit.
    post.postId = resolved;
    reservedSentAtByRunId.delete(draft.participantActivity.publicRunId);
    return post;
  };

  return {
    async create(draft) {
      const publicRunId = draft.participantActivity.publicRunId;
      const sentAt = reservedSentAt(publicRunId);
      let acceptedSentAt = sentAt;
      try {
        const sent = await sendChannelPost({
          fromShip: draft.authorId,
          nest: draft.conversationId,
          story: draft.story,
          blob: draft.blob,
          replyToId: draft.parentId,
          botProfile: draft.botProfile,
          sentAt,
        });
        acceptedSentAt = sent.sentAt;
      } catch (sendError) {
        // The poke can reach the channel host even when its HTTP response is
        // lost. Resolve before retrying so an uncertain acknowledgement does
        // not create a second visible carrier.
        try {
          const postId = await resolveCreatedPost({
            conversationId: draft.conversationId,
            authorId: draft.authorId,
            sentAt,
            parentId: draft.parentId,
            participantActivity: draft.participantActivity,
            delaysMs: resolveDelaysMs,
            pageSize: resolvePageSize,
            maxPages: maxResolvePages,
          });
          reservedSentAtByRunId.delete(publicRunId);
          return {
            postId,
            sentAt,
            ...(draft.parentId ? { parentId: draft.parentId } : {}),
          };
        } catch {
          throw sendError;
        }
      }
      let postId = '';
      try {
        postId = await resolveCreatedPost({
          conversationId: draft.conversationId,
          authorId: draft.authorId,
          sentAt: acceptedSentAt,
          parentId: draft.parentId,
          participantActivity: draft.participantActivity,
          delaysMs: resolveDelaysMs,
          pageSize: resolvePageSize,
          maxPages: maxResolvePages,
        });
      } catch {
        // The post itself was accepted. Retain an unresolved handle so a
        // delayed host index cannot make the next progress event send a
        // duplicate carrier; update/remove will resolve it again.
      }
      if (postId) {
        reservedSentAtByRunId.delete(publicRunId);
      }
      return {
        postId,
        sentAt: acceptedSentAt,
        ...(draft.parentId ? { parentId: draft.parentId } : {}),
      };
    },

    async update(post, draft) {
      const resolved = await ensureResolved(post, draft);
      await apiEditPost({
        channelId: draft.conversationId,
        postId: resolved.postId,
        authorId: draft.authorId,
        sentAt: post.sentAt,
        content: draft.story,
        blob: draft.blob,
        parentId: post.parentId,
        botProfile: draft.botProfile,
      });
      await confirmUpdatedPost({
        post: resolved,
        draft,
        delaysMs: resolveDelaysMs,
      });
    },

    async resolve(sentAt, draft) {
      const postId = await resolveCreatedPost({
        conversationId: draft.conversationId,
        authorId: draft.authorId,
        sentAt,
        parentId: draft.parentId,
        participantActivity: draft.participantActivity,
        delaysMs: resolveDelaysMs,
        pageSize: resolvePageSize,
        maxPages: maxResolvePages,
      });
      return {
        postId,
        sentAt,
        ...(draft.parentId ? { parentId: draft.parentId } : {}),
      };
    },
  };
}
