import { expect, test } from 'vitest';

import * as db from '../db';
import { setupDatabaseTestSuite } from '../test/helpers';

setupDatabaseTestSuite();

const channelId = 'buckets/~zod/files';

function upload(
  id: string,
  state: 'queued' | 'uploading' | 'failed' | 'completed'
) {
  return db.upsertBucketUpload({
    id,
    channelId,
    parentId: null,
    name: `${id}.txt`,
    size: 10,
    mime: 'text/plain',
    progress: 0,
    state,
    sessionId: `session-${id}`,
    startedAt: 1,
  });
}

test('deleteFailedBucketUploads removes and returns only rows still failed', async () => {
  await upload('a', 'failed');
  await upload('b', 'failed');
  // Asked for, but retried in the meantime.
  await upload('c', 'queued');
  // Failed, but not asked for.
  await upload('d', 'failed');

  const deleted = await db.deleteFailedBucketUploads(['a', 'b', 'c']);

  expect(deleted.map((row) => row.id).sort()).toEqual(['a', 'b']);
  expect(deleted[0].sessionId).toMatch(/^session-/);
  const left = await db.getBucketUploads({ channelId });
  expect(left.map((row) => row.id).sort()).toEqual(['c', 'd']);
});
