import { type Mock, beforeEach, expect, test, vi } from 'vitest';

import { ThreadResponseBodyError } from '../http-api';
import type { Group } from '../types/models';
import { createGroup, getGroups, toV1GroupsUpdate } from './groupsApi';
import { BadResponseError, scry, thread } from './urbit';

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
});

test('createGroup does not recover when the thread times out before headers', async () => {
  threadMock.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

  await expect(createGroup({ group })).rejects.toThrow('Aborted');

  // The create thread may still be creating channels, so the group must not
  // be scried and returned merely because its record already exists.
  expect(scryMock).not.toHaveBeenCalled();
});

test('createGroup recovers only when a response body stalls after headers', async () => {
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

test('toV1GroupsUpdate maps blob responses to editGroupBlob', () => {
  expect(
    toV1GroupsUpdate({
      flag: '~zod/test-group',
      'r-group': { blob: '{"custom":"payload"}' },
    })
  ).toEqual({
    type: 'editGroupBlob',
    groupId: '~zod/test-group',
    blob: '{"custom":"payload"}',
  });

  expect(
    toV1GroupsUpdate({
      flag: '~zod/test-group',
      'r-group': { blob: null },
    })
  ).toEqual({
    type: 'editGroupBlob',
    groupId: '~zod/test-group',
    blob: null,
  });
});

test('getGroups falls back to the v2 scry when v3 is unavailable', async () => {
  scryMock.mockRejectedValueOnce(new BadResponseError(404, 'missing'));
  scryMock.mockResolvedValueOnce({});

  await expect(getGroups()).resolves.toEqual([]);

  expect(scryMock).toHaveBeenNthCalledWith(1, {
    app: 'groups',
    path: '/v3/groups',
  });
  expect(scryMock).toHaveBeenNthCalledWith(2, {
    app: 'groups',
    path: '/v2/groups',
  });
});
