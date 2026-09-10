// The signal is the monitor's opts.abortSignal: a shutdown or config-reload
// restart during a backoff must cancel the pending timer and stop the retry
// loop, or a retired monitor lingers and retries against its stale SSE client
// (same pattern as the authentication backoff in monitor/index.ts).
export type Sleeper = (ms: number, signal?: AbortSignal) => Promise<void>;

// Exported for the timer/listener-cleanup tests; production always reaches it
// through the Sleeper default.
export const defaultSleep: Sleeper = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
