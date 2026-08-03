import { type Mock, beforeEach, expect, test, vi } from 'vitest';

import { ThreadResponseBodyError } from '../http-api';
import type { Group } from '../types/models';
import {
  createGroup,
  subscribeGroups,
  toGroupsUpdate,
  updateGroupMeta,
} from './groupsApi';
import { scry, subscribe, thread, trackedPoke } from './urbit';

vi.mock('./urbit', async () => {
  const actual = await vi.importActual<typeof import('./urbit')>('./urbit');
  return {
    ...actual,
    scry: vi.fn(),
    thread: vi.fn(),
    subscribe: vi.fn(),
    trackedPoke: vi.fn(),
  };
});

const scryMock = scry as unknown as Mock;
const subscribeMock = subscribe as unknown as Mock;
const trackedPokeMock = trackedPoke as unknown as Mock;
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

// A trackedPoke resolves only when its watch endpoint receives an event, and
// events arrive solely through that endpoint's own subscription. So the lane
// tracked pokes watch must be the lane we subscribe to, or every group
// mutation hangs until it times out and throws.
test('tracked group pokes watch the lane subscribeGroups subscribes to', async () => {
  subscribeMock.mockResolvedValue(1);
  trackedPokeMock.mockResolvedValue(undefined);

  await subscribeGroups(() => {});
  const subscribedPaths = subscribeMock.mock.calls
    .map(([endpoint]) => endpoint.path)
    .filter((path: string) => path.endsWith('/groups'));

  await updateGroupMeta({
    groupId: '~zod/test-group',
    meta: { title: 't', description: '', image: '', cover: '' },
  });
  const [, watchEndpoint] = trackedPokeMock.mock.calls[0];

  expect(subscribedPaths).toContain(watchEndpoint.path);
});
