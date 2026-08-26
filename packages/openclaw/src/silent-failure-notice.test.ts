import { describe, expect, it } from 'vitest';

import {
  createSilentFailureNoticeCooldown,
  recordFailureNoticeMetric,
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
    expect(resolveSilentFailureNotice(incidentInput)).toEqual({
      kind: 'tool_error',
      text:
        "⚠️ I didn't reply to a request from ~ravmel-ropdyl in chat/~host/lobby " +
        'and may not have completed it — my last failing tool call was ' +
        '`tlon`: TimeoutError: active. You may want to check or retry.',
    });
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
      })?.text
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

  it('fires when a DM turn ends empty with nothing to send', () => {
    expect(
      resolveSilentFailureNotice({
        summary: makeSummary({
          trigger: 'dm',
          destinationKind: 'dm',
          result: 'empty',
          reason: 'empty',
          toolCallCount: 0,
          toolErrorCount: 0,
          lastToolError: null,
        }),
        deliveredCount: 0,
        requester: '~sipnup-litnux',
        conversation: 'our DM with ~sipnup-litnux',
      })
    ).toMatchObject({
      kind: 'dm_empty',
      text: expect.stringContaining('ended with no reply'),
    });
  });

  it('fires when a DM turn ends in intentional silence', () => {
    expect(
      resolveSilentFailureNotice({
        summary: makeSummary({
          trigger: 'dm',
          destinationKind: 'dm',
          result: 'intentional_silence',
          reason: 'silent',
          toolCallCount: 0,
          toolErrorCount: 0,
          lastToolError: null,
        }),
        deliveredCount: 0,
        requester: '~sipnup-litnux',
        conversation: 'our DM with ~sipnup-litnux',
      })
    ).not.toBeNull();
  });

  it('stays silent for empty or intentionally silent group turns', () => {
    for (const result of ['empty', 'intentional_silence'] as const) {
      expect(
        resolveSilentFailureNotice({
          ...incidentInput,
          summary: makeSummary({
            result,
            reason: result === 'empty' ? 'empty' : 'silent',
            toolCallCount: 0,
            toolErrorCount: 0,
            lastToolError: null,
          }),
        })
      ).toBeNull();
    }
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
    ).toMatchObject({
      kind: 'timeout',
      text: expect.stringContaining('timed out before I could reply'),
    });
    expect(
      resolveSilentFailureNotice({
        ...incidentInput,
        summary: makeSummary({
          execution: 'failed',
          reason: 'dispatch_failed',
        }),
      })
    ).toMatchObject({
      kind: 'run_failure',
      text: expect.stringContaining('failed before I could reply'),
    });
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
    ).toMatchObject({
      kind: 'delivery_failure',
      text: expect.stringContaining("couldn't deliver it"),
    });
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

    expect(notice?.text).toContain('`tlon`: TimeoutError: active (poke hung).');
    expect(notice?.text).not.toContain('\n');
  });

  it('caps very long error text', () => {
    const collapsed = `TimeoutError: active ${'x'.repeat(400)}`;
    const notice = resolveSilentFailureNotice({
      ...incidentInput,
      summary: makeSummary({
        lastToolError: { toolName: 'tlon', message: collapsed },
      }),
    });

    expect(notice?.text).toContain(`${collapsed.slice(0, 199)}…`);
    expect(notice?.text).not.toContain(collapsed);
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

  it('formats sub-minute timeouts in seconds and ignores early failures', () => {
    expect(
      rewriteGenericTerminalErrorReply({
        text: 'LLM request failed.',
        isError: true,
        timedOut: false,
        durationMs: 29_950,
        timeoutMs: 30_000,
      })
    ).toBe(
      'The model request timed out after 30 seconds before it could finish. Please try again.'
    );
    // An immediate failure under a short configured timeout is not a timeout.
    expect(
      rewriteGenericTerminalErrorReply({
        text: 'LLM request failed.',
        isError: true,
        timedOut: false,
        durationMs: 5,
        timeoutMs: 1_000,
      })
    ).toBe('LLM request failed.');
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

describe('createSilentFailureNoticeCooldown', () => {
  it('suppresses repeats inside the window only after a recorded send', () => {
    const cooldown = createSilentFailureNoticeCooldown(15 * 60_000);
    expect(cooldown.isCoolingDown('chat/~host/lobby', 0)).toBe(false);
    cooldown.recordSent('chat/~host/lobby', 0);
    expect(cooldown.isCoolingDown('chat/~host/lobby', 60_000)).toBe(true);
    expect(cooldown.isCoolingDown('chat/~host/lobby', 14 * 60_000)).toBe(true);
  });

  it('releasing a failed send frees the window without clobbering newer reservations', () => {
    const cooldown = createSilentFailureNoticeCooldown(15 * 60_000);
    cooldown.recordSent('chat/~host/lobby', 0);
    // A failed owner DM releases its own reservation…
    cooldown.release('chat/~host/lobby', 0);
    expect(cooldown.isCoolingDown('chat/~host/lobby', 1_000)).toBe(false);
    // …but a stale release must not clear a newer reservation.
    cooldown.recordSent('chat/~host/lobby', 2_000);
    cooldown.release('chat/~host/lobby', 0);
    expect(cooldown.isCoolingDown('chat/~host/lobby', 3_000)).toBe(true);
  });

  it('a reservation blocks concurrent notices while a send is in flight', () => {
    const cooldown = createSilentFailureNoticeCooldown(15 * 60_000);
    expect(cooldown.isCoolingDown('chat/~host/lobby', 0)).toBe(false);
    cooldown.recordSent('chat/~host/lobby', 0);
    // A second turn finishing before the first DM resolves is suppressed.
    expect(cooldown.isCoolingDown('chat/~host/lobby', 50)).toBe(true);
  });

  it('allows again after the window elapses', () => {
    const cooldown = createSilentFailureNoticeCooldown(15 * 60_000);
    cooldown.recordSent('chat/~host/lobby', 0);
    expect(cooldown.isCoolingDown('chat/~host/lobby', 15 * 60_000)).toBe(false);
  });

  it('tracks conversations independently', () => {
    const cooldown = createSilentFailureNoticeCooldown(15 * 60_000);
    cooldown.recordSent('chat/~host/lobby', 0);
    expect(cooldown.isCoolingDown('our DM with ~ravmel-ropdyl', 1_000)).toBe(
      false
    );
    expect(cooldown.isCoolingDown('chat/~host/lobby', 1_000)).toBe(true);
  });
});

describe('recordFailureNoticeMetric', () => {
  it('counts notices with kind, destination, and suppression attributes', () => {
    const added: Array<{ value: number; attributes: Record<string, string> }> =
      [];
    recordFailureNoticeMetric(
      { kind: 'timeout', destinationKind: 'dm', suppressed: false },
      {
        getMeterProvider: () => ({
          getMeter: () => ({
            createCounter: () => ({
              add: (value: number, attributes: Record<string, string>) => {
                added.push({ value, attributes });
              },
            }),
          }),
        }),
      }
    );

    expect(added).toEqual([
      {
        value: 1,
        attributes: {
          kind: 'timeout',
          destination_kind: 'dm',
          suppressed: 'false',
        },
      },
    ]);
  });

  it('never throws when the meter provider is broken', () => {
    expect(() =>
      recordFailureNoticeMetric(
        {
          kind: 'tool_error',
          destinationKind: 'group_channel',
          suppressed: true,
        },
        {
          getMeterProvider: () => {
            throw new Error('no provider');
          },
        }
      )
    ).not.toThrow();
  });
});
