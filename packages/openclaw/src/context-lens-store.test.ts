import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { publishContextLensEvent } from './context-lens-events.js';
import {
  createContextLensStore,
  createInflightCheckpoint,
  getContextLensStore,
  inflightCheckpointPath,
  initContextLensStore,
  markLensAborted,
  recoverInterruptedRuns,
  setContextLensStore,
} from './context-lens-store.js';
import {
  type ContextLens,
  type ContextLensStatus,
  createContextLensRegistry,
} from './context-lens.js';
import { sharedSlot } from './shared-state.js';

let tmpDir: string;
let filePath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-store-'));
  filePath = path.join(tmpDir, 'runs.jsonl');
});

afterEach(() => {
  setContextLensStore(null);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeLens(
  overrides: { completedAt?: number; messageId?: string } = {}
): ContextLens {
  const registry = createContextLensRegistry({ ttlMs: 60_000 });
  const lens = registry.create({
    messageId: overrides.messageId ?? 'msg-1',
    chatType: 'dm',
    trigger: 'dm',
  });
  const completedAt = overrides.completedAt ?? Date.now();
  return {
    ...lens,
    status: 'completed',
    lifecycle: { ...lens.lifecycle, completedAt },
  };
}

function makeInflightLens(
  overrides: { messageId?: string; status?: ContextLensStatus } = {}
): ContextLens {
  const registry = createContextLensRegistry({ ttlMs: 60_000 });
  const lens = registry.create({
    messageId: overrides.messageId ?? 'inflight-1',
    chatType: 'dm',
    trigger: 'dm',
  });
  return { ...lens, status: overrides.status ?? 'dispatching' };
}

describe('createContextLensStore', () => {
  it('round-trips a saved run', () => {
    const store = createContextLensStore({ filePath });
    const lens = makeLens({ messageId: 'round-trip' });

    store.save(lens);

    expect(store.get(lens.lensId)).toMatchObject({
      lensId: lens.lensId,
      messageId: 'round-trip',
    });
    expect(store.get('missing')).toBeNull();
  });

  it('recovers saved runs in a fresh store instance (restart survival)', () => {
    const first = createContextLensStore({ filePath });
    const lensA = makeLens({ messageId: 'restart-a' });
    const lensB = makeLens({ messageId: 'restart-b' });
    first.save(lensA);
    first.save(lensB);

    const second = createContextLensStore({ filePath });

    expect(second.size()).toBe(2);
    expect(second.get(lensA.lensId)?.messageId).toBe('restart-a');
    expect(second.get(lensB.lensId)?.messageId).toBe('restart-b');
  });

  it('keeps the latest snapshot when the same lensId is saved twice', () => {
    const store = createContextLensStore({ filePath });
    const lens = makeLens({ messageId: 'dup' });
    store.save(lens);
    store.save({ ...lens, error: 'late update' });

    expect(store.get(lens.lensId)?.error).toBe('late update');

    const reloaded = createContextLensStore({ filePath });
    expect(reloaded.size()).toBe(1);
    expect(reloaded.get(lens.lensId)?.error).toBe('late update');
  });

  it('evicts the oldest runs past maxStored', () => {
    const store = createContextLensStore({ filePath, maxStored: 2 });
    const lenses = [
      makeLens({ messageId: 'evict-0' }),
      makeLens({ messageId: 'evict-1' }),
      makeLens({ messageId: 'evict-2' }),
    ];
    for (const lens of lenses) {
      store.save(lens);
    }

    expect(store.size()).toBe(2);
    expect(store.get(lenses[0].lensId)).toBeNull();
    expect(store.get(lenses[2].lensId)).not.toBeNull();

    const reloaded = createContextLensStore({ filePath, maxStored: 2 });
    expect(reloaded.size()).toBe(2);
    expect(reloaded.get(lenses[0].lensId)).toBeNull();
  });

  it('drops runs older than retainDays on load and refuses to store them', () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const store = createContextLensStore({ filePath, retainDays: 7 });
    const stale = makeLens({ completedAt: Date.now() - 8 * dayMs });
    const fresh = makeLens({ messageId: 'fresh' });

    store.save(stale);
    store.save(fresh);
    expect(store.get(stale.lensId)).toBeNull();
    expect(store.get(fresh.lensId)).not.toBeNull();

    // A stale entry already on disk is pruned at load time.
    fs.appendFileSync(filePath, `${JSON.stringify(stale)}\n`);
    const reloaded = createContextLensStore({ filePath, retainDays: 7 });
    expect(reloaded.get(stale.lensId)).toBeNull();
    expect(reloaded.get(fresh.lensId)).not.toBeNull();
  });

  it('skips malformed lines and compacts them away', () => {
    const lens = makeLens({ messageId: 'survives' });
    fs.writeFileSync(
      filePath,
      `not json at all\n${JSON.stringify(lens)}\n{"lensId":42}\n`
    );
    const warnings: string[] = [];

    const store = createContextLensStore({
      filePath,
      logger: { info: () => {}, warn: (m) => warnings.push(m) },
    });

    expect(store.size()).toBe(1);
    expect(store.get(lens.lensId)?.messageId).toBe('survives');
    expect(warnings.join('\n')).toContain('malformed');

    const compacted = fs.readFileSync(filePath, 'utf8').trim().split('\n');
    expect(compacted).toHaveLength(1);
  });

  it('creates the parent directory when missing', () => {
    const nested = path.join(tmpDir, 'deep', 'nested', 'runs.jsonl');
    const store = createContextLensStore({ filePath: nested });
    const lens = makeLens();
    store.save(lens);

    expect(fs.existsSync(nested)).toBe(true);
    expect(store.get(lens.lensId)).not.toBeNull();
  });
});

describe('createInflightCheckpoint', () => {
  it('upserts, removes, and survives reload', () => {
    const checkpointPath = inflightCheckpointPath(filePath);
    const checkpoint = createInflightCheckpoint({ filePath: checkpointPath });
    const a = makeInflightLens({ messageId: 'ckpt-a' });
    const b = makeInflightLens({ messageId: 'ckpt-b' });

    checkpoint.upsert(a);
    checkpoint.upsert(b);
    expect(
      checkpoint
        .list()
        .map((l) => l.lensId)
        .sort()
    ).toEqual([a.lensId, b.lensId].sort());

    checkpoint.remove(a.lensId);
    const reloaded = createInflightCheckpoint({ filePath: checkpointPath });
    expect(reloaded.list().map((l) => l.lensId)).toEqual([b.lensId]);
  });

  it('keeps the latest snapshot per lensId', () => {
    const checkpoint = createInflightCheckpoint({
      filePath: inflightCheckpointPath(filePath),
    });
    const lens = makeInflightLens({
      messageId: 'ckpt-dup',
      status: 'assembling',
    });
    checkpoint.upsert(lens);
    checkpoint.upsert({ ...lens, status: 'tool_running' });
    expect(checkpoint.list()).toHaveLength(1);
    expect(checkpoint.list()[0].status).toBe('tool_running');
  });

  it('clear empties the file', () => {
    const checkpointPath = inflightCheckpointPath(filePath);
    const checkpoint = createInflightCheckpoint({ filePath: checkpointPath });
    checkpoint.upsert(makeInflightLens());
    checkpoint.clear();
    expect(checkpoint.list()).toHaveLength(0);
    expect(fs.readFileSync(checkpointPath, 'utf8')).toBe('');
  });

  it('evicts the oldest entry past maxInflight', () => {
    const checkpoint = createInflightCheckpoint({
      filePath: inflightCheckpointPath(filePath),
      maxInflight: 2,
    });
    const a = makeInflightLens({ messageId: 'evict-a' });
    const b = makeInflightLens({ messageId: 'evict-b' });
    const c = makeInflightLens({ messageId: 'evict-c' });
    checkpoint.upsert(a);
    checkpoint.upsert(b);
    checkpoint.upsert(c);
    expect(checkpoint.list().map((l) => l.lensId)).toEqual([
      b.lensId,
      c.lensId,
    ]);
  });
});

describe('markLensAborted', () => {
  it('finalizes status, timings, and open tool runs', () => {
    const now = 10_000;
    const base = makeInflightLens({ status: 'tool_running' });
    const lens: ContextLens = {
      ...base,
      createdAt: now - 5_000,
      tools: {
        ...base.tools,
        runs: [
          {
            id: 't1',
            callIndex: 1,
            name: 'search',
            startedAt: now - 3_000,
            completedAt: null,
            durationMs: null,
            status: 'running',
          },
          {
            id: 't2',
            callIndex: 2,
            name: 'fetch',
            startedAt: now - 8_000,
            completedAt: now - 7_000,
            durationMs: 1_000,
            status: 'completed',
          },
        ],
      },
    };

    const aborted = markLensAborted(lens, now);

    expect(aborted.status).toBe('aborted');
    expect(aborted.error).toContain('Gateway stopped');
    expect(aborted.lifecycle.completedAt).toBe(now);
    expect(aborted.lifecycle.durationMs).toBe(5_000);
    expect(aborted.tools.runs[0]).toMatchObject({
      status: 'error',
      completedAt: now,
      durationMs: 3_000,
    });
    // A tool run that already finished is left untouched.
    expect(aborted.tools.runs[1]).toMatchObject({
      status: 'completed',
      durationMs: 1_000,
    });
  });

  it('preserves an existing terminal timestamp and error', () => {
    const base = makeInflightLens();
    const lens: ContextLens = {
      ...base,
      error: 'original error',
      lifecycle: { ...base.lifecycle, completedAt: 42, durationMs: 7 },
    };
    const aborted = markLensAborted(lens, 99);
    expect(aborted.lifecycle.completedAt).toBe(42);
    expect(aborted.lifecycle.durationMs).toBe(7);
    expect(aborted.error).toBe('original error');
  });
});

describe('recoverInterruptedRuns', () => {
  it('aborts leftover in-flight runs into the store and clears the checkpoint', () => {
    const store = createContextLensStore({ filePath });
    const checkpoint = createInflightCheckpoint({
      filePath: inflightCheckpointPath(filePath),
    });
    const lens = makeInflightLens({ messageId: 'killed' });
    checkpoint.upsert(lens);

    const recovered = recoverInterruptedRuns({ store, checkpoint });

    expect(recovered).toBe(1);
    expect(store.get(lens.lensId)?.status).toBe('aborted');
    expect(checkpoint.list()).toHaveLength(0);
  });

  it('skips runs already terminal on disk (stale checkpoint line)', () => {
    const store = createContextLensStore({ filePath });
    const finished = makeLens({ messageId: 'finished' });
    store.save(finished);
    const checkpoint = createInflightCheckpoint({
      filePath: inflightCheckpointPath(filePath),
    });
    // Same lensId, but the checkpoint still holds the pre-terminal snapshot.
    checkpoint.upsert({ ...finished, status: 'dispatching' });

    const recovered = recoverInterruptedRuns({ store, checkpoint });

    expect(recovered).toBe(0);
    expect(store.get(finished.lensId)?.status).toBe('completed');
  });

  it('does no work when the checkpoint is empty', () => {
    const store = createContextLensStore({ filePath });
    const checkpoint = createInflightCheckpoint({
      filePath: inflightCheckpointPath(filePath),
    });
    expect(recoverInterruptedRuns({ store, checkpoint })).toBe(0);
  });
});

// Keep this block last: initContextLensStore subscribes to the global lens
// event stream, and that subscription persists for the rest of the file.
describe('initContextLensStore', () => {
  function makeApi(contextLens: Record<string, unknown>) {
    return {
      config: {
        channels: { tlon: { ship: '~zod', contextLens } },
      } as OpenClawConfig,
      logger: { info: () => {}, warn: () => {} },
    };
  }

  it('returns null when the lens or its store is disabled', () => {
    expect(initContextLensStore(makeApi({ enabled: false }))).toBeNull();
    expect(
      initContextLensStore(
        makeApi({
          enabled: true,
          authToken: 'a-token-of-sufficient-length',
          store: { enabled: false },
        })
      )
    ).toBeNull();
    expect(getContextLensStore()).toBeNull();
  });

  it('persists terminal lens events and ignores in-flight ones', () => {
    const store = initContextLensStore(
      makeApi({
        enabled: true,
        authToken: 'a-token-of-sufficient-length',
        store: { path: filePath },
      })
    );
    expect(store).not.toBeNull();
    expect(getContextLensStore()).toBe(store);

    const inFlight = makeLens({ messageId: 'in-flight' });
    publishContextLensEvent('created', { ...inFlight, status: 'dispatching' });
    expect(store?.get(inFlight.lensId)).toBeNull();

    const finalized = makeLens({ messageId: 'finalized' });
    publishContextLensEvent('final', finalized);
    expect(store?.get(finalized.lensId)?.messageId).toBe('finalized');

    const aborted = makeLens({ messageId: 'aborted-run' });
    publishContextLensEvent('final', { ...aborted, status: 'aborted' });
    expect(store?.get(aborted.lensId)?.messageId).toBe('aborted-run');

    const reloaded = createContextLensStore({ filePath });
    expect(reloaded.get(finalized.lensId)?.messageId).toBe('finalized');
    expect(reloaded.get(aborted.lensId)?.status).toBe('aborted');
  });

  it('replaces the event subscription on re-init instead of stacking writers', () => {
    const stalePath = path.join(tmpDir, 'stale.jsonl');
    initContextLensStore(
      makeApi({
        enabled: true,
        authToken: 'a-token-of-sufficient-length',
        store: { path: stalePath },
      })
    );
    const store = initContextLensStore(
      makeApi({
        enabled: true,
        authToken: 'a-token-of-sufficient-length',
        store: { path: filePath },
      })
    );

    const finalized = makeLens({ messageId: 'replaced-writer' });
    publishContextLensEvent('final', finalized);

    expect(store?.get(finalized.lensId)?.messageId).toBe('replaced-writer');
    const staleContents = fs.existsSync(stalePath)
      ? fs.readFileSync(stalePath, 'utf8')
      : '';
    expect(staleContents).not.toContain(finalized.lensId);
  });

  it('checkpoints in-flight events and clears them on terminal', () => {
    initContextLensStore(
      makeApi({
        enabled: true,
        authToken: 'a-token-of-sufficient-length',
        store: { path: filePath },
      })
    );
    const checkpointPath = inflightCheckpointPath(filePath);

    const lens = makeInflightLens({ messageId: 'checkpointed' });
    publishContextLensEvent('created', { ...lens, status: 'dispatching' });
    expect(fs.readFileSync(checkpointPath, 'utf8')).toContain(lens.lensId);

    publishContextLensEvent('final', { ...lens, status: 'completed' });
    expect(fs.readFileSync(checkpointPath, 'utf8')).not.toContain(lens.lensId);
  });

  it('recovers an interrupted run as aborted on boot', () => {
    // Simulate a prior process that died mid-run: a checkpoint entry exists
    // with no terminal record in the store.
    const stranded = makeInflightLens({
      messageId: 'stranded',
      status: 'tool_running',
    });
    fs.writeFileSync(
      inflightCheckpointPath(filePath),
      `${JSON.stringify(stranded)}\n`
    );
    // Recovery is once-per-process; reset the guard so this boot runs it.
    sharedSlot<boolean>('contextLens.inflight.recovered').set(false);

    const store = initContextLensStore(
      makeApi({
        enabled: true,
        authToken: 'a-token-of-sufficient-length',
        store: { path: filePath },
      })
    );

    expect(store?.get(stranded.lensId)?.status).toBe('aborted');
    expect(fs.readFileSync(inflightCheckpointPath(filePath), 'utf8')).toBe('');
  });
});
