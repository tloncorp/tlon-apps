import { describe, expect, it, vi } from 'vitest';

import {
  handleChannelReaction,
  processChannelReactionSnapshot,
} from './channel-reactions.js';

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

  it('resolves a target once for two reactors', async () => {
    const target = { author: '~bot', content: 'bot message', timestamp: 1 };
    const resolveTarget = vi.fn(async () => target);
    const handleReaction = vi.fn(async () => {});

    await processChannelReactionSnapshot({
      botShip: '~bot',
      reactions: { '~nec': '👍', '~bud': '🎉' },
      postId: '170141184507123',
      normalizeShip: (ship) => ship,
      resolveTarget,
      handleReaction,
    });

    expect(resolveTarget).toHaveBeenCalledOnce();
    expect(handleReaction).toHaveBeenCalledTimes(2);
    expect(handleReaction).toHaveBeenNthCalledWith(1, {
      emoji: '👍',
      reactor: '~nec',
      target,
    });
    expect(handleReaction).toHaveBeenNthCalledWith(2, {
      emoji: '🎉',
      reactor: '~bud',
      target,
    });
  });

  it('resolves an unresolved target once for two reactors', async () => {
    const resolveTarget = vi.fn(async () => undefined);
    const handleReaction = vi.fn(async () => {});

    await processChannelReactionSnapshot({
      botShip: '~bot',
      reactions: { '~nec': '👍', '~bud': '🎉' },
      postId: '170141184507123',
      normalizeShip: (ship) => ship,
      resolveTarget,
      handleReaction,
    });

    expect(resolveTarget).toHaveBeenCalledOnce();
    expect(handleReaction).toHaveBeenCalledTimes(2);
    expect(handleReaction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ target: undefined })
    );
    expect(handleReaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ target: undefined })
    );
  });

  it('does not resolve a target for empty or bot-only reactions', async () => {
    const resolveTarget = vi.fn(async () => undefined);
    const handleReaction = vi.fn(async () => {});
    const common = {
      botShip: '~bot',
      postId: '170141184507123',
      normalizeShip: (ship: string) => ship,
      resolveTarget,
      handleReaction,
    };

    await processChannelReactionSnapshot({ ...common, reactions: {} });
    await processChannelReactionSnapshot({
      ...common,
      reactions: { '~bot': '👍' },
    });

    expect(resolveTarget).not.toHaveBeenCalled();
    expect(handleReaction).not.toHaveBeenCalled();
  });

  it('resolves root and reply targets with their separate identifiers', async () => {
    const resolveTarget = vi.fn(async () => undefined);
    const handleReaction = vi.fn(async () => {});
    const common = {
      botShip: '~bot',
      reactions: { '~nec': '👍' },
      normalizeShip: (ship: string) => ship,
      resolveTarget,
      handleReaction,
    };

    await processChannelReactionSnapshot({
      ...common,
      postId: '170141184507123',
    });
    await processChannelReactionSnapshot({
      ...common,
      postId: '170141184507456',
      rootPostId: '170141184507123',
    });

    expect(resolveTarget).toHaveBeenNthCalledWith(
      1,
      '170141184507123',
      undefined
    );
    expect(resolveTarget).toHaveBeenNthCalledWith(
      2,
      '170141184507456',
      '170141184507123'
    );
  });
});
