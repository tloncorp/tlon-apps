import {
  type SlashCommandOption,
  getStaticSlashCommandManifest,
} from '@tloncorp/shared/domain';
import { describe, expect, test } from 'vitest';

import {
  applySlashCommandSelection,
  computeSlashCommandState,
  getActiveCommandLength,
  rankSlashCommands,
} from './useSlashCommands';

const openclaw = getStaticSlashCommandManifest('openclaw').commands;
const hermes = getStaticSlashCommandManifest('hermes').commands;

const commandNames = (options: SlashCommandOption[]) =>
  options.map((o) => o.command);

describe('computeSlashCommandState', () => {
  test('empty text is inactive', () => {
    expect(computeSlashCommandState('', 0)).toEqual({
      isActive: false,
      query: '',
    });
  });

  test('bare slash at cursor 1 is active with empty query', () => {
    expect(computeSlashCommandState('/', 1)).toEqual({
      isActive: true,
      query: '',
    });
  });

  test('partial command is active with query', () => {
    expect(computeSlashCommandState('/st', 3)).toEqual({
      isActive: true,
      query: 'st',
    });
  });

  test('completed token followed by space is inactive', () => {
    expect(computeSlashCommandState('/status ', 8).isActive).toBe(false);
  });

  test('cursor past the token is inactive', () => {
    expect(computeSlashCommandState('/status foo', 11).isActive).toBe(false);
  });

  test('cursor inside the token stays active', () => {
    expect(computeSlashCommandState('/status foo', 4)).toEqual({
      isActive: true,
      query: 'sta',
    });
  });

  test('non-leading slash is inactive', () => {
    expect(computeSlashCommandState('hi /status', 10).isActive).toBe(false);
  });

  test('leading whitespace is inactive', () => {
    expect(computeSlashCommandState(' /status', 8).isActive).toBe(false);
  });

  test('double slash is inactive', () => {
    expect(computeSlashCommandState('//', 2).isActive).toBe(false);
  });

  test('illegal token char is inactive', () => {
    expect(computeSlashCommandState('/st@', 4).isActive).toBe(false);
  });

  test('native (undefined cursor): partial command is active', () => {
    expect(computeSlashCommandState('/sta')).toEqual({
      isActive: true,
      query: 'sta',
    });
  });

  test('native (undefined cursor): trailing text is inactive', () => {
    expect(computeSlashCommandState('/status foo').isActive).toBe(false);
  });

  test('paste of a full command is active', () => {
    // simulating a paste from '' to '/status' with cursor at end
    expect(computeSlashCommandState('/status', 7)).toEqual({
      isActive: true,
      query: 'status',
    });
  });

  test('newline bounds the token like a space', () => {
    expect(computeSlashCommandState('/status\nfoo', 4)).toEqual({
      isActive: true,
      query: 'sta',
    });
    expect(computeSlashCommandState('/status\nfoo', 11).isActive).toBe(false);
  });

  test('cursor at 0 is inactive', () => {
    expect(computeSlashCommandState('/status', 0).isActive).toBe(false);
  });
});

describe('rankSlashCommands', () => {
  test('empty query returns all commands ordered by priority', () => {
    const ranked = rankSlashCommands(openclaw, '');
    expect(ranked).toHaveLength(openclaw.length);
    const priorities = ranked.map((o) => o.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });

  test('prefix match ranks the command name first', () => {
    expect(rankSlashCommands(openclaw, 'ne')[0].command).toBe('/new');
  });

  test('shared prefix orders name-prefix matches by priority', () => {
    const ranked = commandNames(rankSlashCommands(openclaw, 'ban'));
    expect(ranked.slice(0, 2)).toEqual(['/ban', '/banned']);
    expect(ranked).toContain('/unban');
    // /unban only matches as a substring, so it ranks after the prefix matches
    expect(ranked.indexOf('/unban')).toBeGreaterThan(ranked.indexOf('/banned'));
  });

  test('keyword prefix matches at tier 1', () => {
    expect(rankSlashCommands(openclaw, 'approve')[0].command).toBe('/allow');
  });

  test('no match returns empty', () => {
    expect(rankSlashCommands(openclaw, 'zzz')).toEqual([]);
  });

  test('matching is case-insensitive', () => {
    expect(rankSlashCommands(openclaw, 'STAT')[0].command).toBe('/status');
  });

  test('hermes /compress is found via the compact keyword', () => {
    expect(rankSlashCommands(hermes, 'compact')[0].command).toBe('/compress');
  });
});

describe('applySlashCommandSelection', () => {
  const status = openclaw.find((o) => o.command === '/status')!;

  test('replaces the token with command + trailing space', () => {
    const result = applySlashCommandSelection('/st', status);
    expect(result.text).toBe('/status ');
    expect(result.delta).toBe('/status '.length - '/st'.length);
  });

  test('does not insert a double space before existing trailing text', () => {
    const result = applySlashCommandSelection('/st hello', status);
    expect(result.text).toBe('/status hello');
  });

  test('honors an insertText override', () => {
    const custom: SlashCommandOption = {
      command: '/custom',
      title: 'Custom',
      priority: 1,
      insertText: '/custom arg',
    };
    expect(applySlashCommandSelection('/cus', custom).text).toBe('/custom arg');
  });
});

describe('getActiveCommandLength', () => {
  test('exact command match returns its length', () => {
    expect(getActiveCommandLength('/status', openclaw)).toBe(7);
  });

  test('exact command with trailing text returns command length', () => {
    expect(getActiveCommandLength('/status hello', openclaw)).toBe(7);
  });

  test('a near-miss command does not highlight', () => {
    expect(getActiveCommandLength('/statuss', openclaw)).toBeNull();
    expect(getActiveCommandLength('/stat', openclaw)).toBeNull();
  });

  test('non-leading command does not highlight', () => {
    expect(getActiveCommandLength('hi /status', openclaw)).toBeNull();
  });

  test('empty command list does not highlight', () => {
    expect(getActiveCommandLength('/status', [])).toBeNull();
  });
});
