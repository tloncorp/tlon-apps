import { afterEach, describe, expect, it, vi } from 'vitest';

import { dmReactionReplyParentId } from '../monitor/dm-reactions.js';

vi.mock('@urbit/aura', () => ({
  scot: vi.fn(() => 'mocked-ud'),
  da: {
    fromUnix: vi.fn(() => 123n),
  },
}));

describe('sendDm', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('uses aura v3 helpers for the DM id', async () => {
    const poke = vi.fn(async () => ({}));

    // Mock @tloncorp/api's sendPost to capture arguments instead of hitting the network
    vi.doMock('@tloncorp/api', () => ({
      sendPost: poke,
      sendReply: vi.fn(),
      addReaction: vi.fn(),
      removeReaction: vi.fn(),
      deletePost: vi.fn(),
      configureClient: vi.fn(),
    }));

    const { sendDm } = await import('./send.js');
    const aura = await import('@urbit/aura');
    const scot = vi.mocked(aura.scot);
    const fromUnix = vi.mocked(aura.da.fromUnix);

    const sentAt = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(sentAt);

    const result = await sendDm({
      fromShip: '~zod',
      toShip: '~nec',
      text: 'hi',
    });

    expect(fromUnix).toHaveBeenCalledWith(sentAt);
    expect(scot).toHaveBeenCalledWith('ud', 123n);
    expect(poke).toHaveBeenCalledTimes(1);
    expect(poke).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: '~nec',
        authorId: '~zod',
        sentAt,
      })
    );
    expect(result.messageId).toBe('~zod/mocked-ud');
    // §3 of the approved plan: the send result carries `sentAt` so
    // downstream callers (the nudge runner, pending-nudge writes, the
    // telemetry event's `nudgeSentAtMs`) agree on a single timestamp.
    expect(result.sentAt).toBe(sentAt);
    expect(result.channel).toBe('tlon');
  });

  it('uses aura v3 helpers for channel post ids', async () => {
    const poke = vi.fn(async () => ({}));

    vi.doMock('@tloncorp/api', () => ({
      sendPost: poke,
      sendReply: vi.fn(),
      addReaction: vi.fn(),
      removeReaction: vi.fn(),
      deletePost: vi.fn(),
      configureClient: vi.fn(),
    }));

    const { sendChannelPost } = await import('./send.js');
    const sentAt = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(sentAt);

    const result = await sendChannelPost({
      fromShip: '~zod',
      nest: 'chat/~zod/general',
      story: [{ inline: ['hi'] }],
      blob: '[{"type":"tlon-context-lens","version":1,"lensId":"lens-123"}]',
    });

    expect(poke).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'chat/~zod/general',
        authorId: '~zod',
        sentAt,
        blob: '[{"type":"tlon-context-lens","version":1,"lensId":"lens-123"}]',
      })
    );
    expect(result.messageId).toBe('~zod/mocked-ud');
  });

  it.each([
    ['a bare target id', '170.141.184.507.123'],
    ['a full /v4 target id', '~bot/170.141.184.507.123'],
  ])(
    'keeps the bot as parent author for a DM reaction reply poke with %s',
    async (_description, targetId) => {
      const sendReply = vi.fn(async () => ({}));

      vi.doMock('@tloncorp/api', () => ({
        sendPost: vi.fn(),
        sendReply,
        addReaction: vi.fn(),
        removeReaction: vi.fn(),
        deletePost: vi.fn(),
        configureClient: vi.fn(),
      }));

      const { sendDm } = await import('./send.js');

      await sendDm({
        fromShip: '~bot',
        toShip: '~owner',
        text: 'Acknowledged.',
        replyToId: dmReactionReplyParentId('~bot', targetId),
      });

      expect(sendReply).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: '~owner',
          parentId: '170.141.184.507.123',
          parentAuthor: '~bot',
        })
      );
    }
  );
});
