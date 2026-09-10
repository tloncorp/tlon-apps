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

/**
 * Parse a TLON_SSE_STALE_THRESHOLD_MS env override into a safe stale threshold.
 * Unlike the interval, 0 is a DOCUMENTED disable (startStreamWatchdog bails on
 * <= 0), so it is accepted. Negative/fractional/NaN/Infinity/unsafe values — and
 * empty/whitespace strings, which Number() coerces to 0 — are rejected so a typo
 * can't silently disable the watchdog (the bot's only recovery from a hung
 * socket); only the literal string '0' disables it. '-0' parses to -0, which
 * passes isSafeInteger and >= 0 but disables the watchdog via the <= 0 bail —
 * rejected explicitly via Object.is.
 */
export function parseSseStaleThresholdMs(
  raw: string | undefined
): number | undefined {
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }
  const v = Number(raw);
  if (
    Number.isSafeInteger(v) &&
    !Object.is(v, -0) &&
    v >= 0 &&
    v <= 2_147_483_647
  ) {
    return v;
  }
  return undefined;
}
