import { describe, expect, it, vi } from 'vitest';

import { handleChannelReaction } from './channel-reactions.js';

describe('handleChannelReaction', () => {
  it('queues one passive event when the reaction target cannot be resolved', async () => {
    const log = vi.fn();
    const dispatchAgent = vi.fn(async () => {});
    const enqueueSystemEvent = vi.fn();

    await handleChannelReaction({
      botShip: '~bot',
      emoji: '👍',
      formatShip: (ship) => ship,
      nest: 'chat/~zod/general',
      postId: '170141184507123',
      reactor: '~nec',
      target: undefined,
      log,
      dispatchAgent,
      enqueueSystemEvent,
    });

    expect(enqueueSystemEvent).toHaveBeenCalledOnce();
    expect(enqueueSystemEvent).toHaveBeenCalledWith(
      expect.stringContaining('(message content unavailable)')
    );
    expect(dispatchAgent).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Unclassified reaction')
    );
  });
});
