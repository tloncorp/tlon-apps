import { describe, expect, it } from 'vitest';

import { resolveBotOwnership } from './BotSystemPrompts.helpers';

const mirror = (text: string) => [
  { name: 'SOUL.md', text, updatedAt: 1, edited: false },
];

describe('resolveBotOwnership', () => {
  it('treats a present mirror as ownership', () => {
    expect(
      resolveBotOwnership({
        prompts: mirror('be kind'),
        mirrorUnresolved: false,
        module: 'present',
      })
    ).toEqual({ isOwnedBot: true, isPending: false });
  });

  it('keeps ownership unresolved while the module probe is retrying', () => {
    // The per-bot scry turns %steward's transient 404 into a successful
    // null, so on its own it would report an owned bot as unowned during a
    // restart — long enough for Block to appear on the bot's own profile.
    expect(
      resolveBotOwnership({
        prompts: null,
        mirrorUnresolved: false,
        module: 'unresolved',
      })
    ).toEqual({ isOwnedBot: false, isPending: true });
  });

  it('believes a null mirror once the module is confirmed present', () => {
    expect(
      resolveBotOwnership({
        prompts: null,
        mirrorUnresolved: false,
        module: 'present',
      })
    ).toEqual({ isOwnedBot: false, isPending: false });
  });

  it('settles on an unowned verdict when the ship has no module', () => {
    // An exhausted probe is the authoritative "no mirrors here": leaving
    // this pending would hide Block on every profile on such a ship.
    expect(
      resolveBotOwnership({
        prompts: undefined,
        mirrorUnresolved: true,
        module: 'absent',
      })
    ).toEqual({ isOwnedBot: false, isPending: false });
  });

  it('stays pending while the mirror scry itself is undecided', () => {
    expect(
      resolveBotOwnership({
        prompts: null,
        mirrorUnresolved: true,
        module: 'present',
      })
    ).toEqual({ isOwnedBot: false, isPending: true });
  });
});
