import type {
  TlonAgentTurnSkipReason,
  TlonAgentTurnSummary,
} from './turn-recorder.js';

export type TlonTerminalFallbackKind =
  | 'timeout'
  | 'tool_failure'
  | 'run_failure'
  | 'delivery_failure'
  | 'action_without_reply'
  | 'empty_reply';

const FALLBACK_TEXT: Record<TlonTerminalFallbackKind, string> = {
  timeout:
    "I couldn't finish that request before it timed out. Please try again.",
  tool_failure:
    "I couldn't complete that request because a tool failed. Please try again.",
  run_failure:
    "I couldn't complete that request because the run failed. Please try again.",
  delivery_failure:
    "I generated a response but couldn't deliver it. Please try again.",
  action_without_reply:
    "I finished the tool action, but couldn't produce a response.",
  empty_reply:
    "I couldn't produce a response for that request. Please try again.",
};

function isIntentionalNoReply(reason: TlonAgentTurnSkipReason | null): boolean {
  return (
    reason === 'silent' ||
    reason === 'heartbeat' ||
    reason === 'source_reply_delivery_mode_message_tool_only'
  );
}

export function resolveTlonTerminalFallback(params: {
  deliveredMessageCount: number;
  deliverySkipReason: TlonAgentTurnSkipReason | null;
  summary: TlonAgentTurnSummary;
}): TlonTerminalFallbackKind | null {
  const { deliveredMessageCount, deliverySkipReason, summary } = params;
  if (deliveredMessageCount > 0) {
    return null;
  }
  if (summary.execution === 'cancelled' || summary.execution === 'abandoned') {
    return null;
  }
  if (summary.execution === 'timed_out') {
    return 'timeout';
  }
  if (summary.toolFailureCount > 0) {
    return 'tool_failure';
  }
  if (summary.execution === 'failed') {
    return 'run_failure';
  }
  if (summary.deliveryFailureCount > 0 || summary.delivery === 'failed') {
    return 'delivery_failure';
  }
  if (isIntentionalNoReply(deliverySkipReason)) {
    return null;
  }
  if (summary.result === 'action_only') {
    return 'action_without_reply';
  }
  if (summary.result === 'empty') {
    return 'empty_reply';
  }
  return null;
}

export function formatTlonTerminalFallback(
  kind: TlonTerminalFallbackKind
): string {
  return FALLBACK_TEXT[kind];
}
