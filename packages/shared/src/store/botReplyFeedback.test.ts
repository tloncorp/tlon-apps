import { afterEach, describe, expect, it } from 'vitest';

import { queryClient } from '../db/reactQuery';
import {
  getBotReplyFeedbackQueryKey,
  getBotReplyMessageId,
  sanitizeBotReplyFeedbackText,
  setCachedBotReplyFeedback,
} from './botReplyFeedback';

const BOT_SHIP = '~botnul-banpex-ravseg-nosduc';

afterEach(() => {
  queryClient.clear();
});

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

describe('bot reply feedback query cache', () => {
  it('updates only the targeted message', () => {
    const first = {
      messageId: '~bot/first',
      postId: 'first',
      feedbackId: 'feedback-first',
      revision: 1,
      rating: 'up' as const,
      categories: [],
      submittedAt: 1,
    };
    const second = {
      ...first,
      messageId: '~bot/second',
      postId: 'second',
      feedbackId: 'feedback-second',
      rating: 'down' as const,
    };

    setCachedBotReplyFeedback(first.messageId, first);
    setCachedBotReplyFeedback(second.messageId, second);
    setCachedBotReplyFeedback(first.messageId, null);

    expect(
      queryClient.getQueryData(getBotReplyFeedbackQueryKey(first.messageId))
    ).toBeNull();
    expect(
      queryClient.getQueryData(getBotReplyFeedbackQueryKey(second.messageId))
    ).toEqual(second);
  });
});

describe('sanitizeBotReplyFeedbackText', () => {
  it('redacts Tlon mentions, group mentions, links, and email addresses', () => {
    expect(
      sanitizeBotReplyFeedbackText(
        'Ask ~sampel-palnet, @admins, or jane@example.com. Visit https://example.com/private?q=1, www.example.org/path, and tlon://chat/~sampel-palnet.'
      )
    ).toBe(
      'Ask [mention], [mention], or [email]. Visit [link], [link], and [link].'
    );
  });

  it('leaves ordinary message text unchanged', () => {
    expect(
      sanitizeBotReplyFeedbackText('A normal bot reply with ~10 items.')
    ).toBe('A normal bot reply with ~10 items.');
  });
});
