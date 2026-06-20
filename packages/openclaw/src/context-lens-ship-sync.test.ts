import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
  loadSyncedLensIds,
  recordSyncedLensId,
  replayUnsyncedFinalRuns,
  resolveLensOwners,
  syncedLensIdsPath,
} from './context-lens-ship-sync.js';
import { createContextLensStore } from './context-lens-store.js';
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

describe('resolveLensOwners', () => {
  function makeConfig(tlon: Record<string, unknown>): OpenClawConfig {
    return { channels: { tlon: { ship: '~zod', ...tlon } } } as OpenClawConfig;
  }

  it('normalizes and dedupes configured owners', () => {
    const owners = resolveLensOwners(
      makeConfig({ contextLens: { owners: ['bus', '~bus', '~dev'] } })
    );
    expect(owners).toEqual(['~bus', '~dev']);
  });

  it('falls back to ownerShip when owners is empty', () => {
    expect(
      resolveLensOwners(makeConfig({ ownerShip: 'dev', contextLens: {} }))
    ).toEqual(['~dev']);
    expect(resolveLensOwners(makeConfig({ contextLens: {} }))).toEqual([]);
  });
});

describe('isContextLensEffectivelyEnabled', () => {
  function makeConfig(tlon: Record<string, unknown>): OpenClawConfig {
    return { channels: { tlon: { ship: '~zod', ...tlon } } } as OpenClawConfig;
  }

  it('is enabled for ship-sync-only configs (owners, no authToken)', () => {
    expect(
      isContextLensEffectivelyEnabled(
        makeConfig({ contextLens: { enabled: true, owners: ['~bus'] } })
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
            owners: ['~bus'],
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

  it('strips the gateway-only retrySeed but keeps retryOf', () => {
    const lens = makeLens();
    lens.retryOf = 'lens-original';
    lens.retrySeed = {
      messageText: 'secret original message body',
      blobField: '{"k":"v"}',
    };
    const payload = JSON.parse(buildLensRunPayload(lens)) as {
      lens: ContextLens;
    };
    expect(payload.lens.retrySeed).toBeUndefined();
    expect(payload.lens.retryOf).toBe('lens-original');
    expect(JSON.stringify(payload)).not.toContain(
      'secret original message body'
    );
  });
});

const labelPoke = (poke: RecordedPoke): string => {
  const json = poke.json as { configure?: unknown; lens?: { entry?: { final?: boolean } } };
  if (json.configure) return 'configure';
  const entry = json.lens?.entry;
  if (!entry) return 'unknown';
  return entry.final ? 'entry-final' : 'entry-partial';
};

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

    expect(pokes.map(labelPoke)).toEqual([
      'configure',
      'entry-partial',
      'entry-partial',
      'entry-final',
    ]);
    expect(
      pokes.every(
        (p) => p.app === 'steward' && p.mark === 'steward-action-1'
      )
    ).toBe(true);
    expect(pokes[0].json).toEqual({ configure: { owner: '~bus' } });
    // partial entry assertions: same lensId, non-empty payload, final=false.
    const partialPoke = pokes[1].json as {
      lens: { entry: { id: string; payload: unknown; final: boolean } };
    };
    expect(partialPoke.lens.entry.id).toBe(lens.lensId);
    expect(typeof partialPoke.lens.entry.payload).toBe('string');
    expect((partialPoke.lens.entry.payload as string).length).toBeGreaterThan(
      0
    );
    expect(partialPoke.lens.entry.final).toBe(false);
    // final entry assertions: same lensId, final=true.
    const finalPoke = pokes[3].json as {
      lens: { entry: { id: string; payload: unknown; final: boolean } };
    };
    expect(finalPoke.lens.entry.id).toBe(lens.lensId);
    expect(finalPoke.lens.entry.final).toBe(true);
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

    expect(pokes).toHaveLength(2); // configure + one entry-partial
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
    expect(pokes.map(labelPoke)).toEqual([
      'configure',
      'entry-final',
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
    expect(pokes.map(labelPoke)).toEqual([
      'configure',
      'entry-final',
    ]);

    // New params instance (monitor restart): configure re-asserted.
    current = makeParams(pokes);
    sync.handleEvent(makeEvent(makeLens({ status: 'completed' })));
    await sync.flush();
    expect(pokes.map(labelPoke)).toEqual([
      'configure',
      'entry-final',
      'configure',
      'entry-final',
    ]);
  });
});

describe('synced lens id bookkeeping', () => {
  it('round-trips ids and survives a missing or garbage file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-synced-'));
    const file = syncedLensIdsPath(path.join(dir, 'runs.jsonl'));
    try {
      expect(loadSyncedLensIds(file).size).toBe(0);

      recordSyncedLensId(file, 'a');
      recordSyncedLensId(file, 'b');
      recordSyncedLensId(file, 'a');
      expect([...loadSyncedLensIds(file)]).toEqual(['b', 'a']);

      fs.writeFileSync(file, 'not json');
      expect(loadSyncedLensIds(file).size).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports run finals via onRunFinal only after a successful poke', async () => {
    const pokes: RecordedPoke[] = [];
    const params = makeParams(pokes);
    let connected = false;
    const finals: string[] = [];
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: silentLogger,
      getParams: () => (connected ? params : null),
      onRunFinal: (lens) => finals.push(lens.lensId),
    });

    // Dropped (no params): poke never sent, so no bookkeeping.
    sync.handleEvent(makeEvent(makeLens({ status: 'completed' })));
    await sync.flush();
    expect(finals).toHaveLength(0);

    connected = true;
    // Milestone events are not tracked, only finals.
    const lens = makeLens({ status: 'tool_running' });
    sync.handleEvent(makeEvent(lens));
    sync.handleEvent(makeEvent({ ...lens, status: 'aborted' }));
    await sync.flush();
    expect(finals).toEqual([lens.lensId]);
  });
});

describe('replayUnsyncedFinalRuns', () => {
  function makeFinalLens(
    overrides: Partial<ContextLens> & { completedAt?: number }
  ): ContextLens {
    const { completedAt, ...rest } = overrides;
    const lens = makeLens({ status: 'completed', ...rest });
    return {
      ...lens,
      lifecycle: { ...lens.lifecycle, completedAt: completedAt ?? Date.now() },
    };
  }

  it('re-pokes only unsynced, recent, non-internal terminal runs', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-replay-'));
    const filePath = path.join(dir, 'runs.jsonl');
    try {
      const store = createContextLensStore({ filePath });
      const missed = makeFinalLens({ status: 'aborted' });
      const alreadySynced = makeFinalLens({});
      const internal = makeFinalLens({ visibility: 'internal' });
      const stale = makeFinalLens({
        completedAt: Date.now() - 25 * 60 * 60 * 1_000,
      });
      for (const lens of [missed, alreadySynced, internal]) {
        store.save(lens);
      }
      // Bypass save()'s own retention so the stale lens is present in memory.
      fs.appendFileSync(filePath, `${JSON.stringify(stale)}\n`);
      const reloaded = createContextLensStore({ filePath });
      recordSyncedLensId(syncedLensIdsPath(filePath), alreadySynced.lensId);

      const pokes: RecordedPoke[] = [];
      const params = makeParams(pokes);
      const finals: string[] = [];
      const sync = createContextLensShipSync({
        owner: '~bus',
        logger: silentLogger,
        getParams: () => params,
        onRunFinal: (lens) => {
          finals.push(lens.lensId);
          recordSyncedLensId(syncedLensIdsPath(filePath), lens.lensId);
        },
      });

      expect(replayUnsyncedFinalRuns(reloaded, sync, silentLogger)).toBe(1);
      await sync.flush();
      expect(finals).toEqual([missed.lensId]);

      // Second boot: the replayed run is now recorded as synced.
      expect(replayUnsyncedFinalRuns(reloaded, sync, silentLogger)).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
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
              owners: ['~bus'],
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

      expect(pokes.map(labelPoke)).toEqual([
        'configure',
        'entry-final',
      ]);
    } finally {
      slot.set(previousParams);
    }
  });
});
