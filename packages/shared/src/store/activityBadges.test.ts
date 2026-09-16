import { describe, expect, it } from 'vitest';

import { countUnseenActivity } from './activityBadges';

const BOT_DM = '~pinser-botter-ten';
const rows = [
  { activity_events: { channelId: BOT_DM } },
  { activity_events: { channelId: 'chat/~ten/general' } },
  { activity_events: { channelId: BOT_DM } },
];

describe('countUnseenActivity', () => {
  it('counts every unseen event by default', () => {
    expect(countUnseenActivity(rows)).toBe(3);
  });

  it('leaves the excluded channel out so one message lights one badge', () => {
    expect(countUnseenActivity(rows, { excludeChannelId: BOT_DM })).toBe(1);
  });

  it('is zero for nothing', () => {
    expect(countUnseenActivity(undefined)).toBe(0);
    expect(countUnseenActivity([])).toBe(0);
    expect(countUnseenActivity([], { excludeChannelId: BOT_DM })).toBe(0);
  });

  it('does not exclude when there is nothing to exclude by', () => {
    expect(countUnseenActivity(rows, { excludeChannelId: null })).toBe(3);
  });
});
