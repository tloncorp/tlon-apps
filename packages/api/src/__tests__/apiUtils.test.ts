import { describe, expect, test } from 'vitest';

import { getBotUserIdForUser, isBotUserIdForUser } from '../client/apiUtils';

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
