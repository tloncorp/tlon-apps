import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@urbit/aura', () => ({
  scot: vi.fn(() => 'mocked-ud'),
  da: {
    fromUnix: vi.fn(() => 123n),
  },
}));

describe('sendDm', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
});
