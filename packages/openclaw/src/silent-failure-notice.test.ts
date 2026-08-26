import { describe, expect, it } from 'vitest';

import {
  resolveSilentFailureNotice,
  resolveTurnTerminalLensStatus,
  rewriteGenericTerminalErrorReply,
} from './silent-failure-notice.js';
import type {
  TlonAgentTurnSummary,
  TlonAgentTurnTrigger,
} from './turn-recorder.js';

function makeSummary(
  overrides?: Partial<TlonAgentTurnSummary>
): TlonAgentTurnSummary {
  return {
    accountId: 'hosted',
    agentId: 'main',
    delivery: 'not_applicable',
    deliveryFailureCount: 0,
    deliverySuccessCount: 0,
    destinationKind: 'group_channel',
    durationMs: 65000,
    execution: 'completed',
    finalErrorReplyCount: 0,
    lastToolError: { toolName: 'tlon', message: 'TimeoutError: active' },
    reason: 'action_only',
    result: 'action_only',
    runId: 'run-1',
    sessionKey: 'agent:main:tlon:group:chat/~host/lobby',
    ship: 'pinser-botter-ravmel-ropdyl',
    sourceReplyCount: 0,
    toolCallCount: 7,
    toolErrorCount: 2,
    trigger: 'mention',
    ...overrides,
  };
}

const incidentInput = {
  summary: makeSummary(),
  deliveredCount: 0,
  requester: '~ravmel-ropdyl',
  conversation: 'chat/~host/lobby',
};

describe('resolveSilentFailureNotice', () => {
  it('fires on the incident shape: mention, completed, errors, zero delivery', () => {
    expect(resolveSilentFailureNotice(incidentInput)).toBe(
      "⚠️ I didn't reply to a request from ~ravmel-ropdyl in chat/~host/lobby " +
        'and may not have completed it — my last failing tool call was ' +
        '`tlon`: TimeoutError: active. You may want to check or retry.'
    );
  });

  it('fires for an attempted but undelivered reply', () => {
    expect(
      resolveSilentFailureNotice({
        ...incidentInput,
        summary: makeSummary({
          result: 'reply_and_action',
          reason: 'reply_not_delivered',
          delivery: 'skipped',
          sourceReplyCount: 1,
        }),
      })
    ).not.toBeNull();
  });

  it('fires for summarization requests', () => {
    expect(
      resolveSilentFailureNotice({
        ...incidentInput,
        summary: makeSummary({ trigger: 'summarization' }),
      })
    ).not.toBeNull();
  });

  it('fires for DM turns using the DM conversation label', () => {
    expect(
      resolveSilentFailureNotice({
        summary: makeSummary({
          trigger: 'dm',
          destinationKind: 'dm',
        }),
        deliveredCount: 0,
        requester: '~ravmel-ropdyl',
        conversation: 'our DM with ~ravmel-ropdyl',
      })
    ).toContain('in our DM with ~ravmel-ropdyl');
  });

  it.each([
    'cron',
    'thread',
    'reaction',
    'owner-listen',
    'owner-blob',
    'tool',
    'retry',
    'unknown',
  ] as TlonAgentTurnTrigger[])(
    'stays silent for excluded trigger %s',
    (trigger) => {
      expect(
        resolveSilentFailureNotice({
          ...incidentInput,
          summary: makeSummary({ trigger }),
        })
      ).toBeNull();
    }
  );

  it('stays silent when something was delivered', () => {
    expect(
      resolveSilentFailureNotice({ ...incidentInput, deliveredCount: 1 })
    ).toBeNull();
  });

  it('stays silent when a message-tool send succeeded during the turn', () => {
    expect(
      resolveSilentFailureNotice({
        ...incidentInput,
        summary: makeSummary({ deliverySuccessCount: 1 }),
      })
    ).toBeNull();
  });

  it('stays silent when no tool call errored', () => {
    expect(
      resolveSilentFailureNotice({
        ...incidentInput,
        summary: makeSummary({ toolErrorCount: 0, lastToolError: null }),
      })
    ).toBeNull();
  });

  it('stays silent for non-completed executions', () => {
    expect(
      resolveSilentFailureNotice({
        ...incidentInput,
        summary: makeSummary({ execution: 'cancelled', reason: 'cancelled' }),
      })
    ).toBeNull();
  });

  it('notifies the owner for timeout, run, and delivery failures', () => {
    expect(
      resolveSilentFailureNotice({
        ...incidentInput,
        summary: makeSummary({
          execution: 'timed_out',
          reason: 'timed_out',
        }),
      })
    ).toContain('timed out before I could reply');
    expect(
      resolveSilentFailureNotice({
        ...incidentInput,
        summary: makeSummary({
          execution: 'failed',
          reason: 'dispatch_failed',
        }),
      })
    ).toContain('failed before I could reply');
    expect(
      resolveSilentFailureNotice({
        ...incidentInput,
        summary: makeSummary({
          delivery: 'failed',
          deliveryFailureCount: 1,
          toolErrorCount: 0,
          lastToolError: null,
        }),
      })
    ).toContain("couldn't deliver it");
  });

  it('collapses newlines and trims the error text', () => {
    const notice = resolveSilentFailureNotice({
      ...incidentInput,
      summary: makeSummary({
        lastToolError: {
          toolName: 'tlon',
          message: 'TimeoutError:\n  active\n\t(poke hung) ',
        },
      }),
    });

    expect(notice).toContain('`tlon`: TimeoutError: active (poke hung).');
    expect(notice).not.toContain('\n');
  });

  it('caps very long error text', () => {
    const collapsed = `TimeoutError: active ${'x'.repeat(400)}`;
    const notice = resolveSilentFailureNotice({
      ...incidentInput,
      summary: makeSummary({
        lastToolError: { toolName: 'tlon', message: collapsed },
      }),
    });

    expect(notice).toContain(`${collapsed.slice(0, 199)}…`);
    expect(notice).not.toContain(collapsed);
  });
});

describe('terminal failure presentation', () => {
  it('rewrites OpenClaw generic failures at the configured deadline', () => {
    expect(
      rewriteGenericTerminalErrorReply({
        text: 'LLM request failed.',
        isError: true,
        timedOut: false,
        durationMs: 300_500,
        timeoutMs: 300_000,
      })
    ).toBe(
      'The model request timed out after 5 minutes before it could finish. Please try again.'
    );
  });

  it('leaves non-error, specific, and early generic replies unchanged', () => {
    expect(
      rewriteGenericTerminalErrorReply({
        text: 'LLM request failed.',
        isError: false,
        timedOut: true,
        durationMs: 300_000,
        timeoutMs: 300_000,
      })
    ).toBe('LLM request failed.');
    expect(
      rewriteGenericTerminalErrorReply({
        text: 'LLM request unauthorized.',
        isError: true,
        timedOut: true,
        durationMs: 300_000,
        timeoutMs: 300_000,
      })
    ).toBe('LLM request unauthorized.');
    expect(
      rewriteGenericTerminalErrorReply({
        text: 'LLM request failed.',
        isError: true,
        timedOut: false,
        durationMs: 10_000,
        timeoutMs: 300_000,
      })
    ).toBe('LLM request failed.');
  });

  it('marks delivered terminal errors as errors rather than completed', () => {
    expect(
      resolveTurnTerminalLensStatus({
        summary: makeSummary({ result: 'error_reply_and_action' }),
        deliveredCount: 2,
        dispatchError: undefined,
        timedOut: false,
      })
    ).toBe('error');
    expect(
      resolveTurnTerminalLensStatus({
        summary: makeSummary(),
        deliveredCount: 1,
        dispatchError: undefined,
        timedOut: false,
      })
    ).toBe('completed');
  });
});
