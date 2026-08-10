import { describe, expect, test } from 'vitest';

import {
  BOT_COMMANDS_CONTACT_KEY,
  BOT_COMMANDS_MAX_ENTRIES,
  BOT_COMMANDS_MAX_ICON_CHARS,
  BOT_COMMANDS_MAX_INSERT_TEXT_CHARS,
  BOT_COMMANDS_MAX_KEYWORDS,
  BOT_COMMANDS_MAX_KEYWORD_CHARS,
  BOT_COMMANDS_MAX_RAW_BYTES,
  BOT_COMMANDS_MAX_SUBTITLE_CHARS,
  BOT_COMMANDS_MAX_TITLE_CHARS,
  getStaticSlashCommandManifest,
  parseBotCommandManifest,
  utf8ByteLength,
} from './slashCommands';

const wireEntry = (overrides: Record<string, unknown> = {}) => ({
  command: '/allow',
  title: 'Allow',
  ...overrides,
});

const wireManifest = (
  commands: unknown[],
  extra: Record<string, unknown> = {}
) => JSON.stringify({ v: 1, commands, ...extra });

describe('parseBotCommandManifest', () => {
  test('contact key is the wire contract key', () => {
    expect(BOT_COMMANDS_CONTACT_KEY).toBe('bot-commands');
  });

  test('parses a valid manifest', () => {
    const raw = wireManifest([
      {
        command: '/allow',
        title: 'Allow',
        subtitle: 'Approve a pending request',
        keywords: ['approve'],
        insertText: '/allow ',
      },
      { command: '/pending', title: 'Pending', icon: 'Clock' },
    ]);
    expect(parseBotCommandManifest(raw)).toEqual({
      commands: [
        {
          command: '/allow',
          title: 'Allow',
          subtitle: 'Approve a pending request',
          keywords: ['approve'],
          insertText: '/allow ',
          priority: 1,
        },
        {
          command: '/pending',
          title: 'Pending',
          icon: 'Clock',
          priority: 2,
        },
      ],
    });
  });

  test('array order becomes priority', () => {
    const raw = wireManifest([
      wireEntry({ command: '/zebra', title: 'Zebra' }),
      wireEntry({ command: '/alpha', title: 'Alpha' }),
      wireEntry({ command: '/mid', title: 'Mid' }),
    ]);
    const parsed = parseBotCommandManifest(raw);
    expect(parsed?.commands.map((c) => [c.command, c.priority])).toEqual([
      ['/zebra', 1],
      ['/alpha', 2],
      ['/mid', 3],
    ]);
  });

  test('ignores unknown manifest and entry fields (forward compat)', () => {
    const raw = wireManifest(
      [wireEntry({ audience: 'owner', somethingElse: 42 })],
      { future: true }
    );
    const parsed = parseBotCommandManifest(raw);
    expect(parsed?.commands).toHaveLength(1);
    expect(parsed?.commands[0].command).toBe('/allow');
  });

  test('does not set an agent on parsed manifests', () => {
    const parsed = parseBotCommandManifest(wireManifest([wireEntry()]));
    expect(parsed?.agent).toBeUndefined();
  });

  test('caps entry count, keeping the first entries', () => {
    const commands = Array.from(
      { length: BOT_COMMANDS_MAX_ENTRIES + 5 },
      (_, i) => wireEntry({ command: `/cmd-${i}`, title: `Cmd ${i}` })
    );
    const parsed = parseBotCommandManifest(wireManifest(commands));
    expect(parsed?.commands).toHaveLength(BOT_COMMANDS_MAX_ENTRIES);
    expect(parsed?.commands[0].command).toBe('/cmd-0');
    expect(parsed?.commands[BOT_COMMANDS_MAX_ENTRIES - 1].command).toBe(
      `/cmd-${BOT_COMMANDS_MAX_ENTRIES - 1}`
    );
  });

  test('caps wire entries, not surviving entries', () => {
    // Invalid and duplicate entries inside the first-32 window are consumed by
    // the cap: a valid entry at wire position 33 is never read.
    const commands: unknown[] = [
      wireEntry({ command: '/first', title: 'First' }),
      wireEntry({ command: 'not-a-token', title: 'Invalid' }),
      wireEntry({ command: '/first', title: 'Duplicate' }),
    ];
    while (commands.length < BOT_COMMANDS_MAX_ENTRIES) {
      commands.push(
        wireEntry({
          command: `/cmd-${commands.length}`,
          title: `Cmd ${commands.length}`,
        })
      );
    }
    commands.push(wireEntry({ command: '/past-cap', title: 'Past cap' }));

    const tokens = parseBotCommandManifest(
      wireManifest(commands)
    )?.commands.map((c) => c.command);
    expect(tokens).not.toContain('/past-cap');
    // Two of the first 32 wire entries were dropped, so 30 survive.
    expect(tokens).toHaveLength(BOT_COMMANDS_MAX_ENTRIES - 2);
    expect(tokens?.[0]).toBe('/first');
  });

  test.each([
    ['title', BOT_COMMANDS_MAX_TITLE_CHARS],
    ['subtitle', BOT_COMMANDS_MAX_SUBTITLE_CHARS],
    ['icon', BOT_COMMANDS_MAX_ICON_CHARS],
    ['insertText', BOT_COMMANDS_MAX_INSERT_TEXT_CHARS],
  ])('accepts %s at exactly the cap and rejects one over', (field, cap) => {
    const atCap = wireManifest([
      wireEntry({ command: '/at-cap', [field]: 'x'.repeat(cap) }),
    ]);
    expect(parseBotCommandManifest(atCap)?.commands[0].command).toBe('/at-cap');

    const overCap = wireManifest([
      wireEntry({ command: '/over-cap', [field]: 'x'.repeat(cap + 1) }),
    ]);
    expect(parseBotCommandManifest(overCap)).toBeNull();
  });

  test.each([
    ['title', BOT_COMMANDS_MAX_TITLE_CHARS],
    ['subtitle', BOT_COMMANDS_MAX_SUBTITLE_CHARS],
    ['icon', BOT_COMMANDS_MAX_ICON_CHARS],
    ['insertText', BOT_COMMANDS_MAX_INSERT_TEXT_CHARS],
  ])('counts %s caps in code points, not UTF-16 units', (field, cap) => {
    // An astral character is one character to a publisher but two `.length`
    // units, so a cap-length emoji string must be accepted.
    const atCap = wireManifest([
      wireEntry({ command: '/astral', [field]: '🚀'.repeat(cap) }),
    ]);
    expect(parseBotCommandManifest(atCap)?.commands[0].command).toBe('/astral');

    const overCap = wireManifest([
      wireEntry({ command: '/astral-over', [field]: '🚀'.repeat(cap + 1) }),
    ]);
    expect(parseBotCommandManifest(overCap)).toBeNull();
  });

  test('counts keyword caps in code points', () => {
    const atCap = wireManifest([
      wireEntry({
        command: '/kw',
        keywords: ['🚀'.repeat(BOT_COMMANDS_MAX_KEYWORD_CHARS)],
      }),
    ]);
    expect(parseBotCommandManifest(atCap)?.commands[0].command).toBe('/kw');

    const overCap = wireManifest([
      wireEntry({
        command: '/kw-over',
        keywords: ['🚀'.repeat(BOT_COMMANDS_MAX_KEYWORD_CHARS + 1)],
      }),
    ]);
    expect(parseBotCommandManifest(overCap)).toBeNull();
  });

  test('accepts the maximum number of keywords', () => {
    const raw = wireManifest([
      wireEntry({
        command: '/kw-max',
        keywords: Array.from({ length: BOT_COMMANDS_MAX_KEYWORDS }, (_, i) =>
          String(i)
        ),
      }),
    ]);
    expect(parseBotCommandManifest(raw)?.commands[0].keywords).toHaveLength(
      BOT_COMMANDS_MAX_KEYWORDS
    );
  });

  test.each([
    'allow',
    '/with space',
    '/under_score',
    '/slash/inside',
    '/emoji-🚀',
    '/',
    `/${'a'.repeat(33)}`,
    '',
  ])('rejects command token %j', (command) => {
    const raw = wireManifest([wireEntry({ command })]);
    expect(parseBotCommandManifest(raw)).toBeNull();
  });

  test('accepts a command token at the max length', () => {
    const command = `/${'a'.repeat(32)}`;
    const raw = wireManifest([wireEntry({ command })]);
    expect(parseBotCommandManifest(raw)?.commands[0].command).toBe(command);
  });

  test('accepts mixed-case and dashed tokens (triggerable by the popup)', () => {
    const raw = wireManifest([
      wireEntry({ command: '/Owner-Listen', title: 'Owner listen' }),
    ]);
    expect(parseBotCommandManifest(raw)?.commands[0].command).toBe(
      '/Owner-Listen'
    );
  });

  test('skips an entry with a missing or non-string title', () => {
    const raw = wireManifest([
      wireEntry({ command: '/no-title', title: undefined }),
      wireEntry({ command: '/num-title', title: 42 }),
      wireEntry({ command: '/ok', title: 'Ok' }),
    ]);
    const parsed = parseBotCommandManifest(raw);
    expect(parsed?.commands.map((c) => c.command)).toEqual(['/ok']);
  });

  test('skips an entry whose title exceeds the cap', () => {
    const raw = wireManifest([
      wireEntry({
        command: '/long-title',
        title: 'x'.repeat(BOT_COMMANDS_MAX_TITLE_CHARS + 1),
      }),
      wireEntry({ command: '/ok', title: 'Ok' }),
    ]);
    expect(
      parseBotCommandManifest(raw)?.commands.map((c) => c.command)
    ).toEqual(['/ok']);
  });

  test('skips an entry whose subtitle exceeds the cap', () => {
    const raw = wireManifest([
      wireEntry({
        command: '/long-subtitle',
        subtitle: 'x'.repeat(BOT_COMMANDS_MAX_SUBTITLE_CHARS + 1),
      }),
      wireEntry({ command: '/ok', title: 'Ok' }),
    ]);
    expect(
      parseBotCommandManifest(raw)?.commands.map((c) => c.command)
    ).toEqual(['/ok']);
  });

  test('skips an entry whose icon exceeds the cap', () => {
    const raw = wireManifest([
      wireEntry({
        command: '/long-icon',
        icon: 'x'.repeat(BOT_COMMANDS_MAX_ICON_CHARS + 1),
      }),
      wireEntry({ command: '/ok', title: 'Ok' }),
    ]);
    expect(
      parseBotCommandManifest(raw)?.commands.map((c) => c.command)
    ).toEqual(['/ok']);
  });

  test('skips an entry whose insertText exceeds the cap', () => {
    const raw = wireManifest([
      wireEntry({
        command: '/long-insert',
        insertText: 'x'.repeat(BOT_COMMANDS_MAX_INSERT_TEXT_CHARS + 1),
      }),
      wireEntry({ command: '/ok', title: 'Ok' }),
    ]);
    expect(
      parseBotCommandManifest(raw)?.commands.map((c) => c.command)
    ).toEqual(['/ok']);
  });

  test('skips an entry with too many keywords', () => {
    const raw = wireManifest([
      wireEntry({
        command: '/many-keywords',
        keywords: Array.from(
          { length: BOT_COMMANDS_MAX_KEYWORDS + 1 },
          (_, i) => `k${i}`
        ),
      }),
      wireEntry({ command: '/ok', title: 'Ok' }),
    ]);
    expect(
      parseBotCommandManifest(raw)?.commands.map((c) => c.command)
    ).toEqual(['/ok']);
  });

  test('skips an entry with an overlong keyword', () => {
    const raw = wireManifest([
      wireEntry({
        command: '/long-keyword',
        keywords: ['x'.repeat(BOT_COMMANDS_MAX_KEYWORD_CHARS + 1)],
      }),
      wireEntry({ command: '/ok', title: 'Ok' }),
    ]);
    expect(
      parseBotCommandManifest(raw)?.commands.map((c) => c.command)
    ).toEqual(['/ok']);
  });

  test('skips an entry whose keywords are not strings', () => {
    const raw = wireManifest([
      wireEntry({ command: '/bad-keyword', keywords: ['ok', 7] }),
      wireEntry({ command: '/ok', title: 'Ok' }),
    ]);
    expect(
      parseBotCommandManifest(raw)?.commands.map((c) => c.command)
    ).toEqual(['/ok']);
  });

  test('rejects a raw manifest over the UTF-8 byte cap', () => {
    // Non-ASCII content: each é is 2 UTF-8 bytes, so this manifest is under
    // the cap in char count but over it in bytes. Every entry is individually
    // valid (subtitle within the 160-char cap); only the total size fails.
    const subtitle = 'é'.repeat(150);
    const commands = Array.from({ length: 30 }, (_, i) =>
      wireEntry({ command: `/c-${i}`, title: 'T', subtitle })
    );
    const raw = wireManifest(commands);
    expect(raw.length).toBeLessThan(BOT_COMMANDS_MAX_RAW_BYTES);
    expect(utf8ByteLength(raw)).toBeGreaterThan(BOT_COMMANDS_MAX_RAW_BYTES);
    expect(parseBotCommandManifest(raw)).toBeNull();
  });

  test('accepts a raw manifest under the byte cap with non-ASCII content', () => {
    const subtitle = 'é'.repeat(100);
    const raw = wireManifest([wireEntry({ subtitle })]);
    expect(utf8ByteLength(raw)).toBeLessThan(BOT_COMMANDS_MAX_RAW_BYTES);
    expect(parseBotCommandManifest(raw)?.commands[0].subtitle).toBe(subtitle);
  });

  test('rejects malformed JSON', () => {
    expect(parseBotCommandManifest('{"v":1,"commands":[')).toBeNull();
  });

  test('rejects non-string input', () => {
    expect(parseBotCommandManifest(undefined)).toBeNull();
    expect(parseBotCommandManifest(null)).toBeNull();
    expect(parseBotCommandManifest(42)).toBeNull();
    expect(parseBotCommandManifest({ v: 1, commands: [] })).toBeNull();
  });

  test('rejects JSON that is not an object', () => {
    expect(parseBotCommandManifest('null')).toBeNull();
    expect(parseBotCommandManifest('[1,2]')).toBeNull();
    expect(parseBotCommandManifest('"text"')).toBeNull();
  });

  test('rejects a wrong v', () => {
    expect(
      parseBotCommandManifest(JSON.stringify({ v: 2, commands: [wireEntry()] }))
    ).toBeNull();
    expect(
      parseBotCommandManifest(
        JSON.stringify({ v: '1', commands: [wireEntry()] })
      )
    ).toBeNull();
    expect(
      parseBotCommandManifest(JSON.stringify({ commands: [wireEntry()] }))
    ).toBeNull();
  });

  test('rejects a manifest without a commands array', () => {
    expect(parseBotCommandManifest(JSON.stringify({ v: 1 }))).toBeNull();
    expect(
      parseBotCommandManifest(JSON.stringify({ v: 1, commands: 'nope' }))
    ).toBeNull();
  });

  test('duplicate command tokens keep the first entry', () => {
    const raw = wireManifest([
      wireEntry({ title: 'First' }),
      wireEntry({ title: 'Second' }),
    ]);
    const parsed = parseBotCommandManifest(raw);
    expect(parsed?.commands).toHaveLength(1);
    expect(parsed?.commands[0].title).toBe('First');
    expect(parsed?.commands[0].priority).toBe(1);
  });

  test('skips invalid entries but keeps valid ones (entry-skip, not whole-reject)', () => {
    const raw = wireManifest([
      { command: '/bad token', title: 'Bad' },
      'not-an-object',
      null,
      wireEntry({ command: '/ok', title: 'Ok' }),
    ]);
    const parsed = parseBotCommandManifest(raw);
    expect(parsed?.commands.map((c) => c.command)).toEqual(['/ok']);
  });

  test('returns null when every entry is filtered out', () => {
    const raw = wireManifest([
      { command: 'missing-slash', title: 'Bad' },
      { command: '/no-title' },
    ]);
    expect(parseBotCommandManifest(raw)).toBeNull();
  });

  test('returns null for an empty commands array', () => {
    expect(parseBotCommandManifest(wireManifest([]))).toBeNull();
  });

  test('static fallback manifest still parses as a manifest', () => {
    const fallback = getStaticSlashCommandManifest('openclaw');
    expect(fallback.agent).toBe('openclaw');
    expect(fallback.commands.length).toBeGreaterThan(0);
  });
});
