import { metrics } from '@opentelemetry/api';

import type { ContextLensStatus } from './context-lens.js';
import type { TlonAgentTurnSummary } from './turn-recorder.js';

export type SilentFailureNoticeKind =
  | 'timeout'
  | 'delivery_failure'
  | 'run_failure'
  | 'tool_error'
  | 'dm_empty';

export type SilentFailureNotice = {
  kind: SilentFailureNoticeKind;
  text: string;
};

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
}): SilentFailureNotice | null {
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
    return {
      kind: 'timeout',
      text: `⚠️ ${request} timed out before I could reply. You may want to retry.`,
    };
  }
  if (summary.deliveryFailureCount > 0 || summary.delivery === 'failed') {
    return {
      kind: 'delivery_failure',
      text: `⚠️ I produced a reply to ${request}, but couldn't deliver it. You may want to retry.`,
    };
  }
  if (summary.execution === 'failed') {
    return {
      kind: 'run_failure',
      text: `⚠️ ${request} failed before I could reply. You may want to retry.`,
    };
  }
  if (summary.toolErrorCount > 0) {
    const lastToolError = summary.lastToolError;
    const toolName = lastToolError?.toolName || 'unknown';
    const errorText = lastToolError
      ? formatErrorText(lastToolError.message)
      : 'unknown error';
    return {
      kind: 'tool_error',
      text:
        `⚠️ I didn't reply to a request from ${requester} in ${conversation} ` +
        'and may not have completed it — my last failing tool call was ' +
        `\`${toolName}\`: ${errorText}. You may want to check or retry.`,
    };
  }
  // DM silence is never legitimate (core's own silent-reply policy), so a
  // completed DM turn that produced nothing is a dropped answer. Group
  // silence stays sanctioned — mention-gating depends on it.
  if (
    summary.destinationKind === 'dm' &&
    (summary.result === 'empty' || summary.result === 'intentional_silence')
  ) {
    return {
      kind: 'dm_empty',
      text: `⚠️ ${request} ended with no reply — I didn't produce anything to send. You may want to retry.`,
    };
  }
  return null;
}

type FailureNoticeMeterProviderLike = {
  getMeter(name: string): {
    createCounter(
      name: string,
      options?: { description?: string; unit?: string }
    ): { add(value: number, attributes: Record<string, string>): void };
  };
};

// Rare events, so creating the counter per call keeps this robust across
// meter-provider swaps without the caching dance the turn recorder needs.
export function recordFailureNoticeMetric(
  input: {
    kind: SilentFailureNoticeKind;
    destinationKind: TlonAgentTurnSummary['destinationKind'];
    suppressed: boolean;
  },
  options?: { getMeterProvider?: () => FailureNoticeMeterProviderLike }
): void {
  try {
    const provider =
      options?.getMeterProvider?.() ??
      (metrics.getMeterProvider() as FailureNoticeMeterProviderLike);
    provider
      .getMeter('tlon.openclaw')
      .createCounter('tlon.agent.failure_notice', {
        description: 'Owner-facing terminal no-reply failure notices',
        unit: '1',
      })
      .add(1, {
        kind: input.kind,
        destination_kind: input.destinationKind,
        suppressed: String(input.suppressed),
      });
  } catch {
    // Observability must never alter dispatch or delivery behavior.
  }
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
    isCoolingDown(conversation: string, now: number): boolean {
      const sentAt = lastSentAt.get(conversation);
      return sentAt !== undefined && now - sentAt < windowMs;
    },
    // Reserve the window before sending so concurrent turns for the same
    // conversation can't double-notify while the first DM is in flight.
    recordSent(conversation: string, now: number): void {
      if (lastSentAt.size > COOLDOWN_PRUNE_THRESHOLD) {
        for (const [key, sentAt] of lastSentAt) {
          if (now - sentAt >= windowMs) {
            lastSentAt.delete(key);
          }
        }
      }
      lastSentAt.set(conversation, now);
    },
    // A failed owner DM must not burn the window. Releases only the caller's
    // own reservation so a newer one is never clobbered.
    release(conversation: string, reservedAt: number): void {
      if (lastSentAt.get(conversation) === reservedAt) {
        lastSentAt.delete(conversation);
      }
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
  // Tolerance scales down with short configured timeouts so an immediate
  // generic failure is never misread as reaching the deadline.
  const toleranceMs = Math.min(1_000, Math.floor(input.timeoutMs / 10));
  const reachedDeadline =
    input.timedOut ||
    (input.timeoutMs > 0 && input.durationMs >= input.timeoutMs - toleranceMs);
  if (!reachedDeadline) {
    return input.text;
  }
  const duration =
    input.timeoutMs < 60_000
      ? `${Math.max(1, Math.round(input.timeoutMs / 1_000))} second${Math.round(input.timeoutMs / 1_000) === 1 ? '' : 's'}`
      : `${Math.max(1, Math.round(input.timeoutMs / 60_000))} minute${Math.round(input.timeoutMs / 60_000) === 1 ? '' : 's'}`;
  return `The model request timed out after ${duration} before it could finish. Please try again.`;
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
