import {
  requestJson as apiRequestJson,
  deleteNotesNotebook,
  getGroup,
} from '@tloncorp/api';

import { commandError, errorMessage } from './commands/command';
import type { HttpMethod } from './commands/notes';
import type { NotesChannelDeps } from './notes-channel';

export function createNotesChannelDeps(): NotesChannelDeps {
  return {
    requestJson: async <T = unknown>(
      path: string,
      method: HttpMethod,
      body?: unknown
    ): Promise<T> => {
      try {
        return await apiRequestJson<T>(path, method, body);
      } catch (error) {
        throw commandError(errorMessage(error));
      }
    },
    getGroupChannelIds: async (groupId: string) => {
      const group = await getGroup(groupId);
      return (group.channels ?? []).map((channel) => channel.id);
    },
    // Already best-effort: the notesApi wrapper swallows and logs, which is
    // exactly what the post-create cleanup wants.
    deleteNotesNotebook: (nest: string) => deleteNotesNotebook(nest),
    sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: (message: string) => console.log(message),
  };
}
