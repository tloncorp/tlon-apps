import {
  addReaction as apiAddReaction,
  deletePost as apiDeletePost,
  editPost as apiEditPost,
  getChannelPosts as apiGetChannelPosts,
  getCurrentUserId as apiGetCurrentUserId,
  removeReaction as apiRemoveReaction,
} from '@tloncorp/api';
import * as fs from 'fs';

import { ensureClient } from './api-client';
import { commandError, errorMessage } from './commands/command';
import type {
  PostDeleteInput,
  PostEditInput,
  PostLookupQuery,
  PostReactionInput,
  PostReactionRemoveInput,
  PostsDeps,
} from './commands/posts';

function createProcessCommandDeps() {
  return {
    stdout: (text: string) => process.stdout.write(text),
    stderr: (text: string) => process.stderr.write(text),
  };
}

export function createPostsDeps(): PostsDeps {
  return {
    ...createProcessCommandDeps(),
    authenticate: async () => {
      await ensureClient(['channels']);
    },
    getCurrentUserId: () => apiGetCurrentUserId(),
    now: () => Date.now(),
    readFile: (path: string) => fs.readFileSync(path, 'utf-8'),
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
      // Thin lookup: the around-cursor query and exact-match/null-on-error
      // logic live in the pure command module (fetchExistingPost).
      getChannelPosts: (query: PostLookupQuery) => apiGetChannelPosts(query),
    },
  };
}
