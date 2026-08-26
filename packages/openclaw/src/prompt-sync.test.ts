import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_PROMPT_BYTES,
  PROMPT_FILE_NAMES,
  applyPromptsToWorkspace,
  createPromptSync,
  isAllowedPromptName,
  parsePromptSetFact,
  parseStoredPromptsScry,
  promptsDiffer,
  readEffectivePrompts,
  writePromptsIntoConfigDraft,
} from './prompt-sync.js';

const logger = { log: vi.fn(), warn: vi.fn() };

let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-sync-'));
  logger.log.mockClear();
  logger.warn.mockClear();
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('isAllowedPromptName', () => {
  it('accepts every allowlisted file', () => {
    for (const name of PROMPT_FILE_NAMES) {
      expect(isAllowedPromptName(name)).toBe(true);
    }
  });

  it('rejects path traversal, unknown names, and non-strings', () => {
    expect(isAllowedPromptName('../SOUL.md')).toBe(false);
    expect(isAllowedPromptName('MEMORY.md')).toBe(false);
    expect(isAllowedPromptName('soul.md')).toBe(false);
    expect(isAllowedPromptName(42)).toBe(false);
    expect(isAllowedPromptName(null)).toBe(false);
  });
});

describe('parseStoredPromptsScry', () => {
  it('extracts allowlisted owner-edited name -> text pairs', () => {
    const result = parseStoredPromptsScry({
      prompts: {
        bot: '~zod',
        prompts: {
          'SOUL.md': { text: 'be kind', updated: '~2026.8.26', edited: true },
          'AGENTS.md': {
            text: 'do things',
            updated: '~2026.8.26',
            edited: true,
          },
        },
      },
    });
    expect(result).toEqual({ 'SOUL.md': 'be kind', 'AGENTS.md': 'do things' });
  });

  it('skips un-edited entries (they only mirror our own files)', () => {
    const result = parseStoredPromptsScry({
      prompts: {
        bot: '~zod',
        prompts: {
          'SOUL.md': { text: 'seeded', updated: '~2026.8.26', edited: false },
          'TOOLS.md': { text: 'no flag', updated: '~2026.8.26' },
          'BOOT.md': { text: 'pinned', updated: '~2026.8.26', edited: true },
        },
      },
    });
    expect(result).toEqual({ 'BOOT.md': 'pinned' });
  });

  it('drops unknown names, oversized texts, and malformed entries', () => {
    const result = parseStoredPromptsScry({
      prompts: {
        bot: '~zod',
        prompts: {
          '../evil.md': { text: 'x', edited: true },
          'SOUL.md': { text: 'a'.repeat(MAX_PROMPT_BYTES + 1), edited: true },
          'USER.md': { text: 7, edited: true },
          'BOOT.md': { text: 'ok', edited: true },
        },
      },
    });
    expect(result).toEqual({ 'BOOT.md': 'ok' });
  });

  it('returns empty for junk payloads', () => {
    expect(parseStoredPromptsScry(null)).toEqual({});
    expect(parseStoredPromptsScry('nope')).toEqual({});
    expect(parseStoredPromptsScry({ prompts: { prompts: 'nope' } })).toEqual(
      {}
    );
  });
});

describe('parsePromptSetFact', () => {
  it('parses a %set fact', () => {
    expect(
      parsePromptSetFact({
        set: { name: 'SOUL.md', prompt: { text: 'be kind', updated: '~x' } },
      })
    ).toEqual({ name: 'SOUL.md', text: 'be kind' });
  });

  it('ignores %prompts facts and invalid sets', () => {
    expect(
      parsePromptSetFact({ prompts: { bot: '~zod', prompts: {} } })
    ).toBeNull();
    expect(
      parsePromptSetFact({ set: { name: 'HAX.md', prompt: { text: 'x' } } })
    ).toBeNull();
    expect(
      parsePromptSetFact({ set: { name: 'SOUL.md', prompt: { text: 9 } } })
    ).toBeNull();
    expect(parsePromptSetFact(null)).toBeNull();
  });
});

describe('applyPromptsToWorkspace / readEffectivePrompts', () => {
  it('writes changed files, skips identical ones, reads them back', async () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'unchanged');
    const first = await applyPromptsToWorkspace({
      workspaceDir: tmpDir,
      prompts: { 'SOUL.md': 'be kind', 'AGENTS.md': 'unchanged' },
      logger,
    });
    expect(first.ok).toBe(true);
    expect(first.applied).toEqual(['SOUL.md']);

    const again = await applyPromptsToWorkspace({
      workspaceDir: tmpDir,
      prompts: { 'SOUL.md': 'be kind' },
      logger,
    });
    expect(again.applied).toEqual([]);

    const effective = await readEffectivePrompts(tmpDir, logger);
    expect(effective).toEqual({
      'SOUL.md': 'be kind',
      'AGENTS.md': 'unchanged',
    });
  });

  it('never writes disallowed names', async () => {
    const result = await applyPromptsToWorkspace({
      workspaceDir: tmpDir,
      prompts: { '../escape.md': 'evil', 'MEMORY.md': 'evil' },
      logger,
    });
    expect(result.applied).toEqual([]);
    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });

  it('reports ok=false when a write fails', async () => {
    fs.mkdirSync(path.join(tmpDir, 'SOUL.md'));
    const result = await applyPromptsToWorkspace({
      workspaceDir: tmpDir,
      prompts: { 'SOUL.md': 'be kind' },
      logger,
    });
    expect(result.ok).toBe(false);
  });
});

describe('writePromptsIntoConfigDraft', () => {
  it('merges into channels.tlon.prompts for the default account', () => {
    const draft: Record<string, unknown> = {
      channels: { tlon: { prompts: { 'BOOT.md': 'old' } } },
    };
    writePromptsIntoConfigDraft(draft, 'default', { 'SOUL.md': 'be kind' });
    expect(draft).toEqual({
      channels: {
        tlon: { prompts: { 'BOOT.md': 'old', 'SOUL.md': 'be kind' } },
      },
    });
  });

  it('targets accounts[id].prompts for non-default accounts', () => {
    const draft: Record<string, unknown> = {};
    writePromptsIntoConfigDraft(draft, 'alt', { 'SOUL.md': 'be kind' });
    expect(draft).toEqual({
      channels: {
        tlon: { accounts: { alt: { prompts: { 'SOUL.md': 'be kind' } } } },
      },
    });
  });
});

describe('promptsDiffer', () => {
  it('detects added and changed entries only', () => {
    expect(promptsDiffer({}, { 'SOUL.md': 'x' })).toBe(true);
    expect(promptsDiffer({ 'SOUL.md': 'x' }, { 'SOUL.md': 'y' })).toBe(true);
    expect(promptsDiffer({ 'SOUL.md': 'x' }, { 'SOUL.md': 'x' })).toBe(false);
    // entries only in `current` don't count — the ship is backfilled by seed
    expect(promptsDiffer({ 'SOUL.md': 'x' }, {})).toBe(false);
  });
});

function makeCore() {
  const mutateConfigFile = vi.fn(
    async (params: { mutate: (draft: unknown) => unknown }) => {
      const draft: Record<string, unknown> = {};
      await params.mutate(draft);
      return { draft } as never;
    }
  );
  return { config: { mutateConfigFile } } as never as Parameters<
    typeof createPromptSync
  >[0]['core'] & { config: { mutateConfigFile: typeof mutateConfigFile } };
}

describe('createPromptSync.startup', () => {
  it('applies stored prompts, persists the cache, and seeds effective files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'from archive');
    const core = makeCore();
    const poke = vi.fn(async () => ({}));
    const sync = createPromptSync({
      core,
      accountId: 'default',
      workspaceDir: tmpDir,
      configPrompts: {},
      scry: async () => ({
        prompts: {
          bot: '~zod',
          prompts: {
            'SOUL.md': { text: 'stored edit', updated: '~x', edited: true },
          },
        },
      }),
      poke,
      logger,
    });
    await sync.startup();

    expect(fs.readFileSync(path.join(tmpDir, 'SOUL.md'), 'utf8')).toBe(
      'stored edit'
    );
    expect(core.config.mutateConfigFile).toHaveBeenCalledWith(
      expect.objectContaining({
        afterWrite: expect.objectContaining({ mode: 'none' }),
      })
    );
    expect(poke).toHaveBeenCalledWith({
      app: 'steward',
      mark: 'steward-prompts-action-1',
      json: {
        seed: { 'AGENTS.md': 'from archive', 'SOUL.md': 'stored edit' },
      },
    });
  });

  it('does not seed when the scry fails (older ships)', async () => {
    const poke = vi.fn(async () => ({}));
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      workspaceDir: tmpDir,
      configPrompts: {},
      scry: async () => {
        throw new Error('404');
      },
      poke,
      logger,
    });
    await sync.startup();
    expect(poke).not.toHaveBeenCalled();
  });

  it('skips seeding when a stored prompt failed to apply', async () => {
    // A directory at the target path makes the write fail.
    fs.mkdirSync(path.join(tmpDir, 'SOUL.md'));
    const poke = vi.fn(async () => ({}));
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      workspaceDir: tmpDir,
      configPrompts: {},
      scry: async () => ({
        prompts: {
          bot: '~zod',
          prompts: {
            'SOUL.md': { text: 'stored edit', updated: '~x', edited: true },
          },
        },
      }),
      poke,
      logger,
    });
    await sync.startup();
    expect(poke).not.toHaveBeenCalled();
  });
});

describe('createPromptSync serialization', () => {
  it('runs a fact received mid-startup only after startup finishes', async () => {
    const order: string[] = [];
    let releaseScry!: () => void;
    const scryGate = new Promise<void>((resolve) => {
      releaseScry = resolve;
    });
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      workspaceDir: tmpDir,
      configPrompts: {},
      scry: async () => {
        order.push('scry');
        await scryGate;
        return {};
      },
      poke: async () => ({}),
      logger,
    });
    const startupDone = sync.startup().then(() => order.push('startup-done'));
    const factDone = sync
      .handleFact({
        set: { name: 'SOUL.md', prompt: { text: 'mid-flight', updated: '~x' } },
      })
      .then(() => order.push('fact-done'));
    releaseScry();
    await Promise.all([startupDone, factDone]);
    expect(order).toEqual(['scry', 'startup-done', 'fact-done']);
    expect(fs.readFileSync(path.join(tmpDir, 'SOUL.md'), 'utf8')).toBe(
      'mid-flight'
    );
  });
});

describe('createPromptSync.handleFact', () => {
  it('applies a %set edit and persists with a restart', async () => {
    const core = makeCore();
    const sync = createPromptSync({
      core,
      accountId: 'default',
      workspaceDir: tmpDir,
      configPrompts: {},
      scry: async () => ({}),
      poke: async () => ({}),
      logger,
    });
    await sync.handleFact({
      set: { name: 'SOUL.md', prompt: { text: 'edited', updated: '~x' } },
    });
    expect(fs.readFileSync(path.join(tmpDir, 'SOUL.md'), 'utf8')).toBe(
      'edited'
    );
    expect(core.config.mutateConfigFile).toHaveBeenCalledWith(
      expect.objectContaining({
        afterWrite: expect.objectContaining({ mode: 'restart' }),
      })
    );
  });

  it('ignores %prompts echo facts', async () => {
    const core = makeCore();
    const sync = createPromptSync({
      core,
      accountId: 'default',
      workspaceDir: tmpDir,
      configPrompts: {},
      scry: async () => ({}),
      poke: async () => ({}),
      logger,
    });
    await sync.handleFact({ prompts: { bot: '~zod', prompts: {} } });
    expect(core.config.mutateConfigFile).not.toHaveBeenCalled();
    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });
});
