import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  reloadBot: vi.fn(),
  awaitBotRunning: vi.fn(),
  hosted: true as boolean | null,
}));

vi.mock('@tloncorp/api', () => ({
  reloadBot: mocks.reloadBot,
  awaitBotRunning: mocks.awaitBotRunning,
  getBotUserIdForUser: (userId: string) => `${userId}-bot`,
  getCurrentUserIsHosted: () => {
    if (mocks.hosted === null) {
      throw new Error('Client not initialized');
    }
    return mocks.hosted;
  },
}));

import {
  RESTART_SETTLE_MS,
  isHostedBotOfCurrentUser,
  restartHostedBot,
} from './restartHostedBot';

describe('isHostedBotOfCurrentUser', () => {
  beforeEach(() => {
    mocks.hosted = true;
  });

  it("is only the hosted user's own bot", () => {
    expect(isHostedBotOfCurrentUser('~owner-bot', '~owner')).toBe(true);
    expect(isHostedBotOfCurrentUser('~other-bot', '~owner')).toBe(false);
    mocks.hosted = false;
    expect(isHostedBotOfCurrentUser('~owner-bot', '~owner')).toBe(false);
  });

  it('treats an uninitialized client as not hosted', () => {
    mocks.hosted = null;
    expect(isHostedBotOfCurrentUser('~owner-bot', '~owner')).toBe(false);
  });
});

describe('restartHostedBot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.reloadBot.mockResolvedValue(undefined);
    mocks.awaitBotRunning.mockResolvedValue(true);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reloads, lets the old gateway go down, then waits for the new one', async () => {
    const result = restartHostedBot('owner');
    expect(mocks.reloadBot).toHaveBeenCalledWith('owner');
    await vi.advanceTimersByTimeAsync(RESTART_SETTLE_MS - 1);
    expect(mocks.awaitBotRunning).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.awaitBotRunning).toHaveBeenCalledWith('owner', {
      timeoutMs: expect.any(Number),
      pollIntervalMs: expect.any(Number),
    });
    await expect(result).resolves.toBe(true);
  });

  it('reports a bot that did not come back in time', async () => {
    mocks.awaitBotRunning.mockResolvedValue(false);
    const result = restartHostedBot('owner');
    await vi.advanceTimersByTimeAsync(RESTART_SETTLE_MS);
    await expect(result).resolves.toBe(false);
  });

  it('shares one restart between overlapping saves', async () => {
    const first = restartHostedBot('owner');
    const second = restartHostedBot('owner');
    expect(second).toBe(first);
    await vi.advanceTimersByTimeAsync(RESTART_SETTLE_MS);
    await Promise.all([first, second]);
    expect(mocks.reloadBot).toHaveBeenCalledTimes(1);

    // Once it has settled, the next save restarts again.
    const third = restartHostedBot('owner');
    expect(third).not.toBe(first);
    await vi.advanceTimersByTimeAsync(RESTART_SETTLE_MS);
    await third;
    expect(mocks.reloadBot).toHaveBeenCalledTimes(2);
  });

  it('surfaces a refused reload and lets the next save try again', async () => {
    mocks.reloadBot.mockRejectedValueOnce(new Error('403'));
    await expect(restartHostedBot('owner')).rejects.toThrow('403');
    expect(mocks.awaitBotRunning).not.toHaveBeenCalled();

    const retry = restartHostedBot('owner');
    await vi.advanceTimersByTimeAsync(RESTART_SETTLE_MS);
    await expect(retry).resolves.toBe(true);
  });
});
