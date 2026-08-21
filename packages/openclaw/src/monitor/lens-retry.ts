export type LensRetryRequest = {
  id: string;
  requester: string;
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Parse the JSON form of %steward-lens-update-1. The mark emits the tagged
 * union directly (`{"retry-requested": ...}`); accept the older nested shape
 * as well so gateways remain compatible with experimental steward builds.
 */
export function parseLensRetryRequest(data: unknown): LensRetryRequest | null {
  const root = objectValue(data);
  if (!root) return null;

  const lens = objectValue(root.lens);
  const retry = objectValue(
    root['retry-requested'] ?? lens?.['retry-requested']
  );
  if (!retry) return null;

  const id = typeof retry.id === 'string' ? retry.id : '';
  const requester = typeof retry.requester === 'string' ? retry.requester : '';
  return id && requester ? { id, requester } : null;
}
