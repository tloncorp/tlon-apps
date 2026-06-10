export type ContextLensStatus =
  | 'assembling'
  | 'queued'
  | 'dispatching'
  | 'tool_running'
  | 'delivering'
  | 'completed'
  | 'no_reply'
  | 'timed_out'
  | 'error';

export type ContextLens = {
  lensId: string;
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
  model: string | null;
  provider: string | null;
  status: ContextLensStatus;
  error: string | null;
  createdAt: number;
  updatedAt: number;
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
  lifecycle: {
    queuedMs: number;
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
  callIndex: number;
  name: string;
  phase?: string;
  startedAt: number;
  completedAt: number | null;
  durationMs: number | null;
  status: 'running' | 'completed' | 'error' | 'blocked';
  argumentSummary?: string;
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
  status: LensStreamStatus;
};

export const FINAL_STATUSES = new Set<ContextLensStatus>([
  'completed',
  'no_reply',
  'timed_out',
  'error',
]);

export function isContextLensEventActive(event: ContextLensEvent) {
  return !FINAL_STATUSES.has(event.lens.status);
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
