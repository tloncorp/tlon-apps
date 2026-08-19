import { describe, expect, it } from 'vitest';

import {
  BOT_REPLY_FEEDBACK_RETENTION_MS,
  getBotReplyMessageId,
  getFreshBotReplyFeedback,
} from './botReplyFeedback';

const BOT_SHIP = '~botnul-banpex-ravseg-nosduc';

describe('getBotReplyMessageId', () => {
  it.each([
    ['DM', '170.141.184.506.511.632.882.809.306.892.730.368.000'],
    ['group channel', '170.141.184.506.511.632.885.078.256.413.796.642.848'],
    ['thread reply', '170.141.184.506.511.632.901.237.604.222.366.210.064'],
  ])('reconstructs the full bot-side id for a %s post', (_kind, id) => {
    expect(getBotReplyMessageId({ authorId: BOT_SHIP, id })).toBe(
      `${BOT_SHIP}/${id}`
    );
  });
});

describe('getFreshBotReplyFeedback', () => {
  it('drops entries older than the feedback retention window', () => {
    const now = 2 * BOT_REPLY_FEEDBACK_RETENTION_MS;
    const base = {
      feedbackId: 'feedback-id',
      revision: 1,
      rating: 'up' as const,
      categories: [],
    };
    const fresh = {
      ...base,
      messageId: '~bot/fresh',
      submittedAt: now - BOT_REPLY_FEEDBACK_RETENTION_MS,
    };
    const expired = {
      ...base,
      messageId: '~bot/expired',
      submittedAt: fresh.submittedAt - 1,
    };

    expect(getFreshBotReplyFeedback([fresh, expired], now)).toEqual([fresh]);
  });
});
