import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { publishContextLensEvent } from './context-lens-events.js';
import {
  createContextLensStore,
  getContextLensStore,
  initContextLensStore,
  setContextLensStore,
} from './context-lens-store.js';
import { type ContextLens, createContextLensRegistry } from './context-lens.js';

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

    const reloaded = createContextLensStore({ filePath });
    expect(reloaded.get(finalized.lensId)?.messageId).toBe('finalized');
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
});
