import { describe, expect, it } from 'vitest';

import { resolveSilentFailureNotice } from './silent-failure-notice.js';
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
        summary: makeSummary({ execution: 'timed_out', reason: 'timed_out' }),
      })
    ).toBeNull();
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
