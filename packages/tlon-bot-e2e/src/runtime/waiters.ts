export interface WaitForOptions {
  timeoutMs: number;
  intervalMs?: number;
  /**
   * Upper bound on a single poll attempt. Without it, one hung connection
   * (e.g. a container that accepts TCP but never responds) blocks the poll
   * loop past its overall deadline.
   */
  attemptTimeoutMs?: number;
  description: string;
}

export const DEFAULT_ATTEMPT_TIMEOUT_MS = 10_000;

export function attemptSignal(opts: WaitForOptions): AbortSignal {
  return AbortSignal.timeout(
    opts.attemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS
  );
}

export async function waitFor<T>(
  fn: () => Promise<T | undefined | false | null>,
  { timeoutMs, intervalMs = 1_000, description }: WaitForOptions
): Promise<T> {
  const started = Date.now();
  let lastError = '';
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await fn();
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `Timeout waiting for ${description} after ${timeoutMs}ms` +
      (lastError ? ` (last error: ${lastError})` : '')
  );
}

export async function waitForHttpOk(
  url: string,
  opts: WaitForOptions
): Promise<void> {
  await waitFor(async () => {
    const response = await fetch(url, { signal: attemptSignal(opts) });
    return response.ok;
  }, opts);
}

export async function waitForShipLogin(
  url: string,
  code: string,
  opts: WaitForOptions
): Promise<void> {
  await waitFor(async () => {
    const response = await fetch(`${url}/~/login`, {
      method: 'POST',
      body: new URLSearchParams({ password: code }),
      redirect: 'manual',
      signal: attemptSignal(opts),
    });
    const cookie = response.headers.get('set-cookie') ?? '';
    return response.ok || cookie.includes('urbauth');
  }, opts);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
