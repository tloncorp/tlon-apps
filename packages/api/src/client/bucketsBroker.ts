import { getMemexBaseUrl } from './memex';

/**
 * An explicit override of the whole broker path, for the CLI and its tests.
 *
 * Read in its own try: in a browser nothing substitutes it, so the bare
 * `process` reference throws -- and sharing a try with TLON_MEMEX_URL would
 * throw away the value the define did substitute.
 */
function explicitBrokerUrl(): string | undefined {
  try {
    return process.env.BUCKETS_BROKER_URL?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function bucketsBrokerUrl(): string {
  const explicit = explicitBrokerUrl();
  if (explicit) return explicit.replace(/\/+$/, '');
  return `${getMemexBaseUrl()}/v2/buckets`;
}

type BrokerErrorBody = {
  code?: string;
  message?: string;
  retryable?: boolean;
};

export class BucketsBrokerError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly retryable = false
  ) {
    super(message);
    this.name = 'BucketsBrokerError';
  }
}

export type BucketReadGrant = {
  objectId: string;
  readUrl: string;
  expiresAt: string;
  acceptRanges: boolean;
};

function hostName(host: string) {
  return host.replace(/^~/, '');
}

async function brokerRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${bucketsBrokerUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => null)) as BrokerErrorBody | null;
    throw new BucketsBrokerError(
      body?.message ?? `Buckets storage returned ${response.status}`,
      response.status,
      body?.code,
      body?.retryable ?? false
    );
  }

  return (await response.json()) as T;
}

/**
 * Exchange an upload token for a signed PUT.
 *
 * The token is minted by the bucket's host and handed back when it grants the
 * upload — the client never invents one, and the broker verifies it with that
 * host before issuing anything.
 */
/**
 * Exchange a bucket read token for a signed URL for one object.
 *
 * displayFilename is what the download is saved as. The token covers the whole
 * bucket so it cannot carry a per-file name, and the broker has never stored
 * one -- omitting it makes every download arrive called "download", which is
 * what the broker falls back to. It is sanitized there before it reaches
 * Content-Disposition, and only affects our own download.
 */
export function grantBucketRead(
  capability: string,
  host: string,
  objectId: string,
  displayFilename?: string
): Promise<BucketReadGrant> {
  return brokerRequest(`/objects/${encodeURIComponent(objectId)}/read-grant`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${capability}` },
    body: JSON.stringify({ host: hostName(host), displayFilename }),
  });
}

export function deleteBucketObject(
  capability: string,
  host: string,
  objectId: string
) {
  return brokerRequest<{ objectId: string; deletedAt: string }>(
    `/objects/${encodeURIComponent(objectId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${capability}` },
      body: JSON.stringify({ host: hostName(host) }),
    }
  );
}

export function isBucketObjectAlreadyDeleted(cause: unknown) {
  return (
    cause instanceof BucketsBrokerError &&
    cause.status === 409 &&
    cause.code === 'invalid_state' &&
    cause.message.toLowerCase().includes('object was not found')
  );
}

export function canFallBackFromBucketsBroker(cause: unknown) {
  return (
    cause instanceof BucketsBrokerError &&
    (cause.status === 404 ||
      cause.code === 'feature_disabled' ||
      cause.code === 'pioneer_unavailable')
  );
}
