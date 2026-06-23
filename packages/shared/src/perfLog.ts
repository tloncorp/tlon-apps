/**
 * Lightweight always-on perf logging for investigating receive-path hangs.
 *
 * Disabled by default. Enable on web by running in the devtools console:
 *   localStorage.setItem('tlon:perf', '1')
 * ...and reloading. To disable:
 *   localStorage.removeItem('tlon:perf')
 *
 * Or set globalThis.__TLON_PERF__ = true (works in native too).
 *
 * Output is single-line, grep-friendly: `[perf] <label> key=value key=value`
 */

type Extra = Record<
  string,
  string | number | boolean | null | undefined | bigint
>;

let cached: boolean | null = null;

const checkEnabled = (): boolean => {
  try {
    const g: any = globalThis;
    if (g && g.__TLON_PERF__) return true;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('tlon:perf') === '1';
    }
  } catch {
    // ignore
  }
  return false;
};

export const perfEnabled = (): boolean => {
  if (cached === null) cached = checkEnabled();
  return cached;
};

export const perfRefresh = (): void => {
  cached = null;
};

const format = (label: string, data?: Extra): string => {
  if (!data) return `[perf] ${label}`;
  const parts = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  return parts ? `[perf] ${label} ${parts}` : `[perf] ${label}`;
};

export const perfLog = (label: string, data?: Extra): void => {
  if (!perfEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(format(label, data));
};

const noopStop = (_extra?: Extra): void => {
  /* no-op when disabled */
};

export const perfMark = (label: string): ((extra?: Extra) => void) => {
  if (!perfEnabled()) return noopStop;
  const start =
    typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  return (extra?: Extra) => {
    const now =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    const ms = +(now - start).toFixed(1);
    // eslint-disable-next-line no-console
    console.log(format(label, { ms, ...extra }));
  };
};

/**
 * Callback form of perfMark. Times `fn`, logs duration on resolve or reject,
 * and re-throws on error. Prefer this over `perfMark` when the perf scope is
 * a single await — `finally` guarantees the timer logs even on throw, and
 * the label sits next to the work it measures instead of as a `stopX` local.
 *
 * `extra` may be a static record or a function of the resolved value, for
 * cases where the metric depends on the result (e.g. counts derived from a
 * fetched payload). The function form is only invoked on success.
 */
export async function perfTime<T>(
  label: string,
  fn: () => Promise<T> | T,
  extra?: Extra | ((result: T) => Extra)
): Promise<T> {
  if (!perfEnabled()) return await fn();
  const now = () =>
    typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  const start = now();
  let errored = false;
  let result: T;
  try {
    result = await fn();
    return result;
  } catch (e) {
    errored = true;
    throw e;
  } finally {
    const ms = +(now() - start).toFixed(1);
    const resolved: Extra | undefined = errored
      ? undefined
      : typeof extra === 'function'
        ? extra(result!)
        : extra;
    // eslint-disable-next-line no-console
    console.log(
      format(label, errored ? { ms, error: 'true' } : { ms, ...resolved })
    );
  }
}
