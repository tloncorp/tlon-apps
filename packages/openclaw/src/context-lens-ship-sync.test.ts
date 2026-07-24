import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type ContextLensEvent,
  publishContextLensEvent,
} from './context-lens-events.js';
import {
  buildLensRunPayload,
  createContextLensShipSync,
  createLensSyncRetry,
  initContextLensShipSync,
  isContextLensEffectivelyEnabled,
  loadSyncedLensIds,
  recordSyncedLensId,
  replayUnsyncedFinalRuns,
  resolveLensOwner,
  syncedLensIdsPath,
} from './context-lens-ship-sync.js';
import {
  createContextLensStore,
  setContextLensStore,
} from './context-lens-store.js';
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

// configure rides the core %steward-action-1 mark; lens run milestones and
// finals ride the per-module %steward-lens-action-1 mark.
const pokeKind = (p: RecordedPoke): 'configure' | 'lens' =>
  p.mark === 'steward-action-1' ? 'configure' : 'lens';

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
    const payload = buildLensRunPayload(lens);
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
    const payload = buildLensRunPayload(lens);
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
    const payload = buildLensRunPayload(lens);
    expect(payload.truncated).toBe(true);
    expect(payload.lens.tools.runs).toEqual([]);
    expect(payload.lens.status).toBe(lens.status);
    expect(JSON.stringify(payload).length).toBeLessThan(50 * 1_024);
  });

  it('includes retrySeed in the run payload and keeps retryOf', () => {
    const lens = makeLens();
    lens.retryOf = 'lens-original';
    lens.retrySeed = {
      messageText: 'secret original message body',
      blobField: '{"k":"v"}',
    };
    const payload = buildLensRunPayload(lens);
    expect(payload.lens.retrySeed).toEqual({
      messageText: 'secret original message body',
      blobField: '{"k":"v"}',
    });
    expect(payload.lens.retryOf).toBe('lens-original');
    expect(JSON.stringify(payload)).toContain('secret original message body');
  });

  it('keeps retrySeed when oversized payloads are skeletonized', () => {
    const registry = createContextLensRegistry({ ttlMs: 60_000 });
    const blobField = JSON.stringify({ body: 'b'.repeat(7_500) });
    const lens = registry.create({
      messageId: 'msg-oversized-retry',
      chatType: 'channel',
      trigger: 'mention',
      senderShip: '~ten',
      conversationId: 'chat/~ten/test',
      retrySeed: {
        messageText: 'm'.repeat(20_000),
        blobField,
        parentId: '170.1',
        isThreadReply: true,
        replyParentId: '170.2',
        cachesHistory: true,
      },
    });
    lens.tools.runs = Array.from({ length: 100 }, (_, i) => ({
      id: `t-${i}`,
      callIndex: i + 1,
      name: 'browser',
      startedAt: Date.now(),
      completedAt: Date.now(),
      durationMs: 5,
      status: 'completed' as const,
      argumentSummary: 'y'.repeat(4_000),
      resultSummary: 'z'.repeat(4_000),
    }));

    const payload = buildLensRunPayload(lens);

    expect(payload.truncated).toBe(true);
    expect(payload.lens.tools.runs).toEqual([]);
    expect(payload.lens.context.sources).toEqual([]);
    expect(payload.lens.outputs).toEqual([]);
    expect(payload.lens.retrySeed).toEqual(lens.retrySeed);
    expect(payload.lens.retrySeed?.messageText).toHaveLength(16_384);
    expect(payload.lens.retrySeed?.blobField).toBe(blobField);
    expect(JSON.stringify(payload).length).toBeLessThan(50 * 1_024);
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

    expect(pokes.map(pokeKind)).toEqual(['configure', 'lens', 'lens', 'lens']);
    expect(pokes.every((p) => p.app === 'steward')).toBe(true);
    expect(pokes[0].mark).toBe('steward-action-1');
    expect(pokes[0].json).toEqual({ configure: { owner: '~bus' } });
    expect(
      pokes.slice(1).every((p) => p.mark === 'steward-lens-action-1')
    ).toBe(true);
    const final = pokes[3].json as {
      entry: { id: string; payload: unknown; final: boolean };
    };
    expect(final.entry.id).toBe(lens.lensId);
    expect(final.entry.final).toBe(true);
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
    expect(pokes.map(pokeKind)).toEqual(['configure', 'lens']);
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
    expect(pokes.map(pokeKind)).toEqual(['configure', 'lens']);

    // New params instance (monitor restart): configure re-asserted.
    current = makeParams(pokes);
    sync.handleEvent(makeEvent(makeLens({ status: 'completed' })));
    await sync.flush();
    expect(pokes.map(pokeKind)).toEqual([
      'configure',
      'lens',
      'configure',
      'lens',
    ]);
  });
});

// Keep this block last: initContextLensShipSync subscribes to the global lens
// event stream, and the final subscription persists for the rest of the file.
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

describe('createLensSyncRetry', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires run after the base delay and backs off exponentially', () => {
    vi.useFakeTimers();
    let runs = 0;
    const retry = createLensSyncRetry({
      run: () => {
        runs += 1;
      },
      logger: silentLogger,
      baseMs: 1_000,
      maxMs: 8_000,
    });

    retry.schedule();
    vi.advanceTimersByTime(999);
    expect(runs).toBe(0);
    vi.advanceTimersByTime(1);
    expect(runs).toBe(1);

    // Attempts 2..4 double each time, then cap at maxMs.
    retry.schedule();
    vi.advanceTimersByTime(2_000);
    expect(runs).toBe(2);
    retry.schedule();
    vi.advanceTimersByTime(4_000);
    expect(runs).toBe(3);
    retry.schedule();
    vi.advanceTimersByTime(8_000);
    expect(runs).toBe(4);
    retry.schedule();
    vi.advanceTimersByTime(8_000);
    expect(runs).toBe(5);
  });

  it('dedupes schedule calls while a retry is pending', () => {
    vi.useFakeTimers();
    let runs = 0;
    const retry = createLensSyncRetry({
      run: () => {
        runs += 1;
      },
      logger: silentLogger,
      baseMs: 1_000,
    });

    retry.schedule();
    retry.schedule();
    retry.schedule();
    vi.advanceTimersByTime(10_000);
    expect(runs).toBe(1);
  });

  it('reset returns to the base delay; cancel drops the pending timer', () => {
    vi.useFakeTimers();
    let runs = 0;
    const retry = createLensSyncRetry({
      run: () => {
        runs += 1;
      },
      logger: silentLogger,
      baseMs: 1_000,
    });

    retry.schedule();
    vi.advanceTimersByTime(1_000);
    retry.reset();
    retry.schedule();
    vi.advanceTimersByTime(1_000);
    expect(runs).toBe(2);

    retry.schedule();
    retry.cancel();
    vi.advanceTimersByTime(60_000);
    expect(runs).toBe(2);
  });
});

describe('onRunFinalFailure', () => {
  it('fires when the run-final poke rejects, but not for milestone failures', async () => {
    const failures: string[] = [];
    const failing: SharedApiClientParams = {
      poke: () => Promise.reject(new Error('ship offline')),
      shipName: '~zod',
      shipUrl: 'http://localhost:8080',
    };
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: silentLogger,
      getParams: () => failing,
      onRunFinalFailure: (lens) => failures.push(lens.lensId),
    });

    const lens = makeLens({ status: 'tool_running' });
    sync.handleEvent(makeEvent(lens));
    await sync.flush();
    expect(failures).toHaveLength(0);

    sync.handleEvent(makeEvent({ ...lens, status: 'completed' }));
    await sync.flush();
    expect(failures).toEqual([lens.lensId]);
  });

  it('fires when the final is dropped because no params are published', async () => {
    const failures: string[] = [];
    const sync = createContextLensShipSync({
      owner: '~bus',
      logger: silentLogger,
      getParams: () => null,
      onRunFinalFailure: (lens) => failures.push(lens.lensId),
    });

    const lens = makeLens({ status: 'completed' });
    sync.handleEvent(makeEvent(lens));
    await sync.flush();
    expect(failures).toEqual([lens.lensId]);
  });

  it('heals a failed final through replay once the ship is reachable again', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-retry-'));
    const filePath = path.join(dir, 'runs.jsonl');
    try {
      const store = createContextLensStore({ filePath });
      const pokes: RecordedPoke[] = [];
      let online = false;
      const flaky: SharedApiClientParams = {
        poke: (params) => {
          if (!online) {
            return Promise.reject(new Error('ship offline'));
          }
          pokes.push(params as RecordedPoke);
          return Promise.resolve(undefined);
        },
        shipName: '~zod',
        shipUrl: 'http://localhost:8080',
      };
      const failures: string[] = [];
      const sync = createContextLensShipSync({
        owner: '~bus',
        logger: silentLogger,
        getParams: () => flaky,
        onRunFinal: (lens) => {
          recordSyncedLensId(syncedLensIdsPath(filePath), lens.lensId);
        },
        onRunFinalFailure: (lens) => failures.push(lens.lensId),
      });

      // Run finishes during an outage: store has it, ship poke fails.
      const lens = makeLens({ status: 'completed' });
      store.save({
        ...lens,
        lifecycle: { ...lens.lifecycle, completedAt: Date.now() },
      });
      sync.handleEvent(makeEvent(lens));
      await sync.flush();
      expect(failures).toEqual([lens.lensId]);
      expect(pokes).toHaveLength(0);

      // Connectivity returns; the retry-driven replay finalizes the run.
      online = true;
      expect(replayUnsyncedFinalRuns(store, sync, silentLogger)).toBe(1);
      await sync.flush();
      expect(pokes.map(pokeKind)).toEqual(['configure', 'lens']);
      expect(
        loadSyncedLensIds(syncedLensIdsPath(filePath)).has(lens.lensId)
      ).toBe(true);

      // Nothing left to heal on the next pass.
      expect(replayUnsyncedFinalRuns(store, sync, silentLogger)).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

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

      expect(pokes.map(pokeKind)).toEqual(['configure', 'lens']);
    } finally {
      slot.set(previousParams);
    }
  });

  it('arms the sync retry when the ledger write fails after a successful poke', async () => {
    const pokes: RecordedPoke[] = [];
    const slot = sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT);
    const previousParams = slot.get();
    slot.set(makeParams(pokes));
    const messages: string[] = [];
    const logger = {
      info: (message: string) => messages.push(message),
      warn: (message: string) => messages.push(message),
    };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-ledger-failure-'));
    // recordSyncedLensId writes next to the store file; a store whose
    // directory does not exist makes that write throw.
    setContextLensStore({
      filePath: path.join(dir, 'missing', 'runs.jsonl'),
      save: () => {},
      size: () => 0,
      get: () => null,
      list: () => [],
    });
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
      logger,
    };

    try {
      expect(initContextLensShipSync(api)).toBe(true);

      publishContextLensEvent('final', makeLens({ status: 'completed' }));
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(pokes.map(pokeKind)).toEqual(['configure', 'lens']);
      expect(messages.join('\n')).toContain('ledger write failed');
      expect(messages.join('\n')).toContain('retrying unsynced finals');
    } finally {
      slot.set(previousParams);
      setContextLensStore(null);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
