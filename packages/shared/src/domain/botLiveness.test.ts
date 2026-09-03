import { describe, expect, test } from 'vitest';

import {
  BOT_LIVENESS_MAX_RAW_BYTES,
  botLivenessOf,
  parseBotLiveness,
} from './botLiveness';

const claim = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 1, state: 'online', ...overrides });

const validBotInfo = JSON.stringify({
  v: 1,
  harness: 'openclaw',
  version: '1',
});

describe('parseBotLiveness', () => {
  test('parses a valid online claim', () => {
    expect(parseBotLiveness(claim({ state: 'online' }))).toBe('online');
  });

  test('parses a valid offline claim', () => {
    expect(parseBotLiveness(claim({ state: 'offline' }))).toBe('offline');
  });

  test('ignores unknown fields (forward compat)', () => {
    expect(parseBotLiveness(claim({ state: 'offline', since: 123 }))).toBe(
      'offline'
    );
  });

  test('rejects a wrong version', () => {
    expect(parseBotLiveness(claim({ v: 2 }))).toBeNull();
  });

  test('rejects an unknown state', () => {
    expect(parseBotLiveness(claim({ state: 'down' }))).toBeNull();
  });

  test('rejects a non-JSON string', () => {
    expect(parseBotLiveness('not json')).toBeNull();
  });

  test('rejects a JSON array', () => {
    expect(parseBotLiveness('[1,2,3]')).toBeNull();
  });

  test('rejects an over-long raw claim', () => {
    const long = claim({ state: 'online', pad: 'x'.repeat(200) });
    expect(long.length).toBeGreaterThan(BOT_LIVENESS_MAX_RAW_BYTES);
    expect(parseBotLiveness(long)).toBeNull();
  });

  test('rejects non-string input', () => {
    expect(parseBotLiveness(undefined)).toBeNull();
    expect(parseBotLiveness(null)).toBeNull();
    expect(parseBotLiveness(1)).toBeNull();
  });
});

describe('botLivenessOf', () => {
  test('non-bot id with a valid claim is null', () => {
    expect(
      botLivenessOf({ id: '~sampel-palnet', botLiveness: claim() })
    ).toBeNull();
  });

  test('hosted bot moon prefix with an offline claim', () => {
    expect(
      botLivenessOf({
        id: '~pinser-botter-sampel-palnet',
        botLiveness: claim({ state: 'offline' }),
      })
    ).toBe('offline');
  });

  test('bot via bot-info claim with an online claim', () => {
    expect(
      botLivenessOf({
        id: '~sampel-palnet',
        botInfo: validBotInfo,
        botLiveness: claim({ state: 'online' }),
      })
    ).toBe('online');
  });

  test('bot with no claim is null', () => {
    expect(botLivenessOf({ id: '~pinser-botter-sampel-palnet' })).toBeNull();
  });

  test('null and undefined contacts are null', () => {
    expect(botLivenessOf(null)).toBeNull();
    expect(botLivenessOf(undefined)).toBeNull();
  });
});
