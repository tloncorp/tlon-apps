import type { RuntimeEnv } from 'openclaw/plugin-sdk/runtime';
import { PostHog } from 'posthog-node';

import { sharedMap, sharedSlot } from './shared-state.js';
import type { TlonTelemetryConfig } from './types.js';

type ToolCallRecord = {
  toolName: string;
  durationMs: number | null;
  error: string | null;
  recordedAt: number;
};

type ToolSessionTrace = {
  updatedAt: number;
  calls: ToolCallRecord[];
};

export type ToolUsageSummary = {
  calls: Array<{
    toolName: string;
    durationMs: number | null;
    error: string | null;
  }>;
  names: string[];
  totalDurationMs: number;
  errorCount: number;
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

export type TlonReplyOutcome = 'responded' | 'no_reply' | 'error';

export type TlonReplyOutcomeEvent = {
  ownerShip: string | null;
  botShip: string;
  outcome: TlonReplyOutcome;
  chatType: 'dm' | 'groupChannel';
  isThreadReply: boolean;
  senderRole: 'owner' | 'user';
  attachmentCount: number;
  deliveredMessageCount: number;
  replyCharCount: number;
  replyWordCount: number;
  replyMediaCount: number;
  dispatchDurationMs: number;
  queuedFinal: boolean;
  queuedFinalCount: number;
  queuedBlockCount: number;
  provider: string | null;
  model: string | null;
  thinkLevel: string | null;
  toolUsage: ToolUsageSummary;
};

export type TlonReplyTelemetryStart = {
  sessionKey: string;
  ownerShip: string | null;
  botShip: string;
  chatType: 'dm' | 'groupChannel';
  isThreadReply: boolean;
  senderRole: 'owner' | 'user';
  attachmentCount: number;
};

export type TlonReplyTelemetryResult = {
  deliveredMessageCount: number;
  replyCharCount: number;
  replyWordCount: number;
  replyMediaCount: number;
  dispatchDurationMs: number;
  queuedFinal: boolean;
  queuedFinalCount: number;
  queuedBlockCount: number;
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

export interface TlonTelemetryClient {
  startReply(params: TlonReplyTelemetryStart): TlonReplyTelemetrySession;
  captureHeartbeatNudge(event: TlonHeartbeatNudgeEvent): void;
  captureHeartbeatReengagement(event: TlonHeartbeatReengagementEvent): void;
  captureOutboundRoute(
    event: TlonOutboundRouteEvent & {
      ownerShip?: string | null;
      botShip: string;
    }
  ): void;
  close(): Promise<void>;
}

const TLON_TELEMETRY_EVENT_NAME = 'TlonBot Reply Handled';
const TLON_OUTBOUND_ROUTED_EVENT = 'TlonBot Outbound Routed';
const TLON_HEARTBEAT_NUDGE_EVENT = 'TlonBot Heartbeat Nudge Sent';
const TLON_HEARTBEAT_REENGAGED_EVENT = 'TlonBot Heartbeat Nudge Reengaged';
const TLON_TELEMETRY_LOG_SOURCE = 'openclawPlugin';
const TOOL_TRACE_TTL_MS = 60 * 60 * 1000;
const MAX_TOOL_CALLS_PER_SESSION = 200;
const toolCallsBySession = sharedMap<string, ToolSessionTrace>(
  'telemetry.toolCallsBySession'
);

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
      })) ?? [];

  return {
    calls,
    names: calls.map((call) => call.toolName),
    totalDurationMs: calls.reduce(
      (total, call) => total + (call.durationMs ?? 0),
      0
    ),
    errorCount: calls.filter((call) => call.error).length,
  };
}

function resolveReplyOutcome(params: {
  deliveredMessageCount: number;
  dispatchError?: unknown;
}): TlonReplyOutcome {
  if (params.deliveredMessageCount > 0) {
    return 'responded';
  }

  return params.dispatchError ? 'error' : 'no_reply';
}

class PostHogTlonTelemetry implements TlonTelemetryClient {
  private readonly client: PostHog;
  private readonly runtime?: RuntimeEnv;
  private readonly identifiedOwners = new Set<string>();
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

  startReply(params: TlonReplyTelemetryStart): TlonReplyTelemetrySession {
    const toolTraceCursor = createToolTraceCursor(params.sessionKey);

    return {
      capture: async (result) => {
        // Yield once so after_tool_call hooks for the just-finished reply have time to run.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));

        this.captureReplyOutcome({
          ownerShip: params.ownerShip,
          botShip: params.botShip,
          outcome: resolveReplyOutcome({
            deliveredMessageCount: result.deliveredMessageCount,
            dispatchError: result.dispatchError,
          }),
          chatType: params.chatType,
          isThreadReply: params.isThreadReply,
          senderRole: params.senderRole,
          attachmentCount: params.attachmentCount,
          deliveredMessageCount: result.deliveredMessageCount,
          replyCharCount: result.replyCharCount,
          replyWordCount: result.replyWordCount,
          replyMediaCount: result.replyMediaCount,
          dispatchDurationMs: result.dispatchDurationMs,
          queuedFinal: result.queuedFinal,
          queuedFinalCount: result.queuedFinalCount,
          queuedBlockCount: result.queuedBlockCount,
          provider: result.provider,
          model: result.model,
          thinkLevel: result.thinkLevel,
          toolUsage: collectToolUsageSince(params.sessionKey, toolTraceCursor),
        });
      },
    };
  }

  private captureReplyOutcome(event: TlonReplyOutcomeEvent): void {
    const ownerShip = event.ownerShip ?? '';
    if (!this.ensureIdentified(ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: ownerShip,
      event: TLON_TELEMETRY_EVENT_NAME,
      properties: {
        logSource: TLON_TELEMETRY_LOG_SOURCE,
        botShip: event.botShip,
        ownerShip: event.ownerShip,
        outcome: event.outcome,
        chatType: event.chatType,
        isThreadReply: event.isThreadReply,
        senderRole: event.senderRole,
        attachmentCount: event.attachmentCount,
        hasAttachments: event.attachmentCount > 0,
        deliveredMessageCount: event.deliveredMessageCount,
        replyCharCount: event.replyCharCount,
        replyWordCount: event.replyWordCount,
        replyMediaCount: event.replyMediaCount,
        dispatchDurationMs: event.dispatchDurationMs,
        queuedFinal: event.queuedFinal,
        queuedFinalCount: event.queuedFinalCount,
        queuedBlockCount: event.queuedBlockCount,
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
        })),
      },
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
      properties: {
        logSource: TLON_TELEMETRY_LOG_SOURCE,
        botShip: event.botShip,
        ownerShip: event.ownerShip,
        resolvedChannel: event.resolvedChannel,
        routedToTlon: event.routedToTlon,
        targetKind: event.targetKind,
      },
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
      properties: {
        logSource: TLON_TELEMETRY_LOG_SOURCE,
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
      },
    });
  }

  captureHeartbeatReengagement(event: TlonHeartbeatReengagementEvent): void {
    if (!this.ensureIdentified(event.ownerShip, event.botShip)) {
      return;
    }

    this.client.capture({
      distinctId: event.ownerShip,
      event: TLON_HEARTBEAT_REENGAGED_EVENT,
      properties: {
        logSource: TLON_TELEMETRY_LOG_SOURCE,
        botShip: event.botShip,
        ownerShip: event.ownerShip,
        nudgeStage: event.nudgeStage,
        nudgeSentAt: event.nudgeSentAt,
        reengagedAt: event.reengagedAt,
        reengagementDelayMs: event.reengagementDelayMs,
        channel: event.channel,
        accountId: event.accountId,
      },
    });
  }

  async close(): Promise<void> {
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

const outboundRouteReporterSlot = sharedSlot<OutboundRouteReporter>(
  'telemetry.outboundRouteReporter'
);

export function setOutboundRouteReporter(
  reporter: OutboundRouteReporter | null
): void {
  outboundRouteReporterSlot.set(reporter);
}

export function reportOutboundRoute(event: TlonOutboundRouteEvent): void {
  outboundRouteReporterSlot.get()?.(event);
}

export const _testing = {
  clearToolCalls: () => toolCallsBySession.clear(),
  getToolTraceTtlMs: () => TOOL_TRACE_TTL_MS,
};
