import { describe, expect, it } from 'vitest';

import { resolveLandingChannelId } from './landingChannel';

const FURNISHED = '~zod/furnished-chat';
const BOT_DM = '~pinser-botter-zod';

describe('resolveLandingChannelId', () => {
  it('lands in the bot DM, where the intro request went', () => {
    // Even before the DM row has synced: the tab renders the DM by id, and a
    // fallback to the chat would leave the user watching the wrong channel.
    expect(
      resolveLandingChannelId({
        botDmId: BOT_DM,
        furnishedChatChannelId: FURNISHED,
      })
    ).toBe(BOT_DM);
  });

  it('uses the furnished chat when there is no bot to DM', () => {
    expect(
      resolveLandingChannelId({
        botDmId: null,
        furnishedChatChannelId: FURNISHED,
      })
    ).toBe(FURNISHED);
  });
});
