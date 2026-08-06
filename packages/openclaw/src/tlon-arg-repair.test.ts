import { describe, expect, it } from 'vitest';

import { repairTlonCommandArgs } from './tlon-arg-repair.js';

const CONFIG = JSON.stringify([
  {
    type: 'tlon-group-agent-config',
    version: 1,
    agents: ['~zod'],
    jobs: [{ id: 'digest', prompt: "Put together today's digest." }],
  },
]);

const files = (map: Record<string, string>) => ({
  readFile: (path: string) => {
    const value = map[path];
    if (value === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return value;
  },
});

describe('repairTlonCommandArgs', () => {
  it('expands an argument that is exactly $(cat <file>)', () => {
    // Observed live: the tool runs no shell, so this arrived as the
    // *literal* description of a group, and the setup stalled silently.
    const result = repairTlonCommandArgs(
      ['groups', 'update', '~zod/g', '--description', '$(cat /tmp/c.json)'],
      files({ '/tmp/c.json': `${CONFIG}\n` })
    );
    expect(result).toEqual({
      ok: true,
      args: ['groups', 'update', '~zod/g', '--description', CONFIG],
      expandedPaths: ['/tmp/c.json'],
    });
  });

  it('merges the unquoted form the tokenizer split in two', () => {
    const result = repairTlonCommandArgs(
      ['groups', 'update', '~zod/g', '--description', '$(cat', '/tmp/c.json)'],
      files({ '/tmp/c.json': CONFIG })
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.args[4]).toBe(CONFIG);
  });

  it('supports the $(< file) spelling', () => {
    const result = repairTlonCommandArgs(
      ['groups', 'update', '~zod/g', '--description', '$(< /tmp/c.json)'],
      files({ '/tmp/c.json': CONFIG })
    );
    expect(result.ok && result.args[4]).toBe(CONFIG);
  });

  it('tells the model when the substituted file cannot be read', () => {
    const result = repairTlonCommandArgs(
      ['groups', 'update', '~zod/g', '--description', '$(cat /tmp/nope)'],
      files({})
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('/tmp/nope');
    expect(!result.ok && result.error).toContain('no shell');
  });

  it('refuses a config-shaped description that does not parse', () => {
    // The other live failure: hand-escaped quoting ate the JSON
    // mid-string and the CLI stored the truncated front half.
    const truncated = CONFIG.slice(0, 90);
    const result = repairTlonCommandArgs(
      ['groups', 'update', '~zod/g', '--description', truncated],
      files({})
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('not valid JSON');
    expect(!result.ok && result.error).toContain('$(cat <file>)');
  });

  it('refuses a description still carrying an unexpanded substitution', () => {
    const result = repairTlonCommandArgs(
      ['groups', 'update', '~zod/g', '--description', 'x $(cat /tmp/c) y'],
      files({})
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('unexpanded');
  });

  it('leaves ordinary commands and prose descriptions alone', () => {
    const args = [
      'groups',
      'update',
      '~zod/g',
      '--description',
      'a group about bread',
    ];
    expect(repairTlonCommandArgs(args, files({}))).toEqual({
      ok: true,
      args,
      expandedPaths: [],
    });
    const list = ['groups', 'list'];
    expect(repairTlonCommandArgs(list, files({}))).toEqual({
      ok: true,
      args: list,
      expandedPaths: [],
    });
  });
});
