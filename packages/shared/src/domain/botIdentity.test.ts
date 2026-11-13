import { describe, expect, test } from 'vitest';

import { isBotContact, isNotBotContact } from './botIdentity';

const validClaim = JSON.stringify({
  v: 1,
  harness: 'openclaw',
  version: '1.2.3',
});

describe('isBotContact', () => {
  test('plain planet id is not a bot', () => {
    expect(isBotContact({ id: '~sampel-palnet' })).toBe(false);
  });

  test('hosted bot moon prefix is a bot', () => {
    expect(isBotContact({ id: '~pinser-botter-sampel-palnet' })).toBe(true);
  });

  test('valid bot-info claim is a bot', () => {
    expect(isBotContact({ id: '~sampel-palnet', botInfo: validClaim })).toBe(
      true
    );
  });

  test('malformed bot-info claim alone is not a bot', () => {
    expect(isBotContact({ id: '~sampel-palnet', botInfo: 'not json' })).toBe(
      false
    );
  });

  test('hosted prefix wins even with a malformed claim', () => {
    expect(
      isBotContact({ id: '~pinser-botter-sampel-palnet', botInfo: 'not json' })
    ).toBe(true);
  });

  test('unknown harness in an otherwise valid claim is still a bot', () => {
    expect(
      isBotContact({
        id: '~sampel-palnet',
        botInfo: JSON.stringify({ v: 1, harness: 'xyz', version: '1.2.3' }),
      })
    ).toBe(true);
  });

  test('absent id is not a bot', () => {
    expect(isBotContact({ id: null })).toBe(false);
    expect(isBotContact({})).toBe(false);
  });

  // The two signals are independently sufficient: a claim alone is enough, with
  // no id to fall back on. Without this, an implementation that gated the whole
  // predicate on a truthy id would pass every other case here.
  test('valid claim with no id is still a bot', () => {
    expect(isBotContact({ botInfo: validClaim })).toBe(true);
  });
});

describe('isNotBotContact', () => {
  test('leaves out hosted bots and contacts with a bot claim, as Slab agents carry', () => {
    const claim = JSON.stringify({ v: 1, harness: 'slab', version: '1' });
    const kept = [
      { id: '~sampel-palnet' },
      { id: '~pinser-botter-sampel-palnet' },
      { id: '~scout', botInfo: claim },
    ].filter(isNotBotContact);
    expect(kept.map((contact) => contact.id)).toEqual(['~sampel-palnet']);
  });
});
