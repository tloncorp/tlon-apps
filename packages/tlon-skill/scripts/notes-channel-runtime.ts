import { NotesV1PendingWriteError, getGroup, notesV1 } from '@tloncorp/api';

import { commandError, errorMessage } from './commands/command';
import { assertGroupAdminAccess } from './group-admin-runtime';
import type { NotesChannelDeps } from './notes-channel';
import { pendingWriteCommandErrorMessage } from './notes-pending-write';

export function mapGroupChannelIds(group: unknown, groupId: string): string[] {
  if (!group || typeof group !== 'object') {
    throw new Error(`Group ${groupId}: group response is malformed`);
  }
  const channels = (group as { channels?: unknown }).channels;
  if (!Array.isArray(channels)) {
    throw new Error(`Group ${groupId}: channels array is missing or malformed`);
  }
  if (
    channels.some(
      (channel) =>
        !channel ||
        typeof channel !== 'object' ||
        typeof (channel as { id?: unknown }).id !== 'string'
    )
  ) {
    throw new Error(`Group ${groupId}: channel id is missing or malformed`);
  }
  return channels.map((channel) => (channel as { id: string }).id);
}

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
    assertCanAdministerGroup: (groupId: string) =>
      assertGroupAdminAccess(groupId, 'create a Notebook channel'),
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
      return mapGroupChannelIds(group, groupId);
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
