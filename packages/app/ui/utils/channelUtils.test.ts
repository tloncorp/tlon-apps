import type * as db from '@tloncorp/shared/db';
import { expect, test, vi } from 'vitest';

import { getChannelActionCapabilities } from './channelUtils';

// Only the module's other helpers use these, and they pull in expo at import
// time.
vi.mock('@tloncorp/shared', () => ({}));
vi.mock('@tloncorp/shared/store', () => ({}));
vi.mock('../contexts/appDataContext', () => ({}));

function channelOfType(type: db.Channel['type']): db.Channel {
  return { id: `${type}/~zod/test`, type } as db.Channel;
}

test('a Bucket channel can be deleted but not left', () => {
  const capabilities = getChannelActionCapabilities(channelOfType('buckets'));

  expect(capabilities.canDelete).toBe(true);
  expect(capabilities.canLeave).toBe(false);
  expect(capabilities.deleteDescription).toMatch(/cannot be undone/);
});

test('chat and notes channels can be deleted and left', () => {
  for (const type of ['chat', 'notes'] as const) {
    const capabilities = getChannelActionCapabilities(channelOfType(type));

    expect(capabilities.canDelete).toBe(true);
    expect(capabilities.canLeave).toBe(true);
  }
});

test('no channel offers nothing', () => {
  const capabilities = getChannelActionCapabilities(null);

  expect(capabilities.canDelete).toBe(false);
  expect(capabilities.canLeave).toBe(false);
});
