import { type Mock, beforeEach, expect, test, vi } from 'vitest';

import { ThreadResponseBodyError } from '../http-api';
import type { Group } from '../types/models';
import { createGroup, getGroups, toGroupsUpdate } from './groupsApi';
import { scry, setGroupsSupportsBlob, thread } from './urbit';

vi.mock('./urbit', async () => {
  const actual = await vi.importActual<typeof import('./urbit')>('./urbit');
  return { ...actual, scry: vi.fn(), thread: vi.fn() };
});

const scryMock = scry as unknown as Mock;
const threadMock = thread as unknown as Mock;

const group: Group = {
  id: '~zod/test-group',
  title: 'Test group',
  currentUserIsMember: true,
  currentUserIsHost: true,
  hostUserId: '~zod',
};

beforeEach(() => {
  vi.clearAllMocks();
  setGroupsSupportsBlob(false);
});

test('createGroup does not recover when the thread times out before headers', async () => {
  threadMock.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

  await expect(createGroup({ group })).rejects.toThrow('Aborted');

  // The create thread may still be creating channels, so the group must not
  // be scried and returned merely because its record already exists.
  expect(scryMock).not.toHaveBeenCalled();
});

test('createGroup recovers only when a response body stalls after headers', async () => {
  setGroupsSupportsBlob(true);
  threadMock.mockRejectedValue(new ThreadResponseBodyError(new Error('Abort')));
  scryMock.mockRejectedValue(new Error('Group not found'));

  await expect(createGroup({ group })).rejects.toBeInstanceOf(
    ThreadResponseBodyError
  );

  expect(scryMock).toHaveBeenCalledWith({
    app: 'groups',
    path: '/v3/ui/groups/~zod/test-group',
  });
});

// The blob rides the v3 group surfaces only. A backend that predates it never
// serves /v3, so the client must stay on /v2 until app-info sync confirms the
// groups version — otherwise every group read 404s against an un-OTA'd ship.
test('group scries fall back to v2 until the backend is known to carry the blob', async () => {
  setGroupsSupportsBlob(false);
  scryMock.mockResolvedValue({});

  await getGroups();
  expect(scryMock).toHaveBeenLastCalledWith({
    app: 'groups',
    path: '/v2/groups',
  });

  setGroupsSupportsBlob(true);
  await getGroups();
  expect(scryMock).toHaveBeenLastCalledWith({
    app: 'groups',
    path: '/v3/groups',
  });
});

test('toGroupsUpdate maps blob responses to editGroupBlob', () => {
  expect(
    toGroupsUpdate({
      flag: '~zod/test-group',
      'r-group': { blob: '{"custom":"payload"}' },
    })
  ).toEqual({
    type: 'editGroupBlob',
    groupId: '~zod/test-group',
    blob: '{"custom":"payload"}',
  });

  expect(
    toGroupsUpdate({
      flag: '~zod/test-group',
      'r-group': { blob: null },
    })
  ).toEqual({
    type: 'editGroupBlob',
    groupId: '~zod/test-group',
    blob: null,
  });
});
