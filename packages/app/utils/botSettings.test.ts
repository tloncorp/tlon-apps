import { Platform } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBotEnabled } from './botSettings';

const account = vi.hoisted(() => ({
  hosted: true,
  // What the stored flag reads as: false until hosting has answered.
  hostingBotEnabled: false,
  botDm: undefined as
    | { type: string; isPendingChannel?: boolean; isDmInvite?: boolean }
    | undefined,
}));

vi.mock('@tloncorp/api', () => ({
  getCurrentUserIsHosted: () => account.hosted,
  getBotUserIdForUser: (id: string) =>
    id ? `~pinser-botter-${id.replace(/^~/, '')}` : '',
}));
vi.mock('@tloncorp/shared/db', () => ({
  hostingBotEnabled: { useValue: () => account.hostingBotEnabled },
}));
vi.mock('@tloncorp/shared/store', () => ({
  useChannel: ({ id }: { id: string }) => ({
    data: id === '~pinser-botter-sampel-palnet' ? account.botDm : undefined,
  }),
}));
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUserId: () => '~sampel-palnet',
}));

const platform = Platform as { OS: string };
const startedOn = platform.OS;

beforeEach(() => {
  account.hosted = true;
  account.hostingBotEnabled = false;
  account.botDm = undefined;
});

afterEach(() => {
  platform.OS = startedOn;
});

// Every hook inside is stood in for above, so this runs as a plain function.
describe('useBotEnabled', () => {
  describe('on a phone', () => {
    beforeEach(() => {
      platform.OS = 'ios';
    });

    it('is off until hosting has said the bot is on', () => {
      expect(useBotEnabled()).toBe(false);
    });

    it('is on once hosting says so', () => {
      account.hostingBotEnabled = true;
      expect(useBotEnabled()).toBe(true);
    });

    it('is off for an account that is not hosted, whatever is stored', () => {
      account.hosted = false;
      account.hostingBotEnabled = true;
      expect(useBotEnabled()).toBe(false);
    });

    it('does not go by a DM with the bot', () => {
      account.botDm = { type: 'dm' };
      expect(useBotEnabled()).toBe(false);
    });
  });

  describe('on web, where there is no hosting session', () => {
    beforeEach(() => {
      platform.OS = 'web';
    });

    it('is on for a hosted account with an accepted DM with its bot', () => {
      account.botDm = { type: 'dm' };
      expect(useBotEnabled()).toBe(true);
    });

    it('is off with no DM, or one not yet accepted', () => {
      expect(useBotEnabled()).toBe(false);
      account.botDm = { type: 'dm', isDmInvite: true };
      expect(useBotEnabled()).toBe(false);
      account.botDm = { type: 'dm', isPendingChannel: true };
      expect(useBotEnabled()).toBe(false);
    });

    it('is off for an account that is not hosted', () => {
      account.hosted = false;
      account.botDm = { type: 'dm' };
      expect(useBotEnabled()).toBe(false);
    });
  });
});
