import { createHash, randomUUID } from 'node:crypto';

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
  // Degraded provenance survives retry chains: a retry of a degraded run
  // seeds a new lens, but its threading metadata is still untrustworthy.
  degraded?: boolean;
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

/**
 * The cron job behind a cron run, so the owner's ship can list one task's
 * runs. A test run is one the owner asked for outside the schedule: it
 * delivers nowhere, so its reply is kept here as `output`.
 */
export type ContextLensCron = {
  jobId: string;
  test?: boolean;
  output?: string;
  /** The host's verdict on a scheduled run, from cron_changed `finished`. */
  outcome?: {
    status: 'ok' | 'error' | 'skipped';
    error?: string;
    summary?: string;
    delivered?: boolean;
    deliveryStatus?: string;
    deliveryError?: string;
    /**
     * The run's last reply was NO_REPLY, seen as the agent ended: the
     * evidence of a deliberate silence when the host's summary is empty.
     */
    silent?: boolean;
  };
};

export type ContextLens = {
  lensId: string;
  messageId: string;
  sessionKeyHash: string | null;
  chatType: 'dm' | 'channel' | 'internal';
  runKind: ContextLensRunKind;
  visibility: ContextLensVisibility;
  trigger: ContextLensTrigger;
  triggerDetails: ContextLensTriggerDetails;
  cron?: ContextLensCron;
  /** lensId of the run this one retries, when trigger is "retry". */
  retryOf?: string;
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
  runKind?: ContextLensRunKind;
  visibility?: ContextLensVisibility;
  trigger?: ContextLensTrigger;
  sessionKey?: string | null;
  senderShip?: string;
  conversationId?: string;
  receivedAt?: number;
  preview?: string;
  retryOf?: string;
  retrySeed?: ContextLensRetrySeed;
  cron?: ContextLensCron;
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
    'context' | 'persistence' | 'tools' | 'triggerDetails' | 'lifecycle'
  >
> & {
  context?: Partial<ContextLens['context']>;
  persistence?: Partial<ContextLens['persistence']>;
  tools?: Partial<ContextLens['tools']>;
  triggerDetails?: Partial<ContextLens['triggerDetails']>;
  lifecycle?: Partial<ContextLens['lifecycle']>;
};

export type ContextLensRegistry = ReturnType<typeof createContextLensRegistry>;

type ActiveContextLensBinding = {
  registry: ContextLensRegistry;
  lensId: string;
  background: boolean;
  finalizeTimer?: ReturnType<typeof setTimeout>;
  /** The host run a cron lens records, to tell its runs on one session apart. */
  cronRunId?: string;
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

function cloneLens(lens: ContextLens): ContextLens {
  return {
    ...lens,
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
    lifecycle: { ...lens.lifecycle },
    triggerDetails: { ...lens.triggerDetails },
    ...(lens.retrySeed ? { retrySeed: { ...lens.retrySeed } } : {}),
    ...(lens.cron
      ? {
          cron: {
            ...lens.cron,
            ...(lens.cron.outcome ? { outcome: { ...lens.cron.outcome } } : {}),
          },
        }
      : {}),
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
  /** True when threading metadata is untrustworthy: the run predates
   *  retrySeed, or it retries a run that was itself degraded. */
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
      degraded: seed?.degraded ?? !seed,
    },
  };
}

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name;
  }
  return String(error);
}

export function createContextLensRegistry(
  opts: {
    ttlMs?: number;
    maxEntries?: number;
    visibilityDefault?: ContextLensVisibility;
    disabled?: boolean;
  } = {}
) {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = opts.maxEntries ?? MAX_LENSES;
  const visibilityDefault = opts.visibilityDefault ?? 'owner';
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
      ...(input.retrySeed ? { retrySeed: capRetrySeed(input.retrySeed) } : {}),
      ...(input.cron ? { cron: { ...input.cron } } : {}),
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
  ) =>
    update(lensId, {
      status,
      ...(error === undefined ? {} : { error: serializeError(error) }),
    });

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
    return update(lensId, {
      tools: {
        ...existing.tools,
        runs: existing.tools.runs.map((run) =>
          run.completedAt
            ? run
            : {
                ...run,
                completedAt: now,
                durationMs: now - run.startedAt,
                status,
                ...(error === undefined
                  ? {}
                  : { error: serializeError(error) }),
              }
        ),
      },
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
    typeof sessionKeys === 'string' ? [sessionKeys] : (sessionKeys ?? []);
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

// Scheduled cron runs still waiting for the host's verdict. The verdict
// arrives after the agent ends, when the idle window may already have
// unbound the run's lens, and runs sharing a session can follow one another
// before it does. A verdict finds its run by the host's run or session id,
// else as its job's oldest run still waiting: the host never runs one job
// twice at once, so one job's verdicts arrive in the order its runs started.
const pendingCronLensesByJob = sharedMap<string, string[]>(
  'contextLens.pendingCronLensesByJob'
);
const pendingCronLensByRun = sharedMap<string, string>(
  'contextLens.pendingCronLensByRun'
);
const MAX_PENDING_CRON_JOBS = 256;
const MAX_PENDING_CRON_RUNS_PER_JOB = 8;
const MAX_PENDING_CRON_RUN_IDS = 1_024;

function trimOldest<K, V>(map: Map<K, V>, max: number) {
  while (map.size > max) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    map.delete(oldest);
  }
}

function rememberCronLens(
  jobId: string,
  lensId: string,
  runIds: (string | undefined)[] = []
) {
  const queue = (pendingCronLensesByJob.get(jobId) ?? []).filter(
    (pending) => pending !== lensId
  );
  queue.push(lensId);
  pendingCronLensesByJob.delete(jobId);
  pendingCronLensesByJob.set(
    jobId,
    queue.slice(-MAX_PENDING_CRON_RUNS_PER_JOB)
  );
  trimOldest(pendingCronLensesByJob, MAX_PENDING_CRON_JOBS);
  for (const runId of runIds) {
    if (runId) {
      pendingCronLensByRun.delete(runId);
      pendingCronLensByRun.set(runId, lensId);
    }
  }
  trimOldest(pendingCronLensByRun, MAX_PENDING_CRON_RUN_IDS);
}

function forgetCronLens(jobId: string, lensId: string) {
  const queue = pendingCronLensesByJob
    .get(jobId)
    ?.filter((pending) => pending !== lensId);
  if (queue?.length) {
    pendingCronLensesByJob.set(jobId, queue);
  } else {
    pendingCronLensesByJob.delete(jobId);
  }
  for (const [runId, pending] of pendingCronLensByRun) {
    if (pending === lensId) {
      pendingCronLensByRun.delete(runId);
    }
  }
}

export function ensureBackgroundContextLensForSession(
  sessionKey: string | null | undefined,
  input: {
    chatType?: Extract<ContextLens['chatType'], 'channel' | 'internal'>;
    conversationId?: string;
    runKind?: ContextLensRunKind;
    trigger?: ContextLensTrigger;
    preview?: string;
    cron?: ContextLensCron;
    /** The host's ids for the cron run, when the hook has them. */
    runId?: string;
    runSessionId?: string;
    /** How long the lens outlives its creation; the registry default if unset. */
    ttlMs?: number;
  } = {}
): {
  lens: ContextLens;
  created: boolean;
  /** A cron lens finished because another run took over its session. */
  superseded?: ContextLens;
} | null {
  const key = sessionKey?.trim();
  if (!key) {
    return null;
  }
  const resolved = resolveActiveBinding(key);
  // Cron jobs that share a session, as main-session jobs do, can follow one
  // another before the first one's verdict arrives. A different job, or
  // another run of the same one, gets a lens of its own: the one before it
  // is finished here, and its verdict still finds it as its job's last run.
  const boundCron = resolved
    ? resolved.binding.registry.get(resolved.binding.lensId)?.cron
    : undefined;
  const anotherRun =
    resolved &&
    input.cron &&
    boundCron &&
    (boundCron.jobId !== input.cron.jobId ||
      (input.runId !== undefined &&
        resolved.binding.cronRunId !== undefined &&
        input.runId !== resolved.binding.cronRunId));
  const superseded = anotherRun
    ? (finishBackgroundContextLens(resolved.binding.lensId, {
        status: 'completed',
      }) ?? undefined)
    : undefined;
  if (resolved && !anotherRun) {
    const existing = resolved.binding;
    if (existing.finalizeTimer) {
      clearTimeout(existing.finalizeTimer);
      const cleared = { ...existing };
      delete cleared.finalizeTimer;
      activeLensesBySession.set(resolved.key, cleared);
    }
    const current = existing.registry.get(existing.lensId);
    const attributed =
      current && input.cron && !current.cron
        ? existing.registry.update(existing.lensId, { cron: input.cron })
        : current;
    if (attributed?.cron && input.cron && !input.cron.test) {
      // Attributed now, or already: either way the run's ids may be new.
      rememberCronLens(attributed.cron.jobId, attributed.lensId, [
        input.runId,
        input.runSessionId,
      ]);
    }
    if (input.runId && input.cron && !existing.cronRunId) {
      const bound = activeLensesBySession.get(resolved.key);
      if (bound) {
        activeLensesBySession.set(resolved.key, {
          ...bound,
          cronRunId: input.runId,
        });
      }
    }
    const lens =
      attributed &&
      input.chatType === 'channel' &&
      input.conversationId?.trim() &&
      attributed.chatType === 'internal'
        ? existing.registry.update(existing.lensId, {
            chatType: 'channel',
            triggerDetails: {
              conversationId: input.conversationId.trim(),
              conversationKind: 'channel',
            },
          })
        : attributed;
    return lens ? { lens, created: false } : null;
  }

  const registry = getBackgroundContextLensRegistry();
  const sessionKeyHash = hashSessionKey(key);
  const runKind = input.runKind ?? 'internal';
  const chatType = input.chatType ?? 'internal';
  const lens = registry.create({
    messageId: `${runKind}:${sessionKeyHash}:${Date.now()}`,
    chatType,
    runKind,
    visibility: 'owner',
    trigger: input.trigger ?? 'tool',
    sessionKey: key,
    conversationId: input.conversationId?.trim() || `session:${sessionKeyHash}`,
    receivedAt: Date.now(),
    preview: input.preview,
    cron: input.cron,
    ...(input.ttlMs ? { ttlMs: input.ttlMs } : {}),
  });
  activeLensesBySession.set(key, {
    registry,
    lensId: lens.lensId,
    background: true,
    ...(input.cron && input.runId ? { cronRunId: input.runId } : {}),
  });
  if (input.cron && !input.cron.test) {
    rememberCronLens(input.cron.jobId, lens.lensId, [
      input.runId,
      input.runSessionId,
    ]);
  }
  return { lens, created: true, ...(superseded ? { superseded } : {}) };
}

/**
 * Finish a background lens now rather than after the idle window: unbind it
 * from its session, stamp its duration, and set its final status. Works on a
 * lens the idle window already finalized, so a late verdict still lands.
 */
export function finishBackgroundContextLens(
  lensId: string,
  finish: {
    status: ContextLensStatus;
    error?: string | null;
    cron?: Partial<ContextLensCron>;
  }
): ContextLens | null {
  const registry = getBackgroundContextLensRegistry();
  const lens = registry.get(lensId);
  if (!lens) {
    return null;
  }
  for (const [key, binding] of activeLensesBySession) {
    if (binding.background && binding.lensId === lensId) {
      if (binding.finalizeTimer) {
        clearTimeout(binding.finalizeTimer);
      }
      activeLensesBySession.delete(key);
    }
  }
  const completedAt = lens.lifecycle.completedAt ?? Date.now();
  return registry.update(lensId, {
    status: finish.status,
    ...(finish.error === undefined ? {} : { error: finish.error }),
    ...(lens.cron && finish.cron
      ? { cron: { ...lens.cron, ...finish.cron } }
      : {}),
    lifecycle: { completedAt, durationMs: completedAt - lens.createdAt },
  });
}

/**
 * A successful run that chose to say nothing: the host reports it as not
 * delivered, with no error, and either its summary is NO_REPLY or, the host
 * having stripped the token, it is empty and the plugin saw the silent reply
 * itself. The same test the plugin's cron telemetry uses for intentional
 * silence; an unexplained non-delivery is a failure.
 */
function isSilentCronOutcome(
  outcome: NonNullable<ContextLensCron['outcome']>
): boolean {
  const summary = outcome.summary?.trim();
  return (
    outcome.status === 'ok' &&
    outcome.deliveryStatus === 'not-delivered' &&
    !outcome.error?.trim() &&
    !outcome.deliveryError?.trim() &&
    (summary?.toUpperCase() === 'NO_REPLY' ||
      (!summary && outcome.silent === true))
  );
}

/**
 * Record the host's verdict on a scheduled cron run and finish its lens.
 * The run is found among its job's runs still waiting for a verdict, by the
 * host's run or session id, else as the oldest of them. Each run takes one
 * verdict, so a later run that failed before it reached the agent, and has
 * no lens of its own, finds nothing to overwrite. Returns the finished lens
 * to publish, or null when there is no lens for the run.
 */
export function recordCronRunOutcome(params: {
  jobId: string;
  runId?: string;
  runSessionId?: string;
  outcome: NonNullable<ContextLensCron['outcome']>;
}): ContextLens | null {
  const registry = getBackgroundContextLensRegistry();
  const byRun = [params.runId, params.runSessionId]
    .map((runId) => (runId ? pendingCronLensByRun.get(runId) : undefined))
    .find((lensId) => lensId !== undefined);
  const candidates = [
    ...(byRun ? [byRun] : []),
    ...(pendingCronLensesByJob.get(params.jobId) ?? []),
  ];
  let lens: ContextLens | null = null;
  for (const lensId of candidates) {
    const candidate = registry.get(lensId);
    if (
      candidate?.cron &&
      candidate.cron.jobId === params.jobId &&
      !candidate.cron.test &&
      !candidate.cron.outcome
    ) {
      lens = candidate;
      break;
    }
    // Expired, or not a run of this job waiting for a verdict.
    if (!candidate?.cron || candidate.cron.outcome) {
      forgetCronLens(params.jobId, lensId);
    }
  }
  if (!lens) {
    return null;
  }
  const { lensId } = lens;
  forgetCronLens(params.jobId, lensId);
  const { status, error } = params.outcome;
  return finishBackgroundContextLens(lensId, {
    status:
      status === 'error'
        ? 'error'
        : status === 'skipped' || isSilentCronOutcome(params.outcome)
          ? 'no_reply'
          : 'completed',
    ...(status === 'error' ? { error: error ?? lens.error } : {}),
    cron: { outcome: params.outcome },
  });
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
