import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_PROMPT_BYTES,
  collectAppliedPromptMarker,
  collectPromptFileStamps,
  shipHasPromptSyncAuthority,
  PROMPT_FILE_NAMES,
  applyPromptsToWorkspace,
  collectForeignPromptCaches,
  createPromptSync,
  isAllowedPromptName,
  parsePromptSetFact,
  parseStoredPromptsScry,
  promptsDiffer,
  readEffectivePrompts,
  shouldRunPromptSync,
  writePromptsIntoConfigDraft,
} from './prompt-sync.js';

function makeAccountsConfig(tlon: Record<string, unknown>) {
  return { channels: { tlon } } as never;
}

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
          'BOOTSTRAP.md': {
            text: 'pinned',
            updated: '~2026.8.26',
            edited: true,
          },
        },
      },
    });
    expect(result).toEqual({ 'BOOTSTRAP.md': 'pinned' });
  });

  it('drops unknown names, oversized texts, and malformed entries', () => {
    const result = parseStoredPromptsScry({
      prompts: {
        bot: '~zod',
        prompts: {
          '../evil.md': { text: 'x', edited: true },
          'SOUL.md': { text: 'a'.repeat(MAX_PROMPT_BYTES + 1), edited: true },
          'USER.md': { text: 7, edited: true },
          'BOOTSTRAP.md': { text: 'ok', edited: true },
        },
      },
    });
    expect(result).toEqual({ 'BOOTSTRAP.md': 'ok' });
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
    expect(effective.ok).toBe(true);
    expect(effective.prompts).toEqual({
      'SOUL.md': 'be kind',
      'AGENTS.md': 'unchanged',
    });
  });

  it('reports ok=false when a prompt file read fails (non-ENOENT)', async () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'readable');
    fs.writeFileSync(path.join(tmpDir, 'SOUL.md'), 'unreadable');
    const realReadFile = fs.promises.readFile.bind(fs.promises);
    const readSpy = vi
      .spyOn(fs.promises, 'readFile')
      .mockImplementation(async (file, ...rest) => {
        if (String(file).endsWith('SOUL.md')) {
          throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
        }
        return realReadFile(file as never, ...(rest as never[]));
      });
    try {
      const effective = await readEffectivePrompts(tmpDir, logger);
      // The partial map must not be seeded as authoritative — %steward
      // would drop the unreadable file's un-edited entry even though the
      // gateway still runs it.
      expect(effective.ok).toBe(false);
      expect(effective.prompts).toEqual({ 'AGENTS.md': 'readable' });
    } finally {
      readSpy.mockRestore();
    }
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
    writePromptsIntoConfigDraft(draft, 'default', '~zod', {
      'SOUL.md': 'be kind',
    });
    expect(draft).toEqual({
      channels: {
        tlon: {
          prompts: { 'BOOT.md': 'old', 'SOUL.md': 'be kind' },
          promptsShip: '~zod',
          promptSync: { ships: { '~zod': { 'SOUL.md': ['be kind'] } } },
        },
      },
    });
  });

  it('targets accounts[id].prompts for non-default accounts', () => {
    const draft: Record<string, unknown> = {};
    writePromptsIntoConfigDraft(draft, 'alt', '~bus', {
      'SOUL.md': 'be kind',
    });
    expect(draft).toEqual({
      channels: {
        tlon: {
          accounts: {
            alt: { prompts: { 'SOUL.md': 'be kind' }, promptsShip: '~bus' },
          },
          promptSync: { ships: { '~bus': { 'SOUL.md': ['be kind'] } } },
        },
      },
    });
  });

  it('merges the shadow ledger without dropping other ships', () => {
    const draft: Record<string, unknown> = {
      channels: {
        tlon: {
          promptSync: {
            ships: { '~fed': { 'USER.md': 'deleted account edit' } },
          },
        },
      },
    };
    writePromptsIntoConfigDraft(draft, 'default', '~zod', {
      'SOUL.md': 'be kind',
    });
    expect((draft as any).channels.tlon.promptSync.ships).toEqual({
      '~fed': { 'USER.md': 'deleted account edit' },
      '~zod': { 'SOUL.md': ['be kind'] },
    });
  });

  it('drops a cache stamped for a different ship on repoint', () => {
    const draft: Record<string, unknown> = {
      channels: {
        tlon: {
          prompts: { 'USER.md': 'old ship private notes' },
          promptsShip: '~zod',
        },
      },
    };
    writePromptsIntoConfigDraft(draft, 'default', '~bus', {
      'SOUL.md': 'new ship edit',
    });
    const tlon = (draft as any).channels.tlon;
    // The old ship's cache is not merged into the new ship's.
    expect(tlon.prompts).toEqual({ 'SOUL.md': 'new ship edit' });
    expect(tlon.promptsShip).toBe('~bus');
    expect(tlon.promptSync.ships).toEqual({
      '~bus': { 'SOUL.md': ['new ship edit'] },
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
    const poke = vi.fn(
      async (_params: { app: string; mark: string; json: unknown }) => ({})
    );
    const sync = createPromptSync({
      core,
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      owner: '~ten',
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
    // The owner configure precedes the seed so the seed's fan-out reaches
    // the owner's mirror. Prompt sync does this itself: gateway-status
    // activation is gated to single-account configs and the lens configure
    // is gated on the lens being enabled.
    expect(poke).toHaveBeenNthCalledWith(1, {
      app: 'steward',
      mark: 'steward-action-1',
      json: { configure: { owner: '~ten' } },
    });
    expect(poke).toHaveBeenNthCalledWith(2, {
      app: 'steward',
      mark: 'steward-prompts-action-1',
      json: {
        seed: { 'AGENTS.md': 'from archive', 'SOUL.md': 'stored edit' },
      },
    });
  });

  it('aborts reconciliation when the owner configure fails', async () => {
    // Seeding under an unconfirmed ownership state could fan the prompt
    // set to a former owner, so a failed configure stops the whole pass.
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'from archive');
    const scry = vi.fn(async () => ({}));
    const poke = vi.fn(async (params: { mark: string }) => {
      if (params.mark === 'steward-action-1') {
        throw new Error('nacked');
      }
      return {};
    });
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      owner: '~ten',
      scry,
      poke,
      logger,
      retryDelaysMs: [],
    });
    await sync.startup();
    expect(scry).not.toHaveBeenCalled();
    expect(poke).not.toHaveBeenCalledWith(
      expect.objectContaining({ mark: 'steward-prompts-action-1' })
    );
  });

  it('retries a transiently failed configure poke and scry', async () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'from archive');
    let configureAttempts = 0;
    let scryAttempts = 0;
    const poke = vi.fn(async (params: { mark: string }) => {
      if (params.mark === 'steward-action-1' && configureAttempts++ === 0) {
        throw new Error('socket hang up');
      }
      return {};
    });
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      owner: '~ten',
      scry: async () => {
        if (scryAttempts++ === 0) {
          throw new Error('Scry failed: 502 for path /steward/v1/prompts.json');
        }
        return {};
      },
      poke,
      logger,
      retryDelaysMs: [0, 0],
    });
    await sync.startup();
    expect(configureAttempts).toBe(2);
    expect(scryAttempts).toBe(2);
    expect(poke).toHaveBeenCalledWith(
      expect.objectContaining({ mark: 'steward-prompts-action-1' })
    );
  });

  it('does not retry a missing-module 404 scry', async () => {
    const scry = vi.fn(async () => {
      throw new Error('Scry failed: 404 for path /steward/v1/prompts.json');
    });
    const poke = vi.fn(
      async (_params: { app: string; mark: string; json: unknown }) => ({})
    );
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      owner: null,
      scry,
      poke,
      logger,
      retryDelaysMs: [0, 0],
    });
    await sync.startup();
    expect(scry).toHaveBeenCalledTimes(1);
    expect(poke).not.toHaveBeenCalledWith(
      expect.objectContaining({ mark: 'steward-prompts-action-1' })
    );
  });

  it('pokes %unconfigure when the config no longer names an owner', async () => {
    const poke = vi.fn(
      async (_params: { app: string; mark: string; json: unknown }) => ({})
    );
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      owner: null,
      scry: async () => ({}),
      poke,
      logger,
    });
    await sync.startup();
    expect(poke).toHaveBeenCalledWith({
      app: 'steward',
      mark: 'steward-action-1',
      json: { unconfigure: null },
    });
  });

  it('does not seed when the scry fails (older ships)', async () => {
    const poke = vi.fn(
      async (_params: { app: string; mark: string; json: unknown }) => ({})
    );
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      owner: null,
      scry: async () => {
        throw new Error('404');
      },
      poke,
      logger,
      retryDelaysMs: [],
    });
    await sync.startup();
    // Only the owner unconfigure went out — no seed.
    expect(poke).toHaveBeenCalledTimes(1);
    expect(poke).toHaveBeenCalledWith({
      app: 'steward',
      mark: 'steward-action-1',
      json: { unconfigure: null },
    });
  });

  it('skips seeding when a stored prompt failed to apply', async () => {
    // A directory at the target path makes the write fail.
    fs.mkdirSync(path.join(tmpDir, 'SOUL.md'));
    const poke = vi.fn(
      async (_params: { app: string; mark: string; json: unknown }) => ({})
    );
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      owner: null,
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
    expect(poke).not.toHaveBeenCalledWith(
      expect.objectContaining({ mark: 'steward-prompts-action-1' })
    );
  });
});

describe('shouldRunPromptSync', () => {
  const creds = { ship: '~zod', url: 'http://x', code: 'c' };

  it('always allows the default account', () => {
    expect(
      shouldRunPromptSync(makeAccountsConfig({ ...creds }), 'default')
    ).toBe(true);
  });

  it('allows a sole named account', () => {
    const cfg = makeAccountsConfig({ accounts: { hosted: { ...creds } } });
    expect(shouldRunPromptSync(cfg, 'hosted')).toBe(true);
  });

  it('blocks a named account when the default account also runs', () => {
    const cfg = makeAccountsConfig({
      ...creds,
      accounts: { hosted: { ...creds, ship: '~bus' } },
    });
    expect(shouldRunPromptSync(cfg, 'hosted')).toBe(false);
    expect(shouldRunPromptSync(cfg, 'default')).toBe(true);
  });

  it('blocks every named account when several run', () => {
    const cfg = makeAccountsConfig({
      accounts: {
        one: { ...creds },
        two: { ...creds, ship: '~bus' },
      },
    });
    expect(shouldRunPromptSync(cfg, 'one')).toBe(false);
    expect(shouldRunPromptSync(cfg, 'two')).toBe(false);
  });

  it('ignores disabled accounts when counting', () => {
    const cfg = makeAccountsConfig({
      accounts: {
        one: { ...creds },
        two: { ...creds, ship: '~bus', enabled: false },
      },
    });
    expect(shouldRunPromptSync(cfg, 'one')).toBe(true);
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
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      owner: null,
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
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      owner: null,
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
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      owner: null,
      scry: async () => ({}),
      poke: async () => ({}),
      logger,
    });
    await sync.handleFact({ prompts: { bot: '~zod', prompts: {} } });
    expect(core.config.mutateConfigFile).not.toHaveBeenCalled();
    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });
});

describe('createPromptSync retries and teardown', () => {
  it('retries a transiently failed seed poke', async () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'from archive');
    let seedAttempts = 0;
    const poke = vi.fn(async (params: { mark: string }) => {
      if (params.mark === 'steward-prompts-action-1' && seedAttempts++ === 0) {
        throw new Error('socket hang up');
      }
      return {};
    });
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      owner: '~ten',
      scry: async () => ({}),
      poke,
      logger,
      retryDelaysMs: [0],
    });
    await sync.startup();
    expect(seedAttempts).toBe(2);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Seeded 1 system prompts')
    );
  });

  it('does nothing when the monitor is already torn down', async () => {
    const controller = new AbortController();
    controller.abort();
    const scry = vi.fn(async () => ({}));
    const poke = vi.fn(
      async (_params: { app: string; mark: string; json: unknown }) => ({})
    );
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      owner: '~ten',
      scry,
      poke,
      logger,
      abortSignal: controller.signal,
    });
    await sync.startup();
    await sync.handleFact({
      set: { name: 'SOUL.md', prompt: { text: 'late edit', updated: '~x' } },
    });
    expect(scry).not.toHaveBeenCalled();
    expect(poke).not.toHaveBeenCalled();
    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });

  it('stops retry backoff promptly on abort', async () => {
    const controller = new AbortController();
    const scry = vi.fn(async () => {
      throw new Error('Scry failed: 502 for path /steward/v1/prompts.json');
    });
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      owner: null,
      scry,
      poke: async () => ({}),
      logger,
      abortSignal: controller.signal,
      // Would sit out a full minute if teardown didn't cancel the sleep.
      retryDelaysMs: [60_000],
    });
    setTimeout(() => controller.abort(), 20);
    const started = Date.now();
    await sync.startup();
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(scry).toHaveBeenCalledTimes(1);
  });
});

describe('applyPromptsToWorkspace teardown', () => {
  it('does not publish the rename once torn down mid-write', async () => {
    // The workspace is shared: a replacement monitor for a different bot
    // can clean and repopulate it while we sit in writeFile, and renaming
    // after that publishes our text under its ownership stamp — which no
    // later cleanup can recognize as foreign.
    let aborted = false;
    const writeFileSpy = vi
      .spyOn(fs.promises, 'writeFile')
      .mockImplementation(async (file, data, options) => {
        aborted = true;
        fs.writeFileSync(file as fs.PathLike, data as string, options as never);
      });
    try {
      const result = await applyPromptsToWorkspace({
        workspaceDir: tmpDir,
        prompts: { 'SOUL.md': 'our private text' },
        logger,
        aborted: () => aborted,
      });
      expect(result.ok).toBe(false);
      expect(result.applied).toEqual([]);
      expect(fs.existsSync(path.join(tmpDir, 'SOUL.md'))).toBe(false);
      // The abandoned temp file is cleaned up rather than left behind.
      expect(fs.readdirSync(tmpDir)).toEqual([]);
    } finally {
      writeFileSpy.mockRestore();
    }
  });

  it('stops before the next file when teardown lands between writes', async () => {
    const order: string[] = [];
    let aborted = false;
    const result = await applyPromptsToWorkspace({
      workspaceDir: tmpDir,
      prompts: { 'AGENTS.md': 'first', 'SOUL.md': 'second' },
      logger,
      aborted: () => {
        order.push('checked');
        // Torn down after the first file is published.
        const stop = aborted;
        aborted = order.length >= 2;
        return stop;
      },
    });
    expect(result.applied).toEqual(['AGENTS.md']);
    expect(result.ok).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'SOUL.md'))).toBe(false);
  });
});

describe('createPromptSync abort during foreign cleanup', () => {
  it('does not apply prompts when teardown lands mid-cleanup', async () => {
    // A replacement monitor may already have written the workspace for a
    // different bot by now; renaming our cached prompts over those files
    // would leave it running our text (the stamping config write that
    // follows is refused, so nothing would even record the overwrite).
    const controller = new AbortController();
    fs.writeFileSync(path.join(tmpDir, 'USER.md'), 'former owner notes');
    const unlinkSpy = vi
      .spyOn(fs.promises, 'unlink')
      .mockImplementation(async (file) => {
        controller.abort();
        fs.unlinkSync(file as fs.PathLike);
      });
    try {
      const sync = createPromptSync({
        core: makeCore(),
        accountId: 'default',
        botShip: '~zod',
        workspaceDir: tmpDir,
        configPrompts: { 'SOUL.md': 'our edit' },
        fileStamps: { 'USER.md': '~bus' },
        owner: null,
        scry: async () => ({}),
        poke: async () => ({}),
        logger,
        abortSignal: controller.signal,
      });
      await sync.startup();
      // The foreign file still goes (leaving it would keep private text on
      // the shared workspace), but nothing of ours is written after it.
      expect(fs.existsSync(path.join(tmpDir, 'USER.md'))).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, 'SOUL.md'))).toBe(false);
    } finally {
      unlinkSpy.mockRestore();
    }
  });
});

describe('createPromptSync abort before a foreign unlink', () => {
  it('leaves the file alone when teardown lands during the content read', async () => {
    // Text-inferred cleanup reads the file first, so the teardown can land
    // between the loop-top check and the unlink. A replacement monitor may
    // have published its own prompt at that pathname by then; deleting it
    // after its stamp pass finished leaves the new bot without that prompt.
    const controller = new AbortController();
    fs.writeFileSync(path.join(tmpDir, 'USER.md'), 'former owner notes');
    const realLstat = fs.promises.lstat.bind(fs.promises);
    const lstatSpy = vi
      .spyOn(fs.promises, 'lstat')
      .mockImplementation(async (target) => {
        if (String(target).endsWith('USER.md')) {
          controller.abort();
        }
        return realLstat(target as never);
      });
    try {
      const sync = createPromptSync({
        core: makeCore(),
        accountId: 'default',
        botShip: '~zod',
        workspaceDir: tmpDir,
        configPrompts: {},
        foreignPrompts: { 'USER.md': ['former owner notes'] },
        owner: null,
        scry: async () => ({}),
        poke: async () => ({}),
        logger,
        abortSignal: controller.signal,
      });
      await sync.startup();
      expect(fs.readFileSync(path.join(tmpDir, 'USER.md'), 'utf8')).toBe(
        'former owner notes'
      );
    } finally {
      lstatSpy.mockRestore();
    }
  });
});

describe('createPromptSync abort after in-flight apply', () => {
  it('handleFact publishes nothing once torn down mid-write', async () => {
    const controller = new AbortController();
    const core = makeCore();
    // prompt-sync and this test share the node:fs promises singleton, so
    // aborting from inside the apply's writeFile deterministically lands
    // the teardown between the temp write and the rename that publishes
    // it — exercising the guard in applyPromptsToWorkspace.
    const writeFileSpy = vi
      .spyOn(fs.promises, 'writeFile')
      .mockImplementation(async (file, data) => {
        controller.abort();
        fs.writeFileSync(file as fs.PathLike, data as string);
      });
    try {
      const sync = createPromptSync({
        core,
        accountId: 'default',
        botShip: '~zod',
        workspaceDir: tmpDir,
        configPrompts: {},
        owner: null,
        scry: async () => ({}),
        poke: async () => ({}),
        logger,
        abortSignal: controller.signal,
      });
      await sync.handleFact({
        set: {
          name: 'SOUL.md',
          prompt: { text: 'mid-flight', updated: '~x' },
        },
      });
      // Nothing lands on the shared workspace: a replacement monitor for
      // another bot may already own it, and the rename would publish our
      // text under its ownership stamp. The provenance write that ran
      // BEFORE the apply is harmless on its own — it records text no file
      // carries, and the next reconcile re-applies or cleans it — while no
      // restart write happened for the torn-down monitor.
      expect(fs.existsSync(path.join(tmpDir, 'SOUL.md'))).toBe(false);
      expect(fs.readdirSync(tmpDir)).toEqual([]);
      expect(core.config.mutateConfigFile).toHaveBeenCalledTimes(1);
      expect(core.config.mutateConfigFile).toHaveBeenCalledWith(
        expect.objectContaining({
          afterWrite: expect.objectContaining({ mode: 'none' }),
        })
      );
    } finally {
      writeFileSpy.mockRestore();
    }
  });
});

describe('collectForeignPromptCaches', () => {
  const cfg = makeAccountsConfig({
    ship: '~zod',
    url: 'http://x',
    code: 'c',
    prompts: { 'USER.md': 'default owner private notes' },
    accounts: {
      hosted: {
        ship: '~bus',
        url: 'http://y',
        code: 'c',
        prompts: { 'USER.md': 'hosted owner notes', 'SOUL.md': 'hosted soul' },
      },
      // De-configured (no creds) — its leftover cache still counts.
      stale: { ship: '~fed', prompts: { 'SOUL.md': 'stale soul' } },
    },
  }) as never;

  it('collects every other account cache, keyed by name', () => {
    expect(collectForeignPromptCaches(cfg, 'default')).toEqual({
      'USER.md': ['hosted owner notes'],
      'SOUL.md': expect.arrayContaining(['hosted soul', 'stale soul']),
    });
  });

  it('excludes the syncing account itself', () => {
    const foreign = collectForeignPromptCaches(cfg, 'hosted');
    expect(foreign['USER.md']).toEqual(['default owner private notes']);
    expect(foreign['SOUL.md']).toEqual(['stale soul']);
  });

  it('covers ships deleted from the config via the shadow ledger', () => {
    // The account that synced for ~fed was removed entirely — no account
    // block, no cache — but its edits can still sit on the workspace.
    const withLedger = makeAccountsConfig({
      ship: '~zod',
      url: 'http://x',
      code: 'c',
      promptSync: {
        ships: {
          '~fed': { 'USER.md': ['deleted account private notes'] },
          '~zod': { 'SOUL.md': ['my own edit'] },
        },
      },
    }) as never;
    const foreign = collectForeignPromptCaches(withLedger, 'default');
    expect(foreign['USER.md']).toEqual(['deleted account private notes']);
    // Its own ship's ledger entry is not foreign.
    expect(foreign['SOUL.md']).toBeUndefined();
  });

  it('treats a repointed slot’s former ship as foreign', () => {
    // The default slot used to run ~zod (whose owner edited USER.md) and
    // was repointed at ~bus. The stamped cache no longer resolves as the
    // slot's own prompts, and the ship-keyed ledger marks it foreign.
    const repointed = makeAccountsConfig({
      ship: '~bus',
      url: 'http://x',
      code: 'c',
      prompts: { 'USER.md': 'old ship private notes' },
      promptsShip: '~zod',
      promptSync: {
        ships: { '~zod': { 'USER.md': ['old ship private notes'] } },
      },
    }) as never;
    const foreign = collectForeignPromptCaches(repointed, 'default');
    expect(foreign['USER.md']).toEqual(['old ship private notes']);
  });

  it('does not treat another slot pointing at the same ship as foreign', () => {
    const sameShip = makeAccountsConfig({
      ship: '~zod',
      url: 'http://x',
      code: 'c',
      accounts: {
        alias: { ship: '~zod', prompts: { 'SOUL.md': 'same ship text' } },
      },
    }) as never;
    expect(collectForeignPromptCaches(sameShip, 'default')).toEqual({});
  });
});

describe('createPromptSync foreign-prompt seed filter', () => {
  it('removes and never seeds workspace text matching another account cache', async () => {
    // The shared workspace still holds the former syncing account's edit.
    fs.writeFileSync(path.join(tmpDir, 'USER.md'), 'hosted owner notes');
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'shared baseline');
    const poke = vi.fn(
      async (_params: { app: string; mark: string; json: unknown }) => ({})
    );
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      foreignPrompts: { 'USER.md': ['hosted owner notes'] },
      owner: '~ten',
      scry: async () => ({}),
      poke,
      logger,
    });
    await sync.startup();
    expect(poke).toHaveBeenCalledWith({
      app: 'steward',
      mark: 'steward-prompts-action-1',
      json: { seed: { 'AGENTS.md': 'shared baseline' } },
    });
    // Not just excluded from the seed: the file itself is removed, or the
    // agent (which re-reads bootstrap files every turn) would keep running
    // the former owner's private prompt.
    expect(fs.existsSync(path.join(tmpDir, 'USER.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(true);
  });

  it('seeds the file again once its text no longer matches', async () => {
    fs.writeFileSync(path.join(tmpDir, 'USER.md'), 'fresh text for this bot');
    const poke = vi.fn(
      async (_params: { app: string; mark: string; json: unknown }) => ({})
    );
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      foreignPrompts: { 'USER.md': ['hosted owner notes'] },
      owner: '~ten',
      scry: async () => ({}),
      poke,
      logger,
    });
    await sync.startup();
    expect(poke).toHaveBeenCalledWith({
      app: 'steward',
      mark: 'steward-prompts-action-1',
      json: { seed: { 'USER.md': 'fresh text for this bot' } },
    });
  });
});

describe('shipHasPromptSyncAuthority', () => {
  const creds = { url: 'http://x', code: 'c' };
  const cfg = makeAccountsConfig({
    ship: '~zod',
    ...creds,
    accounts: {
      // Alias: a second runnable slot pointing at the default's ship.
      alias: { ship: '~zod', ...creds },
      other: { ship: '~bus', ...creds },
    },
  }) as never;

  it('is true for a ship the syncing authority targets', () => {
    // default is the authority (multi-account → default syncs).
    expect(shipHasPromptSyncAuthority(cfg, '~zod')).toBe(true);
    expect(shipHasPromptSyncAuthority(cfg, 'zod')).toBe(true);
  });

  it('is false for ships only gated-off accounts target', () => {
    expect(shipHasPromptSyncAuthority(cfg, '~bus')).toBe(false);
  });
});

describe('createPromptSync foreign-file removal failure', () => {
  it('aborts the reconcile when the foreign file cannot be removed', async () => {
    fs.writeFileSync(path.join(tmpDir, 'USER.md'), 'hosted owner notes');
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'shared baseline');
    const unlinkSpy = vi
      .spyOn(fs.promises, 'unlink')
      .mockRejectedValue(new Error('EACCES: read-only workspace'));
    try {
      const poke = vi.fn(
        async (_params: { app: string; mark: string; json: unknown }) => ({})
      );
      const sync = createPromptSync({
        core: makeCore(),
        accountId: 'default',
        botShip: '~zod',
        workspaceDir: tmpDir,
        configPrompts: {},
        foreignPrompts: { 'USER.md': ['hosted owner notes'] },
        owner: '~ten',
        scry: async () => ({}),
        poke,
        logger,
      });
      await sync.startup();
      // The foreign text is still on disk; treating cleanup as complete
      // (and seeding) would misrepresent the workspace as healthy.
      expect(poke).not.toHaveBeenCalledWith(
        expect.objectContaining({ mark: 'steward-prompts-action-1' })
      );
    } finally {
      unlinkSpy.mockRestore();
    }
  });
});

describe('shipHasPromptSyncAuthority with a disabled default', () => {
  it('does not treat a disabled default account as an authority', () => {
    // shouldRunPromptSync('default') is unconditionally true, but a
    // disabled default has no running monitor — an alias slot must still
    // send its %clear or the ship keeps a stale editable set forever.
    const cfg = makeAccountsConfig({
      ship: '~zod',
      url: 'http://x',
      code: 'c',
      enabled: false,
      accounts: {
        alias: { ship: '~zod', url: 'http://x', code: 'c' },
        other: { ship: '~bus', url: 'http://y', code: 'c' },
      },
    }) as never;
    expect(shipHasPromptSyncAuthority(cfg, '~zod')).toBe(false);
  });
});

describe('createPromptSync startup with unreadable workspace', () => {
  it('skips the seed when a prompt file read fails', async () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'readable');
    fs.writeFileSync(path.join(tmpDir, 'SOUL.md'), 'unreadable');
    const realReadFile = fs.promises.readFile.bind(fs.promises);
    const readSpy = vi
      .spyOn(fs.promises, 'readFile')
      .mockImplementation(async (file, ...rest) => {
        if (String(file).endsWith('SOUL.md')) {
          throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
        }
        return realReadFile(file as never, ...(rest as never[]));
      });
    try {
      const poke = vi.fn(
        async (_params: { app: string; mark: string; json: unknown }) => ({})
      );
      const sync = createPromptSync({
        core: makeCore(),
        accountId: 'default',
        botShip: '~zod',
        workspaceDir: tmpDir,
        configPrompts: {},
        owner: '~ten',
        scry: async () => ({}),
        poke,
        logger,
      });
      await sync.startup();
      expect(poke).not.toHaveBeenCalledWith(
        expect.objectContaining({ mark: 'steward-prompts-action-1' })
      );
    } finally {
      readSpy.mockRestore();
    }
  });
});

describe('createPromptSync refused provenance writes', () => {
  it('handleFact does not apply an edit whose provenance was refused', async () => {
    const core = makeCore();
    core.config.mutateConfigFile.mockRejectedValue(
      new Error('config writes disabled')
    );
    const sync = createPromptSync({
      core,
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      owner: null,
      scry: async () => ({}),
      poke: async () => ({}),
      logger,
    });
    await sync.handleFact({
      set: { name: 'SOUL.md', prompt: { text: 'untracked', updated: '~x' } },
    });
    // Applying without a ledger record would leave private text a later
    // authority couldn't recognize as foreign.
    expect(fs.existsSync(path.join(tmpDir, 'SOUL.md'))).toBe(false);
  });

  it('startup defers ship-stored edits when provenance is refused', async () => {
    const core = makeCore();
    core.config.mutateConfigFile.mockRejectedValue(
      new Error('config writes disabled')
    );
    const poke = vi.fn(
      async (_params: { app: string; mark: string; json: unknown }) => ({})
    );
    const sync = createPromptSync({
      core,
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      owner: '~ten',
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
    expect(fs.existsSync(path.join(tmpDir, 'SOUL.md'))).toBe(false);
  });
});

describe('round-18 regressions', () => {
  it('ledger keeps history when an edit replaces earlier text', async () => {
    const draft: Record<string, unknown> = {};
    writePromptsIntoConfigDraft(draft, 'default', '~zod', {
      'USER.md': 'text A',
    });
    // Edit B lands before A's workspace apply ever succeeded — A may still
    // be on disk, so its provenance must survive.
    writePromptsIntoConfigDraft(draft, 'default', '~zod', {
      'USER.md': 'text B',
    });
    expect((draft as any).channels.tlon.promptSync.ships['~zod']).toEqual({
      'USER.md': ['text A', 'text B'],
    });
  });

  it('reports ok=false when a prompt file exceeds the byte cap', async () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'fine');
    fs.writeFileSync(
      path.join(tmpDir, 'SOUL.md'),
      'a'.repeat(MAX_PROMPT_BYTES + 1)
    );
    const effective = await readEffectivePrompts(tmpDir, logger);
    expect(effective.ok).toBe(false);
    expect(effective.prompts).toEqual({ 'AGENTS.md': 'fine' });
  });

  it('never unlinks text the current authority itself claims', async () => {
    // Shared boilerplate: our stored edit is byte-identical to another
    // ship's cached prompt under the same name.
    const shared = 'be helpful and concise';
    fs.writeFileSync(path.join(tmpDir, 'SOUL.md'), 'stale');
    const poke = vi.fn(
      async (_params: { app: string; mark: string; json: unknown }) => ({})
    );
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      foreignPrompts: { 'SOUL.md': [shared] },
      owner: '~ten',
      scry: async () => ({
        prompts: {
          bot: '~zod',
          prompts: {
            'SOUL.md': { text: shared, updated: '~x', edited: true },
          },
        },
      }),
      poke,
      logger,
    });
    await sync.startup();
    expect(fs.readFileSync(path.join(tmpDir, 'SOUL.md'), 'utf8')).toBe(shared);
    expect(poke).toHaveBeenCalledWith({
      app: 'steward',
      mark: 'steward-prompts-action-1',
      json: { seed: { 'SOUL.md': shared } },
    });
  });
});

describe('applied-text marker', () => {
  it('survives history eviction and stays visible to the foreign filter', () => {
    const draft: Record<string, unknown> = {};
    writePromptsIntoConfigDraft(
      draft,
      'default',
      '~zod',
      { 'USER.md': 'applied A' },
      { markApplied: true }
    );
    // Eight later edits whose applies never succeeded evict A from the
    // bounded history…
    for (let i = 0; i < 8; i += 1) {
      writePromptsIntoConfigDraft(draft, 'default', '~zod', {
        'USER.md': `unapplied ${i}`,
      });
    }
    const tlon = (draft as any).channels.tlon;
    expect(tlon.promptSync.ships['~zod']['USER.md']).not.toContain('applied A');
    // …but A is what is still ON DISK, and the applied marker keeps it
    // recognizable as foreign for a replacement authority.
    const cfg = {
      channels: {
        tlon: {
          ship: '~bus',
          url: 'http://x',
          code: 'c',
          promptSync: tlon.promptSync,
        },
      },
    } as never;
    expect(collectForeignPromptCaches(cfg, 'default')['USER.md']).toContain(
      'applied A'
    );
  });
});

describe('per-file ownership stamps', () => {
  it('markApplied stamps files and clearFileStamps drops them', () => {
    const draft: Record<string, unknown> = {};
    writePromptsIntoConfigDraft(
      draft,
      'default',
      '~zod',
      { 'USER.md': 'mine' },
      { markApplied: true }
    );
    expect((draft as any).channels.tlon.promptSync.files).toEqual({
      'USER.md': '~zod',
    });
    writePromptsIntoConfigDraft(
      draft,
      'default',
      '~bus',
      {},
      { clearFileStamps: ['USER.md'] }
    );
    expect((draft as any).channels.tlon.promptSync.files).toEqual({});
  });

  it('removes a stamped-foreign file even when its text matches nothing', async () => {
    // The dev entrypoint rewrites prompt files (re-appending marked
    // blocks), so a former owner's file can differ from every recorded
    // text while still carrying their content. The ownership stamp is
    // what catches it.
    fs.writeFileSync(
      path.join(tmpDir, 'USER.md'),
      'rewritten: private former-owner notes + appended block'
    );
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'shared baseline');
    const core = makeCore();
    const poke = vi.fn(
      async (_params: { app: string; mark: string; json: unknown }) => ({})
    );
    const sync = createPromptSync({
      core,
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      foreignPrompts: {},
      fileStamps: { 'USER.md': '~bus' },
      owner: '~ten',
      scry: async () => ({}),
      poke,
      logger,
    });
    await sync.startup();
    expect(fs.existsSync(path.join(tmpDir, 'USER.md'))).toBe(false);
    expect(poke).toHaveBeenCalledWith({
      app: 'steward',
      mark: 'steward-prompts-action-1',
      json: { seed: { 'AGENTS.md': 'shared baseline' } },
    });
    // The stamp-clear write ran so the regenerated default isn't
    // re-removed forever.
    const reasons = core.config.mutateConfigFile.mock.calls.map(
      (c: any) => c[0].afterWrite.reason
    );
    expect(reasons).toContain('tlon prompt sync stamp clear');
  });

  it('repairs a missing applied marker even when no file changed', async () => {
    // The stored edit already matches disk (a previous boot applied it but
    // crashed before the marker write): applied.length === 0, yet the
    // marker must still be written or later history eviction loses the
    // on-disk text's provenance.
    fs.writeFileSync(path.join(tmpDir, 'SOUL.md'), 'stored edit');
    const core = makeCore();
    const sync = createPromptSync({
      core,
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      currentApplied: {},
      fileStamps: {},
      owner: null,
      scry: async () => ({
        prompts: {
          bot: '~zod',
          prompts: {
            'SOUL.md': { text: 'stored edit', updated: '~x', edited: true },
          },
        },
      }),
      poke: async () => ({}),
      logger,
    });
    await sync.startup();
    const reasons = core.config.mutateConfigFile.mock.calls.map(
      (c: any) => c[0].afterWrite.reason
    );
    expect(reasons).toContain('tlon prompt sync applied marker');
  });

  it('collect helpers read the ledger shapes', () => {
    const cfg = makeAccountsConfig({
      ship: '~zod',
      url: 'http://x',
      code: 'c',
      promptSync: {
        files: { 'USER.md': '~bus', broken: 42 },
        applied: { '~zod': { 'SOUL.md': 'mine' }, '~bus': { 'USER.md': 'x' } },
      },
    }) as never;
    expect(collectPromptFileStamps(cfg)).toEqual({ 'USER.md': '~bus' });
    expect(collectAppliedPromptMarker(cfg, 'zod')).toEqual({
      'SOUL.md': 'mine',
    });
  });
});

describe('reused-instance stamp freshness', () => {
  it('does not re-remove a regenerated default after clearing a stamp', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'USER.md'),
      'former owner private notes'
    );
    const poke = vi.fn(
      async (_params: { app: string; mark: string; json: unknown }) => ({})
    );
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      fileStamps: { 'USER.md': '~bus' },
      owner: '~ten',
      scry: async () => ({}),
      poke,
      logger,
    });
    // First reconcile: the stamped-foreign file is removed and its stamp
    // cleared (in config AND in this instance's live state).
    await sync.startup();
    expect(fs.existsSync(path.join(tmpDir, 'USER.md'))).toBe(false);
    // OpenClaw regenerates a default before a recovery-triggered
    // reconcile reuses the same instance — it must survive.
    fs.writeFileSync(path.join(tmpDir, 'USER.md'), 'regenerated default');
    await sync.startup();
    expect(fs.readFileSync(path.join(tmpDir, 'USER.md'), 'utf8')).toBe(
      'regenerated default'
    );
    expect(poke).toHaveBeenCalledWith({
      app: 'steward',
      mark: 'steward-prompts-action-1',
      json: { seed: { 'USER.md': 'regenerated default' } },
    });
  });
});

describe('ownership stamp write failure', () => {
  it('aborts the reconcile when the marker write fails after an apply', async () => {
    // Owner-edited text is on disk but the ownership stamp could not be
    // persisted — seeding as if healthy would leave text a replacement
    // authority couldn't recognize as foreign after a repoint + rewrite.
    const core = makeCore();
    core.config.mutateConfigFile.mockImplementation(
      async (params: {
        afterWrite: { reason: string };
        mutate: (draft: unknown) => unknown;
      }) => {
        if (params.afterWrite.reason === 'tlon prompt sync applied marker') {
          throw new Error('write refused');
        }
        const draft: Record<string, unknown> = {};
        await params.mutate(draft);
        return { draft } as never;
      }
    );
    const poke = vi.fn(
      async (_params: { app: string; mark: string; json: unknown }) => ({})
    );
    const sync = createPromptSync({
      core,
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: { 'SOUL.md': 'cached edit' },
      currentApplied: {},
      fileStamps: {},
      owner: '~ten',
      scry: async () => ({}),
      poke,
      logger,
    });
    await sync.startup();
    expect(fs.readFileSync(path.join(tmpDir, 'SOUL.md'), 'utf8')).toBe(
      'cached edit'
    );
    expect(poke).not.toHaveBeenCalledWith(
      expect.objectContaining({ mark: 'steward-prompts-action-1' })
    );
  });
});

describe('partial apply stamping', () => {
  it('stamps the files that were written before a mid-loop failure', async () => {
    // A directory at one target makes that write fail; the other succeeds.
    fs.mkdirSync(path.join(tmpDir, 'SOUL.md'));
    const core = makeCore();
    const sync = createPromptSync({
      core,
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: { 'AGENTS.md': 'written ok', 'SOUL.md': 'cannot write' },
      currentApplied: {},
      fileStamps: {},
      owner: null,
      scry: async () => ({}),
      poke: async () => ({}),
      logger,
    });
    await sync.startup();
    // AGENTS.md reached the workspace, so its ownership must be recorded
    // even though the pass aborted before the normal marker write.
    expect(fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf8')).toBe(
      'written ok'
    );
    const reasons = core.config.mutateConfigFile.mock.calls.map(
      (c: any) => c[0].afterWrite.reason
    );
    expect(reasons).toContain('tlon prompt sync partial apply stamps');
  });
});

describe('stamp cleanup independent of the read gate', () => {
  it('removes a foreign-stamped file even when it is oversized', async () => {
    // An entrypoint rewrite pushed a former owner's file past the cap, so
    // readEffectivePrompts reports ok=false. Cleanup must not be gated on
    // that: the agent re-reads this file every turn.
    fs.writeFileSync(
      path.join(tmpDir, 'USER.md'),
      'x'.repeat(MAX_PROMPT_BYTES + 1)
    );
    const core = makeCore();
    const poke = vi.fn(
      async (_params: { app: string; mark: string; json: unknown }) => ({})
    );
    const sync = createPromptSync({
      core,
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: {},
      fileStamps: { 'USER.md': '~bus' },
      owner: null,
      scry: async () => ({}),
      poke,
      logger,
    });
    await sync.startup();
    expect(fs.existsSync(path.join(tmpDir, 'USER.md'))).toBe(false);
    // The oversized read still blocks the seed, but the stamp clear is
    // persisted so the removal is not retried forever.
    expect(poke).not.toHaveBeenCalledWith(
      expect.objectContaining({ mark: 'steward-prompts-action-1' })
    );
    const reasons = core.config.mutateConfigFile.mock.calls.map(
      (c: any) => c[0].afterWrite.reason
    );
    expect(reasons).toContain('tlon prompt sync stamp clear');
  });
});

describe('cleanup precedes the current-authority apply', () => {
  it('removes a foreign-stamped file even when the apply then fails', async () => {
    // A read-only target makes our own write fail; cleanup of the OTHER
    // ship's file must already have happened, or the agent keeps loading
    // that private prompt every turn while each reconcile bails here.
    fs.writeFileSync(path.join(tmpDir, 'USER.md'), 'former owner notes');
    fs.mkdirSync(path.join(tmpDir, 'SOUL.md'));
    const poke = vi.fn(
      async (_params: { app: string; mark: string; json: unknown }) => ({})
    );
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: { 'SOUL.md': 'our edit that cannot be written' },
      fileStamps: { 'USER.md': '~bus' },
      owner: null,
      scry: async () => ({}),
      poke,
      logger,
    });
    await sync.startup();
    expect(fs.existsSync(path.join(tmpDir, 'USER.md'))).toBe(false);
  });

  it('leaves no temp file behind when a write fails', async () => {
    fs.mkdirSync(path.join(tmpDir, 'SOUL.md'));
    await applyPromptsToWorkspace({
      workspaceDir: tmpDir,
      prompts: { 'SOUL.md': 'be kind' },
      logger,
    });
    expect(
      fs.readdirSync(tmpDir).filter((f) => f.includes('tlon-tmp'))
    ).toEqual([]);
  });
});

describe('stamp clears do not erase a fresh restamp', () => {
  it('keeps the new ship stamp when it re-creates a removed foreign file', async () => {
    // The former owner's USER.md is stamped for ~bus; this ship has its own
    // stored edit for the same name, so the file is removed and rewritten.
    fs.writeFileSync(path.join(tmpDir, 'USER.md'), 'former owner notes');
    const core = makeCore();
    const drafts: Record<string, unknown>[] = [];
    core.config.mutateConfigFile.mockImplementation(
      async (params: { mutate: (draft: unknown) => unknown }) => {
        const draft: Record<string, unknown> = {
          channels: { tlon: { promptSync: { files: { 'USER.md': '~bus' } } } },
        };
        await params.mutate(draft);
        drafts.push(draft);
        return { draft } as never;
      }
    );
    const sync = createPromptSync({
      core,
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: { 'USER.md': 'our own edit' },
      fileStamps: { 'USER.md': '~bus' },
      owner: null,
      scry: async () => ({}),
      poke: async () => ({}),
      logger,
    });
    await sync.startup();
    expect(fs.readFileSync(path.join(tmpDir, 'USER.md'), 'utf8')).toBe(
      'our own edit'
    );
    // The LAST write must leave USER.md stamped for us, not cleared: the
    // clear has to happen before the apply restamps it.
    const last = drafts[drafts.length - 1] as any;
    expect(last.channels.tlon.promptSync.files['USER.md']).toBe('~zod');
  });
});

describe('temp-file hardening', () => {
  it('does not write through a planted temp-name symlink', async () => {
    // A prepared workspace could ship a symlink at a predictable temp name;
    // following it would turn a prompt edit into an arbitrary overwrite.
    const outside = path.join(tmpDir, 'outside-target');
    fs.writeFileSync(outside, 'must not be touched');
    fs.symlinkSync(outside, path.join(tmpDir, 'SOUL.md.tlon-tmp'));
    const result = await applyPromptsToWorkspace({
      workspaceDir: tmpDir,
      prompts: { 'SOUL.md': 'be kind' },
      logger,
    });
    expect(result.ok).toBe(true);
    expect(fs.readFileSync(outside, 'utf8')).toBe('must not be touched');
    expect(fs.readFileSync(path.join(tmpDir, 'SOUL.md'), 'utf8')).toBe(
      'be kind'
    );
  });
});

describe('round-36 hardening', () => {
  it('removes a text-inferred foreign file even when the apply fails', async () => {
    // Unstamped (predates stamping) former-owner content, plus a write
    // failure for a different name: cleanup must still happen or every
    // reconcile repeats the failure while the agent loads that prompt.
    fs.writeFileSync(path.join(tmpDir, 'USER.md'), 'former owner notes');
    fs.mkdirSync(path.join(tmpDir, 'SOUL.md'));
    const sync = createPromptSync({
      core: makeCore(),
      accountId: 'default',
      botShip: '~zod',
      workspaceDir: tmpDir,
      configPrompts: { 'SOUL.md': 'our edit that cannot be written' },
      foreignPrompts: { 'USER.md': ['former owner notes'] },
      owner: null,
      scry: async () => ({}),
      poke: async () => ({}),
      logger,
    });
    await sync.startup();
    expect(fs.existsSync(path.join(tmpDir, 'USER.md'))).toBe(false);
  });

  it('does not compare through a symlinked destination', async () => {
    // The apply's freshness check ran before the symlink guard, so a
    // planted link was read through: matching content made it `continue`
    // and left the link in place for the agent to keep loading (and a FIFO
    // or /dev/zero there would have blocked the reconcile outright).
    const outside = path.join(tmpDir, 'outside-target');
    fs.writeFileSync(outside, 'be kind');
    fs.symlinkSync(outside, path.join(tmpDir, 'SOUL.md'));
    const result = await applyPromptsToWorkspace({
      workspaceDir: tmpDir,
      prompts: { 'SOUL.md': 'be kind' },
      logger,
    });
    expect(result.ok).toBe(true);
    // rename does not follow the final component, so the link itself is
    // replaced and the target it pointed at is untouched.
    expect(fs.lstatSync(path.join(tmpDir, 'SOUL.md')).isSymbolicLink()).toBe(
      false
    );
    expect(fs.readFileSync(path.join(tmpDir, 'SOUL.md'), 'utf8')).toBe(
      'be kind'
    );
    expect(fs.readFileSync(outside, 'utf8')).toBe('be kind');
  });

  it('refuses to open a prompt path that is not a regular file', async () => {
    // A FIFO or device node would hang or endlessly feed the read, so the
    // seed must reject it on the stat rather than by failing the open.
    const readFile = vi.spyOn(fs.promises, 'readFile');
    fs.mkdirSync(path.join(tmpDir, 'USER.md'));
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'real prompt');
    try {
      const effective = await readEffectivePrompts(tmpDir, logger);
      expect(effective.prompts['USER.md']).toBeUndefined();
      expect(effective.prompts['AGENTS.md']).toBe('real prompt');
      // Fail closed: seeding without it would drop the name from the
      // ship's canonical set.
      expect(effective.ok).toBe(false);
      expect(
        readFile.mock.calls.some((call) => String(call[0]).endsWith('USER.md'))
      ).toBe(false);
      // Unlike a symlink it is left alone — a directory cannot be unlinked,
      // and deleting an unexpected node is worse than refusing to read it.
      expect(fs.existsSync(path.join(tmpDir, 'USER.md'))).toBe(true);
    } finally {
      readFile.mockRestore();
    }
  });

  it('never reads through a symlinked prompt file', async () => {
    const secret = path.join(tmpDir, 'secret');
    fs.writeFileSync(secret, 'private contents that must not be seeded');
    fs.symlinkSync(secret, path.join(tmpDir, 'USER.md'));
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'real prompt');
    const effective = await readEffectivePrompts(tmpDir, logger);
    expect(effective.prompts['USER.md']).toBeUndefined();
    expect(effective.prompts['AGENTS.md']).toBe('real prompt');
    // The link is removed rather than followed; the target is untouched.
    expect(fs.existsSync(path.join(tmpDir, 'USER.md'))).toBe(false);
    expect(fs.readFileSync(secret, 'utf8')).toBe(
      'private contents that must not be seeded'
    );
  });
});
