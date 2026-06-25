import { deleteNotesNotebookStrict, getGroup, notesV1 } from '@tloncorp/api';

import { commandError, errorMessage } from './commands/command';
import type { NotesChannelDeps } from './notes-channel';

export function createNotesChannelDeps(): NotesChannelDeps {
  return {
    createGroupNotesNotebook: async (input) => {
      try {
        return await notesV1.createGroupNotebook(input);
      } catch (error) {
        throw commandError(errorMessage(error));
      }
    },
    getGroupChannelIds: async (groupId: string) => {
      const group = await getGroup(groupId);
      return (group.channels ?? []).map((channel) => channel.id);
    },
    // Strict: propagate failures so the create flow can report whether the
    // rollback actually removed the stray notebook.
    deleteNotesNotebookStrict: async (nest: string) => {
      await deleteNotesNotebookStrict(nest);
    },
    sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: (message: string) => console.log(message),
  };
}
