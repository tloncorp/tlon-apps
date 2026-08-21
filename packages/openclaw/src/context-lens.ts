import { createHash, randomUUID } from 'node:crypto';

import {
  type ContextLensActivity,
  type ContextLensActivityEvent,
  type ContextLensActivityStatus,
  emptyContextLensActivity,
  foldContextLensActivity,
} from './context-lens-activity.js';
import type { ContextLensContinuation } from './context-lens-continuation.js';
import { sharedMap, sharedSlot } from './shared-state.js';

export type ContextLensTrigger =
  | 'cron'
  | 'dm'
  | 'mention'
  | 'thread'
  | 'reaction'
  | 'owner-listen'
  | 'owner-blob'
  | 'summarization'
  | 'tool'
  | 'retry'
  | 'unknown';

export type ContextLensRunKind =
  | 'conversation'
  | 'cron'
  | 'owner_listen'
  | 'summarization'
  | 'internal';

export type ContextLensVisibility = 'owner' | 'participants' | 'internal';

export type ContextLensStatus =
  | 'assembling'
  | 'queued'
  | 'dispatching'
  | 'tool_running'
  | 'delivering'
  | 'completed'
  | 'no_reply'
  | 'timed_out'
  | 'aborted'
  | 'error';

export type ContextLensTriggerDetails = {
  type: ContextLensTrigger;
  messageId: string;
  authorShip?: string;
  conversationId?: string;
  conversationKind: 'dm' | 'channel' | 'internal';
  receivedAt?: number;
  preview?: string;
};

/**
 * Snapshot of the original dispatch inputs, captured at lens creation so an
 * owner-requested retry can re-dispatch the message faithfully. The seed is
 * capped at capture, persisted in the JSONL store, and included in ship-sync
 * payloads so the owner ship can retry runs even if gateway-local cache state
 * is gone. Message text and blob JSON already originate from the DM/channel
 * visible to the owner.
 */
export type ContextLensRetrySeed = {
  messageText: string;
  blobField?: string | null;
  // Raw Tlon Story content, persisted so a retry can re-attach media that
  // lives in image blocks (not blobField) — downloadMessageImages rebuilds
  // MediaPaths from the durable image URLs it carries.
  messageContent?: unknown;
  parentId?: string | null;
  isThreadReply?: boolean;
  replyParentId?: string | null;
  cachesHistory?: boolean;
};

export type ContextLensSourceKind =
  | 'message'
  | 'memory'
  | 'identity'
  | 'system'
  | 'tool_result'
  | 'other';

export type ContextLensSource = {
  kind: ContextLensSourceKind;
  label: string;
  sourceId?: string;
  included: boolean;
  reason?: string;
  tokenEstimate?: number;
  preview?: string;
};

export type ContextLensToolRun = {
  id: string;
  toolCallId?: string;
  callIndex: number;
  name: string;
  phase?: string;
  startedAt: number;
  completedAt: number | null;
  durationMs: number | null;
  status: 'running' | 'completed' | 'error' | 'blocked';
  argumentSummary?: string;
  argumentDetail?: string;
  resultSummary?: string;
  error?: string;
};

export type ContextLensOutput = {
  messageId: string;
  conversationId: string;
  kind: 'dm' | 'channel';
  sentAt: number;
  preview?: string;
  chunkIndex?: number;
};

export type ContextLensPersistenceEvent = {
  kind: 'memory' | 'conversation_state' | 'tool_cache' | 'artifact' | 'other';
  action: 'read' | 'created' | 'updated' | 'skipped' | 'deleted';
  location: 'openclaw' | 'urbit' | 'tlon-desk' | 'external';
  status: 'ok' | 'failed' | 'skipped';
  key?: string;
  reason?: string;
  at: number;
};

export type ContextLens = {
  lensId: string;
  /** Ship running this agent, used to attribute concurrent group runs. */
  botShip: string | null;
  /** Stable OpenClaw turn id once dispatch begins. */
  runId: string | null;
  messageId: string;
  sessionKeyHash: string | null;
  chatType: 'dm' | 'channel' | 'internal';
  runKind: ContextLensRunKind;
  visibility: ContextLensVisibility;
  trigger: ContextLensTrigger;
  triggerDetails: ContextLensTriggerDetails;
  /** lensId of the run this one retries, when trigger is "retry". */
  retryOf?: string;
  /** Typed workflow lineage; deliberately separate from failure retries. */
  continuation?: ContextLensContinuation;
  retrySeed?: ContextLensRetrySeed;
  model: string | null;
  provider: string | null;
  context: {
    currentMessage: boolean;
    threadMessages: number;
    channelMessages: number;
    citedPosts: number;
    attachments: number;
    pendingNudge: boolean;
    sources: ContextLensSource[];
  };
  persistence: {
    postsReply: boolean;
    updatesSettings: boolean;
    writesMedia: boolean;
    emitsTelemetry: boolean;
    cachesHistory: boolean;
    events: ContextLensPersistenceEvent[];
  };
  tools: {
    ownerOnlyAvailable: string[];
    called: string[];
    callCount: number;
    lastStartedAt: number | null;
    runs: ContextLensToolRun[];
  };
  outputs: ContextLensOutput[];
  /** Bounded, human-readable work log derived from sanitized agent events. */
  activity: ContextLensActivity;
  lifecycle: {
    queuedAt: number | null;
    queuedMs: number;
    dispatchStartedAt: number | null;
    firstToolStartedAt: number | null;
    completedAt: number | null;
    durationMs: number | null;
    timeoutMs: number | null;
    timedOut: boolean;
    deliveredMessageCount: number;
    queuedFinal: boolean;
    queuedFinalCount: number;
    queuedBlockCount: number;
  };
  status: ContextLensStatus;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

export type CreateContextLensInput = {
  messageId: string;
  chatType: ContextLens['chatType'];
  botShip?: string | null;
  runKind?: ContextLensRunKind;
  visibility?: ContextLensVisibility;
  trigger?: ContextLensTrigger;
  sessionKey?: string | null;
  senderShip?: string;
  conversationId?: string;
  receivedAt?: number;
  preview?: string;
  retryOf?: string;
  continuation?: ContextLensContinuation;
  retrySeed?: ContextLensRetrySeed;
  /** Optional plan-only seed used to make a continuation legible immediately. */
  activity?: ContextLensActivity;
  now?: number;
  ttlMs?: number;
};

/**
 * Patch shape for registry update(): top-level fields are optional, and the
 * nested objects may themselves be partial because update() deep-merges them
 * over the existing lens.
 */
export type ContextLensPatch = Partial<
  Omit<
    ContextLens,
    | 'context'
    | 'persistence'
    | 'tools'
    | 'activity'
    | 'triggerDetails'
    | 'lifecycle'
  >
> & {
  context?: Partial<ContextLens['context']>;
  persistence?: Partial<ContextLens['persistence']>;
  tools?: Partial<ContextLens['tools']>;
  activity?: Partial<ContextLens['activity']>;
  triggerDetails?: Partial<ContextLens['triggerDetails']>;
  lifecycle?: Partial<ContextLens['lifecycle']>;
};

export type ContextLensRegistry = ReturnType<typeof createContextLensRegistry>;

type ActiveContextLensBinding = {
  registry: ContextLensRegistry;
  lensId: string;
  background: boolean;
  finalizeTimer?: ReturnType<typeof setTimeout>;
};

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const MAX_LENSES = 200;
const MAX_RETRY_SEED_TEXT_CHARS = 16_384;
export const MAX_RETRY_SEED_BLOB_CHARS = 8_192;
// Long enough for the gateway to deliver the run's reply (cron DMs etc.)
// after the last tool result, so the outbound stamp/output land on the lens
// before it finalizes.
const BACKGROUND_FINALIZE_IDLE_MS = 30_000;
const activeLensesBySession = sharedMap<string, ActiveContextLensBinding>(
  'contextLens.activeLensesBySession'
);
const activeLensesByRun = sharedMap<string, ActiveContextLensBinding>(
  'contextLens.activeLensesByRun'
);
const backgroundContextLensesSlot = sharedSlot<ContextLensRegistry>(
  'contextLens.backgroundRegistry'
);

export function hashSessionKey(sessionKey: string): string {
  return createHash('sha256').update(sessionKey).digest('hex').slice(0, 16);
}

function defaultRunKind(
  trigger: ContextLensTrigger | undefined,
  chatType: ContextLens['chatType']
): ContextLensRunKind {
  if (trigger === 'cron') {
    return 'cron';
  }
  if (trigger === 'owner-listen' || trigger === 'owner-blob') {
    return 'owner_listen';
  }
  if (trigger === 'summarization') {
    return 'summarization';
  }
  if (chatType === 'internal') {
    return 'internal';
  }
  return 'conversation';
}

function cloneActivity(activity: ContextLensActivity): ContextLensActivity {
  return {
    ...activity,
    plan: activity.plan
      ? {
          ...activity.plan,
          steps: activity.plan.steps.map((step) => ({ ...step })),
        }
      : null,
    items: activity.items.map((item) => ({
      ...item,
      ...(item.counts ? { counts: { ...item.counts } } : {}),
    })),
  };
}

function cloneLens(lens: ContextLens): ContextLens {
  // Hot-reload shared state and older JSONL records may predate activity.
  const activity = lens.activity ?? emptyContextLensActivity();
  return {
    ...lens,
    botShip: lens.botShip ?? null,
    runId: lens.runId ?? null,
    context: {
      ...lens.context,
      sources: lens.context.sources.map((source) => ({ ...source })),
    },
    persistence: {
      ...lens.persistence,
      events: lens.persistence.events.map((event) => ({ ...event })),
    },
    tools: {
      ownerOnlyAvailable: [...lens.tools.ownerOnlyAvailable],
      called: [...lens.tools.called],
      callCount: lens.tools.callCount,
      lastStartedAt: lens.tools.lastStartedAt,
      runs: lens.tools.runs.map((run) => ({ ...run })),
    },
    outputs: lens.outputs.map((output) => ({ ...output })),
    activity: cloneActivity(activity),
    lifecycle: { ...lens.lifecycle },
    triggerDetails: { ...lens.triggerDetails },
    ...(lens.continuation ? { continuation: { ...lens.continuation } } : {}),
    ...(lens.retrySeed ? { retrySeed: { ...lens.retrySeed } } : {}),
  };
}

function capRetrySeed(seed: ContextLensRetrySeed): ContextLensRetrySeed {
  const capped: ContextLensRetrySeed = {
    ...seed,
    messageText: seed.messageText.slice(0, MAX_RETRY_SEED_TEXT_CHARS),
  };
  // A truncated blob would be unparseable JSON — drop it instead.
  if (
    typeof seed.blobField === 'string' &&
    seed.blobField.length > MAX_RETRY_SEED_BLOB_CHARS
  ) {
    delete capped.blobField;
  }
  return capped;
}

export const RETRYABLE_STATUSES: ReadonlySet<ContextLensStatus> = new Set([
  'no_reply',
  'timed_out',
  'aborted',
  'error',
]);

export type RetryDispatch = {
  /**
   * Fresh identity used only at OpenClaw's inbound-dispatch boundary. Reusing
   * the source post id makes core classify a continuation as a duplicate of
   * the interrupted turn for the duration of its inbound dedupe window.
   */
  dispatchMessageId: string;
  /** Original Tlon post id retained for Lens/chat correlation. */
  messageId: string;
  senderShip: string;
  messageText: string;
  blobField?: string | null;
  messageContent?: unknown;
  isGroup: boolean;
  channelNest?: string;
  parentId?: string | null;
  isThreadReply?: boolean;
  replyParentId?: string | null;
  cachesHistory?: boolean;
  /** True when dispatching from the truncated preview because the run predates retrySeed. */
  degraded: boolean;
};

export type RetryDispatchResult =
  | { ok: true; dispatch: RetryDispatch }
  | { ok: false; reason: string };

/**
 * Reconstruct processMessage params from a finalized lens so an owner can
 * re-run it. Pure eligibility + mapping; the caller owns dedup and dispatch.
 */
export function buildRetryDispatch(lens: ContextLens): RetryDispatchResult {
  if (!RETRYABLE_STATUSES.has(lens.status)) {
    return { ok: false, reason: `status ${lens.status} is not retryable` };
  }
  if (
    lens.triggerDetails.conversationKind === 'internal' ||
    lens.runKind === 'internal'
  ) {
    return { ok: false, reason: 'internal runs cannot be retried' };
  }
  const senderShip = lens.triggerDetails.authorShip;
  if (!senderShip) {
    return { ok: false, reason: 'original run has no author ship' };
  }
  const isGroup = lens.triggerDetails.conversationKind === 'channel';
  const conversationId = lens.triggerDetails.conversationId;
  if (isGroup && !conversationId) {
    return { ok: false, reason: 'channel run has no conversation id' };
  }
  const seed = lens.retrySeed;
  const messageText = seed?.messageText ?? lens.triggerDetails.preview ?? '';
  const blobField = seed?.blobField ?? null;
  const messageContent = seed?.messageContent ?? null;
  // A run with no text is still dispatchable when it carries media: a blob
  // attachment (voice memo/file via blobField) or image blocks in the Story
  // content (downloadMessageImages re-attaches them). Only reject when there's
  // nothing — no text, blob, or content — to replay.
  if (!messageText.trim() && !blobField && !messageContent) {
    return {
      ok: false,
      reason: 'no message text, blob, or content available to retry',
    };
  }
  return {
    ok: true,
    dispatch: {
      dispatchMessageId: `tlon-retry:${randomUUID()}`,
      messageId: lens.messageId,
      senderShip,
      messageText,
      blobField,
      messageContent,
      isGroup,
      ...(isGroup && conversationId ? { channelNest: conversationId } : {}),
      parentId: seed?.parentId ?? null,
      isThreadReply: seed?.isThreadReply ?? false,
      replyParentId: seed?.replyParentId ?? null,
      cachesHistory: seed?.cachesHistory ?? true,
      degraded: !seed,
    },
  };
}

/**
 * Seed a retry with only the unfinished portion of the prior plan. This makes
 * the child run visible before its first agent event without presenting
 * completed side effects as work that will run again.
 */
export function buildRetryActivitySeed(
  lens: ContextLens,
  now = Date.now()
): ContextLensActivity {
  const empty = emptyContextLensActivity();
  const remaining = (lens.activity?.plan?.steps ?? []).filter(
    (step) => step.status !== 'completed'
  );
  const steps = remaining.length
    ? remaining.map((step, index) => ({
        ...step,
        status: index === 0 ? ('running' as const) : ('pending' as const),
      }))
    : [
        {
          id: 'retry-resume-work',
          title: 'Finish the interrupted request',
          status: 'running' as const,
        },
      ];

  return {
    ...empty,
    lastEventAt: now,
    plan: {
      title: 'Continuing unfinished work',
      explanation:
        steps.length === 1
          ? 'Resuming the remaining task from the previous run.'
          : `Resuming ${steps.length} remaining tasks from the previous run.`,
      steps,
      updatedAt: now,
    },
  };
}

/** Trusted gateway context for a retry; original text/media remain unchanged. */
export function buildRetryContinuationContext(lens: ContextLens): string {
  const steps = lens.activity?.plan?.steps ?? [];
  const completed = steps
    .filter((step) => step.status === 'completed')
    .map((step) => step.title)
    .slice(0, 12);
  const remaining = steps
    .filter((step) => step.status !== 'completed')
    .map((step) => step.title)
    .slice(0, 12);
  const lines = [
    '[Tlon continuation context]',
    `The prior run ended with status ${lens.status}. Continue the same request from its first unfinished step.`,
    'Do not repeat completed mutations or ask again for input or approval that the user already supplied in this conversation. Verify an existing resource before recreating it.',
    'Before using another tool, publish a plan containing only the unfinished work.',
  ];
  if (completed.length) {
    lines.push(`Already completed: ${completed.join('; ')}.`);
  }
  if (remaining.length) {
    lines.push(`Still unfinished: ${remaining.join('; ')}.`);
  }
  if (lens.error?.trim()) {
    lines.push(`Previous run error: ${lens.error.trim().slice(0, 500)}.`);
  }
  return lines.join('\n');
}

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name;
  }
  return String(error);
}

function terminalActivityStatus(
  status: ContextLensStatus
): ContextLensActivityStatus | null {
  if (status === 'completed' || status === 'no_reply') {
    return 'completed';
  }
  if (status === 'timed_out' || status === 'error') {
    return 'error';
  }
  if (status === 'aborted') {
    return 'cancelled';
  }
  return null;
}

function hasOpenActivity(activity: ContextLensActivity) {
  const isOpen = (status: ContextLensActivityStatus) =>
    status === 'running' || status === 'waiting' || status === 'unknown';
  return (
    activity.items.some((item) => isOpen(item.status)) ||
    activity.plan?.steps.some((step) => isOpen(step.status)) === true
  );
}

function closeActivityForRun(
  lens: ContextLens,
  status: ContextLensActivityStatus,
  occurredAt: number
) {
  const activity = lens.activity ?? emptyContextLensActivity();
  if (!hasOpenActivity(activity)) {
    return activity;
  }
  return foldContextLensActivity(activity, {
    schemaVersion: activity.schemaVersion,
    runId: lens.runId ?? lens.lensId,
    sequence: activity.eventCount + 1,
    occurredAt,
    phase: 'end',
    kind: 'lifecycle',
    retention: 'snapshot',
    status,
  });
}

function toolActivityStatus(
  status: ContextLensToolRun['status']
): ContextLensActivityStatus {
  if (status === 'completed') {
    return 'completed';
  }
  if (status === 'blocked') {
    return 'blocked';
  }
  return 'error';
}

function reconcileCompletedToolActivity(
  activity: ContextLensActivity,
  completedRuns: ContextLensToolRun[],
  occurredAt: number
): ContextLensActivity {
  if (completedRuns.length === 0) {
    return activity;
  }

  const claimedItemIds = new Set<string>();
  const runByItemId = new Map<string, ContextLensToolRun>();
  for (const run of completedRuns) {
    const exactItem = activity.items.find(
      (item) =>
        !claimedItemIds.has(item.id) &&
        (item.id === run.id ||
          (run.toolCallId && item.toolCallId === run.toolCallId))
    );
    const fallbackItem = exactItem
      ? undefined
      : [...activity.items]
          .reverse()
          .find(
            (item) =>
              !claimedItemIds.has(item.id) &&
              item.name === run.name &&
              (item.kind === 'tool' ||
                item.kind === 'command' ||
                item.kind === 'patch') &&
              (item.status === 'running' || item.status === 'unknown')
          );
    const item = exactItem ?? fallbackItem;
    if (item) {
      claimedItemIds.add(item.id);
      runByItemId.set(item.id, run);
    }
  }

  if (runByItemId.size === 0) {
    return activity;
  }
  return {
    ...activity,
    items: activity.items.map((item) => {
      const run = runByItemId.get(item.id);
      if (!run) {
        return item;
      }
      return {
        ...item,
        status: toolActivityStatus(run.status),
        updatedAt: run.completedAt ?? occurredAt,
        completedAt: run.completedAt ?? occurredAt,
        ...(run.error ? { progressText: run.error } : {}),
      };
    }),
  };
}

export function createContextLensRegistry(
  opts: {
    ttlMs?: number;
    maxEntries?: number;
    visibilityDefault?: ContextLensVisibility;
    botShip?: string | null;
    disabled?: boolean;
  } = {}
) {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = opts.maxEntries ?? MAX_LENSES;
  const visibilityDefault = opts.visibilityDefault ?? 'owner';
  const botShip = opts.botShip?.trim() || null;
  const disabled = opts.disabled ?? false;
  const lenses = new Map<string, ContextLens>();

  const prune = (now = Date.now()) => {
    for (const [lensId, lens] of lenses) {
      if (lens.expiresAt <= now) {
        lenses.delete(lensId);
      }
    }

    while (lenses.size > maxEntries) {
      const oldest = lenses.keys().next().value;
      if (!oldest) {
        break;
      }
      lenses.delete(oldest);
    }
  };

  const create = (input: CreateContextLensInput): ContextLens => {
    const now = input.now ?? Date.now();
    prune(now);

    const lens: ContextLens = {
      lensId: randomUUID(),
      botShip: input.botShip?.trim() || botShip,
      runId: null,
      messageId: input.messageId,
      sessionKeyHash: input.sessionKey
        ? hashSessionKey(input.sessionKey)
        : null,
      chatType: input.chatType,
      runKind: input.runKind ?? defaultRunKind(input.trigger, input.chatType),
      visibility: input.visibility ?? visibilityDefault,
      trigger: input.trigger ?? 'unknown',
      triggerDetails: {
        type: input.trigger ?? 'unknown',
        messageId: input.messageId,
        ...(input.senderShip ? { authorShip: input.senderShip } : {}),
        ...(input.conversationId
          ? { conversationId: input.conversationId }
          : {}),
        conversationKind: input.chatType,
        ...(input.receivedAt ? { receivedAt: input.receivedAt } : {}),
        ...(input.preview ? { preview: input.preview } : {}),
      },
      ...(input.retryOf ? { retryOf: input.retryOf } : {}),
      ...(input.continuation
        ? { continuation: { ...input.continuation } }
        : {}),
      ...(input.retrySeed ? { retrySeed: capRetrySeed(input.retrySeed) } : {}),
      model: null,
      provider: null,
      context: {
        currentMessage: true,
        threadMessages: 0,
        channelMessages: 0,
        citedPosts: 0,
        attachments: 0,
        pendingNudge: false,
        sources: [
          {
            kind: 'message',
            label: 'Current message',
            sourceId: input.messageId,
            included: true,
            reason: 'trigger',
            ...(input.preview ? { preview: input.preview } : {}),
          },
        ],
      },
      persistence: {
        postsReply: false,
        updatesSettings: false,
        writesMedia: false,
        emitsTelemetry: false,
        cachesHistory: false,
        events: [],
      },
      tools: {
        ownerOnlyAvailable: [],
        called: [],
        callCount: 0,
        lastStartedAt: null,
        runs: [],
      },
      outputs: [],
      activity: input.activity
        ? cloneActivity(input.activity)
        : emptyContextLensActivity(),
      lifecycle: {
        queuedAt: null,
        queuedMs: 0,
        dispatchStartedAt: null,
        firstToolStartedAt: null,
        completedAt: null,
        durationMs: null,
        timeoutMs: null,
        timedOut: false,
        deliveredMessageCount: 0,
        queuedFinal: false,
        queuedFinalCount: 0,
        queuedBlockCount: 0,
      },
      status: 'assembling',
      error: null,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + (input.ttlMs ?? ttlMs),
    };

    // When disabled, hand back a lens without storing it: every later
    // get()/update()/record*() misses the map and no-ops, so call sites
    // need no enabled checks of their own.
    if (!disabled) {
      lenses.set(lens.lensId, lens);
      prune(now);
    }
    return cloneLens(lens);
  };

  const update = (
    lensId: string | null | undefined,
    patch: ContextLensPatch
  ) => {
    if (!lensId) {
      return null;
    }
    const existing = lenses.get(lensId);
    if (!existing) {
      return null;
    }

    const next: ContextLens = {
      ...existing,
      ...patch,
      context: { ...existing.context, ...patch.context },
      persistence: { ...existing.persistence, ...patch.persistence },
      tools: { ...existing.tools, ...patch.tools },
      activity: {
        ...(existing.activity ?? emptyContextLensActivity()),
        ...patch.activity,
      },
      outputs: patch.outputs ?? existing.outputs,
      triggerDetails: { ...existing.triggerDetails, ...patch.triggerDetails },
      lifecycle: { ...existing.lifecycle, ...patch.lifecycle },
      updatedAt: patch.updatedAt ?? Date.now(),
    };
    lenses.set(lensId, next);
    return cloneLens(next);
  };

  const setStatus = (
    lensId: string | null | undefined,
    status: ContextLensStatus,
    error?: unknown
  ) => {
    if (!lensId) {
      return null;
    }
    const existing = lenses.get(lensId);
    if (!existing) {
      return null;
    }
    const now = Date.now();
    const activityStatus = terminalActivityStatus(status);
    return update(lensId, {
      status,
      ...(error === undefined ? {} : { error: serializeError(error) }),
      ...(activityStatus
        ? { activity: closeActivityForRun(existing, activityStatus, now) }
        : {}),
    });
  };

  const recordContext = (
    lensId: string | null | undefined,
    patch: Partial<ContextLens['context']>
  ) => update(lensId, { context: patch });

  const recordPersistence = (
    lensId: string | null | undefined,
    patch: Partial<ContextLens['persistence']>
  ) => update(lensId, { persistence: patch });

  const recordContextSource = (
    lensId: string | null | undefined,
    source: ContextLensSource
  ) => {
    if (!lensId) {
      return null;
    }
    const existing = lenses.get(lensId);
    if (!existing) {
      return null;
    }
    const existingIndex = existing.context.sources.findIndex(
      (item) =>
        item.kind === source.kind &&
        item.label === source.label &&
        (item.sourceId ?? '') === (source.sourceId ?? '')
    );
    const sources =
      existingIndex >= 0
        ? existing.context.sources.map((item, index) =>
            index === existingIndex ? { ...item, ...source } : item
          )
        : [...existing.context.sources, source];
    return update(lensId, {
      context: {
        ...existing.context,
        sources,
      },
    });
  };

  const recordPersistenceEvent = (
    lensId: string | null | undefined,
    event: Omit<ContextLensPersistenceEvent, 'at'> & { at?: number }
  ) => {
    if (!lensId) {
      return null;
    }
    const existing = lenses.get(lensId);
    if (!existing) {
      return null;
    }
    return update(lensId, {
      persistence: {
        ...existing.persistence,
        events: [
          ...existing.persistence.events,
          { ...event, at: event.at ?? Date.now() },
        ],
      },
    });
  };

  const recordLifecycle = (
    lensId: string | null | undefined,
    patch: Partial<ContextLens['lifecycle']>
  ) => update(lensId, { lifecycle: patch as ContextLens['lifecycle'] });

  const recordToolCall = (
    lensId: string | null | undefined,
    toolName: string,
    detail: {
      phase?: string;
      argumentSummary?: string;
      argumentDetail?: string;
      toolCallId?: string;
    } = {}
  ) => {
    if (!lensId || !toolName) {
      return null;
    }
    const existing = lenses.get(lensId);
    if (!existing) {
      return null;
    }
    if (
      detail.toolCallId &&
      existing.tools.runs.some((run) => run.toolCallId === detail.toolCallId)
    ) {
      return cloneLens(existing);
    }
    const now = Date.now();
    const called = existing.tools.called.includes(toolName)
      ? existing.tools.called
      : [...existing.tools.called, toolName];
    const callIndex = existing.tools.callCount + 1;
    return update(lensId, {
      tools: {
        ...existing.tools,
        called,
        callCount: callIndex,
        lastStartedAt: now,
        runs: [
          ...existing.tools.runs,
          {
            id: detail.toolCallId ?? `${toolName}-${callIndex}`,
            ...(detail.toolCallId ? { toolCallId: detail.toolCallId } : {}),
            callIndex,
            name: toolName,
            ...(detail.phase ? { phase: detail.phase } : {}),
            startedAt: now,
            completedAt: null,
            durationMs: null,
            status: 'running',
            ...(detail.argumentSummary
              ? { argumentSummary: detail.argumentSummary }
              : {}),
            ...(detail.argumentDetail
              ? { argumentDetail: detail.argumentDetail }
              : {}),
          },
        ],
      },
      lifecycle: {
        ...existing.lifecycle,
        firstToolStartedAt: existing.lifecycle.firstToolStartedAt ?? now,
      },
    });
  };

  const completeOpenToolRuns = (
    lensId: string | null | undefined,
    status: ContextLensToolRun['status'] = 'completed',
    error?: unknown
  ) => {
    if (!lensId) {
      return null;
    }
    const existing = lenses.get(lensId);
    if (!existing) {
      return null;
    }
    const now = Date.now();
    const runs = existing.tools.runs.map((run) =>
      run.completedAt
        ? run
        : {
            ...run,
            completedAt: now,
            durationMs: now - run.startedAt,
            status,
            ...(error === undefined ? {} : { error: serializeError(error) }),
          }
    );
    const completedRuns = runs.filter(
      (run, index) =>
        !existing.tools.runs[index]?.completedAt && run.completedAt
    );
    return update(lensId, {
      tools: {
        ...existing.tools,
        runs,
      },
      activity: reconcileCompletedToolActivity(
        existing.activity ?? emptyContextLensActivity(),
        completedRuns,
        now
      ),
    });
  };

  const completeToolRun = (
    lensId: string | null | undefined,
    toolName: string,
    detail: {
      durationMs?: number;
      error?: unknown;
      resultSummary?: string;
      status?: ContextLensToolRun['status'];
      toolCallId?: string;
    } = {}
  ) => {
    if (!lensId || !toolName) {
      return null;
    }
    const existing = lenses.get(lensId);
    if (!existing) {
      return null;
    }
    const now = Date.now();
    let completed = false;
    const hasToolCallIdMatch = detail.toolCallId
      ? existing.tools.runs.some(
          (run) => !run.completedAt && run.toolCallId === detail.toolCallId
        )
      : false;
    const runs = existing.tools.runs.map((run) => {
      const matchesToolCallId =
        hasToolCallIdMatch && run.toolCallId === detail.toolCallId;
      const matchesFallbackName = !hasToolCallIdMatch && run.name === toolName;
      if (
        completed ||
        run.completedAt ||
        (!matchesToolCallId && !matchesFallbackName)
      ) {
        return run;
      }
      completed = true;
      const durationMs =
        typeof detail.durationMs === 'number'
          ? detail.durationMs
          : now - run.startedAt;
      const status: ContextLensToolRun['status'] =
        detail.status ?? (detail.error === undefined ? 'completed' : 'error');
      return {
        ...run,
        completedAt: now,
        durationMs,
        status,
        ...(detail.resultSummary
          ? { resultSummary: detail.resultSummary }
          : {}),
        ...(detail.error === undefined
          ? {}
          : { error: serializeError(detail.error) }),
      };
    });
    if (!completed) {
      return null;
    }
    const nextStatus =
      existing.status === 'tool_running' &&
      !runs.some((run) => run.status === 'running')
        ? 'dispatching'
        : existing.status;
    return update(lensId, {
      status: nextStatus,
      tools: {
        ...existing.tools,
        runs,
      },
      activity: reconcileCompletedToolActivity(
        existing.activity ?? emptyContextLensActivity(),
        runs.filter(
          (run, index) =>
            !existing.tools.runs[index]?.completedAt && Boolean(run.completedAt)
        ),
        now
      ),
    });
  };

  const recordOutput = (
    lensId: string | null | undefined,
    output: ContextLensOutput
  ) => {
    if (!lensId) {
      return null;
    }
    const existing = lenses.get(lensId);
    if (!existing) {
      return null;
    }
    return update(lensId, {
      outputs: [...existing.outputs, output],
    });
  };

  const recordActivity = (
    lensId: string | null | undefined,
    event: ContextLensActivityEvent
  ) => {
    if (!lensId) {
      return null;
    }
    const existing = lenses.get(lensId);
    if (!existing) {
      return null;
    }
    return update(lensId, {
      activity: foldContextLensActivity(
        existing.activity ?? emptyContextLensActivity(),
        event
      ),
    });
  };

  return {
    create,
    update,
    setStatus,
    recordContext,
    recordContextSource,
    recordPersistence,
    recordPersistenceEvent,
    recordLifecycle,
    recordToolCall,
    completeToolRun,
    completeOpenToolRuns,
    recordOutput,
    recordActivity,
    get: (lensId: string) => {
      prune();
      const lens = lenses.get(lensId);
      return lens ? cloneLens(lens) : null;
    },
    listRecent: () => {
      prune();
      return [...lenses.values()]
        .toSorted((a, b) => b.createdAt - a.createdAt)
        .map(cloneLens);
    },
    destroy: (lensId: string) => lenses.delete(lensId),
    clear: () => lenses.clear(),
    prune,
  };
}

export type ContextLensSessionKeys =
  | string
  | readonly string[]
  | null
  | undefined;

function normalizeSessionKeys(sessionKeys: ContextLensSessionKeys): string[] {
  const list =
    typeof sessionKeys === 'string' ? [sessionKeys] : sessionKeys ?? [];
  return [
    ...new Set(list.map((key) => key.trim()).filter((key) => key.length > 0)),
  ];
}

/**
 * Hook session keys can differ from the bound key in two ways: core hands
 * tool hooks the per-peer key form regardless of the configured dmScope
 * (callers bind under every form to cover that), and thread sessions append
 * a `:thread:<id>` suffix that was never bound. Fall back to the thread's
 * parent key on a miss.
 */
function resolveActiveBinding(
  sessionKey: string | null | undefined
): { key: string; binding: ActiveContextLensBinding } | null {
  const key = sessionKey?.trim();
  if (!key) {
    return null;
  }
  const direct = activeLensesBySession.get(key);
  if (direct) {
    return { key, binding: direct };
  }
  const threadIndex = key.indexOf(':thread:');
  if (threadIndex > 0) {
    const parentKey = key.slice(0, threadIndex);
    const binding = activeLensesBySession.get(parentKey);
    if (binding) {
      return { key: parentKey, binding };
    }
  }
  return null;
}

export function bindContextLensToSession(
  sessionKeys: ContextLensSessionKeys,
  registry: ContextLensRegistry,
  lensId: string
): void {
  for (const key of normalizeSessionKeys(sessionKeys)) {
    activeLensesBySession.set(key, { registry, lensId, background: false });
  }
}

export function bindContextLensToRun(
  runId: string | null | undefined,
  registry: ContextLensRegistry,
  lensId: string
): void {
  const key = runId?.trim();
  if (!key || !registry.get(lensId)) {
    return;
  }
  // An explicit dispatch binding is authoritative. Drop any earlier
  // session-promoted aliases (for example an automatic pre-compaction turn)
  // before binding the user-facing run.
  for (const [boundRunId, binding] of activeLensesByRun) {
    if (
      boundRunId !== key &&
      binding.registry === registry &&
      binding.lensId === lensId
    ) {
      activeLensesByRun.delete(boundRunId);
    }
  }
  activeLensesByRun.set(key, { registry, lensId, background: false });
  registry.update(lensId, { runId: key });
}

export function unbindContextLensFromRun(
  runId: string | null | undefined,
  lensId: string
): void {
  const key = runId?.trim();
  if (!key) {
    return;
  }
  const binding = activeLensesByRun.get(key);
  if (binding?.lensId !== lensId) {
    return;
  }
  // Session fallback can promote an early event to a run alias. Finalizing
  // the authoritative run must remove every alias for the same Lens.
  for (const [boundRunId, runBinding] of activeLensesByRun) {
    if (
      runBinding.registry === binding.registry &&
      runBinding.lensId === lensId
    ) {
      activeLensesByRun.delete(boundRunId);
    }
  }
}

/**
 * Attach a normalized agent event to its active Lens. The run id is
 * authoritative; session-key fallback covers the first event emitted before
 * an explicit run binding and then promotes that match for subsequent events.
 */
export function recordContextLensActivityForRun(
  runId: string,
  sessionKey: string | null | undefined,
  event: ContextLensActivityEvent
): ContextLens | null {
  let binding = activeLensesByRun.get(runId);
  if (!binding) {
    binding = resolveActiveBinding(sessionKey)?.binding;
    if (binding) {
      const lens = binding.registry.get(binding.lensId);
      // A session can emit auxiliary runs while its user-facing dispatch is
      // active (notably OpenClaw's pre-compaction memory flush). Once a Lens
      // has an explicit run id, session fallback must not let a distinct run
      // overwrite it or leak its maintenance activity into the chat receipt.
      if (!lens || (lens.runId && lens.runId !== runId)) {
        return null;
      }
      activeLensesByRun.set(runId, binding);
      if (!lens.runId) {
        binding.registry.update(binding.lensId, { runId });
      }
    }
  }
  if (!binding) {
    return null;
  }
  if (event.retention === 'ephemeral') {
    return binding.registry.get(binding.lensId);
  }
  // Use the registry's long-standing update() surface so a live binding
  // created by a pre-activity plugin module can survive a hot reload.
  const lens = binding.registry.get(binding.lensId);
  if (!lens) {
    return null;
  }
  if (
    event.source === 'codex-app-server-completion' &&
    !lens.activity?.items?.some((item) => item.id === event.itemId)
  ) {
    return null;
  }
  return binding.registry.update(binding.lensId, {
    activity: foldContextLensActivity(
      lens.activity ?? emptyContextLensActivity(),
      event
    ),
  });
}

export function unbindContextLensFromSession(
  sessionKeys: ContextLensSessionKeys,
  lensId: string
): void {
  for (const key of normalizeSessionKeys(sessionKeys)) {
    const binding = activeLensesBySession.get(key);
    if (binding?.lensId === lensId) {
      if (binding.finalizeTimer) {
        clearTimeout(binding.finalizeTimer);
      }
      activeLensesBySession.delete(key);
    }
  }
}

function getBackgroundContextLensRegistry(): ContextLensRegistry {
  const existing = backgroundContextLensesSlot.get();
  if (existing) {
    return existing;
  }
  const registry = createContextLensRegistry();
  backgroundContextLensesSlot.set(registry);
  return registry;
}

export function ensureBackgroundContextLensForSession(
  sessionKey: string | null | undefined,
  input: {
    runKind?: ContextLensRunKind;
    trigger?: ContextLensTrigger;
    preview?: string;
  } = {}
): { lens: ContextLens; created: boolean } | null {
  const key = sessionKey?.trim();
  if (!key) {
    return null;
  }
  const resolved = resolveActiveBinding(key);
  if (resolved) {
    const existing = resolved.binding;
    if (existing.finalizeTimer) {
      clearTimeout(existing.finalizeTimer);
      const cleared = { ...existing };
      delete cleared.finalizeTimer;
      activeLensesBySession.set(resolved.key, cleared);
    }
    const lens = existing.registry.get(existing.lensId);
    return lens ? { lens, created: false } : null;
  }

  const registry = getBackgroundContextLensRegistry();
  const sessionKeyHash = hashSessionKey(key);
  const runKind = input.runKind ?? 'internal';
  const lens = registry.create({
    messageId: `${runKind}:${sessionKeyHash}:${Date.now()}`,
    chatType: 'internal',
    runKind,
    visibility: 'owner',
    trigger: input.trigger ?? 'tool',
    sessionKey: key,
    conversationId: `session:${sessionKeyHash}`,
    receivedAt: Date.now(),
    preview: input.preview,
  });
  activeLensesBySession.set(key, {
    registry,
    lensId: lens.lensId,
    background: true,
  });
  return { lens, created: true };
}

/**
 * Most recently updated background lens that is still bound (not yet
 * finalized). Used by the outbound send path to stamp gateway-delivered
 * messages (cron announcements, CLI sends) with a lens pointer — those
 * sends carry no session context, so this correlation is best-effort:
 * the binding's bounded lifetime (finalized after a short idle window)
 * keeps stale matches out.
 */
export function getActiveBackgroundContextLens(): ContextLens | null {
  let best: ContextLens | null = null;
  for (const binding of activeLensesBySession.values()) {
    if (!binding.background) {
      continue;
    }
    const lens = binding.registry.get(binding.lensId);
    if (!lens) {
      continue;
    }
    if (!best || lens.updatedAt > best.updatedAt) {
      best = lens;
    }
  }
  return best;
}

/**
 * Active foreground (in-session) dispatch lens for a given conversation, if a
 * run is mid-dispatch for it. The outbound send path uses this to attribute
 * message-tool posts — replies the model issues by calling the `message` tool
 * itself, instead of emitting a normal final reply — to the run that produced
 * them, so a tool-only answer is not mislabeled `no_reply`. Matched on
 * conversationId (not recency) so concurrent runs in different conversations
 * stay correctly separated.
 */
export function getActiveForegroundContextLensForConversation(
  conversationId: string | null | undefined
): { registry: ContextLensRegistry; lensId: string } | null {
  const target = conversationId?.trim();
  if (!target) {
    return null;
  }
  let best: {
    registry: ContextLensRegistry;
    lensId: string;
    updatedAt: number;
  } | null = null;
  for (const binding of activeLensesBySession.values()) {
    if (binding.background) {
      continue;
    }
    const lens = binding.registry.get(binding.lensId);
    if (!lens || lens.triggerDetails.conversationId?.trim() !== target) {
      continue;
    }
    if (!best || lens.updatedAt > best.updatedAt) {
      best = {
        registry: binding.registry,
        lensId: binding.lensId,
        updatedAt: lens.updatedAt,
      };
    }
  }
  return best ? { registry: best.registry, lensId: best.lensId } : null;
}

export function recordBackgroundContextLensOutput(
  lensId: string,
  output: ContextLensOutput
): ContextLens | null {
  return getBackgroundContextLensRegistry().recordOutput(lensId, output);
}

export function recordContextLensToolStartForSession(
  sessionKey: string | null | undefined,
  toolName: string,
  detail: {
    phase?: string;
    argumentSummary?: string;
    argumentDetail?: string;
    toolCallId?: string;
  } = {}
): ContextLens | null {
  const binding = resolveActiveBinding(sessionKey)?.binding;
  if (!binding) {
    return null;
  }
  const lens = binding.registry.recordToolCall(
    binding.lensId,
    toolName,
    detail
  );
  if (!lens) {
    return null;
  }
  return binding.registry.setStatus(binding.lensId, 'tool_running');
}

export function recordContextLensToolResultForSession(
  sessionKey: string | null | undefined,
  toolName: string,
  detail: {
    durationMs?: number;
    error?: unknown;
    resultSummary?: string;
    status?: ContextLensToolRun['status'];
    toolCallId?: string;
  } = {}
): ContextLens | null {
  const binding = resolveActiveBinding(sessionKey)?.binding;
  if (!binding) {
    return null;
  }
  return binding.registry.completeToolRun(binding.lensId, toolName, detail);
}

export function finalizeBackgroundContextLensForSession(
  sessionKey: string | null | undefined
): ContextLens | null {
  const resolved = resolveActiveBinding(sessionKey);
  if (!resolved?.binding.background) {
    return null;
  }
  const { key, binding } = resolved;
  if (binding.finalizeTimer) {
    clearTimeout(binding.finalizeTimer);
  }
  const lens = binding.registry.get(binding.lensId);
  if (!lens || lens.tools.runs.some((run) => run.status === 'running')) {
    return null;
  }
  const completedAt = Date.now();
  binding.registry.recordLifecycle(binding.lensId, {
    completedAt,
    durationMs: completedAt - lens.createdAt,
    deliveredMessageCount: 0,
  });
  const completed = binding.registry.setStatus(binding.lensId, 'completed');
  activeLensesBySession.delete(key);
  for (const [runId, runBinding] of activeLensesByRun) {
    if (
      runBinding.registry === binding.registry &&
      runBinding.lensId === binding.lensId
    ) {
      activeLensesByRun.delete(runId);
    }
  }
  return completed;
}

export function scheduleBackgroundContextLensFinalization(
  sessionKey: string | null | undefined,
  onFinalize: (lens: ContextLens) => void,
  idleMs = BACKGROUND_FINALIZE_IDLE_MS
): void {
  const resolved = resolveActiveBinding(sessionKey);
  if (!resolved?.binding.background) {
    return;
  }
  const { key, binding } = resolved;
  if (binding.finalizeTimer) {
    clearTimeout(binding.finalizeTimer);
  }
  const finalizeTimer = setTimeout(() => {
    const finalLens = finalizeBackgroundContextLensForSession(key);
    if (finalLens) {
      onFinalize(finalLens);
    }
  }, idleMs);
  activeLensesBySession.set(key, { ...binding, finalizeTimer });
}
