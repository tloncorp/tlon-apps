import type { Kit } from '@tloncorp/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { InstalledKitConfig } from './group-config.js';
import { _testing, maybeFireSetup, shouldFireSetup } from './setup.js';

const GROUP = '~zod/book-club';
const BOT = '~zod';

function makeKit(withSetup = true): Kit {
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
      bindings: withSetup
        ? [
            {
              file: 'instructions/setup.md',
              scope: 'group',
              trigger: 'install.setup',
              load: 'on-trigger',
            },
          ]
        : [],
      schedules: [],
      scaffolds: [],
      policy: null,
    },
    files: { 'instructions/setup.md': '# Introduce yourself' },
  };
}

function makeEntry(
  overrides: Partial<InstalledKitConfig> = {}
): InstalledKitConfig {
  return {
    installId: 'book-club-0',
    kit: { id: 'book-club', version: '0.1.0', publisher: '~zod' },
    places: { discussion: 'chat/~zod/discussion' },
    schedules: [],
    agents: [BOT],
    setup: 'pending',
    ...overrides,
  };
}

function makeDeps() {
  return {
    botShip: BOT,
    resolveGroupSessionRoute: vi.fn((nest: string) => ({
      sessionKey: `session:${nest}`,
      accountId: 'default',
    })),
    cron: { add: vi.fn().mockResolvedValue(undefined) },
    poke: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    error: vi.fn(),
  };
}

beforeEach(() => {
  _testing.clearFired();
});

describe('shouldFireSetup', () => {
  it('fires only for pending installs whose agents list the bot ship', () => {
    expect(
      shouldFireSetup({ entry: makeEntry(), groupFlag: GROUP, botShip: BOT })
    ).toBe(true);
    expect(
      shouldFireSetup({
        entry: makeEntry({ setup: 'done' }),
        groupFlag: GROUP,
        botShip: BOT,
      })
    ).toBe(false);
    expect(
      shouldFireSetup({
        entry: makeEntry({ agents: ['~nec'] }),
        groupFlag: GROUP,
        botShip: BOT,
      })
    ).toBe(false);
  });

  it('does not fire twice for the same install', () => {
    _testing.markFired(GROUP, 'book-club-0');
    expect(
      shouldFireSetup({ entry: makeEntry(), groupFlag: GROUP, botShip: BOT })
    ).toBe(false);
  });
});

describe('maybeFireSetup', () => {
  it('schedules the setup turn and pokes setup-done', async () => {
    const deps = makeDeps();
    const fired = await maybeFireSetup({
      groupFlag: GROUP,
      entry: makeEntry(),
      kit: makeKit(),
      deps,
    });
    expect(fired).toBe(true);

    expect(deps.cron.add).toHaveBeenCalledTimes(1);
    const [job] = deps.cron.add.mock.calls[0];
    // A one-shot due immediately: `at` jobs delete after they run, and only
    // an agentTurn payload may target a session — the pairing the host
    // enforces. This is what actually STARTS a turn; a queued system event
    // waits for the human to speak first.
    expect(job.schedule.kind).toBe('at');
    expect(job.sessionTarget).toBe('session:session:chat/~zod/discussion');
    expect(job.wakeMode).toBe('now');
    expect(job.payload.kind).toBe('agentTurn');
    expect(job.payload.message).toContain('# Introduce yourself');
    expect(job.payload.message).toContain(GROUP);
    expect(job.payload.message).toContain('discussion → chat/~zod/discussion');

    expect(deps.poke).toHaveBeenCalledWith({
      app: 'kits',
      mark: 'kits-action-1',
      json: { 'setup-done': { flag: GROUP } },
    });
  });

  it('fires exactly once per install (double-fire guard)', async () => {
    const deps = makeDeps();
    const first = await maybeFireSetup({
      groupFlag: GROUP,
      entry: makeEntry(),
      kit: makeKit(),
      deps,
    });
    const second = await maybeFireSetup({
      groupFlag: GROUP,
      entry: makeEntry(),
      kit: makeKit(),
      deps,
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(deps.cron.add).toHaveBeenCalledTimes(1);
    expect(deps.poke).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the bot ship is not in agents', async () => {
    const deps = makeDeps();
    const fired = await maybeFireSetup({
      groupFlag: GROUP,
      entry: makeEntry({ agents: ['~nec'] }),
      kit: makeKit(),
      deps,
    });
    expect(fired).toBe(false);
    expect(deps.cron.add).not.toHaveBeenCalled();
    expect(deps.poke).not.toHaveBeenCalled();
  });

  it('still pokes setup-done when the kit has no setup instruction', async () => {
    const deps = makeDeps();
    const fired = await maybeFireSetup({
      groupFlag: GROUP,
      entry: makeEntry(),
      kit: makeKit(false),
      deps,
    });
    expect(fired).toBe(false);
    expect(deps.cron.add).not.toHaveBeenCalled();
    expect(deps.poke).toHaveBeenCalledTimes(1);
  });

  it('does not consume the install when the session cannot be resolved', async () => {
    const deps = makeDeps();
    deps.resolveGroupSessionRoute.mockReturnValue(
      null as unknown as ReturnType<typeof deps.resolveGroupSessionRoute>
    );
    const fired = await maybeFireSetup({
      groupFlag: GROUP,
      entry: makeEntry(),
      kit: makeKit(),
      deps,
    });
    expect(fired).toBe(false);
    expect(deps.poke).not.toHaveBeenCalled();
    // Not marked fired: a later reconcile (with routing available) can retry.
    expect(
      shouldFireSetup({ entry: makeEntry(), groupFlag: GROUP, botShip: BOT })
    ).toBe(true);
  });

  it('survives a failing setup-done poke', async () => {
    const deps = makeDeps();
    deps.poke.mockRejectedValue(new Error('nack'));
    const fired = await maybeFireSetup({
      groupFlag: GROUP,
      entry: makeEntry(),
      kit: makeKit(),
      deps,
    });
    expect(fired).toBe(true);
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining('setup-done poke failed')
    );
  });
});
