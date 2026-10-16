import {
  addReaction as apiAddReaction,
  deletePost as apiDeletePost,
  deleteReply as apiDeleteReply,
  editPost as apiEditPost,
  getChannelPosts as apiGetChannelPosts,
  getCurrentUserId as apiGetCurrentUserId,
  getPostWithReplies as apiGetPostWithReplies,
  removeReaction as apiRemoveReaction,
  sendPost as apiSendPost,
  sendReply as apiSendReply,
  setOrder as apiSetOrder,
  toPostContent,
} from '@tloncorp/api';
import { ensureClient, normalizeShip } from './api-client';
import { getChannelState } from './channel-state-runtime';
import type { BotAuthorProfile } from './bot-profile-flags';
import { parseNest } from './cli-utils';
import { commandError, errorMessage } from './commands/command';
import type {
  ExistingReply,
  ExistingThread,
  PostDeleteInput,
  PostEditInput,
  PostLookupQuery,
  PostReactionInput,
  PostReactionRemoveInput,
  PostReplyInput,
  PostSendInput,
  PostThreadQuery,
  PostsDeps,
  ReplyDeleteInput,
} from './commands/posts';
import { assertActingShipCanAdminister } from './group-admin';
import { fetchImageVerse } from './image-attach';
import type { Story } from './markdown';
import { createProcessCommandDeps } from './runtime-deps';

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeysDeep(record[key])])
    );
  }
  return value;
}

// A structural key for post content: object keys sorted at every depth, array
// order kept, undefined fields dropped. The desk re-encodes content in its own
// key order (e.g. an image block's `src`/`alt`/`width`/`height`), so a plain
// JSON string comparison would never match a correctly applied edit.
export function canonicalContentKey(content: unknown): string {
  const plain: unknown = JSON.parse(JSON.stringify(content ?? null));
  return JSON.stringify(sortKeysDeep(plain));
}

// The content key the CLI expects to read back for a story it sends: the same
// `toPostContent` projection the api applies to a stored reply.
export function contentKeyOfStory(story: Story): string {
  return canonicalContentKey(toPostContent(story)[0]);
}

// A read-back reply's `content` is the JSON string `toPostReplyData` built from
// `toPostContent(essay.content)[0]`.
function replyContentKey(content: unknown): string {
  if (typeof content !== 'string') {
    return canonicalContentKey(content);
  }
  try {
    return canonicalContentKey(JSON.parse(content));
  } catch {
    return content;
  }
}

interface ReplyRecord {
  id: string;
  authorId: string;
  sentAt: number;
  content?: unknown;
  isBot?: boolean | null;
  botProfile?: BotAuthorProfile | null;
  isDeleted?: boolean | null;
  blob?: string | null;
}

export function toExistingThread(post: {
  id: string;
  authorId: string;
  isDeleted?: boolean | null;
  replies?: ReplyRecord[] | null;
}): ExistingThread {
  return {
    id: post.id,
    authorId: post.authorId,
    isDeleted: post.isDeleted,
    replies: (post.replies ?? []).map(
      (reply): ExistingReply => ({
        id: reply.id,
        authorId: reply.authorId,
        sentAt: reply.sentAt,
        isBot: reply.isBot,
        botProfile: reply.botProfile,
        isDeleted: reply.isDeleted,
        blob: reply.blob,
        contentKey: replyContentKey(reply.content ?? null),
      })
    ),
  };
}

export function createPostsDeps(): PostsDeps {
  return {
    ...createProcessCommandDeps(),
    authenticate: async (apps) => {
      await ensureClient(apps);
    },
    getCurrentUserId: () => apiGetCurrentUserId(),
    now: () => Date.now(),
    buildImageVerse: (url: string) => fetchImageVerse(url),
    getChannelState,
    assertCanAdminister: async (
      groupId: string,
      action: string,
      nest: string
    ) => {
      // Mirrors `is-admin` in desk/lib/channel-utils.hoon: the ship hosting
      // the channel administers it regardless of its group roles.
      if (
        normalizeShip(parseNest(nest).host) ===
        normalizeShip(apiGetCurrentUserId())
      ) {
        return;
      }
      try {
        await assertActingShipCanAdminister(groupId, action);
      } catch (error) {
        throw commandError(errorMessage(error));
      }
    },
    contentKeyOf: contentKeyOfStory,
    postsApi: {
      addReaction: async (input: PostReactionInput) => {
        try {
          await apiAddReaction(input);
        } catch (error) {
          throw commandError(errorMessage(error));
        }
      },
      removeReaction: async (input: PostReactionRemoveInput) => {
        try {
          await apiRemoveReaction(input);
        } catch (error) {
          throw commandError(errorMessage(error));
        }
      },
      deletePost: async (input: PostDeleteInput) => {
        try {
          await apiDeletePost(input.channelId, input.postId, input.authorId);
        } catch (error) {
          throw commandError(errorMessage(error));
        }
      },
      editPost: async (input: PostEditInput) => {
        try {
          await apiEditPost(input);
        } catch (error) {
          throw commandError(errorMessage(error));
        }
      },
      sendPost: async (input: PostSendInput) => {
        try {
          await apiSendPost(input);
        } catch (error) {
          throw commandError(errorMessage(error));
        }
      },
      sendReply: async (input: PostReplyInput) => {
        try {
          await apiSendReply(input);
        } catch (error) {
          throw commandError(errorMessage(error));
        }
      },
      // Thin lookup: the around-cursor query and exact-match/null-on-error
      // logic live in the pure command module (fetchExistingPost).
      getChannelPosts: (query: PostLookupQuery) => apiGetChannelPosts(query),
      // Raw like getChannelPosts: the command decides what a failed read means.
      getPostWithReplies: async (query: PostThreadQuery) =>
        toExistingThread(
          await apiGetPostWithReplies({
            channelId: query.channelId,
            postId: query.postId,
            authorId: apiGetCurrentUserId(),
          })
        ),
      deleteReply: async (input: ReplyDeleteInput) => {
        try {
          await apiDeleteReply(input);
        } catch (error) {
          throw commandError(errorMessage(error));
        }
      },
      setOrder: async (channelId: string, order: string[]) => {
        try {
          await apiSetOrder(channelId, order);
        } catch (error) {
          throw commandError(errorMessage(error));
        }
      },
    },
  };
}
