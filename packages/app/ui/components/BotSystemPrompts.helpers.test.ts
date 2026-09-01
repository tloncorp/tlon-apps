import { describe, expect, it } from 'vitest';

import {
  classifyProbeFailure,
  resolveBotOwnership,
  resolvePromptsModuleState,
} from './BotSystemPrompts.helpers';

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

describe('classifyProbeFailure', () => {
  it('retries an unavailable verdict until the budget is spent', () => {
    expect(
      classifyProbeFailure({ unavailable: true, attempt: 0, maxRetries: 3 })
    ).toBe('retry');
    expect(
      classifyProbeFailure({ unavailable: true, attempt: 2, maxRetries: 3 })
    ).toBe('retry');
  });

  it('believes absence once the retries are spent', () => {
    expect(
      classifyProbeFailure({ unavailable: true, attempt: 3, maxRetries: 3 })
    ).toBe('absent');
  });

  it('never turns a transport failure into a verdict', () => {
    // Caching one as absence would let Block appear beside an owned bot;
    // caching it as unresolved would hide Block on every profile for the
    // rest of the session. Rethrowing leaves it retryable on a later mount.
    expect(
      classifyProbeFailure({ unavailable: false, attempt: 9, maxRetries: 3 })
    ).toBe('rethrow');
  });
});

describe('resolvePromptsModuleState', () => {
  it('treats a revalidation in flight as unresolved', () => {
    // The cached verdict is what a restart invalidates: holding `present`
    // through the refetch would let a per-bot 404 (indistinguishable from
    // "no mirror") resolve an owned bot to unowned mid-restart.
    expect(
      resolvePromptsModuleState({ data: 'present', isFetching: true })
    ).toBe('unresolved');
  });

  it('uses a settled verdict', () => {
    expect(
      resolvePromptsModuleState({ data: 'present', isFetching: false })
    ).toBe('present');
    expect(
      resolvePromptsModuleState({ data: 'absent', isFetching: false })
    ).toBe('absent');
  });

  it('is unresolved with no verdict at all', () => {
    expect(resolvePromptsModuleState({ isFetching: false })).toBe('unresolved');
  });
});
