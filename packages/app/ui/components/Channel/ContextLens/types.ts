import { preSig } from '@tloncorp/api/lib/urbit';
import type {
  ContextLensActivity,
  ContextLensActivityEvent,
} from '@tloncorp/api/urbit/lens';

export type {
  ContextLensActivity,
  ContextLensActivityEvent,
  ContextLensActivityItem,
  ContextLensActivityKind,
  ContextLensActivityPlan,
  ContextLensActivityPlanStep,
  ContextLensActivityStatus,
} from '@tloncorp/api/urbit/lens';

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

export type ContextLens = {
  lensId: string;
  /** Ship running this agent; absent on records created before schema v1. */
  botShip?: string | null;
  runId?: string | null;
  messageId: string;
  sessionKeyHash?: string | null;
  chatType: 'dm' | 'channel' | 'internal';
  runKind?:
    | 'conversation'
    | 'cron'
    | 'owner_listen'
    | 'summarization'
    | 'internal';
  visibility?: 'owner' | 'participants' | 'internal';
  trigger: string;
  triggerDetails?: {
    type: string;
    messageId: string;
    authorShip?: string;
    conversationId?: string;
    conversationKind: 'dm' | 'channel' | 'internal';
    receivedAt?: number;
    preview?: string;
  };
  /** lensId of the run this one retries, when trigger is "retry". */
  retryOf?: string;
  /**
   * Typed lineage for work that resumes after the requester answers a
   * required-input gate. This is intentionally structural: chat must never
   * infer continuation from reply prose.
   */
  continuation?: {
    kind: 'request_input';
    parentLensId: string;
    requestInputId: string;
    workflowId: string;
    linkedAt: number;
  };
  model: string | null;
  provider: string | null;
  status: ContextLensStatus;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  context: {
    currentMessage: boolean;
    threadMessages: number;
    channelMessages: number;
    citedPosts: number;
    attachments: number;
    pendingNudge: boolean;
    sources?: ContextLensSource[];
  };
  persistence: {
    postsReply: boolean;
    updatesSettings: boolean;
    writesMedia: boolean;
    emitsTelemetry: boolean;
    cachesHistory: boolean;
    events?: ContextLensPersistenceEvent[];
  };
  tools: {
    ownerOnlyAvailable: string[];
    called: string[];
    callCount: number;
    lastStartedAt: number | null;
    runs?: ContextLensToolRun[];
  };
  outputs?: ContextLensOutput[];
  activity?: ContextLensActivity;
  lifecycle: {
    queuedMs: number;
    /** Agent dispatch start; absent on Lens records from older gateways. */
    dispatchStartedAt?: number | null;
    durationMs: number | null;
    timeoutMs: number | null;
    timedOut: boolean;
    deliveredMessageCount: number;
    queuedFinal: boolean;
    queuedFinalCount: number;
    queuedBlockCount: number;
  };
};

export type ContextLensSource = {
  kind: 'message' | 'memory' | 'identity' | 'system' | 'tool_result' | 'other';
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

export type ContextLensEvent = {
  seq: number;
  at: number;
  phase: string;
  lens: ContextLens;
  detail?: {
    toolName?: string;
    toolPhase?: string;
    toolCallCount?: number;
    activity?: ContextLensActivityEvent;
  };
};

export type ContextLensSelectedMessage = {
  id: string;
  authorId?: string | null;
  channelId?: string | null;
  lensId?: string | null;
  botShip?: string | null;
};

export type LensStreamStatus =
  | 'disabled'
  | 'connecting'
  | 'connected'
  | 'offline';

export type LensStreamState = {
  events: ContextLensEvent[];
  /** Exact gateway events before local expiry and durable-store projection. */
  rawEvents: ContextLensEvent[];
  status: LensStreamStatus;
};

export const FINAL_STATUSES = new Set<ContextLensStatus>([
  'completed',
  'no_reply',
  'timed_out',
  'aborted',
  'error',
]);

export function isContextLensEventActive(event: ContextLensEvent) {
  return !FINAL_STATUSES.has(event.lens.status);
}

/** Project an in-flight snapshot at a wall-clock instant. */
export function contextLensEventAtTime(
  event: ContextLensEvent,
  now = Date.now(),
  stalePhase = 'stale'
): ContextLensEvent {
  const expiresAt = event.lens.expiresAt;
  if (
    FINAL_STATUSES.has(event.lens.status) ||
    typeof expiresAt !== 'number' ||
    expiresAt > now
  ) {
    return event;
  }
  return {
    ...event,
    phase: stalePhase,
    lens: {
      ...event.lens,
      status: 'aborted',
      error: event.lens.error ?? 'Run expired before a terminal update.',
      updatedAt: Math.max(event.lens.updatedAt, expiresAt),
    },
  };
}

/**
 * Extract the lens snapshot from a %context-lens run record payload (the gateway
 * pokes `{ schemaVersion: 1, lens }`; tool summaries may be truncated).
 */
export function lensFromRunPayload(payload: unknown): ContextLens | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const record = payload as { schemaVersion?: unknown; lens?: unknown };
  if (record.schemaVersion !== 1 || !record.lens) {
    return null;
  }
  const lens = record.lens as ContextLens;
  if (typeof lens.lensId !== 'string' || typeof lens.status !== 'string') {
    return null;
  }
  return lens;
}

/** Convert one locally synced %steward row into the same event shape as SSE. */
export function contextLensEventFromStewardRun(
  run: {
    botShip: string;
    complete?: boolean;
    receivedAt: number;
    payload?: unknown;
  },
  now = Date.now()
): ContextLensEvent | null {
  const lens = lensFromRunPayload(run.payload);
  if (!lens) {
    return null;
  }
  const complete = run.complete === true;
  const event: ContextLensEvent = {
    seq: 0,
    at: run.receivedAt,
    phase: complete ? 'steward-final' : 'steward',
    lens: {
      ...lens,
      botShip: lens.botShip ?? preSig(run.botShip),
    },
  };
  return complete ? event : contextLensEventAtTime(event, now, 'steward-stale');
}
