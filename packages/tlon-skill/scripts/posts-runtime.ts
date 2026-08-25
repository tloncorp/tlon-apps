import {
  addReaction as apiAddReaction,
  deletePost as apiDeletePost,
  editPost as apiEditPost,
  getChannelPosts as apiGetChannelPosts,
  getCurrentUserId as apiGetCurrentUserId,
  removeReaction as apiRemoveReaction,
  sendPost as apiSendPost,
  sendReply as apiSendReply,
} from '@tloncorp/api';

import { ensureClient } from './api-client';
import { commandError, errorMessage } from './commands/command';
import type {
  PostDeleteInput,
  PostEditInput,
  PostLookupQuery,
  PostReactionInput,
  PostReactionRemoveInput,
  PostReplyInput,
  PostSendInput,
  PostsDeps,
} from './commands/posts';
import { fetchImageVerse } from './image-attach';
import { botMoon } from './moon';

function createProcessCommandDeps() {
  return {
    stdout: (text: string) => process.stdout.write(text),
    stderr: (text: string) => process.stderr.write(text),
  };
}

// Identity-attributed channel writes would be authored as the HOST when the
// skill runs as a bot moon; the harness's message tool is the path that posts
// as the bot. Guarded here at the impure boundary so the pure command module
// stays env-free.
function assertNotBotMoon(action: string): void {
  if (botMoon()) {
    throw commandError(
      `${action} would be attributed to the host, not the bot; ` +
        'use the message tool, which posts as the bot identity'
    );
  }
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
    postsApi: {
      addReaction: async (input: PostReactionInput) => {
        assertNotBotMoon('reacting in a channel');
        try {
          await apiAddReaction(input);
        } catch (error) {
          throw commandError(errorMessage(error));
        }
      },
      removeReaction: async (input: PostReactionRemoveInput) => {
        assertNotBotMoon('removing a channel reaction');
        try {
          await apiRemoveReaction(input);
        } catch (error) {
          throw commandError(errorMessage(error));
        }
      },
      deletePost: async (input: PostDeleteInput) => {
        assertNotBotMoon('deleting a channel post');
        try {
          await apiDeletePost(input.channelId, input.postId, input.authorId);
        } catch (error) {
          throw commandError(errorMessage(error));
        }
      },
      editPost: async (input: PostEditInput) => {
        assertNotBotMoon('editing a channel post');
        try {
          await apiEditPost(input);
        } catch (error) {
          throw commandError(errorMessage(error));
        }
      },
      sendPost: async (input: PostSendInput) => {
        assertNotBotMoon('posting in a channel');
        try {
          await apiSendPost(input);
        } catch (error) {
          throw commandError(errorMessage(error));
        }
      },
      sendReply: async (input: PostReplyInput) => {
        assertNotBotMoon('replying in a channel');
        try {
          await apiSendReply(input);
        } catch (error) {
          throw commandError(errorMessage(error));
        }
      },
      // Thin lookup: the around-cursor query and exact-match/null-on-error
      // logic live in the pure command module (fetchExistingPost).
      getChannelPosts: (query: PostLookupQuery) => apiGetChannelPosts(query),
    },
  };
}
