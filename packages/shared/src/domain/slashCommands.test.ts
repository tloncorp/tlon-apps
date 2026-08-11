import { describe, expect, test } from 'vitest';

import {
  BOT_INFO_CONTACT_KEY,
  BOT_INFO_MAX_FIELD_CHARS,
  BOT_INFO_MAX_RAW_BYTES,
  RUNTIME_COMMANDS,
  STATIC_MANIFESTS,
  getStaticSlashCommandManifest,
  isBotAgentType,
  parseBotInfo,
  utf8ByteLength,
} from './slashCommands';

const claim = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    v: 1,
    harness: 'openclaw',
    version: '0.19.0',
    ...overrides,
  });

describe('parseBotInfo', () => {
  test('contact key is the wire contract key', () => {
    expect(BOT_INFO_CONTACT_KEY).toBe('bot-info');
  });

  test('parses a full claim', () => {
    expect(
      parseBotInfo(
        JSON.stringify({
          v: 1,
          harness: 'openclaw',
          version: '0.19.0',
          harnessVersion: '2026.5.28',
        })
      )
    ).toEqual({
      harness: 'openclaw',
      version: '0.19.0',
      harnessVersion: '2026.5.28',
    });
  });

  test('harnessVersion is optional: a claim without it still stands', () => {
    expect(parseBotInfo(claim())).toEqual({
      harness: 'openclaw',
      version: '0.19.0',
    });
  });

  test('keeps an unknown harness verbatim (selection happens elsewhere)', () => {
    expect(parseBotInfo(claim({ harness: 'someone-elses-bot' }))?.harness).toBe(
      'someone-elses-bot'
    );
  });

  test('harness matching is case-sensitive', () => {
    // Parsed, but not a harness we know: the claim is what the bot said.
    const parsed = parseBotInfo(claim({ harness: 'OpenClaw' }));
    expect(parsed?.harness).toBe('OpenClaw');
    expect(isBotAgentType(parsed?.harness)).toBe(false);
  });

  test('ignores unknown fields (forward compat)', () => {
    expect(
      parseBotInfo(claim({ capabilities: ['commands'], future: 42 }))
    ).toEqual({ harness: 'openclaw', version: '0.19.0' });
  });

  test('rejects non-string input', () => {
    expect(parseBotInfo(undefined)).toBeNull();
    expect(parseBotInfo(null)).toBeNull();
    expect(parseBotInfo(42)).toBeNull();
    expect(parseBotInfo({ v: 1, harness: 'openclaw' })).toBeNull();
  });

  test('rejects malformed JSON', () => {
    expect(parseBotInfo('{"v":1,"harness":')).toBeNull();
  });

  test('rejects JSON that is not an object', () => {
    expect(parseBotInfo('null')).toBeNull();
    expect(parseBotInfo('[1,2]')).toBeNull();
    expect(parseBotInfo('"openclaw"')).toBeNull();
    expect(parseBotInfo('1')).toBeNull();
  });

  test('rejects a wrong or missing v', () => {
    expect(parseBotInfo(claim({ v: 2 }))).toBeNull();
    expect(parseBotInfo(claim({ v: '1' }))).toBeNull();
    expect(
      parseBotInfo(JSON.stringify({ harness: 'openclaw', version: '1.0.0' }))
    ).toBeNull();
  });

  test.each(['harness', 'version'])('rejects a claim missing %s', (field) => {
    expect(parseBotInfo(claim({ [field]: undefined }))).toBeNull();
  });

  test.each(['harness', 'version', 'harnessVersion'])(
    'rejects an empty %s',
    (field) => {
      expect(parseBotInfo(claim({ [field]: '' }))).toBeNull();
    }
  );

  test.each(['harness', 'version', 'harnessVersion'])(
    'rejects a non-string %s',
    (field) => {
      expect(parseBotInfo(claim({ [field]: 42 }))).toBeNull();
      expect(parseBotInfo(claim({ [field]: ['openclaw'] }))).toBeNull();
      expect(parseBotInfo(claim({ [field]: { value: 'x' } }))).toBeNull();
      expect(parseBotInfo(claim({ [field]: true }))).toBeNull();
      expect(parseBotInfo(claim({ [field]: null }))).toBeNull();
    }
  );

  test.each(['harness', 'version', 'harnessVersion'])(
    'accepts %s at exactly the field cap and rejects one over',
    (field) => {
      expect(
        parseBotInfo(claim({ [field]: 'x'.repeat(BOT_INFO_MAX_FIELD_CHARS) }))
      ).not.toBeNull();
      expect(
        parseBotInfo(
          claim({ [field]: 'x'.repeat(BOT_INFO_MAX_FIELD_CHARS + 1) })
        )
      ).toBeNull();
    }
  );

  test('counts the field cap in code points, not UTF-16 units', () => {
    // An astral character is one character to a publisher but two `.length`
    // units, so a cap-length emoji string must still be accepted.
    expect(
      parseBotInfo(claim({ version: '🚀'.repeat(BOT_INFO_MAX_FIELD_CHARS) }))
    ).not.toBeNull();
    expect(
      parseBotInfo(
        claim({ version: '🚀'.repeat(BOT_INFO_MAX_FIELD_CHARS + 1) })
      )
    ).toBeNull();
  });

  test('rejects a raw claim over the UTF-8 byte cap', () => {
    // Non-ASCII: each é is two UTF-8 bytes, so this claim is under the cap in
    // characters and over it in bytes. Every declared field is individually
    // valid — only the total size fails, and the raw size is what the cap
    // guards (unknown fields are ignored but still cost bytes).
    const raw = claim({ note: 'é'.repeat(400) });
    expect(raw.length).toBeLessThan(BOT_INFO_MAX_RAW_BYTES);
    expect(utf8ByteLength(raw)).toBeGreaterThan(BOT_INFO_MAX_RAW_BYTES);
    expect(parseBotInfo(raw)).toBeNull();
  });

  test('accepts a raw claim under the byte cap with non-ASCII content', () => {
    const raw = claim({ version: 'é'.repeat(40) });
    expect(utf8ByteLength(raw)).toBeLessThan(BOT_INFO_MAX_RAW_BYTES);
    expect(parseBotInfo(raw)?.version).toBe('é'.repeat(40));
  });
});

describe('static command lists', () => {
  test('a known harness selects its own list', () => {
    expect(getStaticSlashCommandManifest('openclaw')).toBe(
      STATIC_MANIFESTS.openclaw
    );
    expect(getStaticSlashCommandManifest('hermes')).toBe(
      STATIC_MANIFESTS.hermes
    );
  });

  test('an unknown, absent, or mis-cased harness falls back to openclaw', () => {
    expect(getStaticSlashCommandManifest('third-party')).toBe(
      STATIC_MANIFESTS.openclaw
    );
    expect(getStaticSlashCommandManifest('Hermes')).toBe(
      STATIC_MANIFESTS.openclaw
    );
    expect(getStaticSlashCommandManifest(null)).toBe(STATIC_MANIFESTS.openclaw);
    expect(getStaticSlashCommandManifest(undefined)).toBe(
      STATIC_MANIFESTS.openclaw
    );
  });

  test.each(['openclaw', 'hermes'] as const)(
    'the %s list is the runtime half plus a non-empty core half',
    (harness) => {
      const all = STATIC_MANIFESTS[harness].commands;
      const runtime = RUNTIME_COMMANDS[harness];
      expect(runtime.length).toBeGreaterThan(0);
      expect(all.length).toBeGreaterThan(runtime.length);
      // Every CI-bound runtime entry is actually in the rendered list.
      for (const option of runtime) {
        expect(all).toContain(option);
      }
    }
  );

  test.each(['openclaw', 'hermes'] as const)(
    'the %s list has unique tokens and unique priorities',
    (harness) => {
      const commands = STATIC_MANIFESTS[harness].commands;
      expect(new Set(commands.map((c) => c.command)).size).toBe(
        commands.length
      );
      expect(new Set(commands.map((c) => c.priority)).size).toBe(
        commands.length
      );
    }
  );

  test.each(['openclaw', 'hermes'] as const)(
    'every %s entry carries an icon and a popup-triggerable token',
    (harness) => {
      // A token that does not match this shape can never trigger the popup
      // (computeSlashCommandState in packages/app).
      for (const option of STATIC_MANIFESTS[harness].commands) {
        expect(option.icon, option.command).toBeTruthy();
        expect(option.command).toMatch(/^\/[a-zA-Z0-9-]+$/);
        expect(option.title, option.command).toBeTruthy();
      }
    }
  );
});
