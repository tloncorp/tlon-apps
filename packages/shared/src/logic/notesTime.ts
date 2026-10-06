// Note timestamps may arrive in seconds or milliseconds depending on source.
export function noteTimestampMs(timestamp: number | null | undefined) {
  if (!timestamp) return null;
  return timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
}
