import { createHash } from 'node:crypto';
import {
  browserLifecycleEvent,
  type BrowserLifecycleEvent,
  type BrowserLifecycleInput,
} from '@tloncorp/api';
import { sharedSlot } from './shared-state.js';

export type BrowserAgentContext = {
  sessionKey?: string;
  sessionId?: string;
  runId?: string;
  toolCallId?: string;
};
export type BrowserAgentEvent = BrowserLifecycleEvent & BrowserAgentContext;
const reporter =
  sharedSlot<(event: BrowserAgentEvent) => void>('browser.telemetry');
const taskObserver = sharedSlot<
  (
    event: BrowserLifecycleEvent,
    context: BrowserAgentContext,
    handle?: string
  ) => string | undefined
>('browser.taskObserver');
export function setBrowserTaskObserver(
  value:
    | ((
        event: BrowserLifecycleEvent,
        context: BrowserAgentContext,
        handle?: string
      ) => string | undefined)
    | null
) {
  taskObserver.set(value);
}

export function setBrowserTelemetryReporter(
  value: ((event: BrowserAgentEvent) => void) | null
) {
  reporter.set(value);
}

export function reportBrowserLifecycle(
  input: BrowserLifecycleInput,
  context: BrowserAgentContext = {},
  handle?: string
) {
  // Observability must never fail a browser action or reveal its error contents.
  try {
    const event = browserLifecycleEvent(input);
    if (event) {
      const taskId = taskObserver.get()?.(event, context, handle);
      if (taskId) event.browserTaskId = taskId;
      reporter.get()?.({
        ...event,
        sessionKey: context.sessionKey,
        sessionId: context.sessionId,
        runId: context.runId,
        toolCallId: context.toolCallId,
      });
      return taskId;
    }
  } catch {
    /* Best effort, matching the gateway's telemetry observers. */
  }
}

export function browserSessionTelemetryId(handle: unknown): string | undefined {
  return typeof handle === 'string' && /^sess_[A-Za-z0-9_-]{22}$/.test(handle)
    ? createHash('sha256').update(handle).digest('hex')
    : undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// Broker responses wrap MCP results in details or a JSON text block. Only walk
// those envelopes; page content is never searched for ids or outcome claims.
function resultEnvelope(value: unknown, depth = 0): Record<string, unknown> {
  const result = record(value);
  if (
    depth >= 4 ||
    result.isError !== undefined ||
    result.status === 'error' ||
    result.structuredContent !== undefined
  )
    return result;
  for (const key of ['details', 'result']) {
    if (result[key] && typeof result[key] === 'object') {
      const nested = resultEnvelope(result[key], depth + 1);
      if (
        nested.isError !== undefined ||
        nested.status === 'error' ||
        nested.structuredContent !== undefined
      )
        return nested;
    }
  }
  if (Array.isArray(result.content) && result.content.length === 1) {
    const block = record(result.content[0]);
    if (
      block.type === 'text' &&
      typeof block.text === 'string' &&
      block.text.length <= 65_536
    ) {
      try {
        return resultEnvelope(JSON.parse(block.text), depth + 1);
      } catch {
        /* Not an MCP envelope. */
      }
    }
  }
  return result;
}

const operations = new Set([
  'session_create',
  'session_release',
  'session_live_view',
  'session_handoff',
  'navigate',
  'snapshot',
  'screenshot',
  'click',
  'type',
  'fill',
  'scroll',
  'keypress',
  'evaluate',
  'run',
  'scrape',
  'find',
  'act',
  'wait',
]);

export function observeBrowserToolStart(
  event: { toolName: string; params: Record<string, unknown> },
  context: BrowserAgentContext
) {
  const operation = browserOperation(event);
  if (!operation) return;
  reportBrowserLifecycle(
    {
      source: 'agent',
      phase: 'operation_started',
      outcome: 'unknown',
      operation,
      browserSessionId:
        operation === 'session_create'
          ? undefined
          : browserSessionTelemetryId(
              record(event.params.arguments).session_id
            ),
    },
    context,
    typeof record(event.params.arguments).session_id === 'string'
      ? (record(event.params.arguments).session_id as string)
      : undefined
  );
}

function browserOperation(event: {
  toolName: string;
  params: Record<string, unknown>;
}): BrowserLifecycleInput['operation'] {
  const name = event.params.name;
  // Gateway status reads are monitoring, never evidence of agent resumption.
  if (name === 'browser_browser_session_monitor') return undefined;
  if (
    event.toolName !== 'mcp__call' ||
    typeof name !== 'string' ||
    !name.startsWith('browser_browser_')
  )
    return undefined;
  const raw = name.slice('browser_browser_'.length);
  return operations.has(raw)
    ? (raw as NonNullable<BrowserLifecycleInput['operation']>)
    : 'other';
}

export function observeBrowserToolResult(
  event: {
    toolName: string;
    params: Record<string, unknown>;
    result?: unknown;
    error?: string;
    durationMs?: number;
  },
  context: BrowserAgentContext
) {
  const operation = browserOperation(event);
  if (!operation) return;
  const result = resultEnvelope(event.result);
  const failed =
    Boolean(event.error) ||
    result.isError === true ||
    result.status === 'error';
  const metadata = record(result.structuredContent);
  const args = record(event.params.arguments);
  const browserSessionId = browserSessionTelemetryId(
    operation === 'session_create' ? metadata.session_id : args.session_id
  );
  // No thrown error alone is insufficient evidence of a successful create.
  const accepted =
    !failed &&
    (operation === 'session_create'
      ? Boolean(browserSessionId)
      : result.isError === false || result.structuredContent !== undefined);
  const runStatuses = [
    'done',
    'uncertain',
    'needs_review',
    'stuck',
    'page_changed',
    'needs_input',
    'needs_handoff',
    'needs_confirmation',
    'cancelled',
    'error',
  ];
  const runStatus =
    operation === 'run' &&
    typeof metadata.status === 'string' &&
    runStatuses.includes(metadata.status)
      ? (metadata.status as BrowserLifecycleInput['runStatus'])
      : undefined;
  reportBrowserLifecycle(
    {
      source: 'agent',
      phase:
        operation === 'session_create'
          ? 'session_created'
          : operation === 'session_release'
            ? 'session_released'
            : 'session_activity',
      operation,
      browserSessionId,
      runStatus,
      outcome: failed ? 'failed' : accepted ? 'accepted' : 'unknown',
      durationMs: event.durationMs,
    },
    context,
    operation === 'session_create' && typeof metadata.session_id === 'string'
      ? metadata.session_id
      : typeof args.session_id === 'string'
        ? args.session_id
        : undefined
  );
}
