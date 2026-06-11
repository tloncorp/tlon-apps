import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNudgeScheduler, DEFAULT_NUDGE_TICK_INTERVAL_MS } from "./nudge-scheduler.js";

describe("nudge-scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires the first tick on the next macrotask after start", async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const scheduler = createNudgeScheduler({ tick, intervalMs: 10_000 });

    scheduler.start();
    expect(tick).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it("fires subsequent ticks on the configured interval", async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const scheduler = createNudgeScheduler({ tick, intervalMs: 5_000 });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(tick).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(tick).toHaveBeenCalledTimes(3);

    scheduler.stop();
  });

  it("start is idempotent", async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const scheduler = createNudgeScheduler({ tick, intervalMs: 1_000 });

    scheduler.start();
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(tick).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it("stop halts further ticks", async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const scheduler = createNudgeScheduler({ tick, intervalMs: 1_000 });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("does not start when abortSignal already aborted", async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const ac = new AbortController();
    ac.abort();

    const scheduler = createNudgeScheduler({
      tick,
      intervalMs: 1_000,
      abortSignal: ac.signal,
    });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(tick).not.toHaveBeenCalled();
  });

  it("aborted signal skips pending ticks", async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const ac = new AbortController();
    const scheduler = createNudgeScheduler({
      tick,
      intervalMs: 1_000,
      abortSignal: ac.signal,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);

    ac.abort();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(tick).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it("reentrancy guard: a timer firing while a tick is in flight is a no-op", async () => {
    let release: (() => void) | null = null;
    const tick = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const scheduler = createNudgeScheduler({ tick, intervalMs: 1_000 });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);

    // Fire several more interval ticks while the first one is still awaiting.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(tick).toHaveBeenCalledTimes(1);

    release?.();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(tick).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it("errors inside tick do not poison the scheduler", async () => {
    const tick = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);
    const errorLog = vi.fn();
    const scheduler = createNudgeScheduler({
      tick,
      intervalMs: 1_000,
      error: errorLog,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(tick).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it("tickNow allows manual invocation", async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const scheduler = createNudgeScheduler({ tick, intervalMs: 1_000 });

    await scheduler.tickNow();
    expect(tick).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it("default interval is 15 minutes", () => {
    expect(DEFAULT_NUDGE_TICK_INTERVAL_MS).toBe(15 * 60 * 1000);
  });

  it("stop() awaits an in-flight tick before resolving", async () => {
    // Switch to real timers for this test so the in-flight tick's
    // micro/macrotask chain drains naturally.
    vi.useRealTimers();
    try {
      let resolveTick!: () => void;
      const tick = vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveTick = resolve;
          }),
      );
      const scheduler = createNudgeScheduler({ tick, intervalMs: 1_000 });

      const tickNowPromise = scheduler.tickNow();
      // Let the microtask queue advance so the tick body enters its await.
      await new Promise<void>((r) => setTimeout(r, 0));
      expect(tick).toHaveBeenCalledTimes(1);
      expect(scheduler.isRunning).toBe(true);

      // Issue stop while the tick is still hanging. stop() must not
      // resolve until the tick completes.
      let stopResolved = false;
      const stopPromise = scheduler.stop().then(() => {
        stopResolved = true;
      });
      await new Promise<void>((r) => setTimeout(r, 0));
      expect(stopResolved).toBe(false);

      // Complete the tick; stop should now resolve.
      resolveTick();
      await tickNowPromise;
      await stopPromise;
      expect(stopResolved).toBe(true);
      expect(scheduler.isRunning).toBe(false);
    } finally {
      vi.useFakeTimers();
    }
  });

  it("stop() is safe to call multiple times and still drains the in-flight tick", async () => {
    vi.useRealTimers();
    try {
      let resolveTick!: () => void;
      const tick = vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveTick = resolve;
          }),
      );
      const scheduler = createNudgeScheduler({ tick, intervalMs: 1_000 });

      const tickNowPromise = scheduler.tickNow();
      await new Promise<void>((r) => setTimeout(r, 0));

      // First call: timer off, returns a drain promise.
      const firstStop = scheduler.stop();
      // Second call while still in flight: also returns a promise that
      // resolves when the tick finishes.
      const secondStop = scheduler.stop();

      let firstResolved = false;
      let secondResolved = false;
      void firstStop.then(() => {
        firstResolved = true;
      });
      void secondStop.then(() => {
        secondResolved = true;
      });

      await new Promise<void>((r) => setTimeout(r, 0));
      expect(firstResolved).toBe(false);
      expect(secondResolved).toBe(false);

      resolveTick();
      await tickNowPromise;
      await Promise.all([firstStop, secondStop]);
      expect(firstResolved).toBe(true);
      expect(secondResolved).toBe(true);

      // Third call post-drain resolves immediately.
      const thirdStop = scheduler.stop();
      await thirdStop;
    } finally {
      vi.useFakeTimers();
    }
  });

  it("stop() resolves immediately when no tick is in flight", async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const scheduler = createNudgeScheduler({ tick, intervalMs: 10_000 });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    // The start-scheduled tick has already resolved; stop returns a
    // promise that settles on the next microtask.
    await scheduler.stop();
    expect(scheduler.isRunning).toBe(false);
  });
});
