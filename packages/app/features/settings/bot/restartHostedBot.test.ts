import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  reloadBot: vi.fn(),
  isBotRunning: vi.fn(),
  awaitBotRunning: vi.fn(),
  hosted: true as boolean | null,
}));

vi.mock('@tloncorp/api', () => ({
  reloadBot: mocks.reloadBot,
  isBotRunning: mocks.isBotRunning,
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
  POLL_MS,
  STOP_TIMEOUT_MS,
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
    mocks.isBotRunning.mockResolvedValue(false);
    mocks.awaitBotRunning.mockResolvedValue(true);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('confirms a restart only after the gateway was seen down, then up', async () => {
    mocks.isBotRunning
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const result = restartHostedBot('owner');
    expect(mocks.reloadBot).toHaveBeenCalledWith('owner');

    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(mocks.awaitBotRunning).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(mocks.isBotRunning).toHaveBeenCalledTimes(3);
    expect(mocks.awaitBotRunning).toHaveBeenCalledWith('owner', {
      timeoutMs: expect.any(Number),
      pollIntervalMs: expect.any(Number),
    });
    await expect(result).resolves.toBe(true);
  });

  it('cannot confirm a restart when the old gateway never goes down', async () => {
    mocks.isBotRunning.mockResolvedValue(true);
    const result = restartHostedBot('owner');
    await vi.advanceTimersByTimeAsync(STOP_TIMEOUT_MS + POLL_MS);
    await expect(result).resolves.toBe(false);
    expect(mocks.awaitBotRunning).not.toHaveBeenCalled();
  });

  it('keeps probing when Hosting cannot answer a probe', async () => {
    mocks.isBotRunning
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValue(false);
    const result = restartHostedBot('owner');
    await vi.advanceTimersByTimeAsync(POLL_MS);
    await expect(result).resolves.toBe(true);
  });

  it('reports a bot that did not come back in time', async () => {
    mocks.awaitBotRunning.mockResolvedValue(false);
    await expect(restartHostedBot('owner')).resolves.toBe(false);
  });

  it('surfaces a refused reload and lets the next save try again', async () => {
    mocks.reloadBot.mockRejectedValueOnce(new Error('403'));
    await expect(restartHostedBot('owner')).rejects.toThrow('403');
    expect(mocks.isBotRunning).not.toHaveBeenCalled();

    await expect(restartHostedBot('owner')).resolves.toBe(true);
  });

  it('runs one follow-up restart for saves that land during a restart', async () => {
    const first = restartHostedBot('owner');
    const second = restartHostedBot('owner');
    const third = restartHostedBot('owner');
    expect(second).not.toBe(first);
    expect(third).toBe(second);
    expect(mocks.reloadBot).toHaveBeenCalledTimes(1);

    await first;
    expect(mocks.reloadBot).toHaveBeenCalledTimes(2);

    // A save during the follow-up needs a restart of its own.
    const fourth = restartHostedBot('owner');
    expect(fourth).not.toBe(second);
    await second;
    await fourth;
    expect(mocks.reloadBot).toHaveBeenCalledTimes(3);
  });

  it('still runs the follow-up when the first restart was refused', async () => {
    mocks.reloadBot.mockRejectedValueOnce(new Error('503'));
    const first = restartHostedBot('owner');
    const second = restartHostedBot('owner');
    await expect(first).rejects.toThrow('503');
    await expect(second).resolves.toBe(true);
    expect(mocks.reloadBot).toHaveBeenCalledTimes(2);
  });
});
