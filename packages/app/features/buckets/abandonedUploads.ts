import { sendBucketsAction } from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';

import { hasUploadSource } from './bucketUploadSources';

/**
 * Give up on uploads left behind by a previous run.
 *
 * An upload's bytes live in the process that picked the file, so a row with
 * no source behind it is one this process did not start — the transfer cannot
 * be resumed however far it got. Closing the app mid-upload used to leave the
 * host holding a session and the broker a reservation with its quota, with
 * nothing that knew to release them; the row is what makes them reachable.
 *
 * Cancelling is the same call the uploader makes, so the host releases the
 * reservation as part of it.
 */
let swept: Promise<void> | null = null;

/**
 * Runs once, on the first Bucket opened.
 *
 * Best effort by design: if no Bucket is ever opened, nothing here runs and
 * the host's own expiry sweep releases the reservation instead -- later, but
 * it releases. This just makes it prompt in the case we can see.
 */
export function cancelAbandonedUploadsOnce() {
  swept ??= cancelAbandonedUploads();
  return swept;
}

export async function cancelAbandonedUploads() {
  const rows = await db.getAllBucketUploads(undefined);
  const abandoned = rows.filter((row) => !hasUploadSource(row.id));
  await Promise.all(
    abandoned.map(async (row) => {
      const flag = parseChannelFlag(row.channelId);
      if (flag && row.sessionId) {
        await sendBucketsAction({
          type: 'cancel-upload',
          flag,
          reason: 'The app closed while this upload was running',
          sessionId: row.sessionId,
        }).catch(() => undefined);
      }
      await db.deleteBucketUpload(row.id);
    })
  );
}

function parseChannelFlag(channelId: string) {
  const [kind, host, name] = channelId.split('/');
  if (kind !== 'buckets' || !host || !name) return null;
  return { host, name };
}
