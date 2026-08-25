import { getCanonicalPostId } from '@tloncorp/api/client';
import type * as db from '@tloncorp/shared/db';
import { conversationMatchesChannel } from '@tloncorp/shared/logic';

import { getContextLensStamp } from '../Channel/ContextLens/lensPost';
import {
  type ContextLensEvent,
  isContextLensEventActive,
} from '../Channel/ContextLens/types';
import type { PostWithNeighbors } from '../Channel/PostList/shared';
import {
  hasStructuredAgentChatActivity,
  shouldShowAgentChatRun,
  structuredRequestInputContinuationParent,
} from './activitySemantics';
import { isParticipantContextLensEvent } from './participantActivity';
import { agentChatRunOutcome } from './runOutcome';

export type AgentChatRunAssignments = {
  liveByPostId: Map<string, ContextLensEvent[]>;
  receiptByPostId: Map<string, ContextLensEvent[]>;
  eventsByLensId: Map<string, ContextLensEvent[]>;
  eventsByPostId: Map<string, Map<string, ContextLensEvent[]>>;
  participantCarrierPostIds: ReadonlySet<string>;
};

export type AgentChatRunCard = {
  kind: 'live' | 'receipt';
  event: ContextLensEvent;
};

export type AgentChatDecoratedPost = PostWithNeighbors & {
  agentRunEvents: ContextLensEvent[];
  agentReceiptEvents: ContextLensEvent[];
  agentEventsByLensId: Map<string, ContextLensEvent[]>;
  hidePostContent: boolean;
};

const EMPTY_CONTEXT_LENS_EVENTS: ContextLensEvent[] = [];
const EMPTY_CONTEXT_LENS_EVENT_MAP = new Map<string, ContextLensEvent[]>();

/**
 * Attach run data to only the post row it decorates. Unchanged rows preserve
 * object identity so virtualized lists do not need a list-wide invalidation.
 */
export function decoratePostsWithAgentChatRuns(
  posts: readonly PostWithNeighbors[],
  assignments: AgentChatRunAssignments,
  previous?: readonly AgentChatDecoratedPost[]
): AgentChatDecoratedPost[] {
  const previousById = new Map(
    previous?.map((item) => [item.post.id, item] as const)
  );
  return posts.map((item) => {
    const agentRunEvents =
      assignments.liveByPostId.get(item.post.id) ?? EMPTY_CONTEXT_LENS_EVENTS;
    const agentReceiptEvents =
      assignments.receiptByPostId.get(item.post.id) ??
      EMPTY_CONTEXT_LENS_EVENTS;
    const agentEventsByLensId =
      assignments.eventsByPostId.get(item.post.id) ??
      EMPTY_CONTEXT_LENS_EVENT_MAP;
    const hidePostContent = assignments.participantCarrierPostIds.has(
      item.post.id
    );
    const previousItem = previousById.get(item.post.id);
    if (
      previousItem?.post === item.post &&
      previousItem.previous === item.previous &&
      previousItem.next === item.next &&
      previousItem.agentRunEvents === agentRunEvents &&
      previousItem.agentReceiptEvents === agentReceiptEvents &&
      previousItem.agentEventsByLensId === agentEventsByLensId &&
      previousItem.hidePostContent === hidePostContent
    ) {
      return previousItem;
    }
    return {
      ...item,
      agentRunEvents,
      agentReceiptEvents,
      agentEventsByLensId,
      hidePostContent,
    };
  });
}

/**
 * Protocol carrier posts have no message surface of their own. Keep one in the
 * list only while an activity card is attached to that exact row; otherwise
 * remove it before neighbor/divider calculation so it contributes zero space.
 */
export function filterRenderableAgentChatPosts(
  posts: readonly db.Post[],
  assignments: AgentChatRunAssignments
) {
  return posts.filter(
    (post) =>
      !assignments.participantCarrierPostIds.has(post.id) ||
      assignments.liveByPostId.has(post.id) ||
      assignments.receiptByPostId.has(post.id)
  );
}

/**
 * Live and finished runs can share the same triggering post, especially when
 * Continue starts a retry after a failed run. Render them as one chronological
 * sequence so the retry follows the receipt that caused it.
 */
export function orderAgentChatRunCards(
  liveEvents: readonly ContextLensEvent[],
  receiptEvents: readonly ContextLensEvent[]
): AgentChatRunCard[] {
  return [
    ...liveEvents.map((event) => ({ kind: 'live' as const, event })),
    ...receiptEvents.map((event) => ({ kind: 'receipt' as const, event })),
  ].sort(
    (left, right) =>
      left.event.lens.createdAt - right.event.lens.createdAt ||
      (left.kind === right.kind ? 0 : left.kind === 'receipt' ? -1 : 1) ||
      left.event.lens.lensId.localeCompare(right.event.lens.lensId)
  );
}

function assignLatest(
  assignments: Map<string, ContextLensEvent[]>,
  postId: string,
  event: ContextLensEvent
) {
  const existing = assignments.get(postId) ?? [];
  const index = existing.findIndex(
    (candidate) => candidate.lens.lensId === event.lens.lensId
  );
  if (index >= 0 && event.at < existing[index].at) {
    return;
  }
  const next =
    index >= 0
      ? existing.map((candidate, candidateIndex) =>
          candidateIndex === index ? event : candidate
        )
      : [...existing, event];
  assignments.set(
    postId,
    [...next].sort(
      (left, right) =>
        left.lens.createdAt - right.lens.createdAt ||
        left.lens.lensId.localeCompare(right.lens.lensId)
    )
  );
}

function reuseUnchangedArrays<T>(
  next: Map<string, T[]>,
  previous?: Map<string, T[]>
) {
  if (!previous) return next;
  for (const [key, nextItems] of next) {
    const previousItems = previous.get(key);
    if (
      previousItems?.length === nextItems.length &&
      nextItems.every((item, index) => item === previousItems[index])
    ) {
      next.set(key, previousItems);
    }
  }
  return next;
}

function reuseUnchangedEventMaps(
  next: Map<string, Map<string, ContextLensEvent[]>>,
  previous?: Map<string, Map<string, ContextLensEvent[]>>
) {
  if (!previous) return next;
  for (const [postId, nextEvents] of next) {
    const previousEvents = previous.get(postId);
    if (
      previousEvents?.size === nextEvents.size &&
      [...nextEvents].every(
        ([lensId, events]) => previousEvents.get(lensId) === events
      )
    ) {
      next.set(postId, previousEvents);
    }
  }
  return next;
}

// Lens records can use a prefixed writ id (`~author/@ud`) or a raw undotted
// group-firehose @ud. Local post rows always use the canonical dotted form, so
// normalize at the assignment boundary without changing the Lens contract.
function localPostId(messageId: string) {
  return getCanonicalPostId(messageId);
}

function compareRunEvents(left: ContextLensEvent, right: ContextLensEvent) {
  return (
    left.at - right.at ||
    left.seq - right.seq ||
    left.lens.updatedAt - right.lens.updatedAt
  );
}

function latestAssignedEvent(
  previous: AgentChatRunAssignments | undefined,
  lensId: string
) {
  if (!previous) return undefined;
  const candidates = [
    ...previous.liveByPostId.values(),
    ...previous.receiptByPostId.values(),
  ]
    .flat()
    .filter((event) => event.lens.lensId === lensId);
  return candidates.sort(compareRunEvents).at(-1);
}

/**
 * Lifecycle/delivery snapshots can race ahead of their folded activity. Once
 * structured evidence has appeared, terminal receipts retain its latest
 * plan/items while taking lifecycle, tools, outputs, and timestamps from the
 * newest snapshot. An explicit empty activity remains authoritative while the
 * run is active; terminal lifecycle or final delivery makes recovery safe.
 */
function hasRestorableStructuredActivity(
  activity: ContextLensEvent['lens']['activity']
) {
  return Boolean(
    activity?.plan != null || hasStructuredAgentChatActivity(activity)
  );
}

function preserveStructuredEvidence(
  latest: ContextLensEvent,
  history: readonly ContextLensEvent[]
): ContextLensEvent {
  const newestFirst = [...history].sort(compareRunEvents).reverse();
  const currentActivity = latest.lens.activity;
  const currentActivityIsStructurallyEmpty =
    currentActivity != null &&
    currentActivity.plan == null &&
    currentActivity.items.length === 0;
  const mayRecoverEmptyActivity =
    currentActivity == null ||
    !isContextLensEventActive(latest) ||
    latest.phase === 'final-reply-delivered';
  if (
    (!currentActivityIsStructurallyEmpty && currentActivity != null) ||
    !mayRecoverEmptyActivity
  ) {
    return latest;
  }
  const activitySource = newestFirst.find((event) =>
    hasRestorableStructuredActivity(event.lens.activity)
  )?.lens.activity;
  if (!activitySource) {
    return latest;
  }
  return {
    ...latest,
    lens: {
      ...latest.lens,
      activity: activitySource,
    },
  };
}

function finalChatProjection(
  event: ContextLensEvent,
  outcome: 'completed' | 'failed'
): ContextLensEvent {
  if (isParticipantContextLensEvent(event)) {
    // The participant projection is the bounded, lifecycle-aware source of
    // truth. The surrounding Lens-v1 stamp only says whether delivery of the
    // final chat post succeeded; it must not turn a failed/timed-out task into
    // a successful receipt.
    return event;
  }
  return {
    ...event,
    phase: 'final-reply-delivered',
    lens: {
      ...event.lens,
      // A final stamp proves reply delivery, not that a still-active run has
      // finished its provider lifecycle or published its terminal plan.
      status:
        outcome === 'failed'
          ? 'error'
          : isContextLensEventActive(event)
            ? event.lens.status
            : 'completed',
    },
  };
}

function stampedFinalOutput(
  event: ContextLensEvent,
  posts: readonly db.Post[]
) {
  const post = posts.find((candidate) => {
    const stamp = getContextLensStamp(candidate);
    if (stamp?.delivery !== 'final' || stamp.lensId !== event.lens.lensId) {
      return false;
    }
    if (!event.lens.botShip || !candidate.authorId) {
      return true;
    }
    return (
      candidate.authorId.replace(/^~/, '') ===
      event.lens.botShip.replace(/^~/, '')
    );
  });
  if (!post) return null;
  const stamp = getContextLensStamp(post)!;
  return {
    id: post.id,
    outcome: stamp.outcome ?? ('completed' as const),
  };
}

function participantCarrierAnchor(event: ContextLensEvent) {
  return isParticipantContextLensEvent(event) &&
    event.participantActivity.surface === 'carrier'
    ? event.participantActivity.carrierPostId
    : null;
}

/**
 * Anchors gateway runs without altering the post list: active work belongs to
 * the triggering post, while a final receipt follows a loaded output post when
 * OpenClaw supplied one. Runs without an output stay attached to the trigger.
 */
export function buildAgentChatRunAssignments(
  events: ContextLensEvent[],
  posts: db.Post[],
  channelId: string,
  previous?: AgentChatRunAssignments,
  participantCarrierPostIds: ReadonlySet<string> = new Set()
): AgentChatRunAssignments {
  const eventsByLensId = new Map<string, ContextLensEvent[]>();

  for (const event of events) {
    const matchesChannel = conversationMatchesChannel(
      {
        chatType: event.lens.chatType,
        conversationId: event.lens.triggerDetails?.conversationId ?? null,
      },
      channelId,
      channelId
    );
    if (!matchesChannel) continue;
    const lensEvents = eventsByLensId.get(event.lens.lensId) ?? [];
    lensEvents.push(event);
    eventsByLensId.set(event.lens.lensId, lensEvents);
  }

  const latestByLensId = new Map<string, ContextLensEvent>();
  const evidenceHistoryByLensId = new Map<string, ContextLensEvent[]>();
  for (const [lensId, lensEvents] of eventsByLensId) {
    const currentLatest = [...lensEvents].sort(compareRunEvents).at(-1)!;
    const previousEvent = latestAssignedEvent(previous, lensId);
    const latest =
      previousEvent && compareRunEvents(previousEvent, currentLatest) > 0
        ? previousEvent
        : currentLatest;
    const history = previousEvent ? [...lensEvents, previousEvent] : lensEvents;
    if (!history.some(shouldShowAgentChatRun) && !previousEvent) {
      continue;
    }
    evidenceHistoryByLensId.set(lensId, history);
    latestByLensId.set(lensId, preserveStructuredEvidence(latest, history));
  }

  const postIds = new Set(posts.map((post) => post.id));
  const liveByPostId = new Map<string, ContextLensEvent[]>();
  const receiptByPostId = new Map<string, ContextLensEvent[]>();
  const projectionByLensId = new Map<
    string,
    {
      event: ContextLensEvent;
      triggerPostId: string;
      loadedOutputId?: string;
      stampedOutput: ReturnType<typeof stampedFinalOutput>;
      finalReplyDelivered: boolean;
    }
  >();

  for (const event of latestByLensId.values()) {
    const triggerPostId = localPostId(
      event.lens.triggerDetails?.messageId ?? event.lens.messageId
    );
    if (!postIds.has(triggerPostId)) continue;

    const loadedOutputId = event.lens.outputs
      ?.map((output) => localPostId(output.messageId))
      .find((outputId) => postIds.has(outputId));
    const stampedOutput = stampedFinalOutput(event, posts);
    const finalReplyDelivered =
      stampedOutput != null ||
      (event.lens.lifecycle.queuedFinal === true && loadedOutputId != null);

    projectionByLensId.set(event.lens.lensId, {
      event,
      triggerPostId,
      ...(loadedOutputId ? { loadedOutputId } : {}),
      stampedOutput,
      finalReplyDelivered,
    });
  }

  const receiptAnchorByLensId = new Map<string, string>();
  const chronologicalProjections = [...projectionByLensId.entries()].sort(
    ([, left], [, right]) =>
      left.event.lens.createdAt - right.event.lens.createdAt ||
      left.event.lens.lensId.localeCompare(right.event.lens.lensId)
  );
  for (const [lensId, projection] of chronologicalProjections) {
    if (
      !isContextLensEventActive(projection.event) ||
      projection.finalReplyDelivered
    ) {
      const retryAnchor = projection.event.lens.retryOf
        ? receiptAnchorByLensId.get(projection.event.lens.retryOf)
        : undefined;
      receiptAnchorByLensId.set(
        lensId,
        participantCarrierAnchor(projection.event) ??
          projection.stampedOutput?.id ??
          projection.loadedOutputId ??
          retryAnchor ??
          projection.triggerPostId
      );
    }
  }

  // Lens remains turn-accurate: a required-input question and its answer are
  // separate runs. Chat joins them only through typed continuation lineage;
  // post order or assistant prose must never guess that relationship.
  const normalizedShip = (ship: string | null | undefined) =>
    ship?.replace(/^~/, '').toLowerCase() ?? '';
  const threadRootByPostId = new Map(
    posts.map((post) => [
      post.id,
      post.parentId ? localPostId(post.parentId) : null,
    ])
  );
  const lensIdByPublicRunId = new Map(
    chronologicalProjections.flatMap(([lensId, projection]) => {
      if (!isParticipantContextLensEvent(projection.event)) return [];
      return [
        [projection.event.participantActivity.publicRunId, lensId] as const,
      ];
    })
  );
  const supersededWaitingLensIds = new Set<string>();
  for (const [, child] of chronologicalProjections) {
    const continuation = structuredRequestInputContinuationParent(child.event);
    if (!continuation) continue;
    const parentLensId =
      continuation.kind === 'owner'
        ? continuation.parentLensId
        : lensIdByPublicRunId.get(continuation.parentPublicRunId);
    if (!parentLensId) continue;
    const parent = projectionByLensId.get(parentLensId);
    if (!parent) continue;
    if (
      !parent.finalReplyDelivered ||
      agentChatRunOutcome(parent.event) !== 'waiting'
    ) {
      continue;
    }
    const sameConversation =
      child.event.lens.triggerDetails?.conversationId ===
      parent.event.lens.triggerDetails?.conversationId;
    const sameBot =
      normalizedShip(child.event.lens.botShip) ===
      normalizedShip(parent.event.lens.botShip);
    const sameRequester =
      normalizedShip(child.event.lens.triggerDetails?.authorShip) ===
      normalizedShip(parent.event.lens.triggerDetails?.authorShip);
    const parentThreadRoot = threadRootByPostId.get(parent.triggerPostId);
    const childThreadRoot = threadRootByPostId.get(child.triggerPostId);
    const sameLoadedThread =
      parentThreadRoot !== undefined &&
      childThreadRoot !== undefined &&
      parentThreadRoot === childThreadRoot;
    if (!sameConversation || !sameBot || !sameRequester || !sameLoadedThread) {
      continue;
    }

    // Owner lineage names the exact unresolved input item. Participant-safe
    // lineage intentionally omits that private identifier.
    if (
      continuation.kind === 'owner' &&
      !isParticipantContextLensEvent(parent.event) &&
      !parent.event.lens.activity?.items.some(
        (item) =>
          item.kind === 'request_input' &&
          item.status === 'waiting' &&
          item.id === continuation.requestInputId
      )
    ) {
      continue;
    }
    supersededWaitingLensIds.add(parentLensId);
  }

  for (const projection of projectionByLensId.values()) {
    const {
      event,
      triggerPostId,
      loadedOutputId,
      stampedOutput,
      finalReplyDelivered,
    } = projection;

    if (isContextLensEventActive(event) && !finalReplyDelivered) {
      const retryAnchor = event.lens.retryOf
        ? receiptAnchorByLensId.get(event.lens.retryOf)
        : undefined;
      const participant = isParticipantContextLensEvent(event)
        ? event.participantActivity
        : null;
      assignLatest(
        liveByPostId,
        participant?.surface === 'carrier'
          ? participant.carrierPostId
          : retryAnchor ?? triggerPostId,
        event
      );
      continue;
    }

    if (supersededWaitingLensIds.has(event.lens.lensId)) {
      continue;
    }

    const retryAnchor = event.lens.retryOf
      ? receiptAnchorByLensId.get(event.lens.retryOf)
      : undefined;
    assignLatest(
      receiptByPostId,
      participantCarrierAnchor(event) ??
        stampedOutput?.id ??
        loadedOutputId ??
        retryAnchor ??
        triggerPostId,
      finalReplyDelivered
        ? preserveStructuredEvidence(
            finalChatProjection(event, stampedOutput?.outcome ?? 'completed'),
            evidenceHistoryByLensId.get(event.lens.lensId) ?? [event]
          )
        : event
    );
  }

  const stableEventsByLensId = reuseUnchangedArrays(
    eventsByLensId,
    previous?.eventsByLensId
  );
  const stableLiveByPostId = reuseUnchangedArrays(
    liveByPostId,
    previous?.liveByPostId
  );
  const stableReceiptByPostId = reuseUnchangedArrays(
    receiptByPostId,
    previous?.receiptByPostId
  );
  const eventsByPostId = new Map<string, Map<string, ContextLensEvent[]>>();

  for (const assignments of [stableLiveByPostId, stableReceiptByPostId]) {
    for (const [postId, runEvents] of assignments) {
      const postEvents = eventsByPostId.get(postId) ?? new Map();
      for (const event of runEvents) {
        const lensEvents = stableEventsByLensId.get(event.lens.lensId);
        if (lensEvents) {
          postEvents.set(event.lens.lensId, lensEvents);
        }
      }
      eventsByPostId.set(postId, postEvents);
    }
  }

  // Keep retry lineage observable from the parent receipt even when a very
  // fast child finishes before the client ever sees its live card and its
  // final receipt moves to a new bot reply.
  for (const event of latestByLensId.values()) {
    const parentLensId = event.lens.retryOf;
    const parentPostId = parentLensId
      ? receiptAnchorByLensId.get(parentLensId)
      : undefined;
    const lensEvents = stableEventsByLensId.get(event.lens.lensId);
    if (!parentPostId || !lensEvents) continue;
    const postEvents = eventsByPostId.get(parentPostId) ?? new Map();
    postEvents.set(event.lens.lensId, lensEvents);
    eventsByPostId.set(parentPostId, postEvents);
  }

  return {
    liveByPostId: stableLiveByPostId,
    receiptByPostId: stableReceiptByPostId,
    eventsByLensId: stableEventsByLensId,
    eventsByPostId: reuseUnchangedEventMaps(
      eventsByPostId,
      previous?.eventsByPostId
    ),
    participantCarrierPostIds,
  };
}
