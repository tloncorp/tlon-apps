/**
 * Parse a TLON_SSE_WATCHDOG_INTERVAL_MS env override into a safe interval.
 * A 0/negative override would reach setInterval and be clamped to ~1ms,
 * spinning the watchdog ~1000×/s.
 */
export function parseSseWatchdogIntervalMs(
  raw: string | undefined
): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const v = Number(raw);
  if (Number.isSafeInteger(v) && v > 0 && v <= 2_147_483_647) {
    return v;
  }
  return undefined;
}
