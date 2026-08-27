import * as api from '@tloncorp/api';
import { beforeEach, expect, test, vi } from 'vitest';

import { buildSurfaceInvokeBlob, sendSurfaceInvoke } from './invoke';

vi.mock('@tloncorp/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tloncorp/api')>();
  return {
    ...actual,
    sendPost: vi.fn().mockResolvedValue(undefined),
    getCurrentUserId: vi.fn().mockReturnValue('~ten'),
  };
});

const sendPostMock = api.sendPost as unknown as ReturnType<typeof vi.fn>;

const SPEC = {
  version: 1 as const,
  surfaceId: 'srf-poll',
  specRevision: 5,
  bundle: {
    assetRef: 'https://x/b',
    sha256: 'a'.repeat(64),
    size: 64,
    shellVersion: 1,
  },
  initialState: {},
  actions: { vote: { ops: [] } },
};

beforeEach(() => {
  sendPostMock.mockClear();
});

test('buildSurfaceInvokeBlob makes a single valid invoke entry', () => {
  const blob = buildSurfaceInvokeBlob({
    surfaceId: 'srf-poll',
    specRevision: 5,
    actionId: 'vote',
  });
  expect(blob).not.toBeNull();
  expect(JSON.parse(blob!)).toEqual([
    {
      type: 'surface-event',
      version: 1,
      surfaceId: 'srf-poll',
      specRevision: 5,
      mode: 'invoke',
      actionId: 'vote',
    },
  ]);
});

test('buildSurfaceInvokeBlob refuses a malformed actionId', () => {
  expect(
    buildSurfaceInvokeBlob({
      surfaceId: 'srf-poll',
      specRevision: 5,
      actionId: 'Not Valid!',
    })
  ).toBeNull();
});

test('sendSurfaceInvoke posts one entry under the surface/event kind tail', async () => {
  await sendSurfaceInvoke({
    channelId: 'chat/~zod/dash',
    spec: SPEC,
    actionId: 'vote',
  });
  expect(sendPostMock).toHaveBeenCalledTimes(1);
  const call = sendPostMock.mock.calls[0][0];
  expect(call.channelId).toBe('chat/~zod/dash');
  expect(call.kindTail).toBe('surface/event');
  expect(call.authorId).toBe('~ten');
  // stamped from the spec, not any message
  expect(JSON.parse(call.blob)).toEqual([
    expect.objectContaining({
      mode: 'invoke',
      actionId: 'vote',
      specRevision: 5,
    }),
  ]);
  // fallback Story present so pre-surface clients degrade to a chat message
  expect(Array.isArray(call.content)).toBe(true);
  expect(JSON.stringify(call.content)).toContain('Update Tlon');
});

test('sendSurfaceInvoke never posts a malformed invoke', async () => {
  await sendSurfaceInvoke({
    channelId: 'chat/~zod/dash',
    spec: SPEC,
    actionId: 'BAD ID',
  });
  expect(sendPostMock).not.toHaveBeenCalled();
});
