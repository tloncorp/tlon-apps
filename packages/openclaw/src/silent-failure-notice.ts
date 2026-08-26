import type { ContextLensStatus } from './context-lens.js';
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
  if (summary.execution === 'cancelled' || summary.execution === 'abandoned') {
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
  const request = `a request from ${requester} in ${conversation}`;
  if (summary.execution === 'timed_out') {
    return `⚠️ ${request} timed out before I could reply. You may want to retry.`;
  }
  if (summary.deliveryFailureCount > 0 || summary.delivery === 'failed') {
    return `⚠️ I produced a reply to ${request}, but couldn't deliver it. You may want to retry.`;
  }
  if (summary.execution === 'failed') {
    return `⚠️ ${request} failed before I could reply. You may want to retry.`;
  }
  if (summary.toolErrorCount <= 0) {
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

const NOTICE_COOLDOWN_MS = 15 * 60_000;
const COOLDOWN_PRUNE_THRESHOLD = 64;

// A provider outage fails every turn in a burst; one notice per conversation
// per window keeps the owner informed without flooding their DM.
export function createSilentFailureNoticeCooldown(
  windowMs: number = NOTICE_COOLDOWN_MS
) {
  const lastSentAt = new Map<string, number>();
  return {
    shouldSend(conversation: string, now: number): boolean {
      if (lastSentAt.size > COOLDOWN_PRUNE_THRESHOLD) {
        for (const [key, sentAt] of lastSentAt) {
          if (now - sentAt >= windowMs) {
            lastSentAt.delete(key);
          }
        }
      }
      const sentAt = lastSentAt.get(conversation);
      if (sentAt !== undefined && now - sentAt < windowMs) {
        return false;
      }
      lastSentAt.set(conversation, now);
      return true;
    },
  };
}

const GENERIC_LLM_FAILURE = 'LLM request failed.';

export function rewriteGenericTerminalErrorReply(input: {
  text: string;
  isError: boolean;
  timedOut: boolean;
  durationMs: number;
  timeoutMs: number;
}): string {
  if (!input.isError || input.text.trim() !== GENERIC_LLM_FAILURE) {
    return input.text;
  }
  const reachedDeadline =
    input.timedOut ||
    (input.timeoutMs > 0 && input.durationMs >= input.timeoutMs - 1_000);
  if (!reachedDeadline) {
    return input.text;
  }
  const timeoutMinutes = Math.max(1, Math.round(input.timeoutMs / 60_000));
  return (
    `The model request timed out after ${timeoutMinutes} ` +
    `minute${timeoutMinutes === 1 ? '' : 's'} before it could finish. Please try again.`
  );
}

export function resolveTurnTerminalLensStatus(input: {
  summary: TlonAgentTurnSummary;
  deliveredCount: number;
  dispatchError: unknown;
  timedOut: boolean;
}): Extract<
  ContextLensStatus,
  'timed_out' | 'error' | 'completed' | 'no_reply'
> {
  if (input.timedOut || input.summary.execution === 'timed_out') {
    return 'timed_out';
  }
  if (
    input.dispatchError ||
    input.summary.execution === 'failed' ||
    input.summary.result === 'error_reply' ||
    input.summary.result === 'error_reply_and_action'
  ) {
    return 'error';
  }
  return input.deliveredCount > 0 ? 'completed' : 'no_reply';
}
