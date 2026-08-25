import { describe, expect, it } from 'vitest';

import type { TlonAgentTurnSummary } from './turn-recorder.js';
import {
  formatTlonTerminalFallback,
  resolveTlonTerminalFallback,
} from './terminal-failure-reply.js';

const baseSummary: TlonAgentTurnSummary = {
  accountId: 'hosted',
  agentId: 'main',
  delivery: 'not_applicable',
  deliveryFailureCount: 0,
  deliverySuccessCount: 0,
  destinationKind: 'dm',
  durationMs: 100,
  execution: 'completed',
  finalErrorReplyCount: 0,
  reason: 'empty',
  result: 'empty',
  runId: 'run-1',
  sessionKey: 'agent:main:tlon:direct:~nec',
  ship: 'zod',
  sourceReplyCount: 0,
  toolCallCount: 0,
  toolFailureCount: 0,
  trigger: 'dm',
};

function resolve(
  summary: Partial<TlonAgentTurnSummary> = {},
  options: {
    deliveredMessageCount?: number;
    deliverySkipReason?: Parameters<
      typeof resolveTlonTerminalFallback
    >[0]['deliverySkipReason'];
  } = {}
) {
  return resolveTlonTerminalFallback({
    deliveredMessageCount: options.deliveredMessageCount ?? 0,
    deliverySkipReason: options.deliverySkipReason ?? null,
    summary: { ...baseSummary, ...summary },
  });
}

describe('terminal Tlon fallback policy', () => {
  it('does not add a message after any visible delivery', () => {
    expect(resolve({}, { deliveredMessageCount: 1 })).toBeNull();
  });

  it.each(['silent', 'heartbeat'] as const)(
    'preserves intentional %s responses',
    (deliverySkipReason) => {
      expect(
        resolve({ result: 'intentional_silence' }, { deliverySkipReason })
      ).toBeNull();
    }
  );

  it('preserves message-tool-only delivery policy when the run did not fail', () => {
    expect(
      resolve(
        { result: 'reply' },
        { deliverySkipReason: 'source_reply_delivery_mode_message_tool_only' }
      )
    ).toBeNull();
  });

  it('surfaces timeout, tool, run, and delivery failures', () => {
    expect(resolve({ execution: 'timed_out' })).toBe('timeout');
    expect(resolve({ toolCallCount: 1, toolFailureCount: 1 })).toBe(
      'tool_failure'
    );
    expect(resolve({ execution: 'failed' })).toBe('run_failure');
    expect(resolve({ delivery: 'failed', deliveryFailureCount: 1 })).toBe(
      'delivery_failure'
    );
  });

  it('surfaces a failed tool even under message-tool-only delivery policy', () => {
    expect(
      resolve(
        { toolCallCount: 1, toolFailureCount: 1 },
        { deliverySkipReason: 'source_reply_delivery_mode_message_tool_only' }
      )
    ).toBe('tool_failure');
  });

  it('reports successful action-only and empty terminal turns', () => {
    expect(resolve({ result: 'action_only' })).toBe('action_without_reply');
    expect(resolve()).toBe('empty_reply');
  });

  it('does not message cancelled or abandoned turns', () => {
    expect(resolve({ execution: 'cancelled' })).toBeNull();
    expect(resolve({ execution: 'abandoned' })).toBeNull();
  });

  it('uses generic text that does not expose error details', () => {
    expect(formatTlonTerminalFallback('tool_failure')).toBe(
      "I couldn't complete that request because a tool failed. Please try again."
    );
  });
});
