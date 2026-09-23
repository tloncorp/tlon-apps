export async function observeNoTrue<T extends Record<string, string>>({
  markers,
  read,
  observationMs,
  finalReadTimeoutMs = 10_000,
  pollMs = 1_000,
  now = Date.now,
  sleep = (duration: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, duration)),
}: {
  markers: T;
  read: (marker: string) => Promise<boolean | undefined>;
  observationMs: number;
  finalReadTimeoutMs?: number;
  pollMs?: number;
  now?: () => number;
  sleep?: (duration: number) => Promise<void>;
}): Promise<Record<keyof T, boolean | undefined>> {
  const observed = {} as Record<keyof T, boolean | undefined>;
  const entries = Object.entries(markers) as [keyof T, string][];
  const observationEnd = now() + observationMs;

  while (now() < observationEnd) {
    for (const [name, marker] of entries) {
      try {
        observed[name] = await read(marker);
      } catch {
        // Fake-ship reads can fail briefly while subscriptions catch up.
      }
    }
    if (Object.values(observed).some((value) => value === true)) {
      return observed;
    }
    await sleep(Math.min(pollMs, Math.max(0, observationEnd - now())));
  }

  const finalReadEnd = now() + finalReadTimeoutMs;
  let lastError: unknown;
  while (now() <= finalReadEnd) {
    try {
      const values = await Promise.all(
        entries.map(
          async ([name, marker]) => [name, await read(marker)] as const
        )
      );
      for (const [name, value] of values) observed[name] = value;
      return observed;
    } catch (error) {
      lastError = error;
      if (now() === finalReadEnd) break;
      await sleep(Math.min(pollMs, Math.max(0, finalReadEnd - now())));
    }
  }
  throw new Error(`Final absence read failed: ${String(lastError)}`);
}
