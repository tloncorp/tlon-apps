import type { ContextLens } from './context-lens.js';
import { canonicalizeNest, normalizeShip } from './targets.js';

export type ContextLensContinuation = {
  kind: 'request_input';
  parentLensId: string;
  requestInputId: string;
  workflowId: string;
  linkedAt: number;
};

export type RequestInputContinuationScope = {
  botShip: string;
  requesterShip: string;
  conversationId: string;
  conversationKind: ContextLens['triggerDetails']['conversationKind'];
  threadRootId?: string | null;
  /** Gateway time at which the lineage claim is made. */
  linkedAt?: number;
};

function normalizeConversationId(
  kind: RequestInputContinuationScope['conversationKind'],
  value: string | undefined
): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  if (kind === 'channel') {
    return canonicalizeNest(trimmed) ?? trimmed;
  }
  if (kind === 'dm') {
    return normalizeShip(trimmed);
  }
  return trimmed;
}

function normalizeThreadRoot(value: string | null | undefined) {
  return value?.trim() || undefined;
}

/**
 * Exact thread scope where this run's reply is delivered.
 *
 * Reactions can route a reply into a thread without marking the synthetic
 * inbound as a thread reply, so the delivery override is authoritative.
 */
export function contextLensThreadRootId(lens: ContextLens): string | undefined {
  return normalizeThreadRoot(
    lens.retrySeed?.replyParentId ??
      (lens.retrySeed?.isThreadReply ? lens.retrySeed.parentId : undefined)
  );
}

function isExactScopeMatch(
  lens: ContextLens,
  scope: RequestInputContinuationScope
): boolean {
  const lensBot = normalizeShip(lens.botShip ?? '');
  const requester = normalizeShip(lens.triggerDetails.authorShip ?? '');
  const conversationKind = lens.triggerDetails.conversationKind;

  return (
    Boolean(lensBot) &&
    lensBot === normalizeShip(scope.botShip) &&
    Boolean(requester) &&
    requester === normalizeShip(scope.requesterShip) &&
    conversationKind === scope.conversationKind &&
    normalizeConversationId(
      conversationKind,
      lens.triggerDetails.conversationId
    ) ===
      normalizeConversationId(scope.conversationKind, scope.conversationId) &&
    contextLensThreadRootId(lens) === normalizeThreadRoot(scope.threadRootId)
  );
}

type WaitingCandidate = {
  lens: ContextLens;
  requestInputId: string;
  requestedAt: number;
};

function newestWaitingRequest(lens: ContextLens): WaitingCandidate | null {
  const request = lens.activity.items
    .filter(
      (item) =>
        item.kind === 'request_input' &&
        item.status === 'waiting' &&
        item.id.trim().length > 0
    )
    .toSorted(
      (left, right) =>
        right.updatedAt - left.updatedAt || right.id.localeCompare(left.id)
    )[0];
  return request
    ? {
        lens,
        requestInputId: request.id,
        requestedAt: request.updatedAt,
      }
    : null;
}

function compareCandidates(left: WaitingCandidate, right: WaitingCandidate) {
  return (
    right.requestedAt - left.requestedAt ||
    right.lens.createdAt - left.lens.createdAt ||
    right.lens.lensId.localeCompare(left.lens.lensId)
  );
}

/**
 * Resolve the current typed requester-input gate for a newly dispatching post.
 *
 * The matcher never examines prose. A child Lens already carrying a link is
 * the durable consume record, so combining active registry history with the
 * JSONL store makes the decision replay- and restart-stable.
 */
export function resolveRequestInputContinuation(
  lenses: readonly ContextLens[],
  scope: RequestInputContinuationScope
): ContextLensContinuation | null {
  // Callers pass durable history first and hot registry snapshots second, so
  // last-write-wins mirrors the JSONL store while preferring live state.
  const uniqueLenses = [
    ...new Map(lenses.map((lens) => [lens.lensId, lens])).values(),
  ];
  const consumedParentIds = new Set(
    uniqueLenses.flatMap((lens) =>
      lens.continuation?.kind === 'request_input' &&
      lens.continuation.parentLensId
        ? [lens.continuation.parentLensId]
        : []
    )
  );
  // Use one gateway clock for both request events and linkage. Comparing the
  // remote ship's post timestamp to a gateway agent-event timestamp would
  // make valid answers disappear under ordinary host clock skew.
  const linkedAt = Number.isFinite(scope.linkedAt)
    ? Math.max(0, Math.trunc(scope.linkedAt as number))
    : Date.now();
  const candidate = uniqueLenses
    .filter((lens) => isExactScopeMatch(lens, scope))
    .flatMap((lens) => {
      const waiting = newestWaitingRequest(lens);
      return waiting && linkedAt > waiting.requestedAt ? [waiting] : [];
    })
    .toSorted(compareCandidates)[0];

  // Do not fall back to an older request once the current visible obligation
  // has been consumed; older same-scope waits remain historical.
  if (!candidate || consumedParentIds.has(candidate.lens.lensId)) {
    return null;
  }

  return {
    kind: 'request_input',
    parentLensId: candidate.lens.lensId,
    requestInputId: candidate.requestInputId,
    workflowId:
      candidate.lens.continuation?.workflowId ?? candidate.lens.lensId,
    linkedAt,
  };
}
