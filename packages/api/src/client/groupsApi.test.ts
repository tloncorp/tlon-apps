import { type Mock, beforeEach, expect, test, vi } from 'vitest';

import { ThreadResponseBodyError } from '../http-api';
import type { Group } from '../types/models';
import { createGroup } from './groupsApi';
import { scry, thread } from './urbit';

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
    path: '/v2/ui/groups/~zod/test-group',
  });
});
