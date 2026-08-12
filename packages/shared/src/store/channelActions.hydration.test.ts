import { beforeEach, expect, test, vi } from 'vitest';

import { hydrateExistingNotesChannel } from './channelActions';

const mocks = vi.hoisted(() => ({
  insertGroups: vi.fn(),
  insertChannelPerms: vi.fn(),
}));

vi.mock('../db', () => ({
  insertGroups: mocks.insertGroups,
  insertChannelPerms: mocks.insertChannelPerms,
}));

vi.mock('./notesActions', () => ({
  syncNotesNotebook: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test('hydrates an ambiguously created notes channel from the remote group', async () => {
  const remoteNotebook = {
    id: 'notes/~solfer-magfed/native-notes',
    type: 'notes',
    groupId: '~zod/stale-notify',
    readerRoles: [{ roleId: 'member' }],
    writerRoles: [{ roleId: 'admin' }],
  };
  const remoteGroup = {
    id: '~zod/stale-notify',
    channels: [remoteNotebook],
  };

  await expect(hydrateExistingNotesChannel(remoteGroup as never)).resolves.toBe(
    remoteNotebook
  );
  expect(mocks.insertGroups).toHaveBeenCalledWith({ groups: [remoteGroup] });
  expect(mocks.insertChannelPerms).toHaveBeenCalledWith([
    {
      channelId: remoteNotebook.id,
      readers: ['member'],
      writers: ['admin'],
    },
  ]);
});

test('does nothing when the remote group has no notes channel', async () => {
  await expect(
    hydrateExistingNotesChannel({
      id: '~zod/stale-notify',
      channels: [],
    } as never)
  ).resolves.toBeNull();
  expect(mocks.insertGroups).not.toHaveBeenCalled();
  expect(mocks.insertChannelPerms).not.toHaveBeenCalled();
});
