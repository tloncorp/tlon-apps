import { describe, expect, it } from 'vitest';

import * as db from '../db';
import { GroupPrivacy } from '../db/schema';
import { PersonalGroupSlugs } from '../domain';
import { getModelAnalytics, normalizeUrbitColor } from './utils';
import { isPersonalGroup } from './wayfinding';

describe('normalizeUrbitColor', () => {
  describe('the user submits a color hex value with one or more leading zeroes', () => {
    it('normalizes @ux values of color hexes for all zeroes', () => {
      expect(normalizeUrbitColor('0x0')).toEqual('#000000');
    });

    it('normalizes @ux values of color hexes with 5 leading zeros', () => {
      expect(normalizeUrbitColor('0xf')).toEqual('#00000F');
    });

    it('normalizes @ux values of color hexes with 4 leading zeros', () => {
      expect(normalizeUrbitColor('0xff')).toEqual('#0000FF');
    });

    it('normalizes @ux values of color hexes with 3 leading zeros', () => {
      expect(normalizeUrbitColor('0xfff')).toEqual('#000FFF');
    });

    it('normalizes @ux values of color hexes with 2 leading zeros', () => {
      expect(normalizeUrbitColor('0xffff')).toEqual('#00FFFF');
    });

    it('normalizes @ux values of color hexes with 1 leading zero', () => {
      expect(normalizeUrbitColor('0xf.ffff')).toEqual('#0FFFFF');
    });
  });

  it('normalizes colors with a leading alpha char', () => {
    expect(normalizeUrbitColor('0xff.ffff')).toEqual('#FFFFFF');
  });

  it('normalizes colors with a leading 0', () => {
    expect(normalizeUrbitColor('0x00.0000')).toEqual('#000000');
  });

  it('passes through color hexes', () => {
    expect(normalizeUrbitColor('#ffffff')).toEqual('#ffffff');
  });
});

const channelId = 'chat/~nibset-napwyn/commons';
const groupId = '~nibset-napwyn/tlon';

const personalChatId = `chat/~nocsyx-lassul/${PersonalGroupSlugs.chatSlug}`;
const personalGroupId = `~nocsyx-lassul/${PersonalGroupSlugs.slug}`;
describe('getModelAnalytics', () => {
  it('returns an empty object if no properties are present', () => {
    expect(getModelAnalytics({})).toEqual({});
  });

  it('masks post ids correctly', () => {
    const input = {
      post: {
        sentAt: 1749568132744,
        channelId,
      } as Partial<db.Post>,
    };

    const expectedOutput = {
      postId: 'wmmjir',
      channelId: 'fre2st',
    };
    expect(getModelAnalytics(input)).toEqual(expectedOutput);
  });

  it('masks channel ids correctly', () => {
    const input = {
      channel: {
        id: channelId,
        type: 'chat' as db.ChannelType,
        groupId,
      } as Partial<db.Channel>,
    };
    const expectedOutput = {
      channelId: 'fre2st',
      channelType: 'chat',
      groupId: 'xi6yv7',
    };
    expect(getModelAnalytics(input)).toEqual(expectedOutput);
  });

  it('masks group ids correctly', () => {
    const input = {
      group: {
        id: groupId,
        channels: [
          {
            id: channelId,
          },
        ],
        privacy: 'public' as GroupPrivacy,
      } as Partial<db.Group>,
    };

    const expectedOutput = {
      groupId: 'xi6yv7',
      groupPrivacy: 'public',
      groupType: 'groupchat',
    };
    expect(getModelAnalytics(input)).toEqual(expectedOutput);
  });

  it("doesn't mask wayfinding group", () => {
    const input = {
      group: {
        id: personalGroupId,
        channels: [
          {
            id: personalChatId,
            type: 'chat' as db.ChannelType,
          },
        ],
        privacy: 'secret' as GroupPrivacy,
      },
    };
    const expectedOutput = {
      groupId: personalGroupId,
      groupPrivacy: 'secret',
      groupType: 'groupchat',
      isPersonalGroup: true,
    };
    expect(getModelAnalytics(input)).toEqual(expectedOutput);
  });

  it("doesn't mask wayfinding channel", () => {
    const input = {
      channel: {
        id: personalChatId,
        type: 'chat' as db.ChannelType,
        groupId: personalGroupId,
      },
    };
    const expectedOutput = {
      channelId: personalChatId,
      channelType: 'chat',
      groupId: personalGroupId,
      isPersonalGroup: true,
    };
    expect(getModelAnalytics(input)).toEqual(expectedOutput);
  });

  it("doesn't mask personal channel ids in posts", () => {
    const input = {
      post: {
        sentAt: 1749568132744,
        channelId: personalChatId,
      } as Partial<db.Post>,
    };

    const expectedOutput = {
      postId: 'wmmjir',
      channelId: personalChatId,
      isPersonalGroup: true,
    };
    expect(getModelAnalytics(input)).toEqual(expectedOutput);
  });

  it("doesn't mask Tlon Team DMs", () => {
    const input = {
      channel: {
        id: '~wittyr-witbes',
        type: 'dm' as db.ChannelType,
      },
    };

    const expectedOutput = {
      channelId: '~wittyr-witbes',
      channelType: 'dm',
      groupId: null,
      isTlonTeamDM: true,
    };
    expect(getModelAnalytics(input)).toEqual(expectedOutput);
  });

  it("doesn't mask Tlon Team DM posts", () => {
    const input = {
      post: {
        sentAt: 1749568132744,
        channelId: '~wittyr-witbes',
      } as Partial<db.Post>,
    };

    const expectedOutput = {
      postId: 'wmmjir',
      channelId: '~wittyr-witbes',
      isTlonTeamDM: true,
    };
    expect(getModelAnalytics(input)).toEqual(expectedOutput);
  });
});
