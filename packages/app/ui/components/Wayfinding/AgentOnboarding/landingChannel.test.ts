import { describe, expect, it, vi } from 'vitest';

import { resolveLandingChannelId } from './landingChannel';

const FURNISHED = '~zod/furnished-chat';
const BOT_DM = '~pinser-botter-zod';

const neverWait = () => Promise.resolve();

describe('resolveLandingChannelId', () => {
  it('lands in the bot DM once it exists', async () => {
    await expect(
      resolveLandingChannelId({
        botDmId: BOT_DM,
        furnishedChatChannelId: FURNISHED,
        deadline: Date.now() + 10_000,
        channelExists: async () => true,
        wait: neverWait,
      })
    ).resolves.toBe(BOT_DM);
  });

  it('falls back to the furnished chat rather than hanging on a DM that never arrives', async () => {
    const channelExists = vi.fn().mockResolvedValue(false);

    await expect(
      resolveLandingChannelId({
        botDmId: BOT_DM,
        // Already past, so the wait is skipped entirely.
        deadline: Date.now(),
        furnishedChatChannelId: FURNISHED,
        channelExists,
        wait: neverWait,
      })
    ).resolves.toBe(FURNISHED);
  });

  it('never waits past the overall onboarding deadline', async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    let calls = 0;
    // Exists only after the deadline would have passed.
    const channelExists = async () => ++calls > 3;

    await expect(
      resolveLandingChannelId({
        botDmId: BOT_DM,
        furnishedChatChannelId: FURNISHED,
        deadline: Date.now(),
        channelExists,
        wait,
      })
    ).resolves.toBe(FURNISHED);
    expect(wait).not.toHaveBeenCalled();
  });

  it('uses the furnished chat when there is no bot to DM', async () => {
    const channelExists = vi.fn();

    await expect(
      resolveLandingChannelId({
        botDmId: null,
        furnishedChatChannelId: FURNISHED,
        deadline: Date.now() + 10_000,
        channelExists,
        wait: neverWait,
      })
    ).resolves.toBe(FURNISHED);
    expect(channelExists).not.toHaveBeenCalled();
  });
});
