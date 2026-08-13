import { v4 as uuidv4 } from 'uuid';

const BUCKETS_BROKER_URL = 'https://memex.tlon.network/v2/buckets';

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

export function createBucketCapability() {
  return uuidv4().replaceAll('-', '');
}

function hostName(host: string) {
  return host.replace(/^~/, '');
}

async function brokerRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${BUCKETS_BROKER_URL}${path}`, {
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
