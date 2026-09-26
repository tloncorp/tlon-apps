import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tlonMessageActions } from './actions.js';
import { startTlonAgentTurn } from './turn-recorder.js';
import { withAuthenticatedTlonApi } from './urbit/api-client.js';
import { sendChannelPost } from './urbit/send.js';

vi.mock('./types.js', () => ({
  resolveTlonAccount: () => ({
    accountId: 'secondary',
    configured: true,
    ship: '~zod',
    url: 'http://localhost:8080',
    code: 'lit',
  }),
}));
vi.mock('./urbit/api-client.js', () => ({
  withAuthenticatedTlonApi: vi.fn(async (_opts, fn) => fn()),
}));
vi.mock('./urbit/send.js', () => ({
  sendChannelPost: vi.fn(),
}));
vi.mock('./urbit/story.js', () => ({
  markdownToStory: () => [{ inline: ['reply'] }],
}));

describe('message reply action journey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendChannelPost).mockResolvedValue({
      channel: 'tlon',
      messageId: '~zod/222',
      sentAt: 1000,
    });
  });

  function startTurn() {
    const observer = {
      recordStarted: vi.fn(),
      recordTerminal: vi.fn(),
      recordDispatchAttempted: vi.fn(),
      recordDispatchFailed: vi.fn(),
      recordMoonReplyEnqueued: vi.fn(),
    };
    const turn = startTlonAgentTurn(
      {
        accountId: 'primary',
        agentId: 'main',
        destinationKind: 'dm',
        inputMessageId: '~nec/111',
        runId: 'reply-action',
        sessionKey: 'agent:main:tlon:direct:~nec',
        ship: '~nec',
        trigger: 'dm',
      },
      { observer }
    );
    return { turn, observer };
  }

  function reply(message: string | undefined = 'reply') {
    return tlonMessageActions.handleAction!({
      action: 'reply',
      params: { to: 'chat/~nec/general', messageId: '123', message },
      cfg: {},
    });
  }

  it('records the actual group destination and output ID within a DM turn', async () => {
    const { turn, observer } = startTurn();
    const result = await turn.run(() => reply());
    expect(result.details).toEqual({
      ok: true,
      replied: '123',
      target: 'chat/~nec/general',
    });
    expect(observer.recordDispatchAttempted).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        attemptNumber: 1,
        accountId: 'secondary',
        destinationKind: 'group_channel',
        inputMessageId: '~nec/111',
        ship: 'zod',
      })
    );
    expect(observer.recordMoonReplyEnqueued).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ outputMessageId: '~zod/222' })
    );
    expect(turn.finalize({ durationMs: 1 })).toMatchObject({
      dispatchAttemptCount: 1,
      deliverySuccessCount: 1,
      deliveryFailureCount: 0,
    });
  });

  it('records transport failure without an enqueue event', async () => {
    const { turn, observer } = startTurn();
    vi.mocked(sendChannelPost).mockRejectedValueOnce(new Error('send failed'));
    await expect(turn.run(() => reply())).rejects.toThrow('send failed');
    expect(observer.recordDispatchFailed).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ attemptNumber: 1, errorKind: 'Error' })
    );
    expect(observer.recordMoonReplyEnqueued).not.toHaveBeenCalled();
    expect(turn.finalize({ durationMs: 1 })).toMatchObject({
      dispatchAttemptCount: 1,
      deliveryFailureCount: 1,
    });
  });

  it.each(['validation', 'authentication'])(
    'does not count %s failures as dispatches',
    async (failure) => {
      const { turn, observer } = startTurn();
      if (failure === 'authentication') {
        vi.mocked(withAuthenticatedTlonApi).mockRejectedValueOnce(
          new Error('auth failed')
        );
      }
      await expect(turn.run(() => reply(''))).rejects.toThrow();
      expect(sendChannelPost).not.toHaveBeenCalled();
      expect(observer.recordDispatchAttempted).not.toHaveBeenCalled();
      expect(observer.recordDispatchFailed).not.toHaveBeenCalled();
      expect(turn.finalize({ durationMs: 1 })).toMatchObject({
        dispatchAttemptCount: 0,
      });
    }
  );
});
