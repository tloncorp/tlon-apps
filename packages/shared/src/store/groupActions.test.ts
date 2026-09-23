import * as api from '@tloncorp/api';
import { afterEach, expect, test, vi } from 'vitest';

import * as schema from '../db/schema';
import { getClient, setupDatabaseTestSuite } from '../test/helpers';
import { createGroupFromTemplate, updateGroupBlob } from './groupActions';

setupDatabaseTestSuite();

const groupId = '~bus/blob-actions';

async function insertGroup(blob: string | null) {
  const client = getClient();
  if (!client) throw new Error('test db not initialized');

  await client.insert(schema.groups).values({
    id: groupId,
    currentUserIsMember: true,
    currentUserIsHost: true,
    hostUserId: '~bus',
    blob,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

// The host's %blob arm short-circuits when the value is unchanged, emitting no
// update, so a tracked poke would wait out its 20s timeout and then roll back a
// write that was already correct. The action must not poke at all.
test('updateGroupBlob does not poke when the blob is unchanged', async () => {
  await insertGroup('{"k":1}');
  const updateGroupBlobApi = vi
    .spyOn(api, 'updateGroupBlob')
    .mockResolvedValue(undefined as never);

  await updateGroupBlob({ id: groupId } as never, '{"k":1}');

  expect(updateGroupBlobApi).not.toHaveBeenCalled();
});

test('updateGroupBlob does not poke when both sides are empty', async () => {
  await insertGroup(null);
  const updateGroupBlobApi = vi
    .spyOn(api, 'updateGroupBlob')
    .mockResolvedValue(undefined as never);

  await updateGroupBlob({ id: groupId } as never, null);

  expect(updateGroupBlobApi).not.toHaveBeenCalled();
});

test('updateGroupBlob pokes when the blob changes', async () => {
  await insertGroup('{"k":1}');
  const updateGroupBlobApi = vi
    .spyOn(api, 'updateGroupBlob')
    .mockResolvedValue(undefined as never);

  await updateGroupBlob({ id: groupId } as never, '{"k":2}');

  expect(updateGroupBlobApi).toHaveBeenCalledWith({
    groupId,
    blob: '{"k":2}',
  });
});

test('updateGroupBlob pokes when clearing an existing blob', async () => {
  await insertGroup('{"k":1}');
  const updateGroupBlobApi = vi
    .spyOn(api, 'updateGroupBlob')
    .mockResolvedValue(undefined as never);

  await updateGroupBlob({ id: groupId } as never, null);

  expect(updateGroupBlobApi).toHaveBeenCalledWith({ groupId, blob: null });
});

// A %notes notebook can't ride the %groups create poke; it has to be created
// against the %notes API once the group exists. Templates name 'notes' rather
// than the retired 'notebook' (%diary), so the split has to hold.
test('createGroupFromTemplate keeps notes out of the group poke and creates it after', async () => {
  const createGroupApi = vi
    .spyOn(api, 'createGroup')
    .mockImplementation(async ({ group }) => group);
  const createGroupNotebook = vi
    .spyOn(api.notes, 'createGroupNotebook')
    .mockResolvedValue({
      id: '~solfer-magfed/reviews',
      host: '~solfer-magfed',
      flagName: 'reviews',
      notebookId: 1,
      title: 'Reviews',
    });
  vi.spyOn(api, 'getGroup').mockImplementation(
    async (id) =>
      ({
        id,
        channels: [
          {
            id: 'notes/~solfer-magfed/reviews',
            title: 'Reviews',
            type: 'notes',
            groupId: id,
            currentUserIsMember: true,
            currentUserIsHost: true,
            contentConfiguration: { draftInput: 'disabled' },
            lastPostSequenceNum: 0,
            readerRoles: [],
          },
        ],
      }) as never
  );

  const group = await createGroupFromTemplate({ templateId: 'book-club' });

  const pokedChannels = createGroupApi.mock.calls[0][0].group.channels ?? [];
  expect(pokedChannels.map((channel) => channel.type)).toEqual([
    'chat',
    'gallery',
  ]);
  expect(createGroupNotebook).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Reviews' })
  );
  expect(group.channels?.map((channel) => channel.type)).toEqual([
    'chat',
    'gallery',
    'notes',
  ]);
});

// The group is already created by the time the notebook is attempted, so a
// failure there must not reject and leave the caller thinking nothing happened.
test('createGroupFromTemplate returns the group when its notebook fails', async () => {
  vi.spyOn(api, 'createGroup').mockImplementation(async ({ group }) => group);
  vi.spyOn(api.notes, 'createGroupNotebook').mockRejectedValue(
    new Error('create failed')
  );

  const group = await createGroupFromTemplate({ templateId: 'book-club' });

  expect(group.channels?.map((channel) => channel.type)).toEqual([
    'chat',
    'gallery',
  ]);
});
