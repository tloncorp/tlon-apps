import { NotesV1PendingWriteError, getGroup, notesV1 } from '@tloncorp/api';

import { commandError, errorMessage } from './commands/command';
import type { NotesChannelDeps } from './notes-channel';
import { pendingWriteCommandErrorMessage } from './notes-pending-write';

export function mapChannelReaders(
  channel: { readerRoles?: Array<{ roleId: string }> | null } | undefined,
  nest: string,
  groupId: string
): string[] | null {
  if (!channel) return null;
  if (!Array.isArray(channel.readerRoles)) {
    throw new Error(
      `Channel ${nest} in group ${groupId}: readerRoles field is missing or malformed — refusing to assume open`
    );
  }
  if (
    channel.readerRoles.some(
      (reader) =>
        !reader ||
        typeof reader !== 'object' ||
        typeof reader.roleId !== 'string'
    )
  ) {
    throw new Error(
      `Channel ${nest} in group ${groupId}: readerRoles entries are malformed — refusing to assume open`
    );
  }
  return channel.readerRoles.map((r) => r.roleId);
}

export function createNotesChannelDeps(): NotesChannelDeps {
  return {
    createGroupNotesNotebook: async (input) => {
      try {
        return await notesV1.createGroupNotebook(input);
      } catch (error) {
        if (error instanceof NotesV1PendingWriteError) {
          throw commandError(pendingWriteCommandErrorMessage(error));
        }
        throw commandError(errorMessage(error));
      }
    },
    getGroupChannelIds: async (groupId: string) => {
      const group = await getGroup(groupId);
      return (group.channels ?? []).map((channel) => channel.id);
    },
    getChannelReaders: async (groupId: string, nest: string) => {
      const group = await getGroup(groupId);
      const channel = (group.channels ?? []).find((c) => c.id === nest);
      return mapChannelReaders(channel, nest, groupId);
    },
    sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: (message: string) => console.log(message),
  };
}
