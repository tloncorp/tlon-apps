import { describe, expect, it } from 'vitest';

import { resolveTlonSourceReplyDeliveryMode } from './source-reply-delivery.js';

describe('resolveTlonSourceReplyDeliveryMode', () => {
  it('defaults direct-message source replies to automatic delivery', () => {
    expect(resolveTlonSourceReplyDeliveryMode({ isGroup: false })).toBe(
      'automatic'
    );
  });

  it('defaults group source replies to automatic delivery', () => {
    expect(resolveTlonSourceReplyDeliveryMode({ isGroup: true })).toBe(
      'automatic'
    );
  });

  it('lets an explicit global visible-reply policy win', () => {
    expect(
      resolveTlonSourceReplyDeliveryMode({
        isGroup: false,
        messages: { visibleReplies: 'message_tool' },
      })
    ).toBeUndefined();
  });

  it('applies group-only policy only to groups', () => {
    const messages = {
      groupChat: { visibleReplies: 'message_tool' as const },
    };

    expect(
      resolveTlonSourceReplyDeliveryMode({ isGroup: true, messages })
    ).toBeUndefined();
    expect(
      resolveTlonSourceReplyDeliveryMode({ isGroup: false, messages })
    ).toBe('automatic');
  });
});
