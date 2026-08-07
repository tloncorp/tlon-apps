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
      ['groups', 'update', '~zod/g', '--description', '$(cat /tmp/nope.json)'],
      files({})
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('/tmp/nope.json');
    expect(!result.ok && result.error).toContain('no shell');
  });

  it('only substitutes flat JSON files in /tmp', () => {
    // The expansion is an arbitrary file read otherwise: a prompt-injected
    // message could steer the bot into writing local secrets into a
    // group-visible argument.
    for (const path of [
      '/etc/passwd',
      '/home/openclaw/.openclaw/openclaw.json',
      '/tmp/nested/config.json',
      '/tmp/../etc/x.json',
      '/tmp/config.txt',
    ]) {
      const result = repairTlonCommandArgs(
        ['groups', 'update', '~zod/g', '--description', `$(cat ${path})`],
        files({ [path]: CONFIG })
      );
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toContain('/tmp');
    }
  });

  it('re-checks the path after symlinks resolve', () => {
    const result = repairTlonCommandArgs(
      ['groups', 'update', '~zod/g', '--description', '$(cat /tmp/c.json)'],
      {
        ...files({ '/tmp/c.json': CONFIG }),
        realpath: () => '/home/openclaw/.openclaw/openclaw.json',
      }
    );
    expect(result.ok).toBe(false);
  });

  it('never expands a substitution outside the --description value', () => {
    const result = repairTlonCommandArgs(
      ['groups', 'update', '$(cat /tmp/c.json)', '--title', 'x'],
      files({ '/tmp/c.json': CONFIG })
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('--description');
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

  it('refuses a typed config entry the app would not recognize', () => {
    const wrongVersion = JSON.stringify([
      { type: 'tlon-group-agent-config', version: '1', agents: ['~zod'] },
    ]);
    const noAgents = JSON.stringify([
      { type: 'tlon-group-agent-config', version: 1, agents: [] },
    ]);
    const first = repairTlonCommandArgs(
      ['groups', 'update', '~zod/g', '--description', wrongVersion],
      files({})
    );
    expect(!first.ok && first.error).toContain('version');
    const second = repairTlonCommandArgs(
      ['groups', 'update', '~zod/g', '--description', noAgents],
      files({})
    );
    expect(!second.ok && second.error).toContain('agents');
  });

  it('refuses a single job object where an array belongs', () => {
    // The client reads a non-array "jobs" as no jobs at all, so the group
    // looks configured-but-jobless forever: the chrome stays locked, and
    // nothing flags it because the entry is otherwise well-formed.
    const objectJobs = JSON.stringify([
      {
        type: 'tlon-group-agent-config',
        version: 1,
        agents: ['~zod'],
        jobs: { id: 'digest', prompt: 'x' },
      },
    ]);
    const result = repairTlonCommandArgs(
      ['groups', 'update', '~zod/g', '--description', objectJobs],
      files({})
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('jobs');
    expect(!result.ok && result.error).toContain('array');
  });

  it('lets untyped arrays and bare markers through the tool', () => {
    // An array that never claims to be config is not the tool's business;
    // the monitor's repair nudge owns that judgement, where onboarding
    // context exists. The client's bare marker (typed, no jobs) is the
    // normal pre-setup write.
    const untyped = JSON.stringify([{ id: 'digest', prompt: 'x' }]);
    const marker = JSON.stringify([
      { type: 'tlon-group-agent-config', version: 1, agents: ['~zod'] },
    ]);
    for (const value of [untyped, marker]) {
      const result = repairTlonCommandArgs(
        ['groups', 'update', '~zod/g', '--description', value],
        files({})
      );
      expect(result.ok).toBe(true);
    }
  });

  it('refuses --stdin, which can never receive input through this tool', () => {
    // The tool spawns the CLI with an unwritten stdin pipe, so the CLI's
    // 30-second stdin read always times out — the note never lands. Fail
    // in zero milliseconds naming the flag that works.
    const note = repairTlonCommandArgs(
      ['notes', 'note-create', 'notes/~zod/d', 'root', 'Today', '--stdin'],
      files({})
    );
    expect(note.ok).toBe(false);
    expect(!note.ok && note.error).toContain('--markdown <file>');
    const description = repairTlonCommandArgs(
      ['groups', 'update', '~zod/g', '--description-stdin'],
      files({})
    );
    expect(description.ok).toBe(false);
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
