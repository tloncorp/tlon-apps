import * as api from '@tloncorp/api';

import * as db from '../../db';
import { QueueClearedError, SyncCtx, syncQueue } from '../syncQueue';
import {
  ThreadFetchTrigger,
  emitThreadDiagnostic,
  recordThreadEvidence,
  replySummary,
  threadDiagnosticId,
} from '../threadSyncTelemetry';
import { updateLastActivityTime } from './updateLastActivityTime';

export async function syncThreadPosts(
  {
    postId,
    authorId,
    channelId,
    trigger = 'unspecified',
  }: {
    postId: string;
    authorId: string;
    channelId: string;
    trigger?: ThreadFetchTrigger;
  },
  ctx?: SyncCtx
) {
  const attemptId = threadDiagnosticId();
  const startedAt = Date.now();
  let stage: 'queue' | 'request' | 'normalization' | 'database_write' = 'queue';
  let requestStartedAt: number | null = null;
  let firstRequestStartedAt: number | null = null;
  let responseReceivedAt: number | null = null;
  let normalizedAt: number | null = null;
  let writtenAt: number | null = null;
  let requestCount = 0;
  let response: db.Post;
  let server: ReturnType<typeof replySummary> | null = null;
  const timing = () => ({
    startedAt,
    durationMs: Date.now() - startedAt,
    queueMs:
      firstRequestStartedAt === null ? null : firstRequestStartedAt - startedAt,
    requestMs:
      requestStartedAt === null
        ? null
        : (responseReceivedAt ?? Date.now()) - requestStartedAt,
    normalizationMs:
      responseReceivedAt === null
        ? null
        : (normalizedAt ?? Date.now()) - responseReceivedAt,
    writeMs:
      normalizedAt === null ? null : (writtenAt ?? Date.now()) - normalizedAt,
    requestCount,
  });
  try {
    response = await syncQueue.add('syncThreadPosts', ctx, () => {
      stage = 'request';
      requestStartedAt = Date.now();
      firstRequestStartedAt ??= requestStartedAt;
      responseReceivedAt = null;
      requestCount++;
      return api.getPostWithReplies({
        postId,
        authorId,
        channelId,
        onResponse: () => {
          responseReceivedAt = Date.now();
          stage = 'normalization';
        },
      });
    });
    normalizedAt = Date.now();
    server = replySummary(response.replies ?? []);
    recordThreadEvidence({
      channelId,
      postId: response.id,
      attemptId,
      source: 'thread_fetch',
      startedAt,
      replies: response.replies ?? [],
    });
    stage = 'database_write';
    await db.insertChannelPosts({
      posts: [response, ...(response.replies ?? [])],
    });
    writtenAt = Date.now();
  } catch (error) {
    emitThreadDiagnostic(
      'Thread Fetch Outcome',
      {
        channelId,
        postId,
        attemptId,
        trigger,
        ...timing(),
        outcome:
          ctx?.abortSignal?.aborted || error instanceof QueueClearedError
            ? 'interrupted'
            : 'failed',
        failureStage: stage,
        server,
        // Do not include server error bodies, which can contain message content.
        errorName: error instanceof Error ? error.name : typeof error,
        responseReceived: responseReceivedAt !== null,
      },
      true
    );
    throw error;
  }
  updateLastActivityTime();

  // A diagnostic read failure must not turn a successful write into a sync failure.
  try {
    const database = await db.getThreadPostDiagnostics({
      parentId: response.id,
    });
    const databaseIds = new Set(database.map((reply) => reply.id));
    const replies = response.replies ?? [];
    const missing = replies.filter(
      (reply) => !reply.isDeleted && !databaseIds.has(reply.id)
    );
    emitThreadDiagnostic(
      'Thread Fetch Outcome',
      {
        channelId,
        postId,
        returnedPostId: response.id,
        attemptId,
        trigger,
        ...timing(),
        outcome: 'succeeded',
        responseReceived: true,
        server: replySummary(replies),
        database: replySummary(database),
        parentReplyCount: response.replyCount ?? null,
        missingDatabaseCount: missing.length,
        missingDatabaseIds: missing.slice(0, 5).map((reply) => reply.id),
        // Immediate post-write evidence; catch-up telemetry applies a grace period.
        databaseCheck: missing.length ? 'missing_rows' : 'matched',
      },
      missing.length > 0
    );
  } catch {
    emitThreadDiagnostic(
      'Thread Fetch Outcome',
      {
        channelId,
        postId,
        attemptId,
        trigger,
        ...timing(),
        outcome: 'succeeded',
        responseReceived: true,
        server: replySummary(response.replies ?? []),
        databaseCheck: 'read_failed',
      },
      true
    );
  }
}
