/**
 * Interval-driven scheduler for re-engagement nudge ticks.
 *
 * Owns the timer lifecycle, reentrancy guard, and abort handling. Knows
 * nothing about Urbit, settings, or telemetry — the caller supplies a
 * tick callback that does the evaluation and side effects.
 */

export const DEFAULT_NUDGE_TICK_INTERVAL_MS = 15 * 60 * 1000;

export type NudgeSchedulerOptions = {
  tick: () => Promise<void> | void;
  intervalMs?: number;
  abortSignal?: AbortSignal;
  log?: (msg: string) => void;
  error?: (msg: string) => void;
};

export type NudgeScheduler = {
  start: () => void;
  /**
   * Stop the interval timer and await any in-flight tick. Safe to call
   * multiple times: subsequent calls still return a promise that drains
   * the active tick (or resolves immediately if none is running).
   */
  stop: () => Promise<void>;
  tickNow: () => Promise<void>;
  readonly isRunning: boolean;
};

export function createNudgeScheduler(opts: NudgeSchedulerOptions): NudgeScheduler {
  const intervalMs = opts.intervalMs ?? DEFAULT_NUDGE_TICK_INTERVAL_MS;
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let started = false;
  // Tracked so `stop()` can await an in-flight tick before the caller
  // tears down the rest of the monitor (persistence queues, `api.close()`
  // etc.). Cleared inside the tick's `finally` once the body resolves.
  let activeTick: Promise<void> | null = null;

  async function runTick(): Promise<void> {
    if (opts.abortSignal?.aborted) {return;}
    if (running) {return;}
    running = true;
    const task = (async () => {
      try {
        await opts.tick();
      } catch (err) {
        opts.error?.(`[tlon] nudge tick failed: ${String(err)}`);
      } finally {
        running = false;
      }
    })();
    activeTick = task;
    try {
      await task;
    } finally {
      if (activeTick === task) {
        activeTick = null;
      }
    }
  }

  return {
    start(): void {
      if (started) {return;}
      if (opts.abortSignal?.aborted) {return;}
      started = true;
      // Schedule the first tick on the next macrotask so callers can finish
      // their synchronous startup wiring before the tick observes state.
      setTimeout(() => {
        if (opts.abortSignal?.aborted || !started) {return;}
        void runTick();
      }, 0);
      timer = setInterval(() => {
        if (opts.abortSignal?.aborted) {return;}
        void runTick();
      }, intervalMs);
    },
    async stop(): Promise<void> {
      started = false;
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
      // Drain any in-flight tick so shutdown-time cleanup (queue flush,
      // shadow clear, api.close) runs after the tick's last writes land.
      if (activeTick) {
        await activeTick.catch(() => undefined);
      }
    },
    async tickNow(): Promise<void> {
      await runTick();
    },
    get isRunning(): boolean {
      return running;
    },
  };
}
