import { expect, test } from 'vitest';

import type * as db from '../../db';
import {
  canonicalShipId,
  reduceSurfaceChannel,
  toSurfacePostView,
} from './adapter';

const SPEC = {
  version: 1 as const,
  surfaceId: 'srf-a',
  specRevision: 1,
  bundle: {
    assetRef: 'https://x/b',
    sha256: 'a'.repeat(64),
    size: 64,
    shellVersion: 1,
  },
  initialState: { votes: {}, title: 'initial' },
  actions: {
    vote: {
      ops: [{ op: 'set' as const, path: '/votes/$actor', value: 'yes' }],
    },
  },
};

function post(
  authorId: string,
  entry: unknown,
  overrides: Partial<db.Post> = {}
): db.Post {
  return {
    id: `post-${Math.random()}`,
    type: 'chat',
    channelId: 'chat/~zod/dash',
    sentAt: 0,
    receivedAt: 0,
    authorId,
    sequenceNum: (overrides.sequenceNum as number) ?? 1,
    blob: JSON.stringify([entry]),
    ...overrides,
  } as db.Post;
}

const hostEvent = {
  type: 'surface-event',
  version: 1,
  surfaceId: 'srf-a',
  specRevision: 1,
  mode: 'host',
  ops: [{ op: 'set', path: '/title', value: 'set by host' }],
};

const invokeEvent = {
  type: 'surface-event',
  version: 1,
  surfaceId: 'srf-a',
  specRevision: 1,
  mode: 'invoke',
  actionId: 'vote',
};

test('canonicalShipId normalizes sig, case, and whitespace', () => {
  expect(canonicalShipId('~zod')).toBe('~zod');
  expect(canonicalShipId('zod')).toBe('~zod');
  expect(canonicalShipId('~ZOD')).toBe('~zod');
  expect(canonicalShipId(' ~Sampel-Palnet ')).toBe('~sampel-palnet');
  expect(canonicalShipId('sampel-palnet')).toBe('~sampel-palnet');
  expect(canonicalShipId('')).toBe('');
});

test('host events fold when the author is non-canonical for the channel host', () => {
  const result = reduceSurfaceChannel({
    channelId: 'chat/~zod/dash',
    spec: SPEC,
    posts: [post('ZOD', hostEvent, { sequenceNum: 1 })],
  });
  expect(result.status).toBe('reduced');
  if (result.status === 'reduced') {
    expect(result.state.title).toBe('set by host');
  }
});

test('non-host authors stay non-host after canonicalization', () => {
  const result = reduceSurfaceChannel({
    channelId: 'chat/~zod/dash',
    spec: SPEC,
    posts: [post('~ten', hostEvent, { sequenceNum: 1 })],
  });
  expect(result.status).toBe('reduced');
  if (result.status === 'reduced') {
    expect(result.state.title).toBe('initial');
  }
});

test('$actor keys use the canonical ship string', () => {
  const result = reduceSurfaceChannel({
    channelId: 'chat/~zod/dash',
    spec: SPEC,
    posts: [
      post('TEN', invokeEvent, { sequenceNum: 1 }),
      // the same ship in a different casing overwrites, not duplicates
      post('~ten', invokeEvent, { sequenceNum: 2 }),
    ],
  });
  expect(result.status).toBe('reduced');
  if (result.status === 'reduced') {
    expect(result.state.votes).toEqual({ '~ten': 'yes' });
  }
});

test('toSurfacePostView carries the reducer-relevant fields through', () => {
  const view = toSurfacePostView(
    post('Bus', invokeEvent, {
      sequenceNum: 7,
      isEdited: true,
      isDeleted: false,
    })
  );
  expect(view).toMatchObject({
    authorId: '~bus',
    sequenceNum: 7,
    isEdited: true,
    isDeleted: false,
  });
  expect(typeof view.blob).toBe('string');
});

test('posts with a missing author never fold', () => {
  const result = reduceSurfaceChannel({
    channelId: 'chat/~zod/dash',
    spec: SPEC,
    posts: [
      post(null as unknown as string, hostEvent, { sequenceNum: 1 }),
      post(undefined as unknown as string, invokeEvent, { sequenceNum: 2 }),
    ],
  });
  expect(result.status).toBe('reduced');
  if (result.status === 'reduced') {
    expect(result.state).toEqual(SPEC.initialState);
  }
});
