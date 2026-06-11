import { describe, expect, it, vi } from 'vitest';

import { createOwnerReplyPersistenceQueue } from './owner-reply-persistence.js';

type PokeCall = Record<string, unknown>;

function makeApi() {
  const calls: PokeCall[] = [];
  let resolvers: Array<() => void> = [];
  const api = {
    poke: vi.fn(async (params: PokeCall) => {
      calls.push(params);
      // Default: resolve immediately. Tests can install their own hook via
      // `controlled` mode below.
    }),
  };
  return { api, calls, resolvers };
}

function extractEntryKey(call: PokeCall): string | undefined {
  const json = (call.json ?? {}) as Record<string, unknown>;
  const put = json['put-entry'] as Record<string, unknown> | undefined;
  if (put) {
    return String(put['entry-key'] ?? '');
  }
  const del = json['del-entry'] as Record<string, unknown> | undefined;
  if (del) {
    return String(del['entry-key'] ?? '');
  }
  return undefined;
}

describe('owner-reply-persistence queue', () => {
  it('awaits put-entries before issuing the del-entry', async () => {
    const calls: Array<{ key: string; resolve: () => void }> = [];
    const api = {
      poke: vi.fn((params: PokeCall) => {
        const key = extractEntryKey(params) ?? '';
        return new Promise<void>((resolve) => {
          calls.push({ key, resolve });
        });
      }),
    };

    const queue = createOwnerReplyPersistenceQueue(api);
    queue.enqueue({ at: 1000, date: '2026-04-21', clearStage: true });

    // Both put-entries are issued immediately, del-entry is not yet.
    await Promise.resolve();
    await Promise.resolve();
    expect(calls.map((c) => c.key).toSorted()).toEqual([
      'lastOwnerMessageAt',
      'lastOwnerMessageDate',
    ]);

    // Resolve put-entries; del-entry should now fire.
    for (const c of calls) {
      c.resolve();
    }
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const delCall = calls.find((c) => c.key === 'lastNudgeStage');
    expect(delCall).toBeDefined();
    delCall?.resolve();
    await queue.flush();

    expect(calls.map((c) => c.key)).toEqual([
      expect.any(String),
      expect.any(String),
      'lastNudgeStage',
    ]);
  });

  it('skips the del-entry when clearStage is false', async () => {
    const { api, calls } = makeApi();
    const queue = createOwnerReplyPersistenceQueue(api);

    queue.enqueue({ at: 42, date: '2026-04-21', clearStage: false });
    await queue.flush();

    const keys = calls.map(extractEntryKey);
    expect(keys).toEqual(
      expect.arrayContaining(['lastOwnerMessageAt', 'lastOwnerMessageDate'])
    );
    expect(keys).not.toContain('lastNudgeStage');
  });

  it('preserves FIFO ordering across batches', async () => {
    const { api, calls } = makeApi();
    const queue = createOwnerReplyPersistenceQueue(api);

    queue.enqueue({ at: 1, date: '2026-04-21', clearStage: true });
    queue.enqueue({ at: 2, date: '2026-04-22', clearStage: false });
    await queue.flush();

    // Assert batch A's del-entry happens before any of batch B's put-entries.
    const keys = calls.map(extractEntryKey);
    const values = calls.map((c) => {
      const json = (c.json ?? {}) as Record<string, unknown>;
      const put = json['put-entry'] as Record<string, unknown> | undefined;
      return put ? put.value : undefined;
    });

    const delIdx = keys.indexOf('lastNudgeStage');
    expect(delIdx).toBeGreaterThan(-1);

    // Every batch-A put-entry (value 1 / "2026-04-21") must appear before the del.
    const firstBatchPutIdxes = values
      .map((v, i) => ({ v, i }))
      .filter((x) => x.v === 1 || x.v === '2026-04-21')
      .map((x) => x.i);
    for (const i of firstBatchPutIdxes) {
      expect(i).toBeLessThan(delIdx);
    }

    // Batch B's put-entries must appear after the del.
    const secondBatchPutIdxes = values
      .map((v, i) => ({ v, i }))
      .filter((x) => x.v === 2 || x.v === '2026-04-22')
      .map((x) => x.i);
    for (const i of secondBatchPutIdxes) {
      expect(i).toBeGreaterThan(delIdx);
    }
  });

  it('enqueueStageClear issues a standalone lastNudgeStage del-entry', async () => {
    const { api, calls } = makeApi();
    const queue = createOwnerReplyPersistenceQueue(api);

    queue.enqueueStageClear();
    await queue.flush();

    const keys = calls.map(extractEntryKey);
    expect(keys).toEqual(['lastNudgeStage']);
  });

  it('enqueueStageClear runs after an in-flight activity batch (ordering invariant)', async () => {
    // Models the runner's race path: the reply handler already enqueued
    // an activity-only batch, and now the runner appends a stage clear.
    // The del-entry must land after the put-entries to preserve the
    // "activity settles before stage clear" crash-consistency rule.
    const { api, calls } = makeApi();
    const queue = createOwnerReplyPersistenceQueue(api);

    queue.enqueue({ at: 7, date: '2026-04-21', clearStage: false });
    queue.enqueueStageClear();
    await queue.flush();

    const keys = calls.map(extractEntryKey);
    const delIdx = keys.indexOf('lastNudgeStage');
    expect(delIdx).toBeGreaterThan(-1);
    expect(keys.indexOf('lastOwnerMessageAt')).toBeLessThan(delIdx);
    expect(keys.indexOf('lastOwnerMessageDate')).toBeLessThan(delIdx);
  });

  it('tail survives an errored batch and keeps draining', async () => {
    const api = {
      poke: vi.fn().mockRejectedValueOnce(new Error('transient failure')),
    };
    // Subsequent calls resolve successfully.
    (api.poke as ReturnType<typeof vi.fn>).mockImplementation(
      async () => undefined
    );

    const logError = vi.fn();
    const queue = createOwnerReplyPersistenceQueue(api, { error: logError });
    queue.enqueue({ at: 1, date: '2026-04-21', clearStage: true });
    queue.enqueue({ at: 2, date: '2026-04-22', clearStage: false });

    await queue.flush();

    expect(logError).toHaveBeenCalledOnce();
    // Batch B still ran.
    expect(api.poke.mock.calls.length).toBeGreaterThan(1);
  });

  it("logs the transport error cause, not just 'fetch failed'", async () => {
    // Undici surfaces transport failures as `TypeError: fetch failed` with the
    // real reason on `.cause`; the log must include it for diagnosis.
    const api = {
      poke: vi.fn().mockRejectedValue(
        new TypeError('fetch failed', {
          cause: Object.assign(new Error('read ECONNRESET'), {
            code: 'ECONNRESET',
          }),
        })
      ),
    };
    const logError = vi.fn();
    const queue = createOwnerReplyPersistenceQueue(api, { error: logError });
    queue.enqueue({ at: 1, date: '2026-04-21', clearStage: true });
    await queue.flush();

    expect(logError).toHaveBeenCalledOnce();
    expect(logError.mock.calls[0][0]).toContain('cause=ECONNRESET');
  });
});
