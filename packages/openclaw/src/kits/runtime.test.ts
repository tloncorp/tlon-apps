import type { Kit } from '@tloncorp/api';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GroupConfigReader, KitsGroupConfig } from './group-config.js';
import type { KitPackageStore } from './package-store.js';
import {
  _testing,
  bindKitSessionGroup,
  createKitsRuntime,
  handleKitsBeforePromptBuild,
  isKitsEnabled,
  lookupKitSessionGroup,
  publishKitsRuntime,
  writeKitScaffolds,
} from './runtime.js';
import { _testing as setupTesting } from './setup.js';

const GROUP = '~zod/book-club';
const BOT = '~zod';
const SESSION = 'agent:main:tlon:group:chat/~zod/discussion';

function makeKit(): Kit {
  return {
    manifest: {
      id: 'book-club',
      name: 'Book Club',
      version: '0.1.0',
      publisher: '~zod',
      description: 'a club',
      image: null,
      scope: 'group',
      places: [],
      bindings: [
        {
          file: 'instructions/runner.md',
          scope: 'group',
          trigger: null,
          load: 'ambient',
        },
        {
          file: 'instructions/setup.md',
          scope: 'group',
          trigger: 'install.setup',
          load: 'on-trigger',
        },
      ],
      schedules: [],
      scaffolds: [
        { file: 'scaffolds/Profile.md', workspace: 'Book Club/Profile.md' },
      ],
      policy: null,
    },
    files: {
      'instructions/runner.md': '# Run the club',
      'instructions/setup.md': '# Setup',
      'scaffolds/Profile.md': '# Club profile',
    },
  };
}

function makeConfig(setup: 'pending' | 'done' = 'done'): KitsGroupConfig {
  return {
    version: 1,
    kits: [
      {
        installId: 'book-club-0',
        kit: { id: 'book-club', version: '0.1.0', publisher: '~zod' },
        places: { discussion: 'chat/~zod/discussion' },
        schedules: [],
        agents: [BOT],
        setup,
      },
    ],
  };
}

function makeReader(config: KitsGroupConfig | null): GroupConfigReader {
  return {
    get: vi.fn(async () => config),
    invalidate: vi.fn(),
    clear: vi.fn(),
  };
}

function makeStore(kit: Kit | null): KitPackageStore {
  return {
    get: vi.fn(async () => kit),
    invalidate: vi.fn(),
    clear: vi.fn(),
  };
}

function makeRuntime(overrides?: {
  config?: KitsGroupConfig | null;
  kit?: Kit | null;
}) {
  const reader = makeReader(
    overrides && 'config' in overrides ? overrides.config ?? null : makeConfig()
  );
  const store = makeStore(
    overrides && 'kit' in overrides ? overrides.kit ?? null : makeKit()
  );
  const runtime = createKitsRuntime({
    botShip: BOT,
    scry: vi.fn(),
    poke: vi.fn().mockResolvedValue(undefined),
    resolveGroupSessionRoute: (nest) => ({
      sessionKey: `agent:main:tlon:group:${nest}`,
    }),
    enqueueSystemEvent: vi.fn(),
    getCronService: () => undefined,
    configReader: reader,
    packageStore: store,
  });
  return { runtime, reader, store };
}

beforeEach(() => {
  _testing.clearSessionGroups();
  _testing.clearScaffoldsWritten();
  _testing.clearRuntimeSlot();
  setupTesting.clearFired();
});

afterEach(() => {
  _testing.clearRuntimeSlot();
});

describe('isKitsEnabled', () => {
  it('defaults to enabled', () => {
    expect(isKitsEnabled({} as never)).toBe(true);
    expect(isKitsEnabled({ channels: { tlon: {} } } as never)).toBe(true);
  });

  it('honors the account-level flag over the base flag', () => {
    const cfg = {
      channels: {
        tlon: {
          kits: { enabled: false },
          accounts: { hosted: { kits: { enabled: true } } },
        },
      },
    } as never;
    expect(isKitsEnabled(cfg)).toBe(false);
    expect(isKitsEnabled(cfg, 'hosted')).toBe(true);
  });

  it('can be disabled globally', () => {
    const cfg = {
      channels: { tlon: { kits: { enabled: false } } },
    } as never;
    expect(isKitsEnabled(cfg, 'default')).toBe(false);
  });
});

describe('session ↔ group binding', () => {
  it('binds and looks up, including thread-suffixed session keys', () => {
    bindKitSessionGroup(SESSION, GROUP);
    expect(lookupKitSessionGroup(SESSION)).toBe(GROUP);
    expect(lookupKitSessionGroup(`${SESSION}:thread:12345`)).toBe(GROUP);
    expect(lookupKitSessionGroup('agent:main:other')).toBeNull();
    expect(lookupKitSessionGroup(undefined)).toBeNull();
  });
});

describe('handleBeforePromptBuild', () => {
  it('prepends ambient kit context for bound group sessions', async () => {
    const { runtime } = makeRuntime();
    bindKitSessionGroup(SESSION, GROUP);
    const result = await runtime.handleBeforePromptBuild({
      sessionKey: SESSION,
    });
    expect(result?.prependSystemContext).toContain('# Run the club');
    expect(result?.prependSystemContext).toContain(
      'discussion → chat/~zod/discussion'
    );
    // On-trigger instructions are never ambient.
    expect(result?.prependSystemContext).not.toContain('# Setup');
  });

  it('is a no-op for unbound sessions', async () => {
    const { runtime, reader } = makeRuntime();
    const result = await runtime.handleBeforePromptBuild({
      sessionKey: 'agent:main:webchat',
    });
    expect(result).toBeUndefined();
    expect(reader.get).not.toHaveBeenCalled();
  });

  // A cron-fired turn (setup, weekly schedules) never passes the monitor's
  // inbound-message path, so no session→group binding exists when it reaches
  // this hook — and a binding would have expired anyway for a weekly cron.
  // The group must be derivable from the session key's nest via the places
  // reconcile already knows, or kit setup runs blind with no ambient context.
  it('derives the group from the session nest when no binding exists', async () => {
    const { runtime } = makeRuntime();
    await runtime.start([GROUP]);
    const result = await runtime.handleBeforePromptBuild({
      sessionKey: SESSION,
    });
    expect(result?.prependSystemContext).toContain('# Run the club');
    // The derivation caches the binding for later turns in the session.
    expect(lookupKitSessionGroup(SESSION)).toBe(GROUP);
  });

  it('derives the group for thread-suffixed cron session keys too', async () => {
    const { runtime } = makeRuntime();
    await runtime.start([GROUP]);
    const result = await runtime.handleBeforePromptBuild({
      sessionKey: `${SESSION}:thread:98765`,
    });
    expect(result?.prependSystemContext).toContain('# Run the club');
  });

  it('is a no-op when the group has no kit config', async () => {
    const { runtime } = makeRuntime({ config: null });
    bindKitSessionGroup(SESSION, GROUP);
    expect(
      await runtime.handleBeforePromptBuild({ sessionKey: SESSION })
    ).toBeUndefined();
  });

  it('ignores installs whose agents do not list the bot ship', async () => {
    const config = makeConfig();
    config.kits[0].agents = ['~nec'];
    const { runtime, store } = makeRuntime({ config });
    bindKitSessionGroup(SESSION, GROUP);
    expect(
      await runtime.handleBeforePromptBuild({ sessionKey: SESSION })
    ).toBeUndefined();
    expect(store.get).not.toHaveBeenCalled();
  });

  it('writes scaffolds once into the workspace, never overwriting', async () => {
    const workspaceDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'tlon-kits-test-')
    );
    try {
      const { runtime } = makeRuntime();
      bindKitSessionGroup(SESSION, GROUP);
      await runtime.handleBeforePromptBuild({
        sessionKey: SESSION,
        workspaceDir,
      });
      const target = path.join(workspaceDir, 'Book Club/Profile.md');
      expect(await fs.readFile(target, 'utf8')).toBe('# Club profile');

      // User edits survive later turns.
      await fs.writeFile(target, 'edited');
      _testing.clearScaffoldsWritten(); // simulate a restart
      await runtime.handleBeforePromptBuild({
        sessionKey: SESSION,
        workspaceDir,
      });
      expect(await fs.readFile(target, 'utf8')).toBe('edited');
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it('routes through the shared runtime slot trampoline', async () => {
    const { runtime } = makeRuntime();
    bindKitSessionGroup(SESSION, GROUP);
    // No runtime published → no-op.
    expect(
      await handleKitsBeforePromptBuild({ sessionKey: SESSION })
    ).toBeUndefined();
    publishKitsRuntime(runtime);
    const result = await handleKitsBeforePromptBuild({ sessionKey: SESSION });
    expect(result?.prependSystemContext).toContain('# Run the club');
  });
});

describe('writeKitScaffolds', () => {
  it('refuses scaffold paths that escape the workspace', async () => {
    const workspaceDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'tlon-kits-esc-')
    );
    try {
      const kit = makeKit();
      kit.manifest.scaffolds = [
        { file: 'scaffolds/Profile.md', workspace: '../escape.md' },
      ];
      const error = vi.fn();
      await writeKitScaffolds({
        groupFlag: GROUP,
        entry: makeConfig().kits[0],
        kit,
        workspaceDir,
        error,
      });
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('escapes the workspace')
      );
      await expect(
        fs.access(path.join(workspaceDir, '..', 'escape.md'))
      ).rejects.toThrow();
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });
});

describe('handleKitsUpdate', () => {
  it('invalidates config and reconciles on install facts', async () => {
    const { runtime, reader } = makeRuntime();
    runtime.handleKitsUpdate({
      installed: { flag: GROUP, install: { id: 'book-club' } },
    });
    expect(reader.invalidate).toHaveBeenCalledWith(GROUP);
    // Let the async reconcile settle.
    await new Promise((resolve) => setImmediate(resolve));
    expect(reader.get).toHaveBeenCalledWith(GROUP);
  });

  it('invalidates the package cache on kit facts', () => {
    const { runtime, store } = makeRuntime();
    runtime.handleKitsUpdate({ kit: { manifest: { id: 'book-club' } } });
    expect(store.invalidate).toHaveBeenCalledWith('book-club');
  });

  it('ignores unrelated facts', () => {
    const { runtime, reader } = makeRuntime();
    runtime.handleKitsUpdate({ kits: [] });
    runtime.handleKitsUpdate(null);
    expect(reader.invalidate).not.toHaveBeenCalled();
  });
});

describe('handleGroupsUiEvent', () => {
  it('invalidates the config cache on blob updates', async () => {
    const { runtime, reader } = makeRuntime();
    runtime.handleGroupsUiEvent({ flag: GROUP, update: { blob: '{}' } });
    expect(reader.invalidate).toHaveBeenCalledWith(GROUP);
  });

  it('ignores non-blob group updates', () => {
    const { runtime, reader } = makeRuntime();
    runtime.handleGroupsUiEvent({ flag: GROUP, update: { fleet: {} } });
    runtime.handleGroupsUiEvent({ channels: {} });
    expect(reader.invalidate).not.toHaveBeenCalled();
  });
});

describe('start / setup integration', () => {
  it('fires the pending setup conversation on initial reconcile', async () => {
    const reader = makeReader(makeConfig('pending'));
    const store = makeStore(makeKit());
    const cronAdd = vi.fn().mockResolvedValue(undefined);
    const poke = vi.fn().mockResolvedValue(undefined);
    const runtime = createKitsRuntime({
      botShip: BOT,
      scry: vi.fn(),
      poke,
      resolveGroupSessionRoute: (nest) => ({
        sessionKey: `agent:main:tlon:group:${nest}`,
      }),
      getCronService: () =>
        ({
          add: cronAdd,
          list: vi.fn(),
          update: vi.fn(),
          remove: vi.fn(),
        }) as never,
      configReader: reader,
      packageStore: store,
      cronRetryDelayMs: 1,
    });
    await runtime.start([GROUP]);
    runtime.stop();

    // The setup turn is a one-shot at-job with an agentTurn payload — the
    // only mechanism that starts a turn rather than waiting for the human
    // to speak first.
    const setupJobs = cronAdd.mock.calls
      .map((call) => call[0])
      .filter((job) => job.name.startsWith('tlon:kit-setup:'));
    expect(setupJobs).toHaveLength(1);
    expect(setupJobs[0].schedule.kind).toBe('at');
    expect(setupJobs[0].payload.kind).toBe('agentTurn');
    expect(setupJobs[0].payload.message).toContain('# Setup');
    expect(poke).toHaveBeenCalledWith(
      expect.objectContaining({
        json: { 'setup-done': { flag: GROUP } },
      })
    );
  });
});
