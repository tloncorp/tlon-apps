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
    enqueueSystemEvent: vi.fn(),
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
  it('enqueues the setup conversation and pokes setup-done', async () => {
    const deps = makeDeps();
    const fired = await maybeFireSetup({
      groupFlag: GROUP,
      entry: makeEntry(),
      kit: makeKit(),
      deps,
    });
    expect(fired).toBe(true);

    expect(deps.enqueueSystemEvent).toHaveBeenCalledTimes(1);
    const [text, opts] = deps.enqueueSystemEvent.mock.calls[0];
    expect(text).toContain('# Introduce yourself');
    expect(text).toContain(GROUP);
    expect(text).toContain('discussion → chat/~zod/discussion');
    expect(opts.sessionKey).toBe('session:chat/~zod/discussion');
    expect(opts.deliveryContext).toEqual({
      channel: 'tlon',
      to: 'tlon:chat/~zod/discussion',
      accountId: 'default',
    });

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
    expect(deps.enqueueSystemEvent).toHaveBeenCalledTimes(1);
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
    expect(deps.enqueueSystemEvent).not.toHaveBeenCalled();
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
    expect(deps.enqueueSystemEvent).not.toHaveBeenCalled();
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
