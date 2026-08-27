import * as api from '@tloncorp/api';
import { afterEach, expect, test, vi } from 'vitest';

import * as schema from '../db/schema';
import { getClient, setupDatabaseTestSuite } from '../test/helpers';
import { updateGroupBlob } from './groupActions';

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
