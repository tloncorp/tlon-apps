import { describe, expect, test } from 'vitest';

import {
  getBotUserIdForUser,
  getChannelIdType,
  isBotUserIdForUser,
  isChannelId,
  isGroupChannelId,
} from '../client/apiUtils';

describe('bot user ids', () => {
  test('builds the bot user id for a user', () => {
    expect(getBotUserIdForUser('~zod')).toBe('~pinser-botter-zod');
    expect(getBotUserIdForUser('zod')).toBe('~pinser-botter-zod');
  });

  test('matches only the bot owned by the current user', () => {
    expect(isBotUserIdForUser('~pinser-botter-zod', '~zod')).toBe(true);
    expect(isBotUserIdForUser('pinser-botter-zod', 'zod')).toBe(true);
    expect(isBotUserIdForUser('~pinser-botter-marzod', '~zod')).toBe(false);
    expect(isBotUserIdForUser('~pinser-botter-zod', '')).toBe(false);
  });
});

describe('bucket channel ids', () => {
  const channelId = 'buckets/~zod/project-files';

  test('treats Buckets as group channels', () => {
    expect(isGroupChannelId(channelId)).toBe(true);
    expect(isChannelId(channelId)).toBe(true);
    expect(getChannelIdType(channelId)).toBe('channel');
  });
});
