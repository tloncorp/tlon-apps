import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTlonCommand } from '../../src/tlon-command-runner';
import { createTlonToolExecutor } from '../../src/tlon-tool-command';

const workspaces: string[] = [];
afterEach(() => {
  for (const dir of workspaces.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe('notebook files through the OpenClaw tool wrapper', () => {
  it('creates, updates, and reads a note using relative workspace files across isolated agents', async () => {
    const fixture = fileURLToPath(
      new URL(
        '../../../tlon-skill/tests/fixtures/notes-tool-cli.ts',
        import.meta.url
      )
    );
    for (const label of ['primary', 'other-agent']) {
      const workspace = mkdtempSync(join(tmpdir(), 'tlon-tool-workspace-'));
      workspaces.push(workspace);
      const execute = createTlonToolExecutor({
        runCommand: (args) =>
          runTlonCommand(process.execPath, [fixture, ...args], undefined, {
            cwd: workspace,
            timeoutMs: 5_000,
          }),
        notifyDiaryMigrationDiscovery: async () => false,
      });
      // Equivalent to read/write's workspace-relative file behavior.
      writeFileSync(join(workspace, 'draft.md'), `# Draft for ${label}`);
      const created = await execute('create', {
        command:
          'notes note-create notes/~zod/blog root "Title" --markdown draft.md',
      });
      expect(created.details).toBeUndefined();
      expect(
        JSON.parse(
          readFileSync(join(workspace, 'notebook-fixture.json'), 'utf8')
        ).bodyMd
      ).toBe(`# Draft for ${label}`);
      writeFileSync(join(workspace, 'draft.md'), `# Updated for ${label}`);
      const updated = await execute('update', {
        command:
          'notes note-update notes/~zod/blog 1 --body draft.md --expected-revision 0',
      });
      expect(updated.details).toBeUndefined();
      const read = await execute('read', {
        command: 'notes note notes/~zod/blog 1',
      });
      expect(read.details).toBeUndefined();
      expect(read.content[0].text).toContain(`# Updated for ${label}`);
      expect(read.content[0].text).toContain('Revision: 1');
    }
  });
});
