import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineBundledChannelEntry } from 'openclaw/plugin-sdk/channel-entry-contract';
import { type OpenClawPluginApi } from 'openclaw/plugin-sdk/core';
import {
  onDiagnosticEvent,
  onInternalDiagnosticEvent,
} from 'openclaw/plugin-sdk/diagnostic-runtime';

import { tlonPlugin } from './src/channel.js';
import { registerTlonCommands } from './src/commands-registry.js';
import { publishContextLensEvent } from './src/context-lens-events.js';
import { registerContextLensRoutes } from './src/context-lens-routes.js';
import { initContextLensShipSync } from './src/context-lens-ship-sync.js';
import { initContextLensStore } from './src/context-lens-store.js';
import { detailToolParams } from './src/context-lens-tool-params.js';
import {
  ensureBackgroundContextLensForSession,
  recordContextLensToolResultForSession,
  recordContextLensToolStartForSession,
  scheduleBackgroundContextLensFinalization,
} from './src/context-lens.js';
import {
  recordTlonCronAgentContext,
  resetTlonCronObservability,
} from './src/cron-observability.js';
import {
  clearCronServiceAccessor,
  handleCronChangedEvent,
  setCronServiceAccessor,
} from './src/cron-telemetry.js';
import {
  installTlonDiagnosticSubscriptions,
  shouldInstallTlonDiagnosticSubscriptions,
} from './src/diagnostic-subscriptions.js';
import { notifyDiaryMigrationDiscovery } from './src/diary-migration-discovery.js';
import { registerGatewayStatusHooks } from './src/gateway-status-registration.js';
import {
  createMigrateCommandHandler,
  routeMigrateCommand,
} from './src/migrate-command.js';
import {
  handleAgentOnboardingCronChanged,
  handleAgentOnboardingMessageSent,
} from './src/monitor/agent-onboarding.js';
import { resolveBridgeForCommand } from './src/monitor/command-auth.js';
import { isRouteDebugEnabled } from './src/monitor/session-routing.js';
import { setTlonRuntime } from './src/runtime.js';
import { getSessionRole } from './src/session-roles.js';
import { parseTlonTarget } from './src/targets.js';
import {
  type TlonDiagnosticLogAttributes,
  type TlonSessionDiagnosticReportInput,
  formatTlonTelemetryErrorText,
  recordCronRunAttribution,
  recordToolCall,
  reportHarnessDebug,
  reportHarnessError,
  reportOutboundRoute,
  reportSessionDiagnostic,
  reportSessionLifecycle,
  reportSessionTurnCreated,
  reportTelemetryError,
} from './src/telemetry.js';
import { resolveTlonBinary } from './src/tlon-binary.js';
import {
  DEFAULT_TLON_CLI_TIMEOUT_MS,
  runTlonCommand,
} from './src/tlon-command-runner.js';
import {
  createTlonToolExecutor,
  summarizeTlonCommand,
} from './src/tlon-tool-command.js';
import {
  formatToolTraceEvent,
  liveToolTraceContentsEnabled,
  shouldLogAfterToolTrace,
} from './src/tool-trace.js';
import { recordActiveTlonTurnToolCall } from './src/turn-recorder.js';
import { resolveTlonAccount } from './src/types.js';
import {
  formatTlonVersionIdentity,
  resolveTlonSkillVersion,
  setTlonSkillVersionResolver,
} from './src/version.js';

export { tlonPlugin } from './src/channel.js';
export { setTlonRuntime } from './src/runtime.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readToolCallId(event: unknown): string | undefined {
  if (!event || typeof event !== 'object') {
    return undefined;
  }
  const value =
    (
      event as {
        toolCallId?: unknown;
        callId?: unknown;
        id?: unknown;
      }
    ).toolCallId ??
    (event as { callId?: unknown }).callId ??
    (event as { id?: unknown }).id;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
const require = createRequire(import.meta.url);

function summarizeToolParams(params: unknown): string | undefined {
  if (params === null || params === undefined) {
    return undefined;
  }
  if (Array.isArray(params)) {
    return `${params.length} array item${params.length === 1 ? '' : 's'}`;
  }
  if (typeof params === 'object') {
    const keys = Object.keys(params);
    if (!keys.length) {
      return 'empty object';
    }
    const shown = keys.slice(0, 4).join(', ');
    const suffix = keys.length > 4 ? ` +${keys.length - 4}` : '';
    return `${keys.length} key${keys.length === 1 ? '' : 's'}: ${shown}${suffix}`;
  }
  return typeof params;
}

function firstLine(value: string): string {
  return value.trim().split(/\r?\n/)[0]?.trim() || 'unknown';
}

function summarizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return firstLine(message).slice(0, 180);
}

async function readTlonSkillVersion(binary: string): Promise<string> {
  try {
    return firstLine(
      await runTlonCommand(binary, ['--version'], undefined, {
        timeoutMs: 5_000,
      })
    );
  } catch (error) {
    return `unavailable (${summarizeError(error)})`;
  }
}

function isTlonSessionDiagnosticEvent(event: {
  type: string;
}): event is TlonSessionDiagnosticReportInput {
  return (
    event.type === 'session.stalled' ||
    event.type === 'session.stuck' ||
    event.type === 'session.recovery.requested' ||
    event.type === 'session.recovery.completed'
  );
}

type DiagnosticCandidate = Record<string, unknown> & { type?: unknown };

function stringField(event: DiagnosticCandidate, key: string): string | null {
  const value = event[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberField(event: DiagnosticCandidate, key: string): number | null {
  const value = event[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function objectField(
  event: DiagnosticCandidate,
  key: string
): Record<string, unknown> | null {
  const value = event[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function diagnosticLogAttributes(
  event: DiagnosticCandidate
): TlonDiagnosticLogAttributes | null {
  const attributes = objectField(event, 'attributes');
  if (!attributes) {
    return null;
  }

  const normalized = Object.create(null) as TlonDiagnosticLogAttributes;
  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value === 'string') {
      normalized[key] = value;
      continue;
    }
    if (typeof value === 'boolean') {
      normalized[key] = value;
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      normalized[key] = value;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function stringAttribute(
  attributes: TlonDiagnosticLogAttributes | null,
  key: string
): string | null {
  const value = attributes?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberAttribute(
  attributes: TlonDiagnosticLogAttributes | null,
  key: string
): number | null {
  const value = attributes?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function diagnosticErrorText(event: DiagnosticCandidate): string | null {
  return stringField(event, 'error') ?? stringField(event, 'message');
}

function stringListField(event: DiagnosticCandidate, key: string): string[] {
  const value = event[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

function diagnosticSummary(
  parts: Array<[string, string | number | boolean | null | undefined]>
): string {
  return parts
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== ''
    )
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
}

const HARNESS_DEBUG_EVENT_TYPES = new Set([
  'session.turn.created',
  'run.started',
  'run.completed',
  'context.assembled',
  'model.call.started',
  'model.call.completed',
  'model.call.error',
  'harness.run.started',
  'harness.run.completed',
  'harness.run.error',
  'tool.execution.started',
  'tool.execution.completed',
  'tool.execution.error',
  'tool.execution.blocked',
]);

const HARNESS_DEBUG_LOG_PATTERNS = [
  '[context-engine]',
  '[lcm]',
  '[trace:embedded-run]',
  'context engine',
  'lossless-claw',
];

function debugEventKind(type: string): string {
  if (type === 'session.turn.created') {
    return 'turn';
  }
  if (type === 'context.assembled') {
    return 'context';
  }
  if (type.startsWith('model.call.')) {
    return 'model';
  }
  if (type.startsWith('harness.run.')) {
    return 'harness';
  }
  if (type.startsWith('tool.execution.')) {
    return 'tool';
  }
  if (type.startsWith('run.')) {
    return 'run';
  }
  if (type === 'log.record') {
    return 'log';
  }
  return 'diagnostic';
}

function isContextEngineDebugMessage(message: string | null): boolean {
  const normalized = message?.toLowerCase() ?? '';
  return HARNESS_DEBUG_LOG_PATTERNS.some((pattern) =>
    normalized.includes(pattern)
  );
}

function extractContextEngineTaskId(message: string | null): string | null {
  return extractDiagnosticKeyValue(message, 'taskId');
}

function extractDiagnosticKeyValue(
  message: string | null,
  key: string
): string | null {
  if (!message) {
    return null;
  }
  return new RegExp(`\\b${key}=([^\\s]+)`).exec(message)?.[1] ?? null;
}

function extractDiagnosticSessionKey(message: string | null): string | null {
  if (!message) {
    return null;
  }
  return /\bsessionKey=([^\s]+)/.exec(message)?.[1] ?? null;
}

function shouldReportHarnessDebug(event: DiagnosticCandidate, type: string) {
  if (HARNESS_DEBUG_EVENT_TYPES.has(type)) {
    return true;
  }
  if (type !== 'log.record') {
    return false;
  }

  const message = stringField(event, 'message');
  if (isContextEngineDebugMessage(message)) {
    return true;
  }

  const level = stringField(event, 'level')?.toLowerCase();
  const attributes = diagnosticLogAttributes(event);
  return (
    Boolean(
      stringField(event, 'sessionKey') ??
        stringAttribute(attributes, 'sessionKey')
    ) &&
    (level === 'warn' || level === 'warning' || level === 'error')
  );
}

function reportHarnessDebugDiagnostic(
  event: DiagnosticCandidate,
  type: string
) {
  if (!shouldReportHarnessDebug(event, type)) {
    return;
  }

  const message = stringField(event, 'message');
  const attributes = diagnosticLogAttributes(event);
  const code = objectField(event, 'code');
  const codeFunctionName =
    typeof code?.functionName === 'string' && code.functionName.trim()
      ? code.functionName
      : null;
  const codeLine =
    typeof code?.line === 'number' && Number.isFinite(code.line)
      ? code.line
      : null;
  const isContextEngineEvent = isContextEngineDebugMessage(message);
  const contextEngineTaskId =
    stringField(event, 'contextEngineTaskId') ??
    stringAttribute(attributes, 'contextEngineTaskId') ??
    stringAttribute(attributes, 'taskId') ??
    extractContextEngineTaskId(message);
  const contextEngineOperation =
    stringField(event, 'contextEngineOperation') ??
    stringAttribute(attributes, 'contextEngineOperation') ??
    stringAttribute(attributes, 'operation') ??
    extractDiagnosticKeyValue(message, 'operation');
  const contextEngineLane =
    stringField(event, 'contextEngineLane') ??
    stringAttribute(attributes, 'contextEngineLane') ??
    stringAttribute(attributes, 'lane') ??
    extractDiagnosticKeyValue(message, 'lane');
  reportHarnessDebug({
    harnessEventType: type,
    debugEventKind: debugEventKind(type),
    sessionKey:
      stringField(event, 'sessionKey') ??
      stringAttribute(attributes, 'sessionKey') ??
      extractDiagnosticSessionKey(message),
    sessionId:
      stringField(event, 'sessionId') ??
      stringAttribute(attributes, 'sessionId'),
    runId: stringField(event, 'runId') ?? stringAttribute(attributes, 'runId'),
    agentId:
      stringField(event, 'agentId') ?? stringAttribute(attributes, 'agentId'),
    provider:
      stringField(event, 'provider') ?? stringAttribute(attributes, 'provider'),
    model: stringField(event, 'model') ?? stringAttribute(attributes, 'model'),
    phase: stringField(event, 'phase') ?? stringAttribute(attributes, 'phase'),
    outcome:
      stringField(event, 'outcome') ?? stringAttribute(attributes, 'outcome'),
    durationMs:
      numberField(event, 'durationMs') ??
      numberAttribute(attributes, 'durationMs'),
    toolName:
      stringField(event, 'toolName') ?? stringAttribute(attributes, 'toolName'),
    toolCallId:
      stringField(event, 'toolCallId') ??
      stringAttribute(attributes, 'toolCallId'),
    toolSource:
      stringField(event, 'toolSource') ??
      stringAttribute(attributes, 'toolSource'),
    toolOwner:
      stringField(event, 'toolOwner') ??
      stringAttribute(attributes, 'toolOwner'),
    pluginId:
      stringField(event, 'pluginId') ?? stringAttribute(attributes, 'pluginId'),
    harnessId:
      stringField(event, 'harnessId') ??
      stringAttribute(attributes, 'harnessId'),
    modelCallId:
      stringField(event, 'modelCallId') ??
      stringField(event, 'callId') ??
      stringAttribute(attributes, 'modelCallId') ??
      stringAttribute(attributes, 'callId'),
    modelApi:
      stringField(event, 'modelApi') ?? stringAttribute(attributes, 'modelApi'),
    modelTransport:
      stringField(event, 'modelTransport') ??
      stringAttribute(attributes, 'modelTransport'),
    requestPayloadBytes:
      numberField(event, 'requestPayloadBytes') ??
      numberAttribute(attributes, 'requestPayloadBytes'),
    responseStreamBytes:
      numberField(event, 'responseStreamBytes') ??
      numberAttribute(attributes, 'responseStreamBytes'),
    timeToFirstByteMs:
      numberField(event, 'timeToFirstByteMs') ??
      numberAttribute(attributes, 'timeToFirstByteMs'),
    logLevel: stringField(event, 'level'),
    loggerName: stringField(event, 'loggerName'),
    codeFunctionName,
    codeLine,
    logAttributes: attributes,
    message,
    contextEngineEvent: isContextEngineEvent ? type : null,
    contextEngineTaskId,
    contextEngineOperation,
    contextEngineLane,
    errorName:
      stringField(event, 'errorName') ??
      stringAttribute(attributes, 'errorName'),
    errorCode:
      stringField(event, 'errorCode') ??
      stringAttribute(attributes, 'errorCode'),
    messageCount:
      numberField(event, 'messageCount') ??
      numberAttribute(attributes, 'messageCount'),
    historyTextChars:
      numberField(event, 'historyTextChars') ??
      numberAttribute(attributes, 'historyTextChars'),
    historyImageBlocks:
      numberField(event, 'historyImageBlocks') ??
      numberAttribute(attributes, 'historyImageBlocks'),
    maxMessageTextChars:
      numberField(event, 'maxMessageTextChars') ??
      numberAttribute(attributes, 'maxMessageTextChars'),
    systemPromptChars:
      numberField(event, 'systemPromptChars') ??
      numberAttribute(attributes, 'systemPromptChars'),
    promptChars:
      numberField(event, 'promptChars') ??
      numberAttribute(attributes, 'promptChars'),
    promptImages:
      numberField(event, 'promptImages') ??
      numberAttribute(attributes, 'promptImages'),
    contextTokenBudget:
      numberField(event, 'contextTokenBudget') ??
      numberAttribute(attributes, 'contextTokenBudget'),
    reserveTokens:
      numberField(event, 'reserveTokens') ??
      numberAttribute(attributes, 'reserveTokens'),
    contextChannel:
      stringField(event, 'contextChannel') ??
      stringField(event, 'channel') ??
      stringAttribute(attributes, 'contextChannel') ??
      stringAttribute(attributes, 'channel'),
    contextTrigger:
      stringField(event, 'contextTrigger') ??
      stringField(event, 'trigger') ??
      stringAttribute(attributes, 'contextTrigger') ??
      stringAttribute(attributes, 'trigger'),
  });
}

function reportHarnessDiagnostic(event: DiagnosticCandidate): void {
  const type = stringField(event, 'type');
  if (!type) {
    return;
  }

  if (type === 'session.turn.created') {
    reportSessionTurnCreated({
      type,
      sessionKey: stringField(event, 'sessionKey'),
      sessionId: stringField(event, 'sessionId'),
      runId: stringField(event, 'runId'),
      agentId: stringField(event, 'agentId'),
    });
    reportHarnessDebugDiagnostic(event, type);
    return;
  }

  reportHarnessDebugDiagnostic(event, type);

  const common = {
    harnessEventType: type,
    sessionKey: stringField(event, 'sessionKey'),
    sessionId: stringField(event, 'sessionId'),
    runId: stringField(event, 'runId'),
    agentId: stringField(event, 'agentId'),
    provider: stringField(event, 'provider'),
    model: stringField(event, 'model'),
    phase: stringField(event, 'phase'),
    outcome: stringField(event, 'outcome'),
    errorCategory: stringField(event, 'errorCategory'),
    failureKind: stringField(event, 'failureKind'),
    durationMs: numberField(event, 'durationMs'),
    errorText: diagnosticErrorText(event),
  };

  switch (type) {
    case 'harness.run.error':
      reportHarnessError({
        ...common,
        errorScope: 'harness',
      });
      return;
    case 'harness.run.completed':
      if (common.outcome === 'completed') {
        return;
      }
      reportHarnessError({
        ...common,
        errorScope: 'harness',
      });
      return;
    case 'model.call.error':
      reportHarnessError({
        ...common,
        errorScope: 'model',
      });
      return;
    case 'model.failover': {
      const reason = stringField(event, 'reason');
      const fromProvider = stringField(event, 'fromProvider');
      const fromModel = stringField(event, 'fromModel');
      const toProvider = stringField(event, 'toProvider');
      const toModel = stringField(event, 'toModel');
      reportHarnessError({
        ...common,
        errorScope: 'model',
        provider: fromProvider,
        model: fromModel,
        phase: stringField(event, 'lane'),
        outcome: 'failover',
        errorCategory: 'model_failover',
        failureKind: reason,
        errorText: diagnosticSummary([
          ['fromProvider', fromProvider],
          ['fromModel', fromModel],
          ['toProvider', toProvider],
          ['toModel', toModel],
          ['reason', reason],
          ['cascadeDepth', numberField(event, 'cascadeDepth')],
        ]),
      });
      return;
    }
    case 'tool.execution.error':
      reportHarnessError({
        ...common,
        errorScope: 'tool',
        toolName: stringField(event, 'toolName'),
      });
      return;
    case 'tool.execution.blocked': {
      const deniedReason = stringField(event, 'deniedReason');
      const reason = stringField(event, 'reason');
      reportHarnessError({
        ...common,
        errorScope: 'tool',
        toolName: stringField(event, 'toolName'),
        phase: stringField(event, 'toolSource'),
        outcome: 'blocked',
        errorCategory: 'tool_blocked',
        failureKind: deniedReason,
        errorText: reason ?? deniedReason,
      });
      return;
    }
    case 'tool.loop': {
      const level = stringField(event, 'level');
      const action = stringField(event, 'action');
      if (level !== 'critical' && action !== 'block') {
        return;
      }
      reportHarnessError({
        ...common,
        errorScope: 'tool',
        toolName: stringField(event, 'toolName'),
        phase: level,
        outcome: action,
        errorCategory: 'tool_loop',
        failureKind: stringField(event, 'detector'),
        errorText:
          stringField(event, 'message') ??
          diagnosticSummary([
            ['level', level],
            ['action', action],
            ['detector', stringField(event, 'detector')],
            ['count', numberField(event, 'count')],
          ]),
      });
      return;
    }
    case 'run.completed':
      if (common.outcome === 'completed') {
        return;
      }
      reportHarnessError({
        ...common,
        errorScope: 'run',
      });
      return;
    case 'message.delivery.error':
      reportHarnessError({
        ...common,
        errorScope: 'message_delivery',
        phase: stringField(event, 'deliveryKind'),
      });
      return;
    case 'message.dispatch.completed':
      if (common.outcome !== 'error') {
        return;
      }
      reportHarnessError({
        ...common,
        errorScope: 'message_dispatch',
        phase: stringField(event, 'source'),
      });
      return;
    case 'message.processed':
      if (common.outcome !== 'error') {
        return;
      }
      reportHarnessError({
        ...common,
        errorScope: 'message_processing',
        phase: stringField(event, 'channel'),
      });
      return;
    case 'diagnostic.async_queue.dropped':
      reportHarnessError({
        ...common,
        errorScope: 'diagnostics',
        outcome: 'dropped',
        errorCategory: 'diagnostic_async_queue_dropped',
        failureKind: 'queue_full',
        errorText: diagnosticSummary([
          ['droppedEvents', numberField(event, 'droppedEvents')],
          ['droppedTrustedEvents', numberField(event, 'droppedTrustedEvents')],
          [
            'droppedUntrustedEvents',
            numberField(event, 'droppedUntrustedEvents'),
          ],
          ['queueLength', numberField(event, 'queueLength')],
          ['maxQueueLength', numberField(event, 'maxQueueLength')],
        ]),
      });
      return;
    case 'diagnostic.liveness.warning': {
      const reasons = stringListField(event, 'reasons');
      reportHarnessError({
        ...common,
        errorScope: 'runtime',
        phase: stringField(event, 'phase'),
        outcome: 'warning',
        errorCategory: 'liveness_warning',
        failureKind: reasons.join(',') || null,
        durationMs: numberField(event, 'intervalMs'),
        errorText: diagnosticSummary([
          ['reasons', reasons.join(',')],
          ['eventLoopDelayP99Ms', numberField(event, 'eventLoopDelayP99Ms')],
          ['eventLoopDelayMaxMs', numberField(event, 'eventLoopDelayMaxMs')],
          ['cpuCoreRatio', numberField(event, 'cpuCoreRatio')],
          ['active', numberField(event, 'active')],
          ['waiting', numberField(event, 'waiting')],
          ['queued', numberField(event, 'queued')],
        ]),
      });
      return;
    }
    case 'diagnostic.memory.pressure': {
      const memory = event.memory as Record<string, unknown> | undefined;
      const memoryNumber = (key: string) => {
        const value = memory?.[key];
        return typeof value === 'number' && Number.isFinite(value)
          ? value
          : null;
      };
      reportHarnessError({
        ...common,
        errorScope: 'runtime',
        outcome: stringField(event, 'level'),
        errorCategory: 'memory_pressure',
        failureKind: stringField(event, 'reason'),
        durationMs: numberField(event, 'windowMs'),
        errorText: diagnosticSummary([
          ['level', stringField(event, 'level')],
          ['reason', stringField(event, 'reason')],
          ['rssBytes', memoryNumber('rssBytes')],
          ['heapUsedBytes', memoryNumber('heapUsedBytes')],
          ['thresholdBytes', numberField(event, 'thresholdBytes')],
          ['rssGrowthBytes', numberField(event, 'rssGrowthBytes')],
        ]),
      });
      return;
    }
    case 'payload.large':
      if (stringField(event, 'action') !== 'rejected') {
        return;
      }
      reportHarnessError({
        ...common,
        errorScope: 'payload',
        phase: stringField(event, 'surface'),
        outcome: 'rejected',
        errorCategory: 'payload_large',
        failureKind: stringField(event, 'reason'),
        errorText: diagnosticSummary([
          ['surface', stringField(event, 'surface')],
          ['channel', stringField(event, 'channel')],
          ['pluginId', stringField(event, 'pluginId')],
          ['bytes', numberField(event, 'bytes')],
          ['limitBytes', numberField(event, 'limitBytes')],
          ['count', numberField(event, 'count')],
          ['reason', stringField(event, 'reason')],
        ]),
      });
      return;
  }
}

function safeTelemetryObserver(params: {
  logger: { warn: (message: string) => void };
  telemetrySource: string;
  sourceEventName?: string | null;
  sessionKey?: string | null;
  sessionId?: string | null;
  runId?: string | null;
  agentId?: string | null;
  run: () => void;
}): void {
  try {
    params.run();
  } catch (error) {
    params.logger.warn(
      `[tlon] Telemetry observer failed (${params.telemetrySource}${params.sourceEventName ? `:${params.sourceEventName}` : ''}): ${String(error)}`
    );
    try {
      reportTelemetryError({
        telemetrySource: params.telemetrySource,
        sourceEventName: params.sourceEventName,
        sessionKey: params.sessionKey,
        sessionId: params.sessionId,
        runId: params.runId,
        agentId: params.agentId,
        errorKind: error instanceof Error ? error.name : typeof error,
        errorText: formatTlonTelemetryErrorText(error),
      });
    } catch (reportError) {
      params.logger.warn(
        `[tlon] Telemetry error reporting failed: ${String(reportError)}`
      );
    }
  }
}

function installTelemetryDiagnosticObservers(
  api: OpenClawPluginApi
): () => void {
  return installTlonDiagnosticSubscriptions(() => {
    const unsubscribeDiagnosticEvents = onDiagnosticEvent((event) => {
      const candidate = event as unknown as { type: string };
      safeTelemetryObserver({
        logger: api.logger,
        telemetrySource: 'diagnostic_session',
        sourceEventName: candidate.type,
        sessionKey: (candidate as { sessionKey?: string }).sessionKey,
        sessionId: (candidate as { sessionId?: string }).sessionId,
        run: () => {
          if (isTlonSessionDiagnosticEvent(candidate)) {
            reportSessionDiagnostic(candidate);
          }
        },
      });
    });
    const unsubscribeInternalDiagnosticEvents = onInternalDiagnosticEvent(
      (event) => {
        const candidate = event as DiagnosticCandidate;
        safeTelemetryObserver({
          logger: api.logger,
          telemetrySource: 'diagnostic_internal',
          sourceEventName: stringField(candidate, 'type'),
          sessionKey: stringField(candidate, 'sessionKey'),
          sessionId: stringField(candidate, 'sessionId'),
          runId: stringField(candidate, 'runId'),
          agentId: stringField(candidate, 'agentId'),
          run: () => reportHarnessDiagnostic(candidate),
        });
      }
    );

    return () => {
      unsubscribeDiagnosticEvents();
      unsubscribeInternalDiagnosticEvents();
    };
  });
}

export default defineBundledChannelEntry({
  id: 'tlon',
  name: 'Tlon',
  description: 'Tlon/Urbit channel plugin',
  importMetaUrl: import.meta.url,
  plugin: {
    specifier: './src/channel.js',
    exportName: 'tlonPlugin',
  },
  runtime: {
    specifier: './src/runtime.js',
    exportName: 'setTlonRuntime',
  },
  registerFull(api) {
    // ── Gateway-status liveness integration ───────────────────
    //
    // registerFull is NOT a once-per-process call: OpenClaw invokes it once
    // per load pass — tool discovery, full channel activation, and (on
    // 6.11+) a ~10s post-startup runtime-plugin prewarm that re-runs it
    // into a SEPARATE plugin registry. `gateway_start`/`gateway_stop` are
    // fire-once, non-latched hooks bound against whichever registry is
    // active when they fire, so nulling-and-recreating the coordinator here
    // on every pass (the old behavior) could orphan an already-resolved
    // coordinator behind a never-resolved replacement.
    //
    // registerGatewayStatusHooks() is idempotent across passes: it
    // get-or-creates a single process-lifetime coordinator (independent of
    // Tlon account count — see gateway-status.ts) and (re)binds the hooks
    // onto the CURRENT pass's `api` every time. Per-monitor eligibility
    // (exactly one Tlon account) is evaluated in the monitor itself, from
    // its own config snapshot, so an account added/removed via a
    // channels.tlon hot-reload takes effect without a second registerFull.
    registerGatewayStatusHooks(api, {
      logger: {
        log: (m) => api.logger.info(m),
        error: (m) => api.logger.warn(m),
      },
    });

    // Resolve the tlon tool binary once. The tool itself and version
    // diagnostics share this path so telemetry reports what OpenClaw will
    // actually execute.
    const tlonBinary = resolveTlonBinary({
      moduleDir: __dirname,
      resolveModule: require.resolve,
      log: (msg) => api.logger.debug?.(msg),
    });
    api.logger.info(`[tlon] Registering tlon tool, binary: ${tlonBinary}`);

    setTlonSkillVersionResolver(() => readTlonSkillVersion(tlonBinary));
    const renderTlonVersion = async () => ({
      text: formatTlonVersionIdentity({
        harnessVersion: api.runtime.version,
        tlonSkillVersion: await resolveTlonSkillVersion(),
      }),
    });
    void resolveTlonSkillVersion().then((version) => {
      api.logger.info(`[tlon] Tlon skill version: ${version}`);
    });

    const contextLensRoutesEnabled = registerContextLensRoutes(api);
    const contextLensShipSyncEnabled = initContextLensShipSync(api);
    // Recording and the disk store run when at least one reader path is
    // live: authed gateway routes or %context-lens ship sync.
    const contextLensEnabled =
      contextLensRoutesEnabled || contextLensShipSyncEnabled;
    if (contextLensEnabled) {
      initContextLensStore(api);
    }

    // Register the tlon tool
    // Capture credentials from config at registration time
    const account = resolveTlonAccount(api.config);
    const credentials =
      account.configured && account.url && account.ship && account.code
        ? { url: account.url, ship: account.ship, code: account.code }
        : undefined;
    const toolTimeoutMs =
      account.lifecycle.toolTimeoutMs ?? DEFAULT_TLON_CLI_TIMEOUT_MS;
    const handleMigrateCommand = createMigrateCommandHandler({
      runCommand: (args, commandCredentials, timeoutMs, onDeadline) =>
        runTlonCommand(tlonBinary, args, commandCredentials, {
          timeoutMs,
          onDeadline,
        }),
      logError: (message) => api.logger.warn(`[tlon] ${message}`),
    });

    if (credentials) {
      api.logger.info(`[tlon] Credentials available for ${account.ship}`);
    } else {
      api.logger.warn(
        `[tlon] No credentials configured - tlon tool will rely on env vars`
      );
    }

    const executeTlonTool = createTlonToolExecutor({
      runCommand: (args) =>
        runTlonCommand(tlonBinary, args, credentials, {
          timeoutMs: toolTimeoutMs,
        }),
      notifyDiaryMigrationDiscovery: (nest) =>
        notifyDiaryMigrationDiscovery(nest, api.config),
      logError: (message) => api.logger.warn(`[tlon] ${message}`),
    });

    api.registerTool({
      name: 'tlon',
      label: 'Tlon CLI',
      description:
        'Tlon/Urbit API for reading data and administration: activity, channels, contacts, groups, messages, notes, posts, settings, upload, expose, hooks. ' +
        'DO NOT use this tool to send messages — use the `message` tool instead. ' +
        '%diary channels are deprecated and unsupported by this CLI tool; ask the owner to type `/migrate <diary-nest>` to move one to %notes. ' +
        'OpenClaw message delivery still accepts diary/ targets, including writable archives. ' +
        'Never use LaTeX math delimiters ($...$, $$...$$, \\(...\\), \\[...\\]) in note bodies or message text — Tlon renders no math; write math as plain text/Unicode or in code blocks. ' +
        "Examples: 'activity mentions --limit 10', 'channels groups', 'contacts self', 'groups list', 'notes list'",
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description:
              'The tlon command and arguments (read/admin operations). ' +
              'To send messages, use the `message` tool, not this tool. ' +
              'Do not try migration writes through this model tool: ask the owner to type `/migrate <diary-nest>`. ' +
              'The message tool can still send to diary/ targets; migration only renames the source and does not make it read-only. ' +
              "Examples: 'activity mentions --limit 10', 'contacts get ~sampel-palnet', 'groups list', 'messages dm ~ship --limit 20', 'notes list'",
          },
        },
        required: ['command'],
      },
      execute: executeTlonTool,
    });

    // Tool access control: block sensitive tools for non-owners
    const ownerOnlyTools = new Set(['tlon', 'cron', 'read']);
    const logToolTraceContents = liveToolTraceContentsEnabled();

    api.on('before_tool_call', (event, ctx) => {
      const toolCallId = readToolCallId(event);
      const role = getSessionRole(ctx.sessionKey ?? '');
      const isOwnerOnlyTool = ownerOnlyTools.has(event.toolName);
      const isBlocked = isOwnerOnlyTool && role === 'user';
      const blockReason = isBlocked
        ? `The ${event.toolName} tool is not available.`
        : undefined;
      if (contextLensEnabled) {
        // Capture tool activity even when no conversation run owns this
        // session (cron wakes — including jobs that reuse the main session
        // and so inherit a sender-role entry — heartbeats, subagents).
        // No-ops when a conversation lens is already bound.
        const isCronSession = (ctx.sessionKey ?? '').includes(':cron:');
        const background = ensureBackgroundContextLensForSession(
          ctx.sessionKey,
          {
            runKind: isCronSession ? 'cron' : 'internal',
            trigger: isCronSession ? 'cron' : 'tool',
            preview: `${event.toolName} tool activity`,
          }
        );
        if (background?.created) {
          publishContextLensEvent('created', background.lens);
        }
        const lens = recordContextLensToolStartForSession(
          ctx.sessionKey,
          event.toolName,
          {
            phase: 'before',
            argumentSummary: summarizeToolParams(event.params),
            argumentDetail: detailToolParams(event.params),
            toolCallId,
          }
        );
        if (lens) {
          publishContextLensEvent('tool_start', lens, {
            toolName: event.toolName,
            ...(toolCallId ? { toolCallId } : {}),
            toolPhase: 'before',
            toolCallCount: lens.tools.callCount,
          });
        }
      }

      if (logToolTraceContents) {
        api.logger.info(
          formatToolTraceEvent({
            phase: 'before',
            sessionKey: ctx.sessionKey,
            toolName: event.toolName,
            payload: {
              params: event.params,
              role: role ?? 'internal',
              blocked: isBlocked,
              ...(blockReason ? { blockReason } : {}),
            },
          })
        );
      }

      if (!isOwnerOnlyTool) {
        return undefined;
      }

      // Allow owner sessions and internal sessions (heartbeat, cron, etc.).
      // Internal sessions have no role because they're not triggered by DMs.
      // Only block when role is explicitly "user" (non-owner DM).
      if (isBlocked) {
        api.logger.warn(
          `[tlon] Blocked ${event.toolName} tool for non-owner. Session: ${ctx.sessionKey}, Role: ${role}`
        );
        if (contextLensEnabled) {
          const blockedLens = recordContextLensToolResultForSession(
            ctx.sessionKey,
            event.toolName,
            {
              error: blockReason,
              status: 'blocked',
              toolCallId,
            }
          );
          if (blockedLens) {
            publishContextLensEvent('tool_result', blockedLens, {
              toolName: event.toolName,
              ...(toolCallId ? { toolCallId } : {}),
              toolPhase: 'blocked',
              toolCallCount: blockedLens.tools.callCount,
            });
            scheduleBackgroundContextLensFinalization(
              ctx.sessionKey,
              (finalLens) => {
                publishContextLensEvent('final', finalLens);
              }
            );
          }
        }
        return {
          block: true,
          blockReason,
        };
      }

      api.logger.info(
        `[tlon] Allowed ${event.toolName} tool for ${role ?? 'internal'} session. Session: ${ctx.sessionKey}`
      );
      return undefined;
    });

    api.on('after_tool_call', (event, ctx) => {
      const toolCallId = readToolCallId(event);
      recordActiveTlonTurnToolCall();
      if (logToolTraceContents && shouldLogAfterToolTrace(event)) {
        api.logger.info(
          formatToolTraceEvent({
            phase: 'after',
            sessionKey: ctx.sessionKey,
            toolName: event.toolName,
            payload: {
              params: event.params,
              result: event.result,
              error: event.error ?? null,
              durationMs: event.durationMs ?? null,
            },
          })
        );
      }

      safeTelemetryObserver({
        logger: api.logger,
        telemetrySource: 'after_tool_call',
        sourceEventName: event.toolName,
        sessionKey: ctx.sessionKey,
        run: () => {
          recordToolCall({
            sessionKey: ctx.sessionKey,
            toolName: event.toolName,
            durationMs: event.durationMs,
            error: event.error,
            context:
              event.toolName === 'tlon' &&
              typeof event.params.command === 'string'
                ? summarizeTlonCommand(event.params.command)
                : undefined,
          });
        },
      });
      if (contextLensEnabled) {
        const lens = recordContextLensToolResultForSession(
          ctx.sessionKey,
          event.toolName,
          {
            durationMs: event.durationMs,
            error: event.error,
            toolCallId,
          }
        );
        if (lens) {
          publishContextLensEvent('tool_result', lens, {
            toolName: event.toolName,
            ...(toolCallId ? { toolCallId } : {}),
            toolPhase: 'after',
            toolCallCount: lens.tools.callCount,
          });
          scheduleBackgroundContextLensFinalization(
            ctx.sessionKey,
            (finalLens) => {
              publishContextLensEvent('final', finalLens);
            }
          );
        }
      }
    });

    // ── Session lifecycle / watchdog telemetry ─────────────────────────
    // These hooks are global to OpenClaw, so telemetry.ts filters them through
    // session keys remembered from Tlon inbound replies before emitting.
    api.on('session_start', (event, ctx) => {
      safeTelemetryObserver({
        logger: api.logger,
        telemetrySource: 'session_start',
        sourceEventName: 'session_start',
        sessionKey: event.sessionKey ?? ctx.sessionKey,
        sessionId: event.sessionId ?? ctx.sessionId,
        agentId: ctx.agentId,
        run: () => {
          reportSessionLifecycle({
            lifecycleEvent: 'session_start',
            sessionKey: event.sessionKey ?? ctx.sessionKey,
            sessionId: event.sessionId ?? ctx.sessionId,
            agentId: ctx.agentId,
            hasNextSession: false,
          });
        },
      });
    });

    api.on('session_end', (event, ctx) => {
      safeTelemetryObserver({
        logger: api.logger,
        telemetrySource: 'session_end',
        sourceEventName: 'session_end',
        sessionKey: event.sessionKey ?? ctx.sessionKey,
        sessionId: event.sessionId ?? ctx.sessionId,
        agentId: ctx.agentId,
        run: () => {
          reportSessionLifecycle({
            lifecycleEvent: 'session_end',
            sessionKey: event.sessionKey ?? ctx.sessionKey,
            sessionId: event.sessionId ?? ctx.sessionId,
            agentId: ctx.agentId,
            reason: event.reason ?? null,
            messageCount: event.messageCount,
            durationMs: event.durationMs ?? null,
            transcriptArchived: event.transcriptArchived ?? null,
            hasNextSession: Boolean(
              event.nextSessionId ?? event.nextSessionKey
            ),
          });
        },
      });
    });

    // ── Cron observability ──────────────────────────────────────────────
    // `cron_changed` is a gateway-global hook; owner/bot identity is injected
    // by the monitor's cron reporter (setCronTelemetryReporter). The
    // gateway_start handler publishes the cron service accessor so the monitor
    // can emit its boot-time job-count snapshot without a hook context.
    api.on('gateway_start', (_event, ctx) => {
      if (ctx.getCron) {
        setCronServiceAccessor(ctx.getCron);
      }
    });
    api.on('gateway_stop', () => {
      clearCronServiceAccessor();
      resetTlonCronObservability();
    });

    api.on('cron_changed', async (event, ctx) => {
      try {
        await handleCronChangedEvent(event, ctx);
        await handleAgentOnboardingCronChanged(event);
      } catch (error) {
        api.logger.warn(
          `[tlon] Telemetry observer failed (cron_changed:${event.action}): ${String(error)}`
        );
        try {
          reportTelemetryError({
            telemetrySource: 'cron_changed',
            sourceEventName: event.action,
            errorKind: error instanceof Error ? error.name : typeof error,
            errorText: formatTlonTelemetryErrorText(error),
          });
        } catch (reportError) {
          api.logger.warn(
            `[tlon] Telemetry error reporting failed: ${String(reportError)}`
          );
        }
      }
    });

    if (shouldInstallTlonDiagnosticSubscriptions(api.registrationMode)) {
      const unsubscribeDiagnosticEvents =
        installTelemetryDiagnosticObservers(api);
      api.on('gateway_stop', unsubscribeDiagnosticEvents);
    }

    // ── Route diagnostics ───────────────────────────────────────────────
    // Fires for every outbound send OpenClaw routes — the primary streamed
    // reply (resolves to `tlon`) and route-dependent sends (the shared
    // `message` tool, subagents, which can resolve elsewhere). `ctx.channelId`
    // is where the send resolved; `routedToTlon: false` (e.g. `webchat`) is the
    // leak this work targets. Read-only; never alters delivery.
    //
    // Two sinks: a PostHog event (the primary, fleet-wide signal — gated by the
    // existing telemetry config, on in hosted prod) so we can count how often
    // sends land off-Tlon; and a debug-gated local log for single-gateway
    // triage.
    api.on('message_sending', (event, ctx) => {
      safeTelemetryObserver({
        logger: api.logger,
        telemetrySource: 'message_sending',
        sourceEventName: 'message_sending',
        sessionKey: ctx.sessionKey,
        runId: ctx.runId,
        run: () => {
          const resolvedChannel = ctx.channelId;
          const routedToTlon = resolvedChannel === 'tlon';
          // Only infer target kind for Tlon targets; a webchat target id is not
          // a Tlon target and must not be misclassified.
          const parsedTarget = routedToTlon ? parseTlonTarget(event.to) : null;
          const targetKind =
            parsedTarget?.kind === 'dm'
              ? 'dm'
              : parsedTarget?.kind === 'channel'
                ? 'group'
                : 'unknown';

          reportOutboundRoute({ resolvedChannel, routedToTlon, targetKind });

          if (isRouteDebugEnabled()) {
            api.logger.info(
              `[tlon][route-debug] message_sending ${JSON.stringify({
                channelId: ctx.channelId,
                to: event.to,
                routedToTlon,
                targetKind,
                sessionKey: ctx.sessionKey ?? null,
                conversationId: ctx.conversationId ?? null,
                messageId: ctx.messageId ?? null,
                threadId: event.threadId ?? null,
              })}`
            );
          }
        },
      });
    });

    api.on('message_sent', (event, ctx) => {
      void handleAgentOnboardingMessageSent(event).catch((error) => {
        api.logger.error(
          `[tlon] agent onboarding delivery completion failed: ${String(error)}`
        );
      });
      safeTelemetryObserver({
        logger: api.logger,
        telemetrySource: 'message_sent',
        sourceEventName: 'message_sent',
        sessionKey: event.sessionKey ?? ctx.sessionKey,
        runId: event.runId ?? ctx.runId,
        run: () => {
          if (event.success !== false) {
            return;
          }
          reportHarnessError({
            harnessEventType: 'message_sent',
            errorScope: 'message_delivery',
            sessionKey: event.sessionKey ?? ctx.sessionKey,
            runId: event.runId ?? ctx.runId,
            errorText: event.error ?? null,
            outcome: 'error',
          });
        },
      });
    });

    // Cron jobs can run inside the main session, where the session key has
    // no `:cron:` marker — the agent-level hook context is the only place
    // the gateway exposes the cron trigger, so tag the run's lens here
    // before any tool fires. Idempotent across both hooks.
    const ensureCronContextLens = (ctx: {
      sessionKey?: string;
      trigger?: string;
      jobId?: string;
    }) => {
      if (!contextLensEnabled || ctx.trigger !== 'cron') {
        return;
      }
      const background = ensureBackgroundContextLensForSession(ctx.sessionKey, {
        runKind: 'cron',
        trigger: 'cron',
        preview: ctx.jobId ? `cron job ${ctx.jobId}` : 'cron run',
      });
      if (background?.created) {
        publishContextLensEvent('created', background.lens);
      }
    };
    // Record cron attribution independently of the context lens so low-level
    // model/harness/run failures can bypass the inbound-session telemetry gate
    // and retain their detailed diagnostic fields. The lifecycle hook remains
    // the authoritative source for the final cron outcome.
    const onCronAgentHook = (ctx: {
      sessionId?: string;
      sessionKey?: string;
      trigger?: string;
      jobId?: string;
      runId?: string;
    }) => {
      if (ctx.trigger === 'cron') {
        recordTlonCronAgentContext({
          jobId: ctx.jobId,
          runId: ctx.runId,
          sessionId: ctx.sessionId,
          sessionKey: ctx.sessionKey,
        });
        safeTelemetryObserver({
          logger: api.logger,
          telemetrySource: 'cron_run_attribution',
          sessionKey: ctx.sessionKey,
          runId: ctx.runId,
          run: () =>
            recordCronRunAttribution({
              sessionKey: ctx.sessionKey,
              runId: ctx.runId,
              jobId: ctx.jobId,
            }),
        });
      }
      ensureCronContextLens(ctx);
    };
    api.on('agent_turn_prepare', (_event, ctx) => onCronAgentHook(ctx));
    api.on('model_call_started', (_event, ctx) => onCronAgentHook(ctx));

    // Background lenses normally finalize on tool-result idle; agent_end
    // re-arms the window so runs that end with model output (no trailing
    // tool call) still finalize, while leaving time for the gateway to
    // deliver the reply (stamped + recorded via the outbound send path).
    api.on('agent_end', (_event, ctx) => {
      if (!contextLensEnabled) {
        return;
      }
      scheduleBackgroundContextLensFinalization(ctx.sessionKey, (finalLens) => {
        publishContextLensEvent('final', finalLens);
      });
    });

    // ── Slash commands for approval & admin ────────────────────────────
    // All plugin commands live in one table (commands-registry.ts) that both
    // registers the handlers and serializes as fixtures/commands.json, the
    // token list the Tlon client's drift contract pins its static list against.
    registerTlonCommands(api, {
      renderTlonVersion,
      handleMigrateCommand,
      config: api.config,
    });
  },
});
