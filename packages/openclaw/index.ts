import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type OpenClawPluginApi,
  defineChannelPluginEntry,
} from 'openclaw/plugin-sdk/core';
import {
  onDiagnosticEvent,
  onInternalDiagnosticEvent,
} from 'openclaw/plugin-sdk/diagnostic-runtime';

import { tlonPlugin } from './src/channel.js';
import {
  installTlonDiagnosticSubscriptions,
  shouldInstallTlonDiagnosticSubscriptions,
} from './src/diagnostic-subscriptions.js';
import { sendGatewayStop } from './src/gateway-status.js';
import {
  createGatewayStatusManager,
  setGatewayStatusManager,
} from './src/gateway-status.js';
import { resolveBridgeForCommand } from './src/monitor/command-auth.js';
import { isRouteDebugEnabled } from './src/monitor/session-routing.js';
import { handleOwnerListenCommand } from './src/owner-listen-command.js';
import { setTlonRuntime } from './src/runtime.js';
import { getSessionRole } from './src/session-roles.js';
import { parseTlonTarget } from './src/targets.js';
import {
  type TlonDiagnosticLogAttributes,
  type TlonSessionDiagnosticReportInput,
  formatTlonTelemetryErrorText,
  recordToolCall,
  reportHarnessDebug,
  reportHarnessError,
  reportOutboundRoute,
  reportPluginError,
  reportSessionDiagnostic,
  reportSessionLifecycle,
  reportSessionTurnCreated,
  reportTelemetryError,
} from './src/telemetry.js';
import { resolveTlonBinary } from './src/tlon-binary.js';
import {
  checkBlockedSendOperation,
  formatAllowedTlonSubcommands,
  isAllowedTlonSubcommand,
} from './src/tlon-tool-guard.js';
import {
  findTlonSubcommandIndex,
  shellSplitCommand,
  summarizeTlonCommand,
} from './src/tlon-tool-command.js';
import {
  formatToolTraceEvent,
  liveToolTraceContentsEnabled,
  shouldLogAfterToolTrace,
} from './src/tool-trace.js';
import { listTlonAccountIds, resolveTlonAccount } from './src/types.js';
import {
  formatTlonVersionIdentity,
  resolveTlonSkillVersion,
  setTlonSkillVersionResolver,
} from './src/version.js';

export { tlonPlugin } from './src/channel.js';
export { setTlonRuntime } from './src/runtime.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/**
 * Run the tlon command and return the result
 */
function runTlonCommand(
  binary: string,
  args: string[],
  credentials?: { url: string; ship: string; code: string },
  options?: { timeoutMs?: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    if (credentials) {
      env.URBIT_SHIP = credentials.ship;
      env.URBIT_URL = credentials.url;
      env.URBIT_CODE = credentials.code;
    }

    const child = spawn(binary, args, { env });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutMs = options?.timeoutMs;

    const cleanup = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }
    };

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      cleanup();
      reject(new Error(`Failed to run tlon: ${err.message}`));
    });

    if (timeoutMs) {
      timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);
    }

    child.on('close', (code) => {
      cleanup();
      if (timedOut) {
        reject(new Error(`tlon timed out after ${timeoutMs}ms`));
      } else if (code !== 0) {
        reject(new Error(stderr || `tlon exited with code ${code}`));
      } else {
        resolve(stdout);
      }
    });
  });
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

export default defineChannelPluginEntry({
  id: 'tlon',
  name: 'Tlon',
  description: 'Tlon/Urbit channel plugin',
  plugin: tlonPlugin,
  setRuntime: setTlonRuntime,
  registerFull(api) {
    // ── Gateway-status liveness integration ───────────────────
    //
    // v1 requires exactly one Tlon account. With multiple accounts, multiple
    // monitors call configureTlonApiWithPoke() and the last one wins the
    // global @tloncorp/api singleton — making it unsafe to route heartbeats or
    // stop pokes to a specific ship. Disable entirely rather than route to the
    // wrong ship.
    //
    // We count ALL configured account entries (not just currently-runnable
    // ones) on purpose. The manager is a process-lifetime singleton created
    // here in registerFull, which does NOT re-run on config reload. If we
    // counted only runnable accounts, a config of one complete account plus a
    // disabled/unconfigured stub would enable the singleton, and later
    // completing the stub would start a second monitor that races the shared
    // API slot — without registerFull re-evaluating the gate. Counting every
    // entry keeps the feature off whenever a second account exists at all.
    const gsAccountIds = listTlonAccountIds(api.config);
    setGatewayStatusManager(null);

    if (gsAccountIds.length > 1) {
      api.logger.warn(
        `[gateway-status] disabled: ${gsAccountIds.length} Tlon accounts configured, ` +
          `but v1 only supports one (global @tloncorp/api client cannot target multiple ships)`
      );
    } else if (gsAccountIds.length === 1) {
      const gsManager = createGatewayStatusManager({
        logger: {
          log: (m) => api.logger.info(m),
          error: (m) => {
            reportPluginError({
              pluginErrorSource: 'gateway_status_heartbeat',
              errorKind: 'heartbeat',
              errorText: m,
            });
            api.logger.warn(m);
          },
        },
      });
      setGatewayStatusManager(gsManager);

      api.on('gateway_start', () => {
        gsManager.signalGatewayStarted();
        api.logger.info('[gateway-status] gateway_start received');
      });

      api.on('gateway_stop', async (event) => {
        if (gsManager.stopped) {
          return;
        }
        // Latch stopped FIRST, unconditionally. An activation task may be
        // in flight (between the %gateway-start poke and markActivated());
        // latching here makes its post-poke recheck bail so it can't start a
        // heartbeat after we've already passed the shutdown hook.
        const startPokeInFlightOrDone =
          gsManager.activated || gsManager.starting;
        gsManager.stopHeartbeat();
        gsManager.markStopped();
        // Only send %gateway-stop if a %gateway-start has been or is being
        // sent. If activation never reached the start poke, there is nothing
        // for the ship to stop.
        if (!startPokeInFlightOrDone) {
          return;
        }
        try {
          const sent = await sendGatewayStop({
            bootId: gsManager.bootId,
            reason: event.reason ?? 'shutdown',
          });
          if (sent) {
            api.logger.info(
              `[gateway-status] stopped (reason=${event.reason ?? 'shutdown'})`
            );
          } else {
            api.logger.warn(
              '[gateway-status] stop skipped: api-client params not published'
            );
          }
        } catch (err) {
          api.logger.warn(`[gateway-status] stop poke failed: ${String(err)}`);
        }
      });
    }
    // else: zero accounts configured — nothing to do

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
        tlonSkillVersion: await resolveTlonSkillVersion(),
      }),
    });
    void resolveTlonSkillVersion().then((version) => {
      api.logger.info(`[tlon] Tlon skill version: ${version}`);
    });

    // Register /tlon-version command
    api.registerCommand({
      name: 'tlon-version',
      description: 'Show Tlon plugin version.',
      handler: async () => {
        return renderTlonVersion();
      },
    });

    api.registerCommand({
      name: 'tlon',
      description: 'Tlon plugin diagnostics. Usage: /tlon version',
      acceptsArgs: true,
      handler: async (ctx) => {
        const args = (ctx.args ?? '').trim().toLowerCase();
        if (args !== 'version') {
          return { text: 'Usage: /tlon version' };
        }

        const result = resolveBridgeForCommand(ctx);
        if ('error' in result) {
          return { text: result.error };
        }
        return renderTlonVersion();
      },
    });

    // Register the tlon tool
    // Capture credentials from config at registration time
    const account = resolveTlonAccount(api.config);
    const credentials =
      account.configured && account.url && account.ship && account.code
        ? { url: account.url, ship: account.ship, code: account.code }
        : undefined;

    if (credentials) {
      api.logger.info(`[tlon] Credentials available for ${account.ship}`);
    } else {
      api.logger.warn(
        `[tlon] No credentials configured - tlon tool will rely on env vars`
      );
    }

    api.registerTool({
      name: 'tlon',
      label: 'Tlon CLI',
      description:
        'Tlon/Urbit API for reading data and administration: activity, channels, contacts, groups, messages, notes, posts, settings, upload, expose, hooks. ' +
        'DO NOT use this tool to send messages — use the `message` tool instead. ' +
        "Examples: 'activity mentions --limit 10', 'channels groups', 'contacts self', 'groups list', 'notes list'",
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description:
              'The tlon command and arguments (read/admin operations). ' +
              'To send messages, use the `message` tool, not this tool. ' +
              "Examples: 'activity mentions --limit 10', 'contacts get ~sampel-palnet', 'groups list', 'messages dm ~ship --limit 20', 'notes list'",
          },
        },
        required: ['command'],
      },
      async execute(_id: string, params: { command: string }) {
        try {
          const args = shellSplitCommand(params.command);

          const subIdx = findTlonSubcommandIndex(args);
          const subcommand = subIdx >= 0 ? args[subIdx] : undefined;
          if (!isAllowedTlonSubcommand(subcommand)) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error: Unknown tlon subcommand '${subcommand ?? '(none)'}'. Allowed: ${formatAllowedTlonSubcommands()}`,
                },
              ],
              details: { error: true },
            };
          }

          // Check for blocked send operations (uses args from subcommand onward)
          const blocked = checkBlockedSendOperation(args.slice(subIdx));
          if (blocked) {
            return {
              content: [{ type: 'text' as const, text: blocked }],
              details: { blocked: true, reason: 'send_operation' },
            };
          }

          const output = await runTlonCommand(tlonBinary, args, credentials);
          return {
            content: [{ type: 'text' as const, text: output }],
            details: undefined,
          };
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: 'text' as const, text: `Error: ${message}` }],
            details: { error: true },
          };
        }
      },
    });

    // Tool access control: block sensitive tools for non-owners
    const ownerOnlyTools = new Set(['tlon', 'cron', 'read']);
    const logToolTraceContents = liveToolTraceContentsEnabled();

    api.on('before_tool_call', (event, ctx) => {
      const role = getSessionRole(ctx.sessionKey ?? '');
      const isOwnerOnlyTool = ownerOnlyTools.has(event.toolName);
      const isBlocked = isOwnerOnlyTool && role === 'user';
      const blockReason = isBlocked
        ? `The ${event.toolName} tool is not available.`
        : undefined;

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
        return;
      }

      // Allow owner sessions and internal sessions (heartbeat, cron, etc.).
      // Internal sessions have no role because they're not triggered by DMs.
      // Only block when role is explicitly "user" (non-owner DM).
      if (isBlocked) {
        api.logger.warn(
          `[tlon] Blocked ${event.toolName} tool for non-owner. Session: ${ctx.sessionKey}, Role: ${role}`
        );
        return {
          block: true,
          blockReason,
        };
      }

      api.logger.info(
        `[tlon] Allowed ${event.toolName} tool for ${role ?? 'internal'} session. Session: ${ctx.sessionKey}`
      );
    });

    api.on('after_tool_call', (event, ctx) => {
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

    // ── Slash commands for approval & admin ────────────────────────────
    api.registerCommand({
      name: 'allow',
      description: 'Allow a pending DM/channel/group request',
      acceptsArgs: true,
      handler: async (ctx) => {
        const result = resolveBridgeForCommand(ctx);
        if ('error' in result) {
          return { text: result.error };
        }
        return {
          text: await result.bridge.handleAction(
            'approve',
            ctx.args?.trim() || undefined
          ),
        };
      },
    });

    api.registerCommand({
      name: 'reject',
      description: 'Reject a pending DM/channel/group request',
      acceptsArgs: true,
      handler: async (ctx) => {
        const result = resolveBridgeForCommand(ctx);
        if ('error' in result) {
          return { text: result.error };
        }
        return {
          text: await result.bridge.handleAction(
            'deny',
            ctx.args?.trim() || undefined
          ),
        };
      },
    });

    api.registerCommand({
      name: 'ban',
      description: 'Ban a ship and deny its pending request',
      acceptsArgs: true,
      handler: async (ctx) => {
        const result = resolveBridgeForCommand(ctx);
        if ('error' in result) {
          return { text: result.error };
        }
        return {
          text: await result.bridge.handleAction(
            'block',
            ctx.args?.trim() || undefined
          ),
        };
      },
    });

    api.registerCommand({
      name: 'pending',
      description: 'List pending approval requests',
      handler: async (ctx) => {
        const result = resolveBridgeForCommand(ctx);
        if ('error' in result) {
          return { text: result.error };
        }
        return { text: await result.bridge.getPendingList() };
      },
    });

    api.registerCommand({
      name: 'banned',
      description: 'List banned ships',
      handler: async (ctx) => {
        const result = resolveBridgeForCommand(ctx);
        if ('error' in result) {
          return { text: result.error };
        }
        return { text: await result.bridge.getBlockedList() };
      },
    });

    api.registerCommand({
      name: 'unban',
      description: 'Unban a ship (e.g. /unban ~sampel-palnet)',
      acceptsArgs: true,
      handler: async (ctx) => {
        const result = resolveBridgeForCommand(ctx);
        if ('error' in result) {
          return { text: result.error };
        }
        const ship = ctx.args?.trim();
        if (!ship) {
          return { text: 'Usage: /unban ~ship-name' };
        }
        return { text: await result.bridge.handleUnblock(ship) };
      },
    });

    api.registerCommand({
      name: 'owner-listen',
      description:
        'Control whether the bot listens for the owner without @-mention in owned channels. ' +
        'Usage: /owner-listen [on|off|status|list] [<channel-nest>]; ' +
        '/owner-listen all [on|off] for the global kill switch.',
      acceptsArgs: true,
      handler: async (ctx) => {
        const result = resolveBridgeForCommand(ctx);
        if ('error' in result) {
          return { text: result.error };
        }
        const text = await handleOwnerListenCommand(
          result.bridge,
          ctx.args,
          ctx.from
        );
        return { text };
      },
    });
  },
});
