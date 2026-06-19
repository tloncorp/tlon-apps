import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { describe, expect, it } from 'vitest';

import {
  type ContextLensEvent,
  publishContextLensEvent,
} from './context-lens-events.js';
import {
  buildLensRunPayload,
  createContextLensShipSync,
  initContextLensShipSync,
  isContextLensEffectivelyEnabled,
  resolveLensOwner,
} from './context-lens-ship-sync.js';
import { type ContextLens, createContextLensRegistry } from './context-lens.js';
import {
  API_CLIENT_PARAMS_SLOT,
  type SharedApiClientParams,
} from './gateway-status.js';
import { sharedSlot } from './shared-state.js';

function makeLens(overrides: Partial<ContextLens> = {}): ContextLens {
  const registry = createContextLensRegistry({ ttlMs: 60_000 });
  const lens = registry.create({
    messageId: 'msg-1',
    chatType: 'dm',
    trigger: 'dm',
  });
  return { ...lens, ...overrides };
}

function makeEvent(lens: ContextLens): ContextLensEvent {
  return { seq: 1, at: Date.now(), phase: 'status', lens };
}

type RecordedPoke = { app: string; mark: string; json: unknown };

function makeParams(pokes: RecordedPoke[]): SharedApiClientParams {
  return {
    poke: (params) => {
      pokes.push(params as RecordedPoke);
      return Promise.resolve(undefined);
    },
    shipName: '~zod',
    shipUrl: 'http://localhost:8080',
  };
}

const silentLogger = { info: () => {}, warn: () => {} };

describe('resolveLensOwner', () => {
  function makeConfig(tlon: Record<string, unknown>): OpenClawConfig {
    return { channels: { tlon: { ship: '~zod', ...tlon } } } as OpenClawConfig;
  }

  it('normalizes the configured owner', () => {
    expect(
      resolveLensOwner(makeConfig({ contextLens: { owner: 'bus' } }))
    ).toEqual('~bus');
  });

  it('falls back to ownerShip when owner is unset', () => {
    expect(
      resolveLensOwner(makeConfig({ ownerShip: 'dev', contextLens: {} }))
    ).toEqual('~dev');
    expect(resolveLensOwner(makeConfig({ contextLens: {} }))).toBeNull();
  });
});

describe('isContextLensEffectivelyEnabled', () => {
  function makeConfig(tlon: Record<string, unknown>): OpenClawConfig {
    return { channels: { tlon: { ship: '~zod', ...tlon } } } as OpenClawConfig;
  }

  it('is enabled for ship-sync-only configs (owners, no authToken)', () => {
    expect(
      isContextLensEffectivelyEnabled(
        makeConfig({ contextLens: { enabled: true, owner: '~bus' } })
      )
    ).toBe(true);
    expect(
      isContextLensEffectivelyEnabled(
        makeConfig({ ownerShip: 'dev', contextLens: { enabled: true } })
      )
    ).toBe(true);
  });

  it('is enabled for routes-only configs (authToken, no owners)', () => {
    expect(
      isContextLensEffectivelyEnabled(
        makeConfig({
          contextLens: {
            enabled: true,
            authToken: 'a-token-of-sufficient-length',
          },
        })
      )
    ).toBe(true);
  });

  it('is disabled without any consumer or when not enabled', () => {
    expect(
      isContextLensEffectivelyEnabled(
        makeConfig({ contextLens: { enabled: true } })
      )
    ).toBe(false);
    expect(
      isContextLensEffectivelyEnabled(
        makeConfig({
          contextLens: {
            enabled: false,
            authToken: 'a-token-of-sufficient-length',
            owner: '~bus',
          },
        })
      )
    ).toBe(false);
  });
});

describe('buildLensRunPayload', () => {
  it('serializes the lens with a schemaVersion', () => {
    const lens = makeLens();
    const raw = buildLensRunPayload(lens);
    expect(typeof raw).toBe('string');
    const payload = JSON.parse(raw) as {
      schemaVersion: number;
      lens: ContextLens;
    };
    expect(payload.schemaVersion).toBe(1);
    expect(payload.lens.lensId).toBe(lens.lensId);
  });

  it('truncates oversized tool summaries', () => {
    const lens = makeLens();
    lens.tools.runs = [
      {
        id: 't-1',
        callIndex: 1,
        name: 'browser',
        startedAt: Date.now(),
        completedAt: Date.now(),
        durationMs: 5,
        status: 'completed',
        argumentSummary: 'x'.repeat(10_000),
        resultSummary: 'ok',
      },
    ];
    const payload = JSON.parse(buildLensRunPayload(lens)) as {
      lens: ContextLens;
    };
    const run = payload.lens.tools.runs[0];
    expect(run.argumentSummary?.length).toBeLessThan(5_000);
    expect(run.argumentSummary).toContain('[truncated]');
    expect(run.resultSummary).toBe('ok');
  });

  it('drops bulky arrays when the payload exceeds the total cap', () => {
    const lens = makeLens();
    lens.tools.runs = Array.from({ length: 100 }, (_, i) => ({
      id: `t-${i}`,
      callIndex: i + 1,
      name: 'browser',
      startedAt: Date.now(),
      completedAt: Date.now(),
      durationMs: 5,
      status: 'completed' as const,
      argumentSummary: 'y'.repeat(4_000),
    }));
    const raw = buildLensRunPayload(lens);
    const payload = JSON.parse(raw) as {
      truncated?: boolean;
      lens: ContextLens;
    };
    expect(payload.truncated).toBe(true);
    expect(payload.lens.tools.runs).toEqual([]);
    expect(payload.lens.status).toBe(lens.status);
    expect(raw.length).toBeLessThan(50 * 1_024);
  });
});

describe('createContextLensShipSync', () => {
  it('configures owners once, then pokes run milestones and finals', async () => {
    const pokes: RecordedPoke[] = [];
    const params = makeParams(pokes);
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: silentLogger,
      getParams: () => params,
    });

    const lens = makeLens({ status: 'dispatching' });
    sync.handleEvent(makeEvent(lens));
    sync.handleEvent(makeEvent({ ...lens, status: 'tool_running' }));
    sync.handleEvent(makeEvent({ ...lens, status: 'completed' }));
    await sync.flush();

    expect(pokes.map((p) => Object.keys(p.json as object)[0])).toEqual([
      'configure',
      'lens',
      'lens',
      'lens',
    ]);
    expect(
      pokes.every((p) => p.app === 'steward' && p.mark === 'steward-action-1')
    ).toBe(true);
    expect(pokes[0].json).toEqual({ configure: { owner: '~bus' } });
    const final = pokes[3].json as {
      lens: { id: string; payload: unknown; final: boolean };
    };
    expect(final.lens.id).toBe(lens.lensId);
    expect(final.lens.final).toBe(true);
  });

  it('skips repeat events with an unchanged status', async () => {
    const pokes: RecordedPoke[] = [];
    const params = makeParams(pokes);
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: silentLogger,
      getParams: () => params,
    });

    const lens = makeLens({ status: 'tool_running' });
    sync.handleEvent(makeEvent(lens));
    sync.handleEvent(makeEvent(lens));
    sync.handleEvent(makeEvent(lens));
    await sync.flush();

    expect(pokes).toHaveLength(2); // configure + one lens poke
  });

  it('ignores internal-visibility runs', async () => {
    const pokes: RecordedPoke[] = [];
    const params = makeParams(pokes);
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: silentLogger,
      getParams: () => params,
    });

    sync.handleEvent(
      makeEvent(makeLens({ visibility: 'internal', status: 'completed' }))
    );
    await sync.flush();

    expect(pokes).toHaveLength(0);
  });

  it('drops events while no api params are published, without buffering', async () => {
    const pokes: RecordedPoke[] = [];
    const params = makeParams(pokes);
    let connected = false;
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: silentLogger,
      getParams: () => (connected ? params : null),
    });

    sync.handleEvent(makeEvent(makeLens({ status: 'completed' })));
    await sync.flush();
    expect(pokes).toHaveLength(0);

    connected = true;
    sync.handleEvent(makeEvent(makeLens({ status: 'completed' })));
    await sync.flush();
    expect(pokes.map((p) => Object.keys(p.json as object)[0])).toEqual([
      'configure',
      'lens',
    ]);
  });

  it('re-configures after a poke failure and on params instance change', async () => {
    const pokes: RecordedPoke[] = [];
    let fail = true;
    const flaky: SharedApiClientParams = {
      poke: (params) => {
        if (fail) {
          fail = false;
          return Promise.reject(new Error('ship offline'));
        }
        pokes.push(params as RecordedPoke);
        return Promise.resolve(undefined);
      },
      shipName: '~zod',
      shipUrl: 'http://localhost:8080',
    };
    let current = flaky;
    const warnings: string[] = [];
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: { info: () => {}, warn: (m) => warnings.push(m) },
      getParams: () => current,
    });

    // First final: configure poke rejects, run poke never sent.
    sync.handleEvent(makeEvent(makeLens({ status: 'completed' })));
    await sync.flush();
    expect(warnings.join('\n')).toContain('poke failed');
    expect(pokes).toHaveLength(0);

    // Second final: configure retried (now succeeding), then the run poke.
    sync.handleEvent(makeEvent(makeLens({ status: 'completed' })));
    await sync.flush();
    expect(pokes.map((p) => Object.keys(p.json as object)[0])).toEqual([
      'configure',
      'lens',
    ]);

    // New params instance (monitor restart): configure re-asserted.
    current = makeParams(pokes);
    sync.handleEvent(makeEvent(makeLens({ status: 'completed' })));
    await sync.flush();
    expect(pokes.map((p) => Object.keys(p.json as object)[0])).toEqual([
      'configure',
      'lens',
      'configure',
      'lens',
    ]);
  });
});

// Keep this block last: initContextLensShipSync subscribes to the global lens
// event stream, and the final subscription persists for the rest of the file.
describe('initContextLensShipSync', () => {
  it('replaces the event subscription on re-init instead of stacking pokes', async () => {
    const pokes: RecordedPoke[] = [];
    const slot = sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT);
    const previousParams = slot.get();
    slot.set(makeParams(pokes));
    const api = {
      config: {
        channels: {
          tlon: {
            ship: '~zod',
            contextLens: {
              enabled: true,
              authToken: 'a-token-of-sufficient-length',
              owner: '~bus',
            },
          },
        },
      } as OpenClawConfig,
      logger: silentLogger,
    };

    try {
      expect(initContextLensShipSync(api)).toBe(true);
      expect(initContextLensShipSync(api)).toBe(true);

      publishContextLensEvent('final', makeLens({ status: 'completed' }));
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(pokes.map((p) => Object.keys(p.json as object)[0])).toEqual([
        'configure',
        'lens',
      ]);
    } finally {
      slot.set(previousParams);
    }
  });
});
