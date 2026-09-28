import type { TlonToolCallContext } from './tlon-tool-command.js';

export type TlonToolOutcome = 'ok' | 'error' | 'blocked';

export type TlonToolDiagnosticRecord = {
  level: 'INFO' | 'WARN' | 'ERROR';
  message: 'tlon.tool.execution';
  loggerName: 'tlon.tool';
  attributes: Record<string, string | number | boolean>;
};

type TlonToolTerminalEvent = {
  result?: unknown;
  error?: unknown;
  durationMs?: number;
  toolCallId?: string;
  runId?: string;
  sessionId?: string;
};

const BLOCKED_STATUSES = new Set([
  'blocked',
  'denied',
  'forbidden',
  'disabled',
  'approval-unavailable',
]);

const FAILURE_STATUSES = new Set([
  'error',
  'failed',
  'failure',
  'timeout',
  'timed_out',
  'unavailable',
  'aborted',
  'cancelled',
  'canceled',
  'killed',
  'invalid',
]);

const SAFE_BLOCK_REASONS = new Set([
  'diary_operation',
  'migration_operation',
  'send_operation',
]);

function resultDetails(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return null;
  }
  const details = (result as { details?: unknown }).details;
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return null;
  }
  return details as Record<string, unknown>;
}

function normalizedStatus(details: Record<string, unknown> | null): string {
  const status = details?.status;
  return typeof status === 'string' ? status.trim().toLowerCase() : '';
}

export function resolveTlonToolOutcome(
  event: TlonToolTerminalEvent
): TlonToolOutcome {
  const details = resultDetails(event.result);
  const status = normalizedStatus(details);

  if (details?.blocked === true || BLOCKED_STATUSES.has(status)) {
    return 'blocked';
  }
  if (
    event.error != null ||
    details?.ok === false ||
    details?.success === false ||
    Boolean(details?.error) ||
    details?.timedOut === true ||
    FAILURE_STATUSES.has(status) ||
    (typeof details?.exitCode === 'number' && details.exitCode !== 0)
  ) {
    return 'error';
  }
  return 'ok';
}

function safeFailureKind(
  outcome: TlonToolOutcome,
  summary: TlonToolCallContext,
  details: Record<string, unknown> | null
): string | null {
  if (outcome === 'blocked') {
    const reason = details?.reason;
    return typeof reason === 'string' && SAFE_BLOCK_REASONS.has(reason)
      ? reason
      : 'blocked';
  }
  if (outcome === 'error') {
    return !summary.isKnownSubcommand || summary.operation === 'invalid'
      ? 'invalid_command'
      : 'tool_result_error';
  }
  return null;
}

function addOptionalAttribute(
  attributes: Record<string, string | number | boolean>,
  key: string,
  value: string | number | boolean | undefined
): void {
  if (value !== undefined) {
    attributes[key] = value;
  }
}

function addOptionalIdAttribute(
  attributes: Record<string, string | number | boolean>,
  key: string,
  value: string | undefined
): void {
  const normalized = value?.trim();
  if (normalized) {
    attributes[key] = normalized;
  }
}

export function buildTlonToolDiagnosticRecord(
  summary: TlonToolCallContext,
  event: TlonToolTerminalEvent
): TlonToolDiagnosticRecord {
  const outcome = resolveTlonToolOutcome(event);
  const details = resultDetails(event.result);
  const failureKind = safeFailureKind(outcome, summary, details);
  const attributes: Record<string, string | number | boolean> = {
    'tlon.tool.event': 'tlon.tool.execution',
    'tlon.tool.summary_key': summary.summaryKey,
    'tlon.tool.subcommand': summary.subcommand,
    'tlon.tool.operation': summary.operation,
    'tlon.tool.intent': summary.intent,
    'tlon.tool.outcome': outcome,
    'tlon.tool.known_subcommand': summary.isKnownSubcommand,
    'tlon.tool.blocked_send_operation': summary.blockedSendOperation,
  };

  if (
    typeof event.durationMs === 'number' &&
    Number.isFinite(event.durationMs) &&
    event.durationMs >= 0
  ) {
    attributes['tlon.tool.duration_ms'] = event.durationMs;
  }
  if (failureKind) {
    attributes['tlon.tool.failure_kind'] = failureKind;
  }
  addOptionalIdAttribute(attributes, 'toolCallId', event.toolCallId);
  addOptionalIdAttribute(attributes, 'runId', event.runId);
  addOptionalIdAttribute(attributes, 'sessionId', event.sessionId);

  addOptionalAttribute(
    attributes,
    'tlon.tool.channel_kind',
    summary.channelKind
  );
  addOptionalAttribute(
    attributes,
    'tlon.tool.dm_target_kind',
    summary.dmTargetKind
  );
  addOptionalAttribute(
    attributes,
    'tlon.tool.upload_source',
    summary.uploadSource
  );
  if (summary.updateFields) {
    attributes['tlon.tool.update_fields'] = summary.updateFields.join(',');
  }
  addOptionalAttribute(
    attributes,
    'tlon.tool.invitee_count',
    summary.inviteeCount
  );
  addOptionalAttribute(
    attributes,
    'tlon.tool.member_count',
    summary.memberCount
  );
  addOptionalAttribute(
    attributes,
    'tlon.tool.contact_count',
    summary.contactCount
  );
  addOptionalAttribute(attributes, 'tlon.tool.role_count', summary.roleCount);
  addOptionalAttribute(attributes, 'tlon.tool.hook_count', summary.hookCount);
  addOptionalAttribute(
    attributes,
    'tlon.tool.has_description',
    summary.hasDescription
  );
  addOptionalAttribute(attributes, 'tlon.tool.has_title', summary.hasTitle);
  addOptionalAttribute(attributes, 'tlon.tool.has_content', summary.hasContent);
  addOptionalAttribute(attributes, 'tlon.tool.has_image', summary.hasImage);
  addOptionalAttribute(
    attributes,
    'tlon.tool.has_name_change',
    summary.hasNameChange
  );
  addOptionalAttribute(
    attributes,
    'tlon.tool.has_source_change',
    summary.hasSourceChange
  );
  addOptionalAttribute(attributes, 'tlon.tool.has_nest', summary.hasNest);
  addOptionalAttribute(
    attributes,
    'tlon.tool.privacy_setting',
    summary.privacySetting
  );
  addOptionalAttribute(attributes, 'tlon.tool.limit', summary.limit);
  addOptionalAttribute(
    attributes,
    'tlon.tool.resolve_cites',
    summary.resolveCites
  );
  addOptionalAttribute(
    attributes,
    'tlon.tool.scoped_to_channel',
    summary.scopedToChannel
  );
  addOptionalAttribute(
    attributes,
    'tlon.tool.content_type_provided',
    summary.contentTypeProvided
  );

  return {
    level:
      outcome === 'error' ? 'ERROR' : outcome === 'blocked' ? 'WARN' : 'INFO',
    message: 'tlon.tool.execution',
    loggerName: 'tlon.tool',
    attributes,
  };
}
