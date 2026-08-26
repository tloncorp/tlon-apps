import type { TlonAgentTurnSummary } from './turn-recorder.js';

const USER_FACING_TRIGGERS: ReadonlySet<TlonAgentTurnSummary['trigger']> =
  new Set(['dm', 'mention', 'summarization']);

const MAX_ERROR_TEXT_LENGTH = 200;

function formatErrorText(message: string): string {
  const collapsed = message.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= MAX_ERROR_TEXT_LENGTH) {
    return collapsed;
  }
  return `${collapsed.slice(0, MAX_ERROR_TEXT_LENGTH - 1)}…`;
}

export function resolveSilentFailureNotice(input: {
  summary: TlonAgentTurnSummary;
  deliveredCount: number;
  requester: string;
  conversation: string;
}): string | null {
  const { summary, deliveredCount, requester, conversation } = input;
  if (!USER_FACING_TRIGGERS.has(summary.trigger)) {
    return null;
  }
  if (summary.execution !== 'completed') {
    return null;
  }
  if (summary.toolErrorCount <= 0) {
    return null;
  }
  if (deliveredCount > 0) {
    return null;
  }
  // The message-tool send path records deliveries on the turn but not on the
  // monitor's delivered count (and its lens output needs ContextLens).
  if (summary.deliverySuccessCount > 0) {
    return null;
  }
  const lastToolError = summary.lastToolError;
  const toolName = lastToolError?.toolName || 'unknown';
  const errorText = lastToolError
    ? formatErrorText(lastToolError.message)
    : 'unknown error';
  return (
    `⚠️ I didn't reply to a request from ${requester} in ${conversation} ` +
    'and may not have completed it — my last failing tool call was ' +
    `\`${toolName}\`: ${errorText}. You may want to check or retry.`
  );
}
