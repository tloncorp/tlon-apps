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
    dispatchKitSetupTurn: vi.fn().mockResolvedValue(undefined),
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
  it('dispatches the setup turn and pokes relay-setup-done', async () => {
    const deps = makeDeps();
    const fired = await maybeFireSetup({
      groupFlag: GROUP,
      entry: makeEntry(),
      kit: makeKit(),
      deps,
    });
    expect(fired).toBe(true);

    expect(deps.dispatchKitSetupTurn).toHaveBeenCalledTimes(1);
    const [params] = deps.dispatchKitSetupTurn.mock.calls[0];
    expect(params.nest).toBe('chat/~zod/discussion');
    expect(params.groupFlag).toBe(GROUP);
    expect(params.text).toContain('# Introduce yourself');
    expect(params.text).toContain(GROUP);
    expect(params.text).toContain('discussion → chat/~zod/discussion');

    expect(deps.poke).toHaveBeenCalledWith({
      app: 'kits',
      mark: 'kits-action-1',
      json: { 'relay-setup-done': { flag: GROUP } },
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
    expect(deps.dispatchKitSetupTurn).toHaveBeenCalledTimes(1);
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
    expect(deps.dispatchKitSetupTurn).not.toHaveBeenCalled();
    expect(deps.poke).not.toHaveBeenCalled();
  });

  it('still pokes relay-setup-done when the kit has no setup instruction', async () => {
    const deps = makeDeps();
    const fired = await maybeFireSetup({
      groupFlag: GROUP,
      entry: makeEntry(),
      kit: makeKit(false),
      deps,
    });
    expect(fired).toBe(false);
    expect(deps.dispatchKitSetupTurn).not.toHaveBeenCalled();
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

  it('survives a failing relay-setup-done poke', async () => {
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
      expect.stringContaining('relay-setup-done poke failed')
    );
  });

  it('logs (but does not rethrow) a failing setup turn dispatch', async () => {
    const deps = makeDeps();
    deps.dispatchKitSetupTurn.mockRejectedValue(new Error('boom'));
    const fired = await maybeFireSetup({
      groupFlag: GROUP,
      entry: makeEntry(),
      kit: makeKit(),
      deps,
    });
    expect(fired).toBe(true);
    // The dispatch is fire-and-forget; let its rejection handler run.
    await new Promise((resolve) => setImmediate(resolve));
    expect(deps.error).toHaveBeenCalledWith(
      expect.stringContaining('setup turn for book-club-0')
    );
    // The relay poke still fires: setup is fire-once even on a failed turn.
    expect(deps.poke).toHaveBeenCalledTimes(1);
  });
});
