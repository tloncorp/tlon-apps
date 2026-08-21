// Tool-heavy Tlon turns can legitimately spend several minutes uploading and
// verifying remote resources. Keep a hard cap, but leave enough room for one
// coherent turn to finish without forcing a continuation mid-operation.
export const DEFAULT_CONTEXT_LENS_RUN_TIMEOUT_MS = 900_000;

export function normalizeRunTimeoutMs(
  value: number | null | undefined
): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1_000
    ? Math.floor(value)
    : DEFAULT_CONTEXT_LENS_RUN_TIMEOUT_MS;
}
