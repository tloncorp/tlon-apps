import type {
  BucketsAction,
  BucketsActionError,
  BucketsResponseBody,
  BucketsState,
} from '../urbit/buckets';
import type { DurableClient } from './durable';

// The Slab server keeps a Bucket's manifest beside its room and its files as
// room attachments. Every request carries the account's session, so there are
// no storage tokens to mint: reads use the attachment download tickets, and a
// file's bytes go with its entry.
const SESSION_TOKEN = { token: '', expiresAt: '9999-12-31T23:59:59Z' };

export async function durableBucketsAction(
  client: DurableClient,
  channelId: string,
  action: BucketsAction,
  requestId: string
): Promise<BucketsResponseBody> {
  switch (action.type) {
    case 'issue-bucket-read':
      return { token: SESSION_TOKEN };
    case 'issue-delete':
      return { grant: { ...SESSION_TOKEN, entryId: action.id } };
    case 'create':
    case 'set-title':
    case 'set-writers':
    case 'retry-upload':
      // Creation, title and writers go through the group directory, as for
      // every other channel, and a failed upload starts a new session.
      return failure('invalid-input', `${action.type} is not available here`);
  }
  const room = client.room(channelId);
  if (action.type === 'delete-bucket') {
    // Deleting the channel empties its bucket on the server.
    await client.directory({
      type: 'deleteChannel',
      groupId: room.groupId,
      channelId,
    });
    return { ok: null };
  }
  const response = await fetch(`${client.baseUrl}/rooms/${room.id}/bucket`, {
    method: 'POST',
    headers: { ...client.authorization(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, requestId }),
  });
  const body = await answer<BucketsResponseBody>(response);
  if ('error' in body) return body;
  if ('upload' in body) {
    return {
      upload: {
        ...body.upload,
        url: new URL(body.upload.url, client.origin).href,
        headers: [
          ...body.upload.headers,
          ...Object.entries(client.authorization()),
        ],
      },
    };
  }
  return body;
}

/**
 * A Bucket's state, null once it is gone or out of reach, or 'unchanged' when
 * it is still at revision `after`.
 */
export async function durableBucketState(
  client: DurableClient,
  channelId: string,
  after?: number
): Promise<BucketsState | null | 'unchanged'> {
  const room = client.bootstrap.rooms.find(
    (room) => room.channelId === channelId
  );
  if (!room) return null;
  const query = after ? `?after=${after}` : '';
  const response = await fetch(
    `${client.baseUrl}/rooms/${room.id}/bucket${query}`,
    { headers: client.authorization() }
  );
  if (response.status === 404) return null;
  const body = await answer<BucketsState | { unchanged: true }>(response);
  if ('error' in body) throw new Error(body.error.message);
  if ('unchanged' in body) return 'unchanged';
  // The same roles channels() reports, so a snapshot cannot drop admin from
  // the writers the directory gave the channel.
  return {
    ...body,
    writers: body.writers.length
      ? [...new Set(['admin', ...body.writers])]
      : [],
  };
}

/** A download address for one file, which the browser can load unaided. */
export async function durableBucketReadUrl(
  client: DurableClient,
  objectKey: string
): Promise<string> {
  const response = await fetch(`${client.baseUrl}/attachments/ticket`, {
    method: 'POST',
    headers: { ...client.authorization(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths: [objectKey] }),
  });
  const body = await answer<Record<string, string>>(response);
  if ('error' in body || !body[objectKey]) {
    throw new Error('This file is no longer available');
  }
  return new URL(body[objectKey], client.origin).href;
}

async function answer<T>(
  response: Response
): Promise<T | Extract<BucketsResponseBody, { error: unknown }>> {
  if (response.ok) return (await response.json()) as T;
  const message =
    ((await response.json().catch(() => null)) as { error?: string } | null)
      ?.error ?? `Request failed (${response.status})`;
  const type = errorType(response.status);
  if (!type) throw new Error(message);
  return failure(type, message);
}

function errorType(status: number): BucketsActionError | null {
  if (status === 403) return 'not-authorized';
  if (status === 404) return 'not-found';
  if ([400, 409, 413].includes(status)) return 'invalid-input';
  if ([429, 503].includes(status)) return 'unknown';
  return null;
}

function failure(type: BucketsActionError, message: string) {
  return { error: { type, message } };
}
