import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_BEGIN_REFUSALS,
  MAX_CONCURRENT_UPLOADS,
  dequeueUpload,
  enqueueUpload,
  noteUploadOpened,
  requeueRefusedUpload,
  resetUploadQueue,
  uploadQueuePausedUntil,
} from './bucketUploadQueue';

/** A run that stays open until released, recording when it starts. */
function controllable(started: string[], id: string) {
  let release!: () => void;
  const done = new Promise<void>((resolve) => (release = resolve));
  return {
    run: () => {
      started.push(id);
      return done;
    },
    release: () => release(),
  };
}

async function flush() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  resetUploadQueue();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('bucketUploadQueue', () => {
  it('never runs more than the limit at once, in the order queued', async () => {
    const started: string[] = [];
    const jobs = Array.from({ length: 10 }, (_, i) =>
      controllable(started, `u${i}`)
    );
    jobs.forEach((job, i) => enqueueUpload(`u${i}`, job.run));
    await flush();
    expect(started).toEqual(['u0', 'u1', 'u2']);
    expect(started).toHaveLength(MAX_CONCURRENT_UPLOADS);

    jobs[1].release();
    await flush();
    expect(started).toEqual(['u0', 'u1', 'u2', 'u3']);
  });

  it('ignores an upload that is already queued or running', async () => {
    const started: string[] = [];
    const job = controllable(started, 'u0');
    enqueueUpload('u0', job.run);
    enqueueUpload('u0', job.run);
    await flush();
    enqueueUpload('u0', job.run);
    await flush();
    expect(started).toEqual(['u0']);
  });

  it('frees the slot when a run throws', async () => {
    const started: string[] = [];
    for (let i = 0; i < MAX_CONCURRENT_UPLOADS; i += 1) {
      enqueueUpload(`bad${i}`, async () => {
        started.push(`bad${i}`);
        throw new Error('boom');
      });
    }
    enqueueUpload('next', async () => {
      started.push('next');
    });
    await flush();
    expect(started).toContain('next');
  });

  it('drops a queued upload before it starts', async () => {
    const started: string[] = [];
    const jobs = Array.from({ length: 4 }, (_, i) =>
      controllable(started, `u${i}`)
    );
    jobs.forEach((job, i) => enqueueUpload(`u${i}`, job.run));
    dequeueUpload('u3');
    jobs[0].release();
    await flush();
    expect(started).toEqual(['u0', 'u1', 'u2']);
  });

  it('holds the whole queue after a refusal, then retries the refused upload first', async () => {
    const started: string[] = [];
    let refused = false;
    enqueueUpload('a', async () => {
      started.push('a');
      if (!refused) {
        refused = true;
        expect(requeueRefusedUpload('a')).toBe(true);
      }
    });
    await flush();
    // Queued while the refusal is holding everything.
    enqueueUpload('b', async () => {
      started.push('b');
    });
    await flush();
    expect(started).toEqual(['a']);
    expect(uploadQueuePausedUntil()).not.toBeNull();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(started).toEqual(['a', 'a', 'b']);
  });

  it('waits at least the delay the host asked for', async () => {
    const started: string[] = [];
    let refused = false;
    enqueueUpload('a', async () => {
      started.push('a');
      if (!refused) {
        refused = true;
        requeueRefusedUpload('a', 30_000);
      }
    });
    await flush();
    await vi.advanceTimersByTimeAsync(29_000);
    expect(started).toEqual(['a']);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(started).toEqual(['a', 'a']);
  });

  // Requeues are made from inside a run, while it still holds its slot.
  it('backs off further on each refusal and resets once an upload opens', async () => {
    const started: string[] = [];
    const a = controllable(started, 'a');
    enqueueUpload('a', a.run);
    await flush();
    const at = Date.now();
    requeueRefusedUpload('a');
    expect(uploadQueuePausedUntil()).toBe(at + 5_000);
    // Refused again only after the hold has passed: it doubles.
    vi.setSystemTime(at + 5_000);
    requeueRefusedUpload('a');
    expect(uploadQueuePausedUntil()).toBe(at + 5_000 + 10_000);

    noteUploadOpened('a');
    resetUploadQueue();
    const b = controllable(started, 'b');
    enqueueUpload('b', b.run);
    await flush();
    requeueRefusedUpload('b');
    expect(uploadQueuePausedUntil()).toBe(Date.now() + 5_000);
  });

  it('escalates once for uploads refused together', async () => {
    const jobs = ['a', 'b', 'c'].map((id) => controllable([], id));
    jobs.forEach((job, i) => enqueueUpload(['a', 'b', 'c'][i], job.run));
    await flush();
    const at = Date.now();
    requeueRefusedUpload('a');
    requeueRefusedUpload('b');
    requeueRefusedUpload('c');
    expect(uploadQueuePausedUntil()).toBe(at + 5_000);
  });

  it('keeps backing off when a grant already in flight lands during a hold', async () => {
    const jobs = ['a', 'b'].map((id) => controllable([], id));
    jobs.forEach((job, i) => enqueueUpload(['a', 'b'][i], job.run));
    await flush();
    const at = Date.now();
    requeueRefusedUpload('a');
    // b's grant was asked for before the refusal and lands inside the hold.
    noteUploadOpened('b');
    vi.setSystemTime(at + 5_000);
    requeueRefusedUpload('a');
    expect(uploadQueuePausedUntil()).toBe(at + 5_000 + 10_000);
  });

  it('gives up on an upload refused too often', async () => {
    const a = controllable([], 'a');
    enqueueUpload('a', a.run);
    await flush();
    for (let i = 1; i < MAX_BEGIN_REFUSALS; i += 1) {
      expect(requeueRefusedUpload('a')).toBe(true);
    }
    expect(requeueRefusedUpload('a')).toBe(false);
  });

  it('runs nothing queued before a reset', async () => {
    const started: string[] = [];
    const jobs = Array.from({ length: 5 }, (_, i) =>
      controllable(started, `u${i}`)
    );
    jobs.forEach((job, i) => enqueueUpload(`u${i}`, job.run));
    await flush();
    resetUploadQueue();
    jobs.forEach((job) => job.release());
    await flush();
    expect(started).toEqual(['u0', 'u1', 'u2']);
  });
});
