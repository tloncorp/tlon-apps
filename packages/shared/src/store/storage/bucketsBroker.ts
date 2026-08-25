const DEFAULT_MEMEX_BASE_URL = 'https://memex.tlon.network';

/**
 * Where the storage broker lives, for clients.
 *
 * The broker is one service seen from two directions: the bucket host pushes
 * read grants to it, and clients upload and read through it. Pointing one at a
 * test deployment and not the other is broken in both, so this is the client
 * half of the %buckets `%set-broker-base` poke — set TLON_MEMEX_URL and poke
 * the host to match.
 *
 * `process.env.TLON_MEMEX_URL` is written out in full, and not behind optional
 * chaining, because Vite's `define` substitutes the literal expression: written
 * as `process.env?.TLON_MEMEX_URL` it does not match and the browser silently
 * keeps the production default. The try/catch is what makes a bare `process`
 * reference safe in a runtime where nothing substituted it.
 *
 * Mirrors memexBaseUrl() in packages/api/src/client/storageApi.ts, rather than
 * importing it, because shared/ does not depend on api/.
 */
function memexBaseUrl(): string {
  try {
    return process.env.TLON_MEMEX_URL?.trim() || DEFAULT_MEMEX_BASE_URL;
  } catch {
    return DEFAULT_MEMEX_BASE_URL;
  }
}

function bucketsBrokerUrl(): string {
  return `${memexBaseUrl().replace(/\/+$/, '')}/v2/buckets`;
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

export type BucketUploadGrant = {
  reservationId: string;
  objectId: string;
  uploadUrl: string;
  uploadExpiresAt: string;
  requiredHeaders: [string, string][];
};

export type BucketObjectReceipt = {
  reservationId: string;
  objectId: string;
  host: string;
  bucketId: string;
  size: number;
  mimeType: string;
  checksum: { algorithm: 'crc32c' | 'md5'; value: string } | null;
  createdAt: string;
};

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
export function grantBucketUpload(
  capability: string,
  host: string
): Promise<BucketUploadGrant> {
  return brokerRequest('/uploads/grant', {
    method: 'POST',
    headers: { Authorization: `Bearer ${capability}` },
    body: JSON.stringify({ host: hostName(host) }),
  });
}

export function completeBucketUpload(
  reservationId: string
): Promise<BucketObjectReceipt> {
  return brokerRequest(
    `/uploads/${encodeURIComponent(reservationId)}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({ reservationId }),
    }
  );
}

export function retryBucketUpload(
  reservationId: string
): Promise<BucketUploadGrant> {
  return brokerRequest(`/uploads/${encodeURIComponent(reservationId)}/retry`, {
    method: 'POST',
  });
}

export function cancelBucketUpload(reservationId: string) {
  return brokerRequest<{ reservationId: string; canceledAt: string }>(
    `/uploads/${encodeURIComponent(reservationId)}/cancel`,
    { method: 'POST' }
  );
}

export function grantBucketRead(
  capability: string,
  host: string,
  objectId: string
): Promise<BucketReadGrant> {
  return brokerRequest(`/objects/${encodeURIComponent(objectId)}/read-grant`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${capability}` },
    body: JSON.stringify({ host: hostName(host) }),
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

export function brokerRequiredHeaders(grant: BucketUploadGrant) {
  return Object.fromEntries(grant.requiredHeaders);
}

export function canFallBackFromBucketsBroker(cause: unknown) {
  return (
    cause instanceof BucketsBrokerError &&
    (cause.status === 404 ||
      cause.code === 'feature_disabled' ||
      cause.code === 'pioneer_unavailable')
  );
}
