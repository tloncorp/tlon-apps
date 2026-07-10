import type { RuntimeEnv } from 'openclaw/plugin-sdk/runtime';
import { PostHog } from 'posthog-node';

import { sharedMap, sharedSlot } from './shared-state.js';
import type {
  TlonChannelKind,
  TlonProfileUpdateField,
  TlonToolCallContext,
} from './tlon-tool-command.js';
import type { TlonTelemetryConfig } from './types.js';
import { getTlonVersionIdentity } from './version.js';

type ToolCallRecord = {
  toolName: string;
  durationMs: number | null;
  error: string | null;
  context: ToolCallContext | null;
  recordedAt: number;
};

type ToolSessionTrace = {
  updatedAt: number;
  calls: ToolCallRecord[];
};

type HarnessDebugSnapshotRecord = {
  updatedAt: number;
  debugSequence: number;
  lastHarnessEventType: string | null;
  lastHarnessEventAt: number | null;
  lastHarnessEventRunId: string | null;
  lastHarnessEventPhase: string | null;
  lastHarnessEventOutcome: string | null;
  lastHarnessProvider: string | null;
  lastHarnessModel: string | null;
  runStartedSeen: boolean;
  contextAssembledSeen: boolean;
  modelCallStartedSeen: boolean;
  harnessRunStartedSeen: boolean;
  toolExecutionStartedSeen: boolean;
  lastContextEngineEvent: string | null;
  lastContextEngineEventAt: number | null;
  lastContextEngineTaskId: string | null;
  lastContextEngineOperation: string | null;
  lastContextEngineLane: string | null;
  lastContextEngineMessage: string | null;
};

type CronRunAttributionRecord = {
  // Run ids observed to belong to a cron run in this session, mapped to their
  // cron job id (null when the gateway did not expose one). Matching by run id
  // prevents a later interactive run in the same main session from inheriting
  // cron attribution.
  runIds: Map<string, string | null>;
  // The cron hook can fire before a run id is assigned. Preserve that signal
  // so a run-id-less failure in the same session can still be attributed.
  sawCronWithoutRunId: boolean;
  // Job id from this record's latest run-id-less cron signal. Reset even when
  // the signal omits a job id so an earlier run's id cannot bleed forward.
  runlessJobId: string | null;
  updatedAt: number;
};

type CronRunAttribution = { cronJobId: string | null };

export type TlonHarnessName = 'openclaw' | 'hermes';
type ReplyDispatchKind = 'tool' | 'block' | 'final';
type ReplyDispatchCounts = Partial<Record<ReplyDispatchKind, number>>;
type TlonDestinationKind = 'dm' | 'groupChannel';

type TlonSessionTelemetryContext = {
  sessionKey: string;
  sessionId: string | null;
  runId: string | null;
  ownerShip: string | null;
  botShip: string;
  accountId: string | null;
  agentId: string | null;
  destinationKind: TlonDestinationKind;
  updatedAt: number;
};

export type ToolCallContext = TlonToolCallContext;

export type ToolUsageSummary = {
  calls: Array<{
    toolName: string;
    durationMs: number | null;
    error: string | null;
    summaryKey: string | null;
  }>;
  names: string[];
  totalDurationMs: number;
  errorCount: number;
  tlonToolCallCount: number;
  tlonSummaryKeys: string[];
  tlonChannelKinds: TlonChannelKind[];
  tlonUpdateFields: TlonProfileUpdateField[];
};

export type TlonHeartbeatNudgeEvent = {
  ownerShip: string;
  botShip: string;
  nudgeStage: 1 | 2 | 3;
  nudgeTarget: string;
  channel: string;
  success: boolean;
  accountId: string | null;
  /**
   * Canonical DM message id constructed by `sendDmWithStory` as
   * `${fromShip}/${formatSentAt(sentAt)}`. Populated only when the send
   * succeeded; `null` on send failure. Joined to Homestead's
   * `Tapped DM Push Notification` event by exact `messageId` to compute
   * the TLON-5728 nudge → tap funnel.
   */
  messageId: string | null;
  /**
   * Unix ms timestamp the send-side `Date.now()` used to construct
   * `messageId`. Populated only when the send succeeded; `null` on send
   * failure. Carried as a sibling field so downstream HogQL queries can
   * compute a `delayMs` without parsing the id.
   */
  nudgeSentAtMs: number | null;
};

export type TlonHeartbeatReengagementEvent = {
  ownerShip: string;
  botShip: string;
  nudgeStage: 1 | 2 | 3;
  nudgeSentAt: number;
  reengagedAt: number;
  reengagementDelayMs: number;
  channel: string;
  accountId: string | null;
};

export type TlonReplyOutcome = 'responded' | 'no_reply' | 'error' | 'abandoned';
export type TlonDeliverySkipReason =
  | 'empty'
  | 'silent'
  | 'heartbeat'
  | 'empty_payload_text'
  | 'block_directive_only'
  | 'media_only_payload_not_sent'
  | 'source_reply_delivery_mode_message_tool_only';

export type TlonReplyOutcomeEvent = {
  sessionKey: string;
  sessionId: string | null;
  runId: string | null;
  accountId: string | null;
  agentId: string | null;
  ownerShip: string | null;
  botShip: string;
  outcome: TlonReplyOutcome;
  chatType: 'dm' | 'groupChannel';
  destinationKind: TlonDestinationKind;
  isThreadReply: boolean;
  senderRole: 'owner' | 'user';
  attachmentCount: number;
  sendAttemptCount: number;
  sendError: boolean;
  sendErrorCount: number;
  sendErrorKind: string | null;
  deliveredMessageCount: number;
  replyCharCount: number;
  replyWordCount: number;
  replyMediaCount: number;
  dispatchDurationMs: number;
  queuedFinal: boolean;
  queuedFinalCount: number;
  queuedBlockCount: number;
  failedToolCount: number;
  failedBlockCount: number;
  failedFinalCount: number;
  failedReplyCount: number;
  deliverySkipReason: TlonDeliverySkipReason | null;
  sourceReplyDeliveryMode: string | null;
  beforeAgentRunBlocked: boolean;
  dispatchError: boolean;
  dispatchErrorKind: string | null;
  abandonedReason: string | null;
  provider: string | null;
  model: string | null;
  thinkLevel: string | null;
  toolUsage: ToolUsageSummary;
};

export type TlonReplyTelemetryStart = {
  sessionKey: string;
  sessionId?: string | null;
  runId?: string | null;
  accountId?: string | null;
  agentId?: string | null;
  ownerShip: string | null;
  botShip: string;
  chatType: 'dm' | 'groupChannel';
  destinationKind?: TlonDestinationKind;
  isThreadReply: boolean;
  senderRole: 'owner' | 'user';
  attachmentCount: number;
};

export type TlonGatewayConnectedEvent = {
  ownerShip: string | null;
  botShip: string;
  tlonSkillVersion: string;
  accountId: string | null;
  configured: boolean;
  watchedChannelCount: number;
  dmAllowlistCount: number;
  defaultAuthorizedShipsCount: number;
  pendingApprovalCount: number;
  autoDiscoverChannels: boolean;
  ownerListenEnabled: boolean;
};

export type TlonReplyTelemetryResult = {
  sendAttemptCount?: number;
  sendErrorCount?: number;
  sendErrorKind?: string | null;
  deliveredMessageCount: number;
  replyCharCount: number;
  replyWordCount: number;
  replyMediaCount: number;
  dispatchDurationMs: number;
  queuedFinal: boolean;
  queuedFinalCount: number;
  queuedBlockCount: number;
  failedCounts?: ReplyDispatchCounts;
  deliverySkipReason?: TlonDeliverySkipReason | null;
  sourceReplyDeliveryMode?: string | null;
  beforeAgentRunBlocked?: boolean;
  provider: string | null;
  model: string | null;
  thinkLevel: string | null;
  dispatchError?: unknown;
};

export interface TlonReplyTelemetrySession {
  capture(result: TlonReplyTelemetryResult): Promise<void>;
}

/**
 * One outbound send seen by OpenClaw's `message_sending` hook, tagged with which
 * channel it resolved to. This fires for both the primary streamed reply (which
 * resolves to `tlon`, so `routedToTlon: true`) and route-dependent sends (the
 * shared `message` tool, subagents — which can resolve elsewhere). So
 * `routedToTlon: false` is the meaningful signal: a send that went somewhere
 * users can't see (e.g. webchat) — the bug this tracks. The `true` events
 * include healthy primary replies, so prefer the off-Tlon count over a raw rate.
 */
export type TlonOutboundRouteEvent = {
  resolvedChannel: string;
  routedToTlon: boolean;
  targetKind: 'dm' | 'group' | 'unknown';
};

export type TlonSessionLifecycleEvent = {
  lifecycleEvent: 'session_start' | 'session_end';
  sessionKey: string;
  sessionId: string | null;
  accountId: string | null;
  agentId: string | null;
  ownerShip: string | null;
  botShip: string;
  destinationKind: TlonDestinationKind;
  reason: string | null;
  messageCount: number | null;
  durationMs: number | null;
  transcriptArchived: boolean | null;
  hasNextSession: boolean;
};

export type TlonHarnessDebugSnapshotFields = {
  harnessDebugSequence: number | null;
  lastHarnessEventType: string | null;
  lastHarnessEventAgeMs: number | null;
  lastHarnessEventRunId: string | null;
  lastHarnessEventPhase: string | null;
  lastHarnessEventOutcome: string | null;
  lastHarnessProvider: string | null;
  lastHarnessModel: string | null;
  runStartedSeen: boolean;
  contextAssembledSeen: boolean;
  modelCallStartedSeen: boolean;
  harnessRunStartedSeen: boolean;
  toolExecutionStartedSeen: boolean;
  lastContextEngineEvent: string | null;
  lastContextEngineEventAgeMs: number | null;
  lastContextEngineTaskId: string | null;
  lastContextEngineOperation: string | null;
  lastContextEngineLane: string | null;
  lastContextEngineMessage: string | null;
};

export type TlonDiagnosticLogAttributes = Record<
  string,
  string | number | boolean
>;

export type TlonSessionWatchdogEvent = TlonHarnessDebugSnapshotFields & {
  diagnosticType: 'session.stalled' | 'session.stuck';
  sessionKey: string;
  sessionId: string | null;
  accountId: string | null;
  agentId: string | null;
  ownerShip: string | null;
  botShip: string;
  destinationKind: TlonDestinationKind;
  state: string;
  ageMs: number;
  queueDepth: number | null;
  reason: string | null;
  classification: string;
  activeWorkKind: string | null;
  lastProgressAgeMs: number | null;
  lastProgressReason: string | null;
  activeToolName: string | null;
  activeToolAgeMs: number | null;
  terminalProgressStale: boolean;
};

export type TlonSessionRecoveryEvent = TlonHarnessDebugSnapshotFields & {
  diagnosticType: 'session.recovery.requested' | 'session.recovery.completed';
  sessionKey: string;
  sessionId: string | null;
  accountId: string | null;
  agentId: string | null;
  ownerShip: string | null;
  botShip: string;
  destinationKind: TlonDestinationKind;
  state: string;
  stateGeneration: number | null;
  ageMs: number;
  queueDepth: number | null;
  reason: string | null;
  activeWorkKind: string | null;
  allowActiveAbort: boolean;
  status: string | null;
  action: string | null;
  outcomeReason: string | null;
  released: number | null;
  stale: boolean;
};

export type TlonSessionTelemetryReport =
  | { kind: 'lifecycle'; event: TlonSessionLifecycleEvent }
  | { kind: 'watchdog'; event: TlonSessionWatchdogEvent }
  | { kind: 'recovery'; event: TlonSessionRecoveryEvent };

/**
 * Cron observability. Fed by the gateway-global `cron_changed` hook (see
 * src/cron-telemetry.ts), so events carry schedule metadata only — never the
 * job's prompt text (`payload.text`), an on-exit schedule's watched command/cwd,
 * or the run's output (`summary`).
 */
export type TlonCronScheduleFields = {
  scheduleKind: string | null;
  scheduleExpr: string | null;
  scheduleTz: string | null;
  scheduleEveryMs: number | null;
  scheduleAt: string | null;
};

export type TlonCronCountFields = {
  activeCronJobCount: number | null;
  totalCronJobCount: number | null;
};

export type TlonCronJobChangedEvent = TlonCronScheduleFields &
  TlonCronCountFields & {
    accountId: string | null;
    ownerShip: string | null;
    botShip: string;
    cronAction: 'added' | 'updated' | 'removed';
    jobId: string;
    jobName: string | null;
    agentId: string | null;
    enabled: boolean | null;
    wakeMode: string | null;
    payloadKind: string | null;
    sessionTargetKind: string | null;
  };

export type TlonCronRunEvent = TlonCronScheduleFields & {
  accountId: string | null;
  ownerShip: string | null;
  botShip: string;
  jobId: string;
  jobName: string | null;
  agentId: string | null;
  runId: string | null;
  status: string;
  cronError: string | null;
  durationMs: number | null;
  runAtMs: number | null;
  nextRunAtMs: number | null;
  delivered: boolean | null;
  deliveryStatus: string | null;
  deliveryError: string | null;
  model: string | null;
  provider: string | null;
  payloadKind: string | null;
  sessionTargetKind: string | null;
};

export type TlonCronSnapshotEvent = TlonCronCountFields & {
  accountId: string | null;
  ownerShip: string | null;
  botShip: string;
  scheduleKindCronCount: number | null;
  scheduleKindEveryCount: number | null;
  scheduleKindAtCount: number | null;
  scheduleKindOnExitCount: number | null;
};

export type TlonHarnessErrorScope =
  | 'harness'
  | 'model'
  | 'tool'
  | 'run'
  | 'runtime'
  | 'diagnostics'
  | 'payload'
  | 'message_delivery'
  | 'message_dispatch'
  | 'message_processing';

export type TlonHarnessErrorEvent = {
  harness: TlonHarnessName;
  harnessEventType: string;
  errorScope: TlonHarnessErrorScope;
  sessionKey: string | null;
  sessionId: string | null;
  runId: string | null;
  accountId: string | null;
  agentId: string | null;
  ownerShip: string | null;
  botShip: string;
  destinationKind: TlonDestinationKind | null;
  provider: string | null;
  model: string | null;
  toolName: string | null;
  phase: string | null;
  outcome: string | null;
  errorCategory: string | null;
  failureKind: string | null;
  durationMs: number | null;
  errorText: string | null;
  // Set only for model/harness/run failures positively correlated with a cron
  // run. These fields complement the authoritative `TlonBot Cron Run` event
  // with lower-level harness diagnostics.
  isCron: boolean;
  cronJobId: string | null;
};

export type TlonHarnessDebugEvent = TlonHarnessDebugSnapshotFields & {
  harness: TlonHarnessName;
  harnessEventType: string;
  debugEventKind: string;
  sessionKey: string;
  sessionId: string | null;
  runId: string | null;
  accountId: string | null;
  agentId: string | null;
  ownerShip: string | null;
  botShip: string;
  destinationKind: TlonDestinationKind;
  provider: string | null;
  model: string | null;
  phase: string | null;
  outcome: string | null;
  durationMs: number | null;
  toolName: string | null;
  toolCallId: string | null;
  toolSource: string | null;
  toolOwner: string | null;
  pluginId: string | null;
  harnessId: string | null;
  modelCallId: string | null;
  modelApi: string | null;
  modelTransport: string | null;
  requestPayloadBytes: number | null;
  responseStreamBytes: number | null;
  timeToFirstByteMs: number | null;
  logLevel: string | null;
  message: string | null;
  loggerName: string | null;
  codeFunctionName: string | null;
  codeLine: number | null;
  logAttributes: TlonDiagnosticLogAttributes | null;
  contextEngineEvent: string | null;
  contextEngineTaskId: string | null;
  contextEngineOperation: string | null;
  contextEngineLane: string | null;
  errorName: string | null;
  errorCode: string | null;
  messageCount: number | null;
  historyTextChars: number | null;
  historyImageBlocks: number | null;
  maxMessageTextChars: number | null;
  systemPromptChars: number | null;
  promptChars: number | null;
  promptImages: number | null;
  contextTokenBudget: number | null;
  reserveTokens: number | null;
  contextChannel: string | null;
  contextTrigger: string | null;
};

export type TlonPluginErrorSource =
  | 'auth'
  | 're_auth'
  | 'gateway_status_activation'
  | 'gateway_status_heartbeat'
  | 'channels_firehose'
  | 'chat_firehose'
  | 'contacts_subscription'
  | 'groups_ui_subscription'
  | 'foreigns_subscription'
  | 'settings_refresh';

export type TlonPluginErrorEvent = {
  harness: TlonHarnessName;
  pluginErrorSource: TlonPluginErrorSource;
  accountId: string | null;
  ownerShip: string | null;
  botShip: string;
  errorKind: string | null;
  errorText: string;
  attempt: number | null;
};

export type TlonTelemetryErrorEvent = {
  harness: TlonHarnessName;
  telemetrySource: string;
  sourceEventName: string | null;
  sessionKey: string | null;
  sessionId: string | null;
  runId: string | null;
  accountId: string | null;
  agentId: string | null;
  ownerShip: string | null;
  botShip: string;
  errorKind: string | null;
  errorText: string;
};

export interface TlonTelemetryClient {
  captureGatewayConnected(event: TlonGatewayConnectedEvent): void;
  startReply(params: TlonReplyTelemetryStart): TlonReplyTelemetrySession;
  captureHeartbeatNudge(event: TlonHeartbeatNudgeEvent): void;
  captureHeartbeatReengagement(event: TlonHeartbeatReengagementEvent): void;
  captureSessionLifecycle(event: TlonSessionLifecycleEvent): void;
  captureSessionWatchdog(event: TlonSessionWatchdogEvent): void;
  captureSessionRecovery(event: TlonSessionRecoveryEvent): void;
  captureHarnessError(event: TlonHarnessErrorEvent): void;
  captureHarnessDebug(event: TlonHarnessDebugEvent): void;
  capturePluginError(event: TlonPluginErrorEvent): void;
  captureTelemetryError(event: TlonTelemetryErrorEvent): void;
  captureCronJobChanged(event: TlonCronJobChangedEvent): void;
  captureCronRun(event: TlonCronRunEvent): void;
  captureCronSnapshot(event: TlonCronSnapshotEvent): void;
  captureOutboundRoute(
    event: TlonOutboundRouteEvent & {
      ownerShip?: string | null;
      botShip: string;
    }
  ): void;
  close(): Promise<void>;
}

const TLON_TELEMETRY_EVENT_NAME = 'TlonBot Reply Handled';
const TLON_GATEWAY_CONNECTED_EVENT = 'TlonBot Gateway Connected';
const TLON_OUTBOUND_ROUTED_EVENT = 'TlonBot Outbound Routed';
const TLON_SESSION_LIFECYCLE_EVENT = 'TlonBot Session Lifecycle';
const TLON_SESSION_WATCHDOG_EVENT = 'TlonBot Session Watchdog';
const TLON_SESSION_RECOVERY_EVENT = 'TlonBot Session Recovery';
const TLON_HARNESS_ERROR_EVENT = 'TlonBot Harness Error';
const TLON_HARNESS_DEBUG_EVENT = 'TlonBot Harness Debug';
const TLON_PLUGIN_ERROR_EVENT = 'TlonBot Plugin Error';
const TLON_TELEMETRY_ERROR_EVENT = 'TlonBot Telemetry Error';
const TLON_HEARTBEAT_NUDGE_EVENT = 'TlonBot Heartbeat Nudge Sent';
const TLON_HEARTBEAT_REENGAGED_EVENT = 'TlonBot Heartbeat Nudge Reengaged';
const TLON_CRON_JOB_CHANGED_EVENT = 'TlonBot Cron Job Changed';
const TLON_CRON_RUN_EVENT = 'TlonBot Cron Run';
const TLON_CRON_SNAPSHOT_EVENT = 'TlonBot Cron Snapshot';
const TLON_TELEMETRY_LOG_SOURCE = 'openclawPlugin';
const TOOL_TRACE_TTL_MS = 60 * 60 * 1000;
const MAX_TOOL_CALLS_PER_SESSION = 200;
const REPLY_TRACE_TTL_MS = 60 * 60 * 1000;
const MAX_ACTIVE_REPLY_TRACES = 50;
const SESSION_CONTEXT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SESSION_CONTEXTS = 5_000;
const HARNESS_DEBUG_SNAPSHOT_TTL_MS = 60 * 60 * 1000;
const MAX_HARNESS_DEBUG_SNAPSHOTS = 5_000;
const CRON_RUN_ATTRIBUTION_TTL_MS = 60 * 60 * 1000;
const MAX_CRON_RUN_ATTRIBUTION_SESSIONS = 5_000;
const MAX_CRON_RUN_IDS_PER_SESSION = 50;
// Restrict cron attribution to errors representing a failed gateway/model run.
// Tool/runtime/plugin diagnostics remain in their existing streams and should
// not independently count as a failed cron run.
const CRON_GATEWAY_ERROR_SCOPES = new Set<TlonHarnessErrorScope>([
  'model',
  'harness',
  'run',
]);
const toolCallsBySession = sharedMap<string, ToolSessionTrace>(
  'telemetry.toolCallsBySession'
);
const sessionContextsBySessionKey = sharedMap<
  string,
  TlonSessionTelemetryContext
>('telemetry.sessionContextsBySessionKey');
const harnessDebugSnapshotsBySessionKey = sharedMap<
  string,
  HarnessDebugSnapshotRecord
>('telemetry.harnessDebugSnapshotsBySessionKey');
const cronRunAttributionBySessionKey = sharedMap<
  string,
  CronRunAttributionRecord
>('telemetry.cronRunAttributionBySessionKey');

function cleanupToolCalls(now = Date.now()): void {
  for (const [sessionKey, trace] of toolCallsBySession) {
    if (now - trace.updatedAt > TOOL_TRACE_TTL_MS) {
      toolCallsBySession.delete(sessionKey);
    }
  }
}

export function recordToolCall(params: {
  sessionKey?: string | null;
  toolName: string;
  durationMs?: number;
  error?: string;
  context?: ToolCallContext;
}): void {
  const sessionKey = params.sessionKey?.trim();
  if (!sessionKey) {
    return;
  }

  const now = Date.now();
  cleanupToolCalls(now);

  const existing = toolCallsBySession.get(sessionKey);
  const trace: ToolSessionTrace = existing ?? {
    updatedAt: now,
    calls: [],
  };

  trace.updatedAt = now;
  trace.calls.push({
    toolName: params.toolName,
    durationMs:
      typeof params.durationMs === 'number' ? params.durationMs : null,
    error: params.error ?? null,
    context: params.context ?? null,
    recordedAt: now,
  });

  if (trace.calls.length > MAX_TOOL_CALLS_PER_SESSION) {
    trace.calls.splice(0, trace.calls.length - MAX_TOOL_CALLS_PER_SESSION);
  }

  toolCallsBySession.set(sessionKey, trace);
}

function createToolTraceCursor(sessionKey: string): number {
  cleanupToolCalls();
  return toolCallsBySession.get(sessionKey)?.calls.length ?? 0;
}

function collectToolUsageSince(
  sessionKey: string,
  cursor: number
): ToolUsageSummary {
  cleanupToolCalls();

  const calls =
    toolCallsBySession
      .get(sessionKey)
      ?.calls.slice(Math.max(0, cursor))
      .map((call) => ({
        toolName: call.toolName,
        durationMs: call.durationMs,
        error: call.error,
        summaryKey:
          call.context?.kind === 'tlonCommand' ? call.context.summaryKey : null,
      })) ?? [];
  const tlonContexts =
    toolCallsBySession
      .get(sessionKey)
      ?.calls.slice(Math.max(0, cursor))
      .flatMap((call) => {
        if (call.context?.kind !== 'tlonCommand') {
          return [];
        }

        return [call.context];
      }) ?? [];

  return {
    calls,
    names: calls.map((call) => call.toolName),
    totalDurationMs: calls.reduce(
      (total, call) => total + (call.durationMs ?? 0),
      0
    ),
    errorCount: calls.filter((call) => call.error).length,
    tlonToolCallCount: tlonContexts.length,
    tlonSummaryKeys: uniqueInOrder(tlonContexts.map((call) => call.summaryKey)),
    tlonChannelKinds: uniqueInOrder(
      tlonContexts.flatMap((call) =>
        call.channelKind ? [call.channelKind] : []
      )
    ),
    tlonUpdateFields: uniqueInOrder(
      tlonContexts.flatMap((call) => call.updateFields ?? [])
    ),
  };
}

function uniqueInOrder<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const unique: T[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    unique.push(value);
  }

  return unique;
}

function cleanupSessionContexts(now = Date.now()): void {
  for (const [sessionKey, context] of sessionContextsBySessionKey) {
    if (now - context.updatedAt > SESSION_CONTEXT_TTL_MS) {
      sessionContextsBySessionKey.delete(sessionKey);
    }
  }

  while (sessionContextsBySessionKey.size > MAX_SESSION_CONTEXTS) {
    const oldestKey = [...sessionContextsBySessionKey.entries()].sort(
      (a, b) => a[1].updatedAt - b[1].updatedAt
    )[0]?.[0];
    if (!oldestKey) {
      break;
    }
    sessionContextsBySessionKey.delete(oldestKey);
  }
}

function cleanupCronRunAttribution(now = Date.now()): void {
  for (const [sessionKey, record] of cronRunAttributionBySessionKey) {
    if (now - record.updatedAt > CRON_RUN_ATTRIBUTION_TTL_MS) {
      cronRunAttributionBySessionKey.delete(sessionKey);
    }
  }

  while (
    cronRunAttributionBySessionKey.size > MAX_CRON_RUN_ATTRIBUTION_SESSIONS
  ) {
    const oldestKey = [...cronRunAttributionBySessionKey.entries()].sort(
      (a, b) => a[1].updatedAt - b[1].updatedAt
    )[0]?.[0];
    if (!oldestKey) {
      break;
    }
    cronRunAttributionBySessionKey.delete(oldestKey);
  }
}

/**
 * Remember that an agent run was triggered by cron so lower-level diagnostic
 * events can be correlated with LB's authoritative cron lifecycle telemetry.
 * Safe to call from both agent hooks for the same run.
 */
export function recordCronRunAttribution(params: {
  sessionKey?: string | null;
  runId?: string | null;
  jobId?: string | null;
}): void {
  const sessionKey = optionalString(params.sessionKey);
  if (!sessionKey) {
    return;
  }

  const now = Date.now();
  cleanupCronRunAttribution(now);

  const record = cronRunAttributionBySessionKey.get(sessionKey) ?? {
    runIds: new Map<string, string | null>(),
    sawCronWithoutRunId: false,
    runlessJobId: null,
    updatedAt: now,
  };
  record.updatedAt = now;

  const jobId = optionalString(params.jobId);
  const runId = optionalString(params.runId);
  if (runId) {
    record.runIds.set(runId, jobId ?? record.runIds.get(runId) ?? null);
    while (record.runIds.size > MAX_CRON_RUN_IDS_PER_SESSION) {
      const oldestRunId = record.runIds.keys().next().value;
      if (oldestRunId === undefined) {
        break;
      }
      record.runIds.delete(oldestRunId);
    }
  } else {
    record.sawCronWithoutRunId = true;
    record.runlessJobId = jobId;
  }

  cronRunAttributionBySessionKey.set(sessionKey, record);
}

function lookupCronRunAttribution(
  sessionKey: string | null,
  runId: string | null
): CronRunAttribution | null {
  const normalizedSessionKey = optionalString(sessionKey);
  if (!normalizedSessionKey) {
    return null;
  }

  cleanupCronRunAttribution();
  const record = cronRunAttributionBySessionKey.get(normalizedSessionKey);
  if (!record) {
    return null;
  }
  // Reads deliberately do not refresh the TTL. The attribution window is
  // measured from the last cron hook, not from unrelated session activity.

  if (runId) {
    return record.runIds.has(runId)
      ? { cronJobId: record.runIds.get(runId) ?? null }
      : null;
  }

  // Only match a run-id-less failure to a run-id-less cron signal. If a later
  // diagnostic has a run id, exact matching above is required.
  return record.sawCronWithoutRunId ? { cronJobId: record.runlessJobId } : null;
}

function cleanupHarnessDebugSnapshots(now = Date.now()): void {
  for (const [sessionKey, snapshot] of harnessDebugSnapshotsBySessionKey) {
    if (now - snapshot.updatedAt > HARNESS_DEBUG_SNAPSHOT_TTL_MS) {
      harnessDebugSnapshotsBySessionKey.delete(sessionKey);
    }
  }

  while (harnessDebugSnapshotsBySessionKey.size > MAX_HARNESS_DEBUG_SNAPSHOTS) {
    const oldestKey = [...harnessDebugSnapshotsBySessionKey.entries()].sort(
      (a, b) => a[1].updatedAt - b[1].updatedAt
    )[0]?.[0];
    if (!oldestKey) {
      break;
    }
    harnessDebugSnapshotsBySessionKey.delete(oldestKey);
  }
}

function createEmptyHarnessDebugSnapshot(
  now = Date.now()
): HarnessDebugSnapshotRecord {
  return {
    updatedAt: now,
    debugSequence: 0,
    lastHarnessEventType: null,
    lastHarnessEventAt: null,
    lastHarnessEventRunId: null,
    lastHarnessEventPhase: null,
    lastHarnessEventOutcome: null,
    lastHarnessProvider: null,
    lastHarnessModel: null,
    runStartedSeen: false,
    contextAssembledSeen: false,
    modelCallStartedSeen: false,
    harnessRunStartedSeen: false,
    toolExecutionStartedSeen: false,
    lastContextEngineEvent: null,
    lastContextEngineEventAt: null,
    lastContextEngineTaskId: null,
    lastContextEngineOperation: null,
    lastContextEngineLane: null,
    lastContextEngineMessage: null,
  };
}

function harnessDebugSnapshotFields(
  snapshot: HarnessDebugSnapshotRecord | null,
  now = Date.now()
): TlonHarnessDebugSnapshotFields {
  return {
    harnessDebugSequence: snapshot?.debugSequence ?? null,
    lastHarnessEventType: snapshot?.lastHarnessEventType ?? null,
    lastHarnessEventAgeMs:
      snapshot?.lastHarnessEventAt !== null &&
      snapshot?.lastHarnessEventAt !== undefined
        ? Math.max(0, now - snapshot.lastHarnessEventAt)
        : null,
    lastHarnessEventRunId: snapshot?.lastHarnessEventRunId ?? null,
    lastHarnessEventPhase: snapshot?.lastHarnessEventPhase ?? null,
    lastHarnessEventOutcome: snapshot?.lastHarnessEventOutcome ?? null,
    lastHarnessProvider: snapshot?.lastHarnessProvider ?? null,
    lastHarnessModel: snapshot?.lastHarnessModel ?? null,
    runStartedSeen: snapshot?.runStartedSeen === true,
    contextAssembledSeen: snapshot?.contextAssembledSeen === true,
    modelCallStartedSeen: snapshot?.modelCallStartedSeen === true,
    harnessRunStartedSeen: snapshot?.harnessRunStartedSeen === true,
    toolExecutionStartedSeen: snapshot?.toolExecutionStartedSeen === true,
    lastContextEngineEvent: snapshot?.lastContextEngineEvent ?? null,
    lastContextEngineEventAgeMs:
      snapshot?.lastContextEngineEventAt !== null &&
      snapshot?.lastContextEngineEventAt !== undefined
        ? Math.max(0, now - snapshot.lastContextEngineEventAt)
        : null,
    lastContextEngineTaskId: snapshot?.lastContextEngineTaskId ?? null,
    lastContextEngineOperation: snapshot?.lastContextEngineOperation ?? null,
    lastContextEngineLane: snapshot?.lastContextEngineLane ?? null,
    lastContextEngineMessage: snapshot?.lastContextEngineMessage ?? null,
  };
}

function lookupHarnessDebugSnapshotFields(
  sessionKey?: string | null
): TlonHarnessDebugSnapshotFields {
  const normalized = sessionKey?.trim();
  if (!normalized) {
    return harnessDebugSnapshotFields(null);
  }

  cleanupHarnessDebugSnapshots();
  return harnessDebugSnapshotFields(
    harnessDebugSnapshotsBySessionKey.get(normalized) ?? null
  );
}

function updateHarnessDebugSnapshot(
  sessionKey: string,
  event: TlonHarnessDebugReportInput,
  now = Date.now()
): TlonHarnessDebugSnapshotFields {
  cleanupHarnessDebugSnapshots(now);
  const previous = harnessDebugSnapshotsBySessionKey.get(sessionKey);
  const eventRunId = optionalString(event.runId);
  const resetForNewRun =
    previous &&
    eventRunId &&
    previous.lastHarnessEventRunId &&
    previous.lastHarnessEventRunId !== eventRunId;
  const existing = resetForNewRun
    ? createEmptyHarnessDebugSnapshot(now)
    : previous ?? createEmptyHarnessDebugSnapshot(now);
  const contextEngineEvent = optionalString(event.contextEngineEvent);
  const contextEngineTaskId = optionalString(event.contextEngineTaskId);
  const contextEngineOperation = optionalString(event.contextEngineOperation);
  const contextEngineLane = optionalString(event.contextEngineLane);
  const message = optionalString(event.message);

  const updated: HarnessDebugSnapshotRecord = {
    ...existing,
    updatedAt: now,
    debugSequence: existing.debugSequence + 1,
    lastHarnessEventType:
      optionalString(event.harnessEventType) ?? existing.lastHarnessEventType,
    lastHarnessEventAt: now,
    lastHarnessEventRunId: eventRunId ?? existing.lastHarnessEventRunId,
    lastHarnessEventPhase:
      optionalString(event.phase) ?? existing.lastHarnessEventPhase,
    lastHarnessEventOutcome:
      optionalString(event.outcome) ?? existing.lastHarnessEventOutcome,
    lastHarnessProvider:
      optionalString(event.provider) ?? existing.lastHarnessProvider,
    lastHarnessModel: optionalString(event.model) ?? existing.lastHarnessModel,
    runStartedSeen:
      existing.runStartedSeen || event.harnessEventType === 'run.started',
    contextAssembledSeen:
      existing.contextAssembledSeen ||
      event.harnessEventType === 'context.assembled',
    modelCallStartedSeen:
      existing.modelCallStartedSeen ||
      event.harnessEventType === 'model.call.started',
    harnessRunStartedSeen:
      existing.harnessRunStartedSeen ||
      event.harnessEventType === 'harness.run.started',
    toolExecutionStartedSeen:
      existing.toolExecutionStartedSeen ||
      event.harnessEventType === 'tool.execution.started',
    lastContextEngineEvent:
      contextEngineEvent ?? existing.lastContextEngineEvent,
    lastContextEngineEventAt: contextEngineEvent
      ? now
      : existing.lastContextEngineEventAt,
    lastContextEngineTaskId:
      contextEngineTaskId ?? existing.lastContextEngineTaskId,
    lastContextEngineOperation:
      contextEngineOperation ?? existing.lastContextEngineOperation,
    lastContextEngineLane: contextEngineLane ?? existing.lastContextEngineLane,
    lastContextEngineMessage:
      contextEngineEvent && message
        ? message
        : existing.lastContextEngineMessage,
  };

  harnessDebugSnapshotsBySessionKey.set(sessionKey, updated);
  return harnessDebugSnapshotFields(updated, now);
}

function rememberTlonSessionContext(params: {
  sessionKey: string;
  sessionId?: string | null;
  runId?: string | null;
  ownerShip: string | null;
  botShip: string;
  accountId?: string | null;
  agentId?: string | null;
  destinationKind: TlonDestinationKind;
}): void {
  const sessionKey = params.sessionKey.trim();
  if (!sessionKey) {
    return;
  }

  const now = Date.now();
  cleanupSessionContexts(now);
  const existing = sessionContextsBySessionKey.get(sessionKey);
  sessionContextsBySessionKey.set(sessionKey, {
    sessionKey,
    sessionId: optionalString(params.sessionId) ?? existing?.sessionId ?? null,
    runId: optionalString(params.runId) ?? existing?.runId ?? null,
    ownerShip: params.ownerShip,
    botShip: params.botShip,
    accountId: params.accountId ?? null,
    agentId: params.agentId ?? null,
    destinationKind: params.destinationKind,
    updatedAt: now,
  });
}

function lookupTlonSessionContext(
  sessionKey?: string | null
): TlonSessionTelemetryContext | null {
  const normalized = sessionKey?.trim();
  if (!normalized) {
    return null;
  }

  cleanupSessionContexts();
  const context = sessionContextsBySessionKey.get(normalized);
  if (!context) {
    return null;
  }

  context.updatedAt = Date.now();
  sessionContextsBySessionKey.set(normalized, context);
  return context;
}

function updateTlonSessionContextSessionId(
  context: TlonSessionTelemetryContext,
  sessionId?: string | null
): TlonSessionTelemetryContext {
  const normalizedSessionId = optionalString(sessionId);
  if (!normalizedSessionId || context.sessionId === normalizedSessionId) {
    return context;
  }

  const updated = {
    ...context,
    sessionId: normalizedSessionId,
    updatedAt: Date.now(),
  };
  sessionContextsBySessionKey.set(updated.sessionKey, updated);
  return updated;
}

function updateTlonSessionContextRuntime(
  context: TlonSessionTelemetryContext,
  params: {
    sessionId?: string | null;
    runId?: string | null;
    agentId?: string | null;
  }
): TlonSessionTelemetryContext {
  const normalizedSessionId = optionalString(params.sessionId);
  const normalizedRunId = optionalString(params.runId);
  const normalizedAgentId = optionalString(params.agentId);
  if (
    (!normalizedSessionId || context.sessionId === normalizedSessionId) &&
    (!normalizedRunId || context.runId === normalizedRunId) &&
    (!normalizedAgentId || context.agentId === normalizedAgentId)
  ) {
    return context;
  }

  const updated = {
    ...context,
    sessionId: normalizedSessionId ?? context.sessionId,
    runId: normalizedRunId ?? context.runId,
    agentId: normalizedAgentId ?? context.agentId,
    updatedAt: Date.now(),
  };
  sessionContextsBySessionKey.set(updated.sessionKey, updated);
  return updated;
}

function countDispatchFailures(
  counts: ReplyDispatchCounts | undefined,
  kind: ReplyDispatchKind
): number {
  const value = counts?.[kind];
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function classifyError(error: unknown): string | null {
  if (!error) {
    return null;
  }
  if (error instanceof Error) {
    return error.name || 'Error';
  }
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.trim()) {
      return code.trim().slice(0, 80);
    }
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) {
      return name.trim().slice(0, 80);
    }
    return 'object';
  }
  return typeof error;
}

function resolveReplyOutcome(params: {
  deliveredMessageCount: number;
  sendError?: boolean;
  failedCounts?: ReplyDispatchCounts;
  dispatchError?: unknown;
}): TlonReplyOutcome {
  if (params.deliveredMessageCount > 0) {
    return 'responded';
  }

  const failedReplyCount =
    countDispatchFailures(params.failedCounts, 'tool') +
    countDispatchFailures(params.failedCounts, 'block') +
    countDispatchFailures(params.failedCounts, 'final');

  return params.dispatchError || params.sendError || failedReplyCount > 0
    ? 'error'
    : 'no_reply';
}

function resolveDeliverySkipReason(params: {
  outcome: TlonReplyOutcome;
  deliverySkipReason?: TlonDeliverySkipReason | null;
  sourceReplyDeliveryMode?: string | null;
}): TlonDeliverySkipReason | null {
  if (params.outcome !== 'no_reply') {
    return null;
  }
  if (params.deliverySkipReason) {
    return params.deliverySkipReason;
  }
  if (params.sourceReplyDeliveryMode === 'message_tool_only') {
    return 'source_reply_delivery_mode_message_tool_only';
  }
  return null;
}

type ActiveReplyTrace = {
  params: TlonReplyTelemetryStart & {
    sessionId: string | null;
    runId: string | null;
    accountId: string | null;
    agentId: string | null;
    destinationKind: TlonDestinationKind;
  };
  startedAt: number;
  toolTraceCursor: number;
  timeout: ReturnType<typeof setTimeout>;
};

class PostHogTlonTelemetry implements TlonTelemetryClient {
  private readonly client: PostHog;
  private readonly runtime?: RuntimeEnv;
  private readonly versionIdentity = getTlonVersionIdentity();
  private readonly identifiedOwners = new Set<string>();
  private readonly activeReplyTraces = new Map<symbol, ActiveReplyTrace>();
  private missingOwnerWarningLogged = false;

  constructor(params: {
    apiKey: string;
    host: string | null;
    runtime?: RuntimeEnv;
  }) {
    this.runtime = params.runtime;
    this.client = new PostHog(params.apiKey, {
      host: params.host ?? undefined,
      flushAt: 1,
      flushInterval: 10_000,
      disableGeoip: true,
      preloadFeatureFlags: false,
      disableRemoteConfig: true,
    });
  }

  private properties<T extends Record<string, unknown>>(
    props: T,
    options?: { omitNullish?: boolean }
  ): Record<string, unknown> {
    const properties = {
      logSource: TLON_TELEMETRY_LOG_SOURCE,
      ...this.versionIdentity,
      ...props,
    };
    if (options?.omitNullish !== true) {
      return properties;
    }
    return Object.fromEntries(
      Object.entries(properties).filter(([, value]) => value != null)
    );
  }

  captureGatewayConnected(event: TlonGatewayConnectedEvent): void {
    const ownerShip = event.ownerShip ?? '';
    if (!this.ensureIdentified(ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: ownerShip,
      event: TLON_GATEWAY_CONNECTED_EVENT,
      properties: this.properties({
        botShip: event.botShip,
        ownerShip: event.ownerShip,
        tlonSkillVersion: event.tlonSkillVersion,
        accountId: event.accountId,
        configured: event.configured,
        watchedChannelCount: event.watchedChannelCount,
        dmAllowlistCount: event.dmAllowlistCount,
        defaultAuthorizedShipsCount: event.defaultAuthorizedShipsCount,
        pendingApprovalCount: event.pendingApprovalCount,
        autoDiscoverChannels: event.autoDiscoverChannels,
        ownerListenEnabled: event.ownerListenEnabled,
      }),
    });
  }

  startReply(params: TlonReplyTelemetryStart): TlonReplyTelemetrySession {
    const normalizedParams: ActiveReplyTrace['params'] = {
      ...params,
      sessionId: optionalString(params.sessionId),
      runId: params.runId ?? null,
      accountId: params.accountId ?? null,
      agentId: params.agentId ?? null,
      destinationKind: params.destinationKind ?? params.chatType,
    };
    const toolTraceCursor = createToolTraceCursor(params.sessionKey);
    rememberTlonSessionContext({
      sessionKey: normalizedParams.sessionKey,
      sessionId: normalizedParams.sessionId,
      runId: normalizedParams.runId,
      ownerShip: normalizedParams.ownerShip,
      botShip: normalizedParams.botShip,
      accountId: normalizedParams.accountId,
      agentId: normalizedParams.agentId,
      destinationKind: normalizedParams.destinationKind,
    });

    this.pruneActiveReplyTraces();
    const token = Symbol(normalizedParams.sessionKey);
    const trace: ActiveReplyTrace = {
      params: normalizedParams,
      startedAt: Date.now(),
      toolTraceCursor,
      timeout: setTimeout(() => {
        this.captureAbandonedReplyTrace(token, 'stale');
      }, REPLY_TRACE_TTL_MS),
    };
    trace.timeout.unref?.();
    this.activeReplyTraces.set(token, trace);
    this.pruneActiveReplyTraces();

    return {
      capture: async (result) => {
        const activeTrace = this.activeReplyTraces.get(token);
        if (!activeTrace) {
          return;
        }
        this.activeReplyTraces.delete(token);
        clearTimeout(activeTrace.timeout);

        // Yield once so after_tool_call hooks for the just-finished reply have time to run.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));

        const failedToolCount = countDispatchFailures(
          result.failedCounts,
          'tool'
        );
        const failedBlockCount = countDispatchFailures(
          result.failedCounts,
          'block'
        );
        const failedFinalCount = countDispatchFailures(
          result.failedCounts,
          'final'
        );
        const sendErrorCount = Math.max(0, result.sendErrorCount ?? 0);
        const sessionContext = lookupTlonSessionContext(
          activeTrace.params.sessionKey
        );

        const outcome = resolveReplyOutcome({
          deliveredMessageCount: result.deliveredMessageCount,
          sendError: sendErrorCount > 0,
          failedCounts: result.failedCounts,
          dispatchError: result.dispatchError,
        });
        const sourceReplyDeliveryMode = result.sourceReplyDeliveryMode ?? null;

        this.captureReplyOutcome({
          sessionKey: activeTrace.params.sessionKey,
          sessionId: sessionContext?.sessionId ?? activeTrace.params.sessionId,
          runId: activeTrace.params.runId,
          accountId: activeTrace.params.accountId,
          agentId: activeTrace.params.agentId,
          ownerShip: activeTrace.params.ownerShip,
          botShip: activeTrace.params.botShip,
          outcome,
          chatType: activeTrace.params.chatType,
          destinationKind: activeTrace.params.destinationKind,
          isThreadReply: activeTrace.params.isThreadReply,
          senderRole: activeTrace.params.senderRole,
          attachmentCount: activeTrace.params.attachmentCount,
          sendAttemptCount: Math.max(0, result.sendAttemptCount ?? 0),
          sendError: sendErrorCount > 0,
          sendErrorCount,
          sendErrorKind: result.sendErrorKind ?? null,
          deliveredMessageCount: result.deliveredMessageCount,
          replyCharCount: result.replyCharCount,
          replyWordCount: result.replyWordCount,
          replyMediaCount: result.replyMediaCount,
          dispatchDurationMs: result.dispatchDurationMs,
          queuedFinal: result.queuedFinal,
          queuedFinalCount: result.queuedFinalCount,
          queuedBlockCount: result.queuedBlockCount,
          failedToolCount,
          failedBlockCount,
          failedFinalCount,
          failedReplyCount:
            failedToolCount + failedBlockCount + failedFinalCount,
          deliverySkipReason: resolveDeliverySkipReason({
            outcome,
            deliverySkipReason: result.deliverySkipReason,
            sourceReplyDeliveryMode,
          }),
          sourceReplyDeliveryMode,
          beforeAgentRunBlocked: result.beforeAgentRunBlocked === true,
          dispatchError: Boolean(result.dispatchError),
          dispatchErrorKind: classifyError(result.dispatchError),
          abandonedReason: null,
          provider: result.provider,
          model: result.model,
          thinkLevel: result.thinkLevel,
          toolUsage: collectToolUsageSince(
            activeTrace.params.sessionKey,
            activeTrace.toolTraceCursor
          ),
        });
      },
    };
  }

  private captureAbandonedReplyTrace(token: symbol, reason: string): void {
    const trace = this.activeReplyTraces.get(token);
    if (!trace) {
      return;
    }
    this.activeReplyTraces.delete(token);
    clearTimeout(trace.timeout);
    const sessionContext = lookupTlonSessionContext(trace.params.sessionKey);

    this.captureReplyOutcome({
      sessionKey: trace.params.sessionKey,
      sessionId: sessionContext?.sessionId ?? trace.params.sessionId,
      runId: trace.params.runId,
      accountId: trace.params.accountId,
      agentId: trace.params.agentId,
      ownerShip: trace.params.ownerShip,
      botShip: trace.params.botShip,
      outcome: 'abandoned',
      chatType: trace.params.chatType,
      destinationKind: trace.params.destinationKind,
      isThreadReply: trace.params.isThreadReply,
      senderRole: trace.params.senderRole,
      attachmentCount: trace.params.attachmentCount,
      sendAttemptCount: 0,
      sendError: false,
      sendErrorCount: 0,
      sendErrorKind: null,
      deliveredMessageCount: 0,
      replyCharCount: 0,
      replyWordCount: 0,
      replyMediaCount: 0,
      dispatchDurationMs: Date.now() - trace.startedAt,
      queuedFinal: false,
      queuedFinalCount: 0,
      queuedBlockCount: 0,
      failedToolCount: 0,
      failedBlockCount: 0,
      failedFinalCount: 0,
      failedReplyCount: 0,
      deliverySkipReason: null,
      sourceReplyDeliveryMode: null,
      beforeAgentRunBlocked: false,
      dispatchError: false,
      dispatchErrorKind: null,
      abandonedReason: reason,
      provider: null,
      model: null,
      thinkLevel: null,
      toolUsage: collectToolUsageSince(
        trace.params.sessionKey,
        trace.toolTraceCursor
      ),
    });
  }

  private pruneActiveReplyTraces(now = Date.now()): void {
    for (const [token, trace] of this.activeReplyTraces) {
      if (now - trace.startedAt > REPLY_TRACE_TTL_MS) {
        this.captureAbandonedReplyTrace(token, 'stale');
      }
    }

    while (this.activeReplyTraces.size > MAX_ACTIVE_REPLY_TRACES) {
      const oldest = [...this.activeReplyTraces.entries()].sort(
        (a, b) => a[1].startedAt - b[1].startedAt
      )[0];
      if (!oldest) {
        break;
      }
      this.captureAbandonedReplyTrace(oldest[0], 'max_traces');
    }
  }

  private captureReplyOutcome(event: TlonReplyOutcomeEvent): void {
    const ownerShip = event.ownerShip ?? '';
    if (!this.ensureIdentified(ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: ownerShip,
      event: TLON_TELEMETRY_EVENT_NAME,
      properties: this.properties({
        sessionKey: event.sessionKey,
        sessionId: event.sessionId,
        runId: event.runId,
        accountId: event.accountId,
        agentId: event.agentId,
        botShip: event.botShip,
        ownerShip: event.ownerShip,
        outcome: event.outcome,
        chatType: event.chatType,
        destinationKind: event.destinationKind,
        isThreadReply: event.isThreadReply,
        senderRole: event.senderRole,
        attachmentCount: event.attachmentCount,
        hasAttachments: event.attachmentCount > 0,
        sendAttemptCount: event.sendAttemptCount,
        sendError: event.sendError,
        sendErrorCount: event.sendErrorCount,
        sendErrorKind: event.sendErrorKind,
        deliveredMessageCount: event.deliveredMessageCount,
        replyCharCount: event.replyCharCount,
        replyWordCount: event.replyWordCount,
        replyMediaCount: event.replyMediaCount,
        dispatchDurationMs: event.dispatchDurationMs,
        queuedFinal: event.queuedFinal,
        queuedFinalCount: event.queuedFinalCount,
        queuedBlockCount: event.queuedBlockCount,
        failedToolCount: event.failedToolCount,
        failedBlockCount: event.failedBlockCount,
        failedFinalCount: event.failedFinalCount,
        failedReplyCount: event.failedReplyCount,
        deliverySkipReason: event.deliverySkipReason,
        sourceReplyDeliveryMode: event.sourceReplyDeliveryMode,
        beforeAgentRunBlocked: event.beforeAgentRunBlocked,
        dispatchError: event.dispatchError,
        dispatchErrorKind: event.dispatchErrorKind,
        abandonedReason: event.abandonedReason,
        provider: event.provider,
        model: event.model,
        thinkLevel: event.thinkLevel,
        toolCount: event.toolUsage.calls.length,
        toolNames: event.toolUsage.names,
        toolTotalDurationMs: event.toolUsage.totalDurationMs,
        toolErrorCount: event.toolUsage.errorCount,
        toolCalls: event.toolUsage.calls.map((call) => ({
          toolName: call.toolName,
          durationMs: call.durationMs,
          error: call.error,
          summaryKey: call.summaryKey,
        })),
        tlonToolCallCount: event.toolUsage.tlonToolCallCount,
        tlonToolSummaryKeys: event.toolUsage.tlonSummaryKeys,
        tlonToolChannelKinds: event.toolUsage.tlonChannelKinds,
        tlonToolUpdateFields: event.toolUsage.tlonUpdateFields,
      }),
    });
  }

  captureSessionLifecycle(event: TlonSessionLifecycleEvent): void {
    const ownerShip = event.ownerShip ?? '';
    if (!this.ensureIdentified(ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: ownerShip,
      event: TLON_SESSION_LIFECYCLE_EVENT,
      properties: this.properties({
        botShip: event.botShip,
        ownerShip: event.ownerShip,
        accountId: event.accountId,
        agentId: event.agentId,
        sessionKey: event.sessionKey,
        sessionId: event.sessionId,
        lifecycleEvent: event.lifecycleEvent,
        destinationKind: event.destinationKind,
        reason: event.reason,
        messageCount: event.messageCount,
        durationMs: event.durationMs,
        transcriptArchived: event.transcriptArchived,
        hasNextSession: event.hasNextSession,
      }),
    });
  }

  captureSessionWatchdog(event: TlonSessionWatchdogEvent): void {
    const ownerShip = event.ownerShip ?? '';
    if (!this.ensureIdentified(ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: ownerShip,
      event: TLON_SESSION_WATCHDOG_EVENT,
      properties: this.properties(
        {
          botShip: event.botShip,
          ownerShip: event.ownerShip,
          accountId: event.accountId,
          agentId: event.agentId,
          sessionKey: event.sessionKey,
          sessionId: event.sessionId,
          diagnosticType: event.diagnosticType,
          destinationKind: event.destinationKind,
          state: event.state,
          ageMs: event.ageMs,
          queueDepth: event.queueDepth,
          reason: event.reason,
          classification: event.classification,
          activeWorkKind: event.activeWorkKind,
          lastProgressAgeMs: event.lastProgressAgeMs,
          lastProgressReason: event.lastProgressReason,
          activeToolName: event.activeToolName,
          activeToolAgeMs: event.activeToolAgeMs,
          terminalProgressStale: event.terminalProgressStale,
          harnessDebugSequence: event.harnessDebugSequence,
          lastHarnessEventType: event.lastHarnessEventType,
          lastHarnessEventAgeMs: event.lastHarnessEventAgeMs,
          lastHarnessEventRunId: event.lastHarnessEventRunId,
          lastHarnessEventPhase: event.lastHarnessEventPhase,
          lastHarnessEventOutcome: event.lastHarnessEventOutcome,
          lastHarnessProvider: event.lastHarnessProvider,
          lastHarnessModel: event.lastHarnessModel,
          runStartedSeen: event.runStartedSeen,
          contextAssembledSeen: event.contextAssembledSeen,
          modelCallStartedSeen: event.modelCallStartedSeen,
          harnessRunStartedSeen: event.harnessRunStartedSeen,
          toolExecutionStartedSeen: event.toolExecutionStartedSeen,
          lastContextEngineEvent: event.lastContextEngineEvent,
          lastContextEngineEventAgeMs: event.lastContextEngineEventAgeMs,
          lastContextEngineTaskId: event.lastContextEngineTaskId,
          lastContextEngineOperation: event.lastContextEngineOperation,
          lastContextEngineLane: event.lastContextEngineLane,
          lastContextEngineMessage: event.lastContextEngineMessage,
        },
        { omitNullish: true }
      ),
    });
  }

  captureSessionRecovery(event: TlonSessionRecoveryEvent): void {
    const ownerShip = event.ownerShip ?? '';
    if (!this.ensureIdentified(ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: ownerShip,
      event: TLON_SESSION_RECOVERY_EVENT,
      properties: this.properties(
        {
          botShip: event.botShip,
          ownerShip: event.ownerShip,
          accountId: event.accountId,
          agentId: event.agentId,
          sessionKey: event.sessionKey,
          sessionId: event.sessionId,
          diagnosticType: event.diagnosticType,
          destinationKind: event.destinationKind,
          state: event.state,
          stateGeneration: event.stateGeneration,
          ageMs: event.ageMs,
          queueDepth: event.queueDepth,
          reason: event.reason,
          activeWorkKind: event.activeWorkKind,
          allowActiveAbort: event.allowActiveAbort,
          status: event.status,
          action: event.action,
          outcomeReason: event.outcomeReason,
          released: event.released,
          stale: event.stale,
          harnessDebugSequence: event.harnessDebugSequence,
          lastHarnessEventType: event.lastHarnessEventType,
          lastHarnessEventAgeMs: event.lastHarnessEventAgeMs,
          lastHarnessEventRunId: event.lastHarnessEventRunId,
          lastHarnessEventPhase: event.lastHarnessEventPhase,
          lastHarnessEventOutcome: event.lastHarnessEventOutcome,
          lastHarnessProvider: event.lastHarnessProvider,
          lastHarnessModel: event.lastHarnessModel,
          runStartedSeen: event.runStartedSeen,
          contextAssembledSeen: event.contextAssembledSeen,
          modelCallStartedSeen: event.modelCallStartedSeen,
          harnessRunStartedSeen: event.harnessRunStartedSeen,
          toolExecutionStartedSeen: event.toolExecutionStartedSeen,
          lastContextEngineEvent: event.lastContextEngineEvent,
          lastContextEngineEventAgeMs: event.lastContextEngineEventAgeMs,
          lastContextEngineTaskId: event.lastContextEngineTaskId,
          lastContextEngineOperation: event.lastContextEngineOperation,
          lastContextEngineLane: event.lastContextEngineLane,
          lastContextEngineMessage: event.lastContextEngineMessage,
        },
        { omitNullish: true }
      ),
    });
  }

  private cronCountPersonProps(
    event: TlonCronCountFields
  ): Record<string, unknown> {
    if (event.activeCronJobCount == null && event.totalCronJobCount == null) {
      return {};
    }
    return {
      $set: {
        tlonCronActiveJobCount: event.activeCronJobCount,
        tlonCronTotalJobCount: event.totalCronJobCount,
        tlonCronCountsUpdatedAt: new Date().toISOString(),
      },
    };
  }

  captureCronJobChanged(event: TlonCronJobChangedEvent): void {
    const ownerShip = event.ownerShip ?? '';
    if (!this.ensureIdentified(ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: ownerShip,
      event: TLON_CRON_JOB_CHANGED_EVENT,
      properties: this.properties(
        {
          botShip: event.botShip,
          ownerShip: event.ownerShip,
          accountId: event.accountId,
          agentId: event.agentId,
          cronAction: event.cronAction,
          jobId: event.jobId,
          jobName: event.jobName,
          enabled: event.enabled,
          wakeMode: event.wakeMode,
          payloadKind: event.payloadKind,
          sessionTargetKind: event.sessionTargetKind,
          scheduleKind: event.scheduleKind,
          scheduleExpr: event.scheduleExpr,
          scheduleTz: event.scheduleTz,
          scheduleEveryMs: event.scheduleEveryMs,
          scheduleAt: event.scheduleAt,
          activeCronJobCount: event.activeCronJobCount,
          totalCronJobCount: event.totalCronJobCount,
          ...this.cronCountPersonProps(event),
        },
        { omitNullish: true }
      ),
    });
  }

  captureCronRun(event: TlonCronRunEvent): void {
    const ownerShip = event.ownerShip ?? '';
    if (!this.ensureIdentified(ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: ownerShip,
      event: TLON_CRON_RUN_EVENT,
      properties: this.properties(
        {
          botShip: event.botShip,
          ownerShip: event.ownerShip,
          accountId: event.accountId,
          agentId: event.agentId,
          jobId: event.jobId,
          jobName: event.jobName,
          runId: event.runId,
          status: event.status,
          cronError: event.cronError,
          durationMs: event.durationMs,
          runAtMs: event.runAtMs,
          nextRunAtMs: event.nextRunAtMs,
          delivered: event.delivered,
          deliveryStatus: event.deliveryStatus,
          deliveryError: event.deliveryError,
          model: event.model,
          provider: event.provider,
          payloadKind: event.payloadKind,
          sessionTargetKind: event.sessionTargetKind,
          scheduleKind: event.scheduleKind,
          scheduleExpr: event.scheduleExpr,
          scheduleTz: event.scheduleTz,
          scheduleEveryMs: event.scheduleEveryMs,
          scheduleAt: event.scheduleAt,
        },
        { omitNullish: true }
      ),
    });
  }

  captureCronSnapshot(event: TlonCronSnapshotEvent): void {
    const ownerShip = event.ownerShip ?? '';
    if (!this.ensureIdentified(ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: ownerShip,
      event: TLON_CRON_SNAPSHOT_EVENT,
      properties: this.properties(
        {
          botShip: event.botShip,
          ownerShip: event.ownerShip,
          accountId: event.accountId,
          activeCronJobCount: event.activeCronJobCount,
          totalCronJobCount: event.totalCronJobCount,
          scheduleKindCronCount: event.scheduleKindCronCount,
          scheduleKindEveryCount: event.scheduleKindEveryCount,
          scheduleKindAtCount: event.scheduleKindAtCount,
          scheduleKindOnExitCount: event.scheduleKindOnExitCount,
          ...this.cronCountPersonProps(event),
        },
        { omitNullish: true }
      ),
    });
  }

  captureOutboundRoute(
    event: TlonOutboundRouteEvent & {
      ownerShip?: string | null;
      botShip: string;
    }
  ): void {
    const ownerShip = event.ownerShip ?? '';
    if (!this.ensureIdentified(ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: ownerShip,
      event: TLON_OUTBOUND_ROUTED_EVENT,
      properties: this.properties({
        botShip: event.botShip,
        ownerShip: event.ownerShip,
        resolvedChannel: event.resolvedChannel,
        routedToTlon: event.routedToTlon,
        targetKind: event.targetKind,
      }),
    });
  }

  captureHarnessError(event: TlonHarnessErrorEvent): void {
    const ownerShip = event.ownerShip ?? '';
    if (!this.ensureIdentified(ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: ownerShip,
      event: TLON_HARNESS_ERROR_EVENT,
      properties: this.properties(
        {
          harness: event.harness,
          harnessEventType: event.harnessEventType,
          errorScope: event.errorScope,
          sessionKey: event.sessionKey,
          sessionId: event.sessionId,
          runId: event.runId,
          accountId: event.accountId,
          agentId: event.agentId,
          ownerShip: event.ownerShip,
          botShip: event.botShip,
          destinationKind: event.destinationKind,
          provider: event.provider,
          model: event.model,
          toolName: event.toolName,
          phase: event.phase,
          outcome: event.outcome,
          errorCategory: event.errorCategory,
          failureKind: event.failureKind,
          durationMs: event.durationMs,
          errorText: event.errorText,
          isCron: event.isCron,
          cronJobId: event.cronJobId,
        },
        { omitNullish: true }
      ),
    });
  }

  captureHarnessDebug(event: TlonHarnessDebugEvent): void {
    const ownerShip = event.ownerShip ?? '';
    if (!this.ensureIdentified(ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: ownerShip,
      event: TLON_HARNESS_DEBUG_EVENT,
      properties: this.properties(
        {
          harness: event.harness,
          harnessEventType: event.harnessEventType,
          debugEventKind: event.debugEventKind,
          sessionKey: event.sessionKey,
          sessionId: event.sessionId,
          runId: event.runId,
          accountId: event.accountId,
          agentId: event.agentId,
          ownerShip: event.ownerShip,
          botShip: event.botShip,
          destinationKind: event.destinationKind,
          provider: event.provider,
          model: event.model,
          phase: event.phase,
          outcome: event.outcome,
          durationMs: event.durationMs,
          toolName: event.toolName,
          toolCallId: event.toolCallId,
          toolSource: event.toolSource,
          toolOwner: event.toolOwner,
          pluginId: event.pluginId,
          harnessId: event.harnessId,
          modelCallId: event.modelCallId,
          modelApi: event.modelApi,
          modelTransport: event.modelTransport,
          requestPayloadBytes: event.requestPayloadBytes,
          responseStreamBytes: event.responseStreamBytes,
          timeToFirstByteMs: event.timeToFirstByteMs,
          logLevel: event.logLevel,
          message: event.message,
          loggerName: event.loggerName,
          codeFunctionName: event.codeFunctionName,
          codeLine: event.codeLine,
          logAttributes: event.logAttributes,
          contextEngineEvent: event.contextEngineEvent,
          contextEngineTaskId: event.contextEngineTaskId,
          contextEngineOperation: event.contextEngineOperation,
          contextEngineLane: event.contextEngineLane,
          errorName: event.errorName,
          errorCode: event.errorCode,
          messageCount: event.messageCount,
          historyTextChars: event.historyTextChars,
          historyImageBlocks: event.historyImageBlocks,
          maxMessageTextChars: event.maxMessageTextChars,
          systemPromptChars: event.systemPromptChars,
          promptChars: event.promptChars,
          promptImages: event.promptImages,
          contextTokenBudget: event.contextTokenBudget,
          reserveTokens: event.reserveTokens,
          contextChannel: event.contextChannel,
          contextTrigger: event.contextTrigger,
          harnessDebugSequence: event.harnessDebugSequence,
          lastHarnessEventType: event.lastHarnessEventType,
          lastHarnessEventAgeMs: event.lastHarnessEventAgeMs,
          lastHarnessEventRunId: event.lastHarnessEventRunId,
          lastHarnessEventPhase: event.lastHarnessEventPhase,
          lastHarnessEventOutcome: event.lastHarnessEventOutcome,
          lastHarnessProvider: event.lastHarnessProvider,
          lastHarnessModel: event.lastHarnessModel,
          runStartedSeen: event.runStartedSeen,
          contextAssembledSeen: event.contextAssembledSeen,
          modelCallStartedSeen: event.modelCallStartedSeen,
          harnessRunStartedSeen: event.harnessRunStartedSeen,
          toolExecutionStartedSeen: event.toolExecutionStartedSeen,
          lastContextEngineEvent: event.lastContextEngineEvent,
          lastContextEngineEventAgeMs: event.lastContextEngineEventAgeMs,
          lastContextEngineTaskId: event.lastContextEngineTaskId,
          lastContextEngineOperation: event.lastContextEngineOperation,
          lastContextEngineLane: event.lastContextEngineLane,
          lastContextEngineMessage: event.lastContextEngineMessage,
        },
        { omitNullish: true }
      ),
    });
  }

  capturePluginError(event: TlonPluginErrorEvent): void {
    const ownerShip = event.ownerShip ?? '';
    if (!this.ensureIdentified(ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: ownerShip,
      event: TLON_PLUGIN_ERROR_EVENT,
      properties: this.properties(
        {
          harness: event.harness,
          pluginErrorSource: event.pluginErrorSource,
          accountId: event.accountId,
          ownerShip: event.ownerShip,
          botShip: event.botShip,
          errorKind: event.errorKind,
          errorText: event.errorText,
          attempt: event.attempt,
        },
        { omitNullish: true }
      ),
    });
  }

  captureTelemetryError(event: TlonTelemetryErrorEvent): void {
    const ownerShip = event.ownerShip ?? '';
    if (!this.ensureIdentified(ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: ownerShip,
      event: TLON_TELEMETRY_ERROR_EVENT,
      properties: this.properties(
        {
          harness: event.harness,
          telemetrySource: event.telemetrySource,
          sourceEventName: event.sourceEventName,
          sessionKey: event.sessionKey,
          sessionId: event.sessionId,
          runId: event.runId,
          accountId: event.accountId,
          agentId: event.agentId,
          ownerShip: event.ownerShip,
          botShip: event.botShip,
          errorKind: event.errorKind,
          errorText: event.errorText,
        },
        { omitNullish: true }
      ),
    });
  }

  private ensureIdentified(ownerShip: string, botShip: string): boolean {
    if (!ownerShip) {
      if (!this.missingOwnerWarningLogged) {
        this.missingOwnerWarningLogged = true;
        this.runtime?.log?.(
          '[tlon] Telemetry is enabled but ownerShip is not configured; skipping telemetry events'
        );
      }
      return false;
    }

    if (!this.identifiedOwners.has(ownerShip)) {
      this.identifiedOwners.add(ownerShip);
      this.client.identify({
        distinctId: ownerShip,
        properties: {
          logSource: TLON_TELEMETRY_LOG_SOURCE,
          ...this.versionIdentity,
          tlonOwnerShip: ownerShip,
          tlonBotShip: botShip,
        },
      });
    }
    return true;
  }

  captureHeartbeatNudge(event: TlonHeartbeatNudgeEvent): void {
    if (!this.ensureIdentified(event.ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: event.ownerShip,
      event: TLON_HEARTBEAT_NUDGE_EVENT,
      properties: this.properties({
        botShip: event.botShip,
        ownerShip: event.ownerShip,
        trigger: 'heartbeat',
        nudgeStage: event.nudgeStage,
        nudgeTarget: event.nudgeTarget,
        channel: event.channel,
        success: event.success,
        accountId: event.accountId,
        messageId: event.messageId,
        nudgeSentAtMs: event.nudgeSentAtMs,
      }),
    });
  }

  captureHeartbeatReengagement(event: TlonHeartbeatReengagementEvent): void {
    if (!this.ensureIdentified(event.ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: event.ownerShip,
      event: TLON_HEARTBEAT_REENGAGED_EVENT,
      properties: this.properties({
        botShip: event.botShip,
        ownerShip: event.ownerShip,
        nudgeStage: event.nudgeStage,
        nudgeSentAt: event.nudgeSentAt,
        reengagedAt: event.reengagedAt,
        reengagementDelayMs: event.reengagementDelayMs,
        channel: event.channel,
        accountId: event.accountId,
      }),
    });
  }

  async close(): Promise<void> {
    for (const token of [...this.activeReplyTraces.keys()]) {
      this.captureAbandonedReplyTrace(token, 'telemetry_close');
    }

    try {
      await this.client.flush();
    } catch (error) {
      this.runtime?.error?.(`[tlon] Telemetry flush failed: ${String(error)}`);
    }

    try {
      void this.client.shutdown();
    } catch (error) {
      this.runtime?.error?.(
        `[tlon] Telemetry shutdown failed: ${String(error)}`
      );
    }
  }
}

export function createTlonTelemetry(params: {
  config: TlonTelemetryConfig;
  runtime?: RuntimeEnv;
}): TlonTelemetryClient | null {
  if (!params.config.enabled) {
    return null;
  }

  if (!params.config.apiKey) {
    params.runtime?.log?.(
      '[tlon] Telemetry is enabled but telemetry.apiKey is missing; telemetry disabled'
    );
    return null;
  }

  params.runtime?.log?.(
    `[tlon] Telemetry enabled${params.config.host ? ` (${params.config.host})` : ''}`
  );

  return new PostHogTlonTelemetry({
    apiKey: params.config.apiKey,
    host: params.config.host,
    runtime: params.runtime,
  });
}

/**
 * Bridge so the global `message_sending` hook (registered in the extension
 * entry) can report route resolutions to the per-account telemetry client
 * (created in the monitor's runtime context). The two run in separate plugin
 * module contexts, so this must go through the shared-state slot, not a plain
 * module singleton. The monitor publishes a reporter bound to its telemetry
 * client + owner/bot ships; the hook calls `reportOutboundRoute`.
 */
export type OutboundRouteReporter = (event: TlonOutboundRouteEvent) => void;
export type SessionTelemetryReporter = (
  report: TlonSessionTelemetryReport
) => void;
export type ErrorTelemetryReporter = (
  report:
    | { kind: 'harness'; event: TlonHarnessErrorEvent }
    | { kind: 'plugin'; event: TlonPluginErrorReportInput }
    | { kind: 'telemetry'; event: TlonTelemetryErrorReportInput }
) => void;
export type DebugTelemetryReporter = (event: TlonHarnessDebugEvent) => void;

export type TlonCronJobChangedReportInput = Omit<
  TlonCronJobChangedEvent,
  'accountId' | 'ownerShip' | 'botShip'
>;
export type TlonCronRunReportInput = Omit<
  TlonCronRunEvent,
  'accountId' | 'ownerShip' | 'botShip'
>;
export type TlonCronSnapshotReportInput = Omit<
  TlonCronSnapshotEvent,
  'accountId' | 'ownerShip' | 'botShip'
>;

export type TlonCronTelemetryReport =
  | { kind: 'jobChanged'; event: TlonCronJobChangedReportInput }
  | { kind: 'run'; event: TlonCronRunReportInput }
  | { kind: 'snapshot'; event: TlonCronSnapshotReportInput };

export type CronTelemetryReporter = (report: TlonCronTelemetryReport) => void;

export type TlonSessionLifecycleReportInput = {
  lifecycleEvent: 'session_start' | 'session_end';
  sessionKey?: string | null;
  sessionId?: string | null;
  agentId?: string | null;
  reason?: string | null;
  messageCount?: number | null;
  durationMs?: number | null;
  transcriptArchived?: boolean | null;
  hasNextSession?: boolean;
};

export type TlonSessionDiagnosticReportInput =
  | {
      type: 'session.stalled' | 'session.stuck';
      sessionKey?: string | null;
      sessionId?: string | null;
      state: string;
      ageMs: number;
      queueDepth?: number;
      reason?: string;
      classification: string;
      activeWorkKind?: string;
      lastProgressAgeMs?: number;
      lastProgressReason?: string;
      activeToolName?: string;
      activeToolAgeMs?: number;
      terminalProgressStale?: boolean;
    }
  | {
      type: 'session.recovery.requested' | 'session.recovery.completed';
      sessionKey?: string | null;
      sessionId?: string | null;
      state: string;
      stateGeneration?: number;
      ageMs: number;
      queueDepth?: number;
      reason?: string;
      activeWorkKind?: string;
      allowActiveAbort?: boolean;
      status?: string;
      action?: string;
      outcomeReason?: string;
      released?: number;
      stale?: boolean;
    };

export type TlonSessionTurnCreatedReportInput = {
  type: 'session.turn.created';
  sessionKey?: string | null;
  sessionId?: string | null;
  runId?: string | null;
  agentId?: string | null;
};

export type TlonHarnessErrorReportInput = {
  harnessEventType: string;
  errorScope: TlonHarnessErrorScope;
  sessionKey?: string | null;
  sessionId?: string | null;
  runId?: string | null;
  accountId?: string | null;
  agentId?: string | null;
  ownerShip?: string | null;
  botShip?: string | null;
  destinationKind?: TlonDestinationKind | null;
  provider?: string | null;
  model?: string | null;
  toolName?: string | null;
  phase?: string | null;
  outcome?: string | null;
  errorCategory?: string | null;
  failureKind?: string | null;
  durationMs?: number | null;
  errorText?: string | null;
};

export type TlonHarnessDebugReportInput = {
  harnessEventType: string;
  debugEventKind: string;
  sessionKey?: string | null;
  sessionId?: string | null;
  runId?: string | null;
  accountId?: string | null;
  agentId?: string | null;
  ownerShip?: string | null;
  botShip?: string | null;
  destinationKind?: TlonDestinationKind | null;
  provider?: string | null;
  model?: string | null;
  phase?: string | null;
  outcome?: string | null;
  durationMs?: number | null;
  toolName?: string | null;
  toolCallId?: string | null;
  toolSource?: string | null;
  toolOwner?: string | null;
  pluginId?: string | null;
  harnessId?: string | null;
  modelCallId?: string | null;
  modelApi?: string | null;
  modelTransport?: string | null;
  requestPayloadBytes?: number | null;
  responseStreamBytes?: number | null;
  timeToFirstByteMs?: number | null;
  logLevel?: string | null;
  message?: string | null;
  loggerName?: string | null;
  codeFunctionName?: string | null;
  codeLine?: number | null;
  logAttributes?: TlonDiagnosticLogAttributes | null;
  contextEngineEvent?: string | null;
  contextEngineTaskId?: string | null;
  contextEngineOperation?: string | null;
  contextEngineLane?: string | null;
  errorName?: string | null;
  errorCode?: string | null;
  messageCount?: number | null;
  historyTextChars?: number | null;
  historyImageBlocks?: number | null;
  maxMessageTextChars?: number | null;
  systemPromptChars?: number | null;
  promptChars?: number | null;
  promptImages?: number | null;
  contextTokenBudget?: number | null;
  reserveTokens?: number | null;
  contextChannel?: string | null;
  contextTrigger?: string | null;
};

export type TlonPluginErrorReportInput = {
  pluginErrorSource: TlonPluginErrorSource;
  accountId?: string | null;
  ownerShip?: string | null;
  botShip?: string | null;
  errorKind?: string | null;
  errorText: string;
  attempt?: number | null;
};

export type TlonTelemetryErrorReportInput = {
  telemetrySource: string;
  sourceEventName?: string | null;
  sessionKey?: string | null;
  sessionId?: string | null;
  runId?: string | null;
  agentId?: string | null;
  accountId?: string | null;
  ownerShip?: string | null;
  botShip?: string | null;
  errorKind?: string | null;
  errorText: string;
};

const outboundRouteReporterSlot = sharedSlot<OutboundRouteReporter>(
  'telemetry.outboundRouteReporter'
);
const sessionTelemetryReporterSlot = sharedSlot<SessionTelemetryReporter>(
  'telemetry.sessionTelemetryReporter'
);
const errorTelemetryReporterSlot = sharedSlot<ErrorTelemetryReporter>(
  'telemetry.errorTelemetryReporter'
);
const debugTelemetryReporterSlot = sharedSlot<DebugTelemetryReporter>(
  'telemetry.debugTelemetryReporter'
);
const cronTelemetryReporterSlot = sharedSlot<CronTelemetryReporter>(
  'telemetry.cronTelemetryReporter'
);

export function setOutboundRouteReporter(
  reporter: OutboundRouteReporter | null
): void {
  outboundRouteReporterSlot.set(reporter);
}

export function reportOutboundRoute(event: TlonOutboundRouteEvent): void {
  outboundRouteReporterSlot.get()?.(event);
}

export function setSessionTelemetryReporter(
  reporter: SessionTelemetryReporter | null
): void {
  sessionTelemetryReporterSlot.set(reporter);
}

export function setErrorTelemetryReporter(
  reporter: ErrorTelemetryReporter | null
): void {
  errorTelemetryReporterSlot.set(reporter);
}

export function setDebugTelemetryReporter(
  reporter: DebugTelemetryReporter | null
): void {
  debugTelemetryReporterSlot.set(reporter);
}

export function setCronTelemetryReporter(
  reporter: CronTelemetryReporter | null
): void {
  cronTelemetryReporterSlot.set(reporter);
}

export function reportCronJobChanged(
  event: TlonCronJobChangedReportInput
): void {
  cronTelemetryReporterSlot.get()?.({ kind: 'jobChanged', event });
}

export function reportCronRun(event: TlonCronRunReportInput): void {
  cronTelemetryReporterSlot.get()?.({ kind: 'run', event });
}

export function reportCronSnapshot(event: TlonCronSnapshotReportInput): void {
  cronTelemetryReporterSlot.get()?.({ kind: 'snapshot', event });
}

function optionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function optionalErrorText(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function optionalNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const DIAGNOSTIC_LOG_ATTRIBUTE_KEY_RE = /^[A-Za-z0-9_.:-]{1,64}$/u;
const BLOCKED_DIAGNOSTIC_LOG_ATTRIBUTE_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

function normalizeLogAttributes(
  value: TlonDiagnosticLogAttributes | null | undefined
): TlonDiagnosticLogAttributes | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const normalized = Object.create(null) as TlonDiagnosticLogAttributes;
  for (const [key, attributeValue] of Object.entries(value)) {
    if (
      BLOCKED_DIAGNOSTIC_LOG_ATTRIBUTE_KEYS.has(key) ||
      !DIAGNOSTIC_LOG_ATTRIBUTE_KEY_RE.test(key)
    ) {
      continue;
    }
    if (typeof attributeValue === 'string') {
      normalized[key] = attributeValue;
      continue;
    }
    if (typeof attributeValue === 'boolean') {
      normalized[key] = attributeValue;
      continue;
    }
    if (typeof attributeValue === 'number' && Number.isFinite(attributeValue)) {
      normalized[key] = attributeValue;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function formatTlonTelemetryErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message || String(error);
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error === null) {
    return 'null';
  }

  if (error === undefined) {
    return 'undefined';
  }

  try {
    const json = JSON.stringify(error);
    if (json) {
      return json;
    }
  } catch {
    // Fall through to String(error).
  }

  return String(error);
}

export function reportSessionTurnCreated(
  event: TlonSessionTurnCreatedReportInput
): void {
  const context = lookupTlonSessionContext(event.sessionKey);
  if (!context) {
    return;
  }

  updateTlonSessionContextRuntime(context, {
    sessionId: event.sessionId,
    runId: event.runId,
    agentId: event.agentId,
  });
}

export function reportHarnessError(event: TlonHarnessErrorReportInput): void {
  const rememberedContext = lookupTlonSessionContext(event.sessionKey);
  const context = rememberedContext
    ? updateTlonSessionContextRuntime(rememberedContext, {
        sessionId: event.sessionId,
        runId: event.runId,
        agentId: event.agentId,
      })
    : null;

  const sessionKey = context?.sessionKey ?? optionalString(event.sessionKey);
  // Correlate using the diagnostic's own run id. The emitted run id may fall
  // back to a remembered interactive run, which must not influence whether a
  // run-id-less cron diagnostic matches a run-id-less cron signal.
  const diagnosticRunId = optionalString(event.runId);
  const runId = diagnosticRunId ?? context?.runId ?? null;
  const cronAttribution = CRON_GATEWAY_ERROR_SCOPES.has(event.errorScope)
    ? lookupCronRunAttribution(sessionKey, diagnosticRunId)
    : null;

  // Cron runs have no inbound Tlon reply, so they normally lack the remembered
  // session context required for harness telemetry. A positively correlated
  // cron error bypasses that gate so its full low-level diagnostic is emitted.
  if (!context && event.sessionKey && !cronAttribution) {
    return;
  }

  errorTelemetryReporterSlot.get()?.({
    kind: 'harness',
    event: {
      harness: 'openclaw',
      harnessEventType: event.harnessEventType,
      errorScope: event.errorScope,
      sessionKey,
      sessionId: context?.sessionId ?? optionalString(event.sessionId),
      runId,
      accountId: context?.accountId ?? optionalString(event.accountId),
      agentId: optionalString(event.agentId) ?? context?.agentId ?? null,
      ownerShip: context?.ownerShip ?? optionalString(event.ownerShip),
      botShip: context?.botShip ?? optionalString(event.botShip) ?? '',
      destinationKind:
        context?.destinationKind ?? event.destinationKind ?? null,
      provider: optionalString(event.provider),
      model: optionalString(event.model),
      toolName: optionalString(event.toolName),
      phase: optionalString(event.phase),
      outcome: optionalString(event.outcome),
      errorCategory: optionalString(event.errorCategory),
      failureKind: optionalString(event.failureKind),
      durationMs: optionalNumber(event.durationMs),
      errorText: optionalErrorText(event.errorText),
      isCron: cronAttribution != null,
      cronJobId: cronAttribution?.cronJobId ?? null,
    },
  });
}

export function reportHarnessDebug(event: TlonHarnessDebugReportInput): void {
  const rememberedContext = lookupTlonSessionContext(event.sessionKey);
  const context = rememberedContext
    ? updateTlonSessionContextRuntime(rememberedContext, {
        sessionId: event.sessionId,
        runId: event.runId,
        agentId: event.agentId,
      })
    : null;
  if (!context) {
    return;
  }

  const logAttributes = normalizeLogAttributes(event.logAttributes);
  const snapshot = updateHarnessDebugSnapshot(context.sessionKey, event);
  debugTelemetryReporterSlot.get()?.({
    harness: 'openclaw',
    harnessEventType: event.harnessEventType,
    debugEventKind: event.debugEventKind,
    sessionKey: context.sessionKey,
    sessionId: context.sessionId,
    runId: optionalString(event.runId) ?? context.runId,
    accountId: context.accountId ?? optionalString(event.accountId),
    agentId: optionalString(event.agentId) ?? context.agentId,
    ownerShip: context.ownerShip ?? optionalString(event.ownerShip),
    botShip: context.botShip ?? optionalString(event.botShip) ?? '',
    destinationKind: context.destinationKind ?? event.destinationKind ?? 'dm',
    provider: optionalString(event.provider),
    model: optionalString(event.model),
    phase: optionalString(event.phase),
    outcome: optionalString(event.outcome),
    durationMs: optionalNumber(event.durationMs),
    toolName: optionalString(event.toolName),
    toolCallId: optionalString(event.toolCallId),
    toolSource: optionalString(event.toolSource),
    toolOwner: optionalString(event.toolOwner),
    pluginId: optionalString(event.pluginId),
    harnessId: optionalString(event.harnessId),
    modelCallId: optionalString(event.modelCallId),
    modelApi: optionalString(event.modelApi),
    modelTransport: optionalString(event.modelTransport),
    requestPayloadBytes: optionalNumber(event.requestPayloadBytes),
    responseStreamBytes: optionalNumber(event.responseStreamBytes),
    timeToFirstByteMs: optionalNumber(event.timeToFirstByteMs),
    logLevel: optionalString(event.logLevel),
    message: optionalString(event.message),
    loggerName: optionalString(event.loggerName),
    codeFunctionName: optionalString(event.codeFunctionName),
    codeLine: optionalNumber(event.codeLine),
    logAttributes,
    contextEngineEvent: optionalString(event.contextEngineEvent),
    contextEngineTaskId: optionalString(event.contextEngineTaskId),
    contextEngineOperation: optionalString(event.contextEngineOperation),
    contextEngineLane: optionalString(event.contextEngineLane),
    errorName: optionalString(event.errorName),
    errorCode: optionalString(event.errorCode),
    messageCount: optionalNumber(event.messageCount),
    historyTextChars: optionalNumber(event.historyTextChars),
    historyImageBlocks: optionalNumber(event.historyImageBlocks),
    maxMessageTextChars: optionalNumber(event.maxMessageTextChars),
    systemPromptChars: optionalNumber(event.systemPromptChars),
    promptChars: optionalNumber(event.promptChars),
    promptImages: optionalNumber(event.promptImages),
    contextTokenBudget: optionalNumber(event.contextTokenBudget),
    reserveTokens: optionalNumber(event.reserveTokens),
    contextChannel: optionalString(event.contextChannel),
    contextTrigger: optionalString(event.contextTrigger),
    ...snapshot,
  });
}

export function reportPluginError(event: TlonPluginErrorReportInput): void {
  errorTelemetryReporterSlot.get()?.({
    kind: 'plugin',
    event,
  });
}

export function reportTelemetryError(
  event: TlonTelemetryErrorReportInput
): void {
  const rememberedContext = lookupTlonSessionContext(event.sessionKey);
  const context = rememberedContext
    ? updateTlonSessionContextRuntime(rememberedContext, {
        sessionId: event.sessionId,
        runId: event.runId,
        agentId: event.agentId,
      })
    : null;

  errorTelemetryReporterSlot.get()?.({
    kind: 'telemetry',
    event: {
      ...event,
      sessionKey: context?.sessionKey ?? optionalString(event.sessionKey),
      sessionId: context?.sessionId ?? optionalString(event.sessionId),
      runId: optionalString(event.runId) ?? context?.runId ?? null,
      agentId: optionalString(event.agentId) ?? context?.agentId ?? null,
      accountId: event.accountId ?? context?.accountId ?? null,
      ownerShip: event.ownerShip ?? context?.ownerShip ?? null,
      botShip: event.botShip ?? context?.botShip ?? null,
      sourceEventName: optionalString(event.sourceEventName),
      errorKind: optionalString(event.errorKind),
    },
  });
}

export function reportSessionLifecycle(
  event: TlonSessionLifecycleReportInput
): void {
  const rememberedContext = lookupTlonSessionContext(event.sessionKey);
  const context = rememberedContext
    ? updateTlonSessionContextSessionId(rememberedContext, event.sessionId)
    : null;
  if (!context) {
    return;
  }

  sessionTelemetryReporterSlot.get()?.({
    kind: 'lifecycle',
    event: {
      lifecycleEvent: event.lifecycleEvent,
      sessionKey: context.sessionKey,
      sessionId: context.sessionId,
      accountId: context.accountId,
      agentId: optionalString(event.agentId) ?? context.agentId,
      ownerShip: context.ownerShip,
      botShip: context.botShip,
      destinationKind: context.destinationKind,
      reason: optionalString(event.reason),
      messageCount: optionalNumber(event.messageCount),
      durationMs: optionalNumber(event.durationMs),
      transcriptArchived:
        typeof event.transcriptArchived === 'boolean'
          ? event.transcriptArchived
          : null,
      hasNextSession: event.hasNextSession === true,
    },
  });
}

export function reportSessionDiagnostic(
  event: TlonSessionDiagnosticReportInput
): void {
  const rememberedContext = lookupTlonSessionContext(event.sessionKey);
  const context = rememberedContext
    ? updateTlonSessionContextSessionId(rememberedContext, event.sessionId)
    : null;
  if (!context) {
    return;
  }
  const harnessDebugSnapshot = lookupHarnessDebugSnapshotFields(
    context.sessionKey
  );

  if (event.type === 'session.stalled' || event.type === 'session.stuck') {
    sessionTelemetryReporterSlot.get()?.({
      kind: 'watchdog',
      event: {
        diagnosticType: event.type,
        sessionKey: context.sessionKey,
        sessionId: context.sessionId,
        accountId: context.accountId,
        agentId: context.agentId,
        ownerShip: context.ownerShip,
        botShip: context.botShip,
        destinationKind: context.destinationKind,
        state: event.state,
        ageMs: event.ageMs,
        queueDepth: optionalNumber(event.queueDepth),
        reason: optionalString(event.reason),
        classification: event.classification,
        activeWorkKind: optionalString(event.activeWorkKind),
        lastProgressAgeMs: optionalNumber(event.lastProgressAgeMs),
        lastProgressReason: optionalString(event.lastProgressReason),
        activeToolName: optionalString(event.activeToolName),
        activeToolAgeMs: optionalNumber(event.activeToolAgeMs),
        terminalProgressStale: event.terminalProgressStale === true,
        ...harnessDebugSnapshot,
      },
    });
    return;
  }

  const recoveryEvent = event as Extract<
    TlonSessionDiagnosticReportInput,
    {
      type: 'session.recovery.requested' | 'session.recovery.completed';
    }
  >;

  sessionTelemetryReporterSlot.get()?.({
    kind: 'recovery',
    event: {
      diagnosticType: recoveryEvent.type,
      sessionKey: context.sessionKey,
      sessionId: context.sessionId,
      accountId: context.accountId,
      agentId: context.agentId,
      ownerShip: context.ownerShip,
      botShip: context.botShip,
      destinationKind: context.destinationKind,
      state: recoveryEvent.state,
      stateGeneration: optionalNumber(recoveryEvent.stateGeneration),
      ageMs: recoveryEvent.ageMs,
      queueDepth: optionalNumber(recoveryEvent.queueDepth),
      reason: optionalString(recoveryEvent.reason),
      activeWorkKind: optionalString(recoveryEvent.activeWorkKind),
      allowActiveAbort: recoveryEvent.allowActiveAbort === true,
      status: optionalString(recoveryEvent.status),
      action: optionalString(recoveryEvent.action),
      outcomeReason: optionalString(recoveryEvent.outcomeReason),
      released: optionalNumber(recoveryEvent.released),
      stale: recoveryEvent.stale === true,
      ...harnessDebugSnapshot,
    },
  });
}

export const _testing = {
  clearToolCalls: () => toolCallsBySession.clear(),
  clearSessionContexts: () => sessionContextsBySessionKey.clear(),
  clearHarnessDebugSnapshots: () => harnessDebugSnapshotsBySessionKey.clear(),
  clearCronRunAttribution: () => cronRunAttributionBySessionKey.clear(),
  getReplyTraceTtlMs: () => REPLY_TRACE_TTL_MS,
  getToolTraceTtlMs: () => TOOL_TRACE_TTL_MS,
};
