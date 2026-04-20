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
