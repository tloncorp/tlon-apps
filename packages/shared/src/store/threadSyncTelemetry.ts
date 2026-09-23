import type { Post } from '../db';
import { createDevLogger } from '../debug';

export const THREAD_CATCHUP_DEADLINE_MS = 5000;
const SUCCESS_SAMPLE_RATE = 0.05;
const logger = createDevLogger('threadSync', false);
let nextId = 0;

export type ThreadIdentity = { channelId: string; postId: string };
export type ReplyIdentity = Pick<Post, 'id' | 'isDeleted' | 'deliveryStatus'>;
export type ThreadFetchTrigger =
  | 'thread_open'
  | 'missing_parent'
  | 'unspecified';
export type ThreadEvidence = ThreadIdentity & {
  attemptId: string;
  source: 'thread_fetch' | 'subscription' | 'changes';
  startedAt: number;
  replies: ReplyIdentity[];
};
type Evidence = ThreadEvidence | { deletedId: string };
const observers = new Set<(event: Evidence) => void>();

// jsContextId and buildInfo are attached by createDevLogger.
export function threadDiagnosticId() {
  return `${Date.now().toString(36)}-${++nextId}`;
}

export function emitThreadDiagnostic(
  event: string,
  props: Record<string, unknown>,
  always = false
) {
  if (!always && Math.random() >= SUCCESS_SAMPLE_RATE) return;
  try {
    logger.trackEvent(event, { schemaVersion: 1, ...props });
  } catch {
    // Diagnostics must never change sync or rendering behavior.
  }
}

export function recordThreadEvidence(event: Evidence) {
  for (const observer of observers) {
    try {
      observer(event);
    } catch {
      // One observer must not prevent persistence or other observers.
    }
  }
}

export function recordThreadPostsReceived(
  posts: Post[],
  source: 'subscription' | 'changes'
) {
  if (!observers.size) return;
  const attemptId = threadDiagnosticId();
  const startedAt = Date.now();
  for (const post of posts) {
    if (post.parentId) {
      recordThreadEvidence({
        channelId: post.channelId,
        postId: post.parentId,
        attemptId,
        source,
        startedAt,
        replies: [post],
      });
    }
    if (post.replies?.length) {
      recordThreadEvidence({
        channelId: post.channelId,
        postId: post.id,
        attemptId,
        source,
        startedAt,
        replies: post.replies,
      });
    }
  }
}

export function recordThreadPostDeleted(deletedId: string) {
  recordThreadEvidence({ deletedId });
}

function isConfirmed(reply: ReplyIdentity) {
  return !reply.deliveryStatus || reply.deliveryStatus === 'sent';
}

export function replySummary(replies: ReplyIdentity[]) {
  const ids = [...new Set(replies.map((reply) => reply.id))].sort();
  // An order-independent identity checksum, not an anonymization mechanism.
  let hash = 2166136261;
  for (const char of JSON.stringify(ids)) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return {
    count: replies.length,
    fingerprint: (hash >>> 0).toString(16),
    deletedCount: replies.filter((reply) => reply.isDeleted).length,
    unconfirmedCount: replies.filter((reply) => !isConfirmed(reply)).length,
  };
}

export type ThreadViewSnapshot = {
  queryReplies: ReplyIdentity[] | undefined;
  listReplies: ReplyIdentity[];
  includeDeleted: boolean;
  queryStatus: string;
  fetchStatus: string;
  dataUpdatedAt: number;
  errorUpdatedAt: number;
  parentReplyCount?: number | null;
};

type Missing = { database: string[]; query: string[]; list: string[] };

export function compareThreadReplies(
  expected: ReplyIdentity[],
  database: ReplyIdentity[],
  view: ThreadViewSnapshot
): Missing {
  const dbIds = new Set(database.map((reply) => reply.id));
  const queryIds = new Set(view.queryReplies?.map((reply) => reply.id));
  const listIds = new Set(view.listReplies.map((reply) => reply.id));
  const deletedIds = new Set(
    database.filter((p) => p.isDeleted).map((p) => p.id)
  );
  const belongsInList = (p: ReplyIdentity) =>
    isConfirmed(p) &&
    (view.includeDeleted || (!p.isDeleted && !deletedIds.has(p.id)));
  return {
    // Deleted/pending replies aren't evidence of missing received messages.
    database: expected
      .filter((p) => !p.isDeleted && isConfirmed(p) && !dbIds.has(p.id))
      .map((p) => p.id),
    query: database
      .filter((p) => belongsInList(p) && !queryIds.has(p.id))
      .map((p) => p.id),
    list: (view.queryReplies ?? [])
      .filter((p) => belongsInList(p) && !listIds.has(p.id))
      .map((p) => p.id),
  };
}

/** One instance per focused, foreground thread. Never refetches or repairs data. */
export function monitorThreadCatchup(
  identity: ThreadIdentity,
  readDatabase: () => Promise<ReplyIdentity[]>,
  getView: () => ThreadViewSnapshot,
  isActive: () => boolean,
  trigger: 'focus' | 'foreground',
  emit = emitThreadDiagnostic
) {
  const checkId = threadDiagnosticId();
  const openedAt = Date.now();
  const expected = new Map<
    string,
    {
      reply: ReplyIdentity;
      observedAt: number;
      attemptId: string;
      source: ThreadEvidence['source'];
    }
  >();
  const deleted = new Set<string>();
  const missingSince = new Map<string, number>();
  let source: ThreadEvidence | undefined;
  let newestFetchStartedAt = -Infinity;
  let stopped = false;
  let running = false;
  let dirty = false;
  let reportedMismatch = false;
  let reportedMismatchSignature: string | undefined;
  let reportedSuccess = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = (delay = 100) => {
    dirty = true;
    if (!stopped && !timer && !running) {
      timer = setTimeout(() => {
        timer = undefined;
        void check();
      }, delay);
    }
  };

  const check = async () => {
    if (stopped || !isActive()) return;
    running = true;
    dirty = false;
    let database: ReplyIdentity[];
    try {
      database = await readDatabase();
    } catch {
      if (!stopped && isActive()) {
        emit(
          'Thread Catchup Check',
          {
            ...identity,
            checkId,
            trigger,
            outcome: 'diagnostic_read_failed',
            attemptId: source?.attemptId ?? null,
          },
          true
        );
      }
      running = false;
      if (dirty) schedule();
      return;
    }
    running = false;
    if (stopped || !isActive()) return;
    const view = getView();
    const missing = compareThreadReplies(
      [...expected.values()].map((entry) => entry.reply),
      database,
      view
    );
    // Treat a not-yet-resolved/failed SQLite query separately from a valid empty result.
    const keys = new Set(
      Object.entries(missing).flatMap(([stage, ids]) =>
        ids.map((id) => `${stage}:${id}`)
      )
    );
    if (view.queryStatus !== 'success')
      keys.add(`query_status:${view.queryStatus}`);
    const now = Date.now();
    for (const key of missingSince.keys())
      if (!keys.has(key)) missingSince.delete(key);
    for (const key of keys)
      if (!missingSince.has(key)) missingSince.set(key, now);
    const sustained = [...missingSince].filter(
      ([, since]) => now - since >= THREAD_CATCHUP_DEADLINE_MS
    );
    const sustainedSignature = sustained
      .map(([key]) => key)
      .sort()
      .join('\n');
    const props = {
      ...identity,
      checkId,
      trigger,
      attemptId: source?.attemptId ?? null,
      source: source?.source ?? 'local_only',
      elapsedMs: now - openedAt,
      sourceAgeMs: source ? now - source.startedAt : null,
      expected: replySummary(
        [...expected.values()].map((entry) => entry.reply)
      ),
      database: replySummary(database),
      query: replySummary(view.queryReplies ?? []),
      list: replySummary(view.listReplies),
      includeDeleted: view.includeDeleted,
      queryStatus: view.queryStatus,
      fetchStatus: view.fetchStatus,
      dataUpdatedAt: view.dataUpdatedAt,
      errorUpdatedAt: view.errorUpdatedAt,
      parentReplyCount: view.parentReplyCount ?? null,
      // These are committed list inputs, not viewport/paint observations.
      observation: 'list_input',
      missingDatabaseCount: missing.database.length,
      missingDatabaseIds: missing.database.slice(0, 5),
      missingDatabaseEvidence: missing.database.slice(0, 5).map((id) => ({
        id,
        attemptId: expected.get(id)?.attemptId,
        source: expected.get(id)?.source,
      })),
      missingQueryCount: missing.query.length,
      missingQueryIds: missing.query.slice(0, 5),
      missingListCount: missing.list.length,
      missingListIds: missing.list.slice(0, 5),
    };
    if (sustained.length && sustainedSignature !== reportedMismatchSignature) {
      emit(
        'Thread Catchup Check',
        {
          ...props,
          outcome: 'mismatch',
          sustainedStages: [
            ...new Set(sustained.map(([key]) => key.split(':')[0])),
          ],
        },
        true
      );
      reportedMismatch = true;
      reportedMismatchSignature = sustainedSignature;
    } else if (!keys.size && (!reportedSuccess || reportedMismatch)) {
      emit(
        'Thread Catchup Check',
        { ...props, outcome: reportedMismatch ? 'recovered' : 'caught_up' },
        reportedMismatch
      );
      reportedMismatch = false;
      reportedMismatchSignature = undefined;
      reportedSuccess = true;
    }
    // Stop repeated reports for an unchanged failure, but keep a deadline for
    // newly observed gaps so a changing mismatch cannot silence the monitor.
    const hasPendingGap = [...missingSince.values()].some(
      (since) => now - since < THREAD_CATCHUP_DEADLINE_MS
    );
    if (keys.size && (!reportedMismatch || hasPendingGap))
      schedule(THREAD_CATCHUP_DEADLINE_MS);
    else if (dirty) schedule();
  };

  const onEvidence = (event: Evidence) => {
    if ('deletedId' in event) {
      deleted.add(event.deletedId);
      expected.delete(event.deletedId);
      schedule();
      return;
    }
    if (
      event.channelId !== identity.channelId ||
      event.postId !== identity.postId
    )
      return;
    if (event.source === 'thread_fetch') {
      if (event.startedAt < newestFetchStartedAt) return;
      newestFetchStartedAt = event.startedAt;
      const ids = new Set(event.replies.map((reply) => reply.id));
      for (const [id, previous] of expected) {
        // A newer full snapshot can omit a deleted reply. Preserve only live
        // evidence that arrived after that request began.
        if (!ids.has(id) && previous.observedAt <= event.startedAt)
          expected.delete(id);
      }
    }
    source = event;
    for (const reply of event.replies) {
      // A fetch started before a live update cannot overwrite that newer evidence.
      const previous = expected.get(reply.id);
      if (
        !deleted.has(reply.id) &&
        (!previous || previous.observedAt <= event.startedAt)
      ) {
        expected.set(reply.id, {
          reply: {
            id: reply.id,
            isDeleted: reply.isDeleted,
            deliveryStatus: reply.deliveryStatus,
          },
          observedAt: Date.now(),
          attemptId: event.attemptId,
          source: event.source,
        });
      }
    }
    schedule();
  };
  observers.add(onEvidence);
  schedule();
  return {
    update: schedule,
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (timer) clearTimeout(timer);
      observers.delete(onEvidence);
      if (missingSince.size || running) {
        emit(
          'Thread Catchup Check',
          {
            ...identity,
            checkId,
            trigger,
            outcome: 'interrupted',
            attemptId: source?.attemptId ?? null,
            elapsedMs: Date.now() - openedAt,
          },
          reportedMismatch
        );
      }
    },
  };
}
