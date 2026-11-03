import { describe, expect, test } from 'vitest';

import {
  getBotUserIdForUser,
  getChannelIdType,
  isBotUserIdForUser,
  isChannelId,
  isGroupChannelId,
  isMoonOfUser,
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

describe('isMoonOfUser', () => {
  test('matches moons of the user, sigged or not', () => {
    expect(isMoonOfUser('~dirmec-dolbes-sampel-palnet', '~sampel-palnet')).toBe(
      true
    );
    expect(isMoonOfUser('dirmec-dolbes-sampel-palnet', 'sampel-palnet')).toBe(
      true
    );
    expect(isMoonOfUser('~pinser-botter-sampel-palnet', '~sampel-palnet')).toBe(
      true
    );
  });

  test('rejects the user itself, unrelated ships, and empty input', () => {
    expect(isMoonOfUser('~sampel-palnet', '~sampel-palnet')).toBe(false);
    expect(isMoonOfUser('~finned-palmer', '~sampel-palnet')).toBe(false);
    expect(isMoonOfUser('~dirmec-dolbes-finned-palmer', '~sampel-palnet')).toBe(
      false
    );
    expect(isMoonOfUser(null, '~sampel-palnet')).toBe(false);
    expect(isMoonOfUser('~dirmec-dolbes-sampel-palnet', '')).toBe(false);
  });

  test('rejects comets whose name textually ends with the planet name', () => {
    expect(
      isMoonOfUser(
        '~racmus-mollen-fallyt-linpex--watres-sibbur-sampel-palnet',
        '~sampel-palnet'
      )
    ).toBe(false);
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
