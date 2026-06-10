import {
  addReaction as apiAddReaction,
  getCurrentUserId as apiGetCurrentUserId,
} from '@tloncorp/api';

import { ensureClient } from './api-client';
import { commandError, errorMessage } from './commands/command';
import type { PostReactionInput, PostsDeps } from './commands/posts';

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
    postsApi: {
      addReaction: async (input: PostReactionInput) => {
        try {
          await apiAddReaction(input);
        } catch (error) {
          throw commandError(errorMessage(error));
        }
      },
    },
  };
}
