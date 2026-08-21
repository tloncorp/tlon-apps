import {
  type ParticipantAgentActivityProjectionV1,
  ParticipantAgentActivityProjectionV1Schema,
  type ParticipantAgentActivityStepStatus,
  getCanonicalPostId,
} from '@tloncorp/api/client';
import type * as db from '@tloncorp/shared/db';

import {
  type ContextLensActivity,
  type ContextLensActivityItem,
  type ContextLensActivityStatus,
  type ContextLensEvent,
  type ContextLensStatus,
  contextLensEventAtTime,
} from '../Channel/ContextLens/types';

const MAX_BLOB_CHARS = 128_000;
const MAX_ACTIONS_PER_STEP = 100;
export const PARTICIPANT_CARRIER_STALE_MS = 5 * 60 * 1_000;

export type ParticipantTaskStepStatus = ParticipantAgentActivityStepStatus;
export type ParticipantTaskProjection = ParticipantAgentActivityProjectionV1;

export type ParticipantActivityRecord = {
  lensId: string;
  projection: ParticipantTaskProjection;
  post: db.Post;
  triggerPost: db.Post;
};

export type ParticipantContextLensEvent = ContextLensEvent & {
  participantActivity: {
    publicRunId: string;
    revision: number;
    surface: 'carrier' | 'final';
    carrierPostId: string;
    triggerPostId: string;
    waitingAudience?: 'owner' | 'requester';
    continuation?: {
      kind: 'request_input';
      parentPublicRunId: string;
    };
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

export function parseParticipantTaskProjection(
  value: unknown
): ParticipantTaskProjection | null {
  const parsed = ParticipantAgentActivityProjectionV1Schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function normalizeShip(value: string) {
  return value.replace(/^~/, '').toLowerCase();
}

function localPostId(value: string) {
  return getCanonicalPostId(value);
}

function threadRoot(post: db.Post) {
  return post.parentId ? localPostId(post.parentId) : null;
}

function rawParticipantEntries(post: db.Post) {
  if (!post.blob || post.blob.length > MAX_BLOB_CHARS) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(post.blob);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed) || parsed.length > 16) return [];
  return parsed.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      entry.type !== 'tlon-context-lens' ||
      entry.version !== 1
    ) {
      return [];
    }
    const lensId = stringValue(entry.lensId, 256);
    const botShip = stringValue(entry.botShip, 128);
    const projection = parseParticipantTaskProjection(
      entry.participantActivity
    );
    if (!lensId || !botShip || !projection) return [];
    if (
      (projection.surface === 'carrier' && entry.delivery !== 'intermediate') ||
      (projection.surface === 'final' && entry.delivery !== 'final')
    ) {
      return [];
    }
    return [{ lensId, botShip, projection }];
  });
}

function authenticatedParticipantEntryForPost(
  post: db.Post,
  channelId: string
) {
  if (
    !channelId.startsWith('chat/') ||
    post.channelId !== channelId ||
    (post.type !== 'chat' && post.type !== 'reply') ||
    post.isBot !== true ||
    !post.authorId
  ) {
    return null;
  }
  const candidates = rawParticipantEntries(post);
  // Ambiguous stamps are rejected rather than allowing blob order to choose
  // which protocol surface owns an authenticated post.
  if (candidates.length !== 1) return null;
  const candidate = candidates[0];
  if (normalizeShip(candidate.botShip) !== normalizeShip(post.authorId)) {
    return null;
  }
  if (
    candidate.projection.threadRootId &&
    localPostId(candidate.projection.threadRootId) !== threadRoot(post)
  ) {
    return null;
  }
  return candidate;
}

/**
 * Carrier suppression deliberately does not depend on the triggering post.
 * Pagination can load the authenticated protocol post before its trigger; the
 * card waits for that trigger, while this classifier prevents fallback text
 * from leaking into an enabled task-card surface.
 */
export function authenticatedParticipantCarrierPostIds(
  posts: readonly db.Post[],
  channelId: string
) {
  return new Set(
    posts.flatMap((post) => {
      const candidate = authenticatedParticipantEntryForPost(post, channelId);
      return candidate?.projection.surface === 'carrier' ? [post.id] : [];
    })
  );
}

export function participantCarrierPostIdsForExperiment(
  posts: readonly db.Post[],
  channelId: string,
  enabled: boolean
) {
  return enabled
    ? authenticatedParticipantCarrierPostIds(posts, channelId)
    : new Set<string>();
}

/** Metadata-only activity reconciliation is not a user-visible message edit. */
export function shouldSuppressParticipantActivityEditedIndicator(
  post: db.Post
) {
  return Boolean(authenticatedParticipantEntryForPost(post, post.channelId));
}

/**
 * Read participant-safe run data only from authenticated chat envelopes. The
 * projection never supplies bot, requester, channel, output, or thread
 * identity: those all come from loaded post rows.
 */
export function participantActivityRecordsForPosts(
  posts: readonly db.Post[],
  channelId: string
): ParticipantActivityRecord[] {
  if (!channelId.startsWith('chat/')) return [];
  const postsById = new Map(
    posts
      .filter((post) => post.channelId === channelId)
      .map((post) => [localPostId(post.id), post] as const)
  );
  const records: ParticipantActivityRecord[] = [];
  for (const post of posts) {
    const candidate = authenticatedParticipantEntryForPost(post, channelId);
    if (!candidate) continue;
    const triggerPostId = localPostId(candidate.projection.triggerPostId);
    const triggerPost = postsById.get(triggerPostId);
    if (
      !triggerPost ||
      triggerPost.id === post.id ||
      triggerPost.channelId !== channelId ||
      threadRoot(triggerPost) !== threadRoot(post)
    ) {
      continue;
    }
    records.push({
      lensId: candidate.lensId,
      projection: {
        ...candidate.projection,
        triggerPostId,
        ...(candidate.projection.threadRootId
          ? { threadRootId: localPostId(candidate.projection.threadRootId) }
          : {}),
      },
      post,
      triggerPost,
    });
  }
  return records;
}

function activityStatus(
  status: ParticipantTaskStepStatus
): ContextLensActivityStatus {
  if (status === 'failed') return 'error';
  return status;
}

function actionStatus(
  stepStatus: ParticipantTaskStepStatus,
  index: number,
  completed: number
): ContextLensActivityStatus {
  if (index < completed) return 'completed';
  return activityStatus(stepStatus);
}

function participantActivity(
  projection: ParticipantTaskProjection
): ContextLensActivity {
  const items: ContextLensActivityItem[] = [];
  for (const step of projection.steps) {
    if (step.update) {
      const status = activityStatus(step.status);
      items.push({
        id: `${step.id}:update`,
        kind: 'commentary',
        title: 'Progress',
        progressText: step.update,
        status,
        planStepId: step.id,
        startedAt: projection.createdAt,
        updatedAt: projection.updatedAt,
        completedAt:
          status === 'completed' || status === 'error' || status === 'cancelled'
            ? projection.completedAt ?? projection.updatedAt
            : null,
      });
    }
    const visibleActionCount = Math.min(
      step.actions?.total ?? 0,
      MAX_ACTIONS_PER_STEP
    );
    for (let index = 0; index < visibleActionCount; index += 1) {
      const status = actionStatus(
        step.status,
        index,
        step.actions?.completed ?? 0
      );
      items.push({
        id: `${step.id}:participant-action:${index + 1}`,
        kind: 'item',
        title: 'Agent work',
        status,
        planStepId: step.id,
        startedAt: projection.createdAt,
        updatedAt: projection.updatedAt,
        completedAt:
          status === 'completed' || status === 'error' || status === 'cancelled'
            ? projection.completedAt ?? projection.updatedAt
            : null,
      });
    }
  }
  return {
    schemaVersion: 1,
    eventCount: projection.revision,
    lastEventAt: projection.updatedAt,
    truncated: projection.steps.some(
      (step) => (step.actions?.total ?? 0) > MAX_ACTIONS_PER_STEP
    ),
    plan: {
      steps: projection.steps.map((step) => ({
        id: step.id,
        title: step.title,
        status: activityStatus(step.status),
      })),
      updatedAt: projection.updatedAt,
    },
    items,
  };
}

function lensStatus(projection: ParticipantTaskProjection): ContextLensStatus {
  if (projection.state === 'failed') return 'error';
  if (projection.state === 'timed_out') return 'timed_out';
  if (projection.state === 'cancelled') return 'aborted';
  if (projection.state === 'completed' || projection.state === 'incomplete') {
    return 'completed';
  }
  if (projection.surface === 'carrier') return 'tool_running';
  return 'completed';
}

function terminalError(projection: ParticipantTaskProjection) {
  if (projection.terminalReason === 'timeout') return 'The run timed out.';
  if (projection.terminalReason === 'denied') {
    return 'The requested action was denied.';
  }
  if (projection.terminalReason === 'interrupted') {
    return 'The run was interrupted.';
  }
  if (projection.terminalReason === 'failed') {
    return 'The run could not finish.';
  }
  return null;
}

function toParticipantEvent(
  record: ParticipantActivityRecord,
  carrierPostId: string,
  retryLensId?: string
): ParticipantContextLensEvent {
  const { lensId, post, projection, triggerPost } = record;
  const final = projection.surface === 'final';
  const actionCount = projection.steps.reduce(
    (count, step) => count + (step.actions?.total ?? 0),
    0
  );
  const continuation = (
    projection as ParticipantTaskProjection & {
      continuation?: {
        kind: 'request_input';
        parentPublicRunId: string;
      };
    }
  ).continuation;
  return {
    seq: projection.revision,
    at: projection.updatedAt,
    phase: final ? 'participant-final' : 'participant-carrier',
    participantActivity: {
      publicRunId: projection.publicRunId,
      revision: projection.revision,
      surface: projection.surface,
      carrierPostId,
      triggerPostId: triggerPost.id,
      ...(projection.state === 'waiting_owner'
        ? { waitingAudience: 'owner' as const }
        : projection.state === 'waiting_requester'
          ? { waitingAudience: 'requester' as const }
          : {}),
      ...(continuation ? { continuation } : {}),
    },
    lens: {
      lensId,
      botShip: post.authorId,
      runId: projection.publicRunId,
      messageId: triggerPost.id,
      sessionKeyHash: null,
      chatType: 'channel',
      runKind: 'conversation',
      visibility: 'participants',
      trigger: 'participant_activity',
      triggerDetails: {
        type: 'message',
        messageId: triggerPost.id,
        authorShip: triggerPost.authorId,
        conversationId: post.channelId,
        conversationKind: 'channel',
        receivedAt: triggerPost.receivedAt,
        preview: triggerPost.textContent ?? undefined,
      },
      ...(retryLensId ? { retryOf: retryLensId } : {}),
      model: null,
      provider: null,
      status: lensStatus(projection),
      error: terminalError(projection),
      createdAt: projection.createdAt,
      updatedAt: projection.updatedAt,
      ...(projection.surface === 'carrier' && projection.state === 'working'
        ? { expiresAt: projection.updatedAt + PARTICIPANT_CARRIER_STALE_MS }
        : {}),
      context: {
        currentMessage: true,
        threadMessages: 0,
        channelMessages: 0,
        citedPosts: 0,
        attachments: 0,
        pendingNudge: false,
        sources: [],
      },
      persistence: {
        postsReply: final,
        updatesSettings: false,
        writesMedia: false,
        emitsTelemetry: false,
        cachesHistory: false,
        events: [],
      },
      tools: {
        ownerOnlyAvailable: [],
        called: [],
        callCount: actionCount,
        lastStartedAt: null,
        runs: [],
      },
      outputs: final
        ? [
            {
              messageId: post.id,
              conversationId: post.channelId,
              kind: 'channel',
              sentAt: post.sentAt,
              preview: post.textContent ?? undefined,
            },
          ]
        : [],
      activity: participantActivity(projection),
      lifecycle: {
        queuedMs: 0,
        dispatchStartedAt: projection.createdAt,
        durationMs:
          projection.completedAt === undefined
            ? null
            : Math.max(0, projection.completedAt - projection.createdAt),
        timeoutMs: null,
        timedOut: projection.state === 'timed_out',
        deliveredMessageCount: final ? 1 : 0,
        queuedFinal: final,
        queuedFinalCount: final ? 1 : 0,
        queuedBlockCount: 0,
      },
    },
  };
}

function recordIsNewer(
  candidate: ParticipantActivityRecord,
  current: ParticipantActivityRecord
) {
  if (candidate.projection.surface !== current.projection.surface) {
    return candidate.projection.surface === 'final';
  }
  return (
    candidate.projection.revision > current.projection.revision ||
    (candidate.projection.revision === current.projection.revision &&
      candidate.projection.updatedAt > current.projection.updatedAt)
  );
}

export function participantContextLensEvents(
  records: readonly ParticipantActivityRecord[]
) {
  const latestByPublicRunId = new Map<string, ParticipantActivityRecord>();
  const carrierByPublicRunId = new Map<string, ParticipantActivityRecord>();
  for (const record of records) {
    const current = latestByPublicRunId.get(record.projection.publicRunId);
    if (!current || recordIsNewer(record, current)) {
      latestByPublicRunId.set(record.projection.publicRunId, record);
    }
    if (record.projection.surface === 'carrier') {
      const currentCarrier = carrierByPublicRunId.get(
        record.projection.publicRunId
      );
      if (!currentCarrier || recordIsNewer(record, currentCarrier)) {
        carrierByPublicRunId.set(record.projection.publicRunId, record);
      }
    }
  }
  const lensIdByPublicRunId = new Map(
    [...latestByPublicRunId].map(([publicRunId, record]) => [
      publicRunId,
      record.lensId,
    ])
  );
  return [...latestByPublicRunId.values()].map((record) =>
    toParticipantEvent(
      record,
      carrierByPublicRunId.get(record.projection.publicRunId)?.post.id ??
        record.post.id,
      record.projection.retryOf
        ? lensIdByPublicRunId.get(record.projection.retryOf)
        : undefined
    )
  );
}

export function participantCarrierPostIds(
  records: readonly ParticipantActivityRecord[]
) {
  return new Set(
    records.flatMap((record) =>
      record.projection.surface === 'carrier' ? [record.post.id] : []
    )
  );
}

export function participantContextLensEventAtTime(
  event: ParticipantContextLensEvent,
  now: number
): ParticipantContextLensEvent {
  return {
    ...contextLensEventAtTime(event, now, 'participant-carrier-stale'),
    participantActivity: event.participantActivity,
  };
}

export function isParticipantContextLensEvent(
  event: ContextLensEvent
): event is ParticipantContextLensEvent {
  const participant = (event as Partial<ParticipantContextLensEvent>)
    .participantActivity;
  return Boolean(
    event.lens.visibility === 'participants' &&
      isRecord(participant) &&
      typeof participant.publicRunId === 'string' &&
      Number.isSafeInteger(participant.revision) &&
      (participant.surface === 'carrier' || participant.surface === 'final') &&
      typeof participant.carrierPostId === 'string' &&
      typeof participant.triggerPostId === 'string' &&
      (participant.waitingAudience === undefined ||
        participant.waitingAudience === 'owner' ||
        participant.waitingAudience === 'requester') &&
      (participant.continuation === undefined ||
        (isRecord(participant.continuation) &&
          participant.continuation.kind === 'request_input' &&
          typeof participant.continuation.parentPublicRunId === 'string'))
  );
}

/** Full owner snapshots replace the participant projection for the same run. */
export function mergeOwnerAndParticipantEvents(
  ownerEvents: readonly ContextLensEvent[],
  participantEvents: readonly ParticipantContextLensEvent[]
) {
  const ownerLensIds = new Set(
    ownerEvents
      .filter((event) => !isParticipantContextLensEvent(event))
      .map((event) => event.lens.lensId)
  );
  const ownerRunIds = new Set(
    ownerEvents.flatMap((event) =>
      !isParticipantContextLensEvent(event) && event.lens.runId
        ? [event.lens.runId]
        : []
    )
  );
  return [
    ...ownerEvents,
    ...participantEvents.filter(
      (event) =>
        !ownerLensIds.has(event.lens.lensId) &&
        !ownerRunIds.has(event.participantActivity.publicRunId)
    ),
  ];
}
