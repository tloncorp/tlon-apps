import { describe, expect, it } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { runTlonCommand } from '../../src/tlon-command-runner';
import { createTlonToolExecutor } from '../../src/tlon-tool-command';

const cli = fileURLToPath(
  new URL('../../../tlon-skill/scripts/main.ts', import.meta.url)
);
const execute = createTlonToolExecutor({
  runCommand: (args) =>
    runTlonCommand(
      process.execPath,
      [cli, ...args],
      { url: 'http://127.0.0.1:1', ship: '~zod', code: 'test-only' },
      { timeoutMs: 5000 }
    ),
  notifyDiaryMigrationDiscovery: async () => false,
});

describe('discovery through the real CLI and tool wrapper', () => {
  for (const command of [
    'help',
    '--help',
    '-h',
    'help notes',
    'notes --help',
    'help notes note-create',
    'notes note-create --help',
    'help groups create-owned',
    'help buckets upload',
    'help upload',
    'help browser handoff',
    'version',
    '--version',
    '-v',
  ]) {
    it(command, async () => {
      const result = await execute('discovery', { command });
      expect(result.details).toBeUndefined();
      expect(result.content[0].text.length).toBeGreaterThan(0);
      expect(result.content[0].text).not.toContain('Missing Urbit config');
    });
  }
  it('unknown-command guidance leads to working help', async () => {
    const failed = await execute('unknown', { command: 'invented-command' });
    expect(failed.details).toMatchObject({ status: 'error' });
    expect(failed.content[0].text).toContain('{"command":"help"}');
    expect(
      (await execute('recovery', { command: 'help' })).details
    ).toBeUndefined();
  });
  it('help aliases do not authorize writes', async () => {
    expect(
      (await execute('send', { command: 'dms send ~zod hello' })).details
    ).toMatchObject({ status: 'blocked' });
    expect(
      (
        await execute('migration', {
          command: 'notes migrate-apply diary/~zod/test --yes',
        })
      ).details
    ).toMatchObject({ status: 'blocked' });
  });
});
