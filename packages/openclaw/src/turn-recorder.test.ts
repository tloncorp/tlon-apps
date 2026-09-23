import { describe, expect, it, vi } from 'vitest';

import {
  type TlonAgentTurnObserver,
  type TlonAgentTurnSummary,
  claimActiveTlonTurnOutput,
  createTlonAgentTurnOtelObserver,
  observeActiveTlonTurnDelivery,
  recordActiveTlonTurnDelivery,
  recordActiveTlonTurnSourceReply,
  recordActiveTlonTurnToolCall,
  recordTlonAgentRunTrace,
  startTlonAgentTurn,
} from './turn-recorder.js';

const baseTurn = {
  accountId: 'hosted',
  agentId: 'main',
  destinationKind: 'dm' as const,
  runId: 'run-1',
  sessionKey: 'agent:main:tlon:direct:~nec',
  ship: '~zod',
  trigger: 'dm' as const,
};

const noOpObserver: TlonAgentTurnObserver = {
  recordStarted: () => undefined,
  recordTerminal: () => undefined,
};

function recordTurn(params: {
  replyCount?: number;
  sourceReplies?: Array<{
    isError?: boolean;
    kind: 'tool' | 'block' | 'final';
  }>;
  toolCount?: number;
  deliverySuccessCount?: number;
  deliveryFailureCount?: number;
  terminal?: Parameters<ReturnType<typeof startTlonAgentTurn>['finalize']>[0];
}): TlonAgentTurnSummary {
  const turn = startTlonAgentTurn(baseTurn, { observer: noOpObserver });
  turn.run(() => {
    for (let i = 0; i < (params.replyCount ?? 0); i += 1) {
      recordActiveTlonTurnSourceReply();
    }
    for (const reply of params.sourceReplies ?? []) {
      recordActiveTlonTurnSourceReply(reply);
    }
    for (let i = 0; i < (params.toolCount ?? 0); i += 1) {
      recordActiveTlonTurnToolCall();
    }
    for (let i = 0; i < (params.deliverySuccessCount ?? 0); i += 1) {
      recordActiveTlonTurnDelivery(true);
    }
    for (let i = 0; i < (params.deliveryFailureCount ?? 0); i += 1) {
      recordActiveTlonTurnDelivery(false);
    }
  });
  return turn.finalize(params.terminal ?? { durationMs: 250 });
}

describe('Tlon agent turn output attribution', () => {
  it('assigns the active run id and monotonic output indexes', () => {
    const turn = startTlonAgentTurn(baseTurn, { observer: noOpObserver });
    const outputs = turn.run(() => {
      recordTlonAgentRunTrace('run-1', 'trace-1');
      return [claimActiveTlonTurnOutput(), claimActiveTlonTurnOutput()];
    });

    expect(outputs).toEqual([
      { runId: 'run-1', outputIndex: 0, traceId: 'trace-1' },
      { runId: 'run-1', outputIndex: 1, traceId: 'trace-1' },
    ]);
    turn.finalize({ durationMs: 0 });

    const nextTurn = startTlonAgentTurn(baseTurn, { observer: noOpObserver });
    expect(nextTurn.run(() => claimActiveTlonTurnOutput())).toEqual({
      runId: 'run-1',
      outputIndex: 0,
      traceId: null,
    });
    nextTurn.finalize({ durationMs: 0 });
  });

  it('returns a nullable attribution outside a Tlon turn', () => {
    expect(claimActiveTlonTurnOutput()).toEqual({
      runId: null,
      outputIndex: 0,
      traceId: null,
    });
  });
});

describe('Tlon agent turn classification', () => {
  it.each([
    {
      name: 'reply delivered',
      input: { replyCount: 1, deliverySuccessCount: 1 },
      expected: {
        execution: 'completed',
        result: 'reply',
        delivery: 'delivered',
        reason: 'reply',
      },
    },
    {
      name: 'final error reply delivered',
      input: {
        sourceReplies: [{ kind: 'final', isError: true }],
        deliverySuccessCount: 1,
      },
      expected: {
        execution: 'completed',
        result: 'error_reply',
        delivery: 'delivered',
        reason: 'error_reply',
        finalErrorReplyCount: 1,
      },
    },
    {
      name: 'final error reply after an action',
      input: {
        sourceReplies: [{ kind: 'final', isError: true }],
        toolCount: 1,
        deliverySuccessCount: 1,
      },
      expected: {
        execution: 'completed',
        result: 'error_reply_and_action',
        delivery: 'delivered',
        reason: 'error_reply_and_action',
        finalErrorReplyCount: 1,
      },
    },
    {
      name: 'intermediate tool error followed by a normal final reply',
      input: {
        sourceReplies: [{ kind: 'tool', isError: true }, { kind: 'final' }],
        deliverySuccessCount: 2,
      },
      expected: {
        execution: 'completed',
        result: 'reply',
        delivery: 'delivered',
        reason: 'reply',
        finalErrorReplyCount: 0,
      },
    },
    {
      name: 'recovered final error followed by a normal final reply',
      input: {
        sourceReplies: [{ kind: 'final', isError: true }, { kind: 'final' }],
        deliverySuccessCount: 2,
      },
      expected: {
        execution: 'completed',
        result: 'reply',
        delivery: 'delivered',
        reason: 'reply',
        finalErrorReplyCount: 1,
      },
    },
    {
      name: 'action only',
      input: { toolCount: 2 },
      expected: {
        execution: 'completed',
        result: 'action_only',
        delivery: 'not_applicable',
        reason: 'action_only',
      },
    },
    {
      name: 'reply and action',
      input: {
        replyCount: 1,
        toolCount: 1,
        deliverySuccessCount: 1,
      },
      expected: {
        execution: 'completed',
        result: 'reply_and_action',
        delivery: 'delivered',
        reason: 'reply_and_action',
      },
    },
    {
      name: 'intentional silence',
      input: {
        terminal: { durationMs: 250, deliverySkipReason: 'silent' },
      },
      expected: {
        execution: 'completed',
        result: 'intentional_silence',
        delivery: 'not_applicable',
        reason: 'silent',
      },
    },
    {
      name: 'empty result',
      input: {
        terminal: { durationMs: 250, deliverySkipReason: 'empty' },
      },
      expected: {
        execution: 'completed',
        result: 'empty',
        delivery: 'not_applicable',
        reason: 'empty',
      },
    },
    {
      name: 'partial delivery',
      input: {
        replyCount: 1,
        deliverySuccessCount: 1,
        deliveryFailureCount: 1,
      },
      expected: {
        execution: 'completed',
        result: 'reply',
        delivery: 'partial',
        reason: 'delivery_partial',
      },
    },
    {
      name: 'failed delivery',
      input: { replyCount: 1, deliveryFailureCount: 1 },
      expected: {
        execution: 'completed',
        result: 'reply',
        delivery: 'failed',
        reason: 'delivery_failed',
      },
    },
    {
      name: 'skipped reply delivery',
      input: {
        terminal: {
          durationMs: 250,
          sourceReplyDeliveryMode: 'message_tool_only',
        },
      },
      expected: {
        execution: 'completed',
        result: 'reply',
        delivery: 'skipped',
        reason: 'source_reply_delivery_mode_message_tool_only',
      },
    },
    {
      name: 'message tool delivery',
      input: {
        toolCount: 1,
        deliverySuccessCount: 1,
        terminal: {
          durationMs: 250,
          sourceReplyDeliveryMode: 'message_tool_only',
        },
      },
      expected: {
        execution: 'completed',
        result: 'action_only',
        delivery: 'delivered',
        reason: 'action_only',
      },
    },
    {
      name: 'failed message tool delivery',
      input: {
        toolCount: 1,
        deliveryFailureCount: 1,
        terminal: {
          durationMs: 250,
          sourceReplyDeliveryMode: 'message_tool_only',
        },
      },
      expected: {
        execution: 'completed',
        result: 'action_only',
        delivery: 'failed',
        reason: 'delivery_failed',
      },
    },
    {
      name: 'explicit empty skip under message tool policy',
      input: {
        terminal: {
          durationMs: 250,
          deliverySkipReason: 'empty',
          sourceReplyDeliveryMode: 'message_tool_only',
        },
      },
      expected: {
        execution: 'completed',
        result: 'empty',
        delivery: 'not_applicable',
        reason: 'empty',
      },
    },
    {
      name: 'failed execution',
      input: {
        terminal: { durationMs: 250, dispatchError: new Error('boom') },
      },
      expected: {
        execution: 'failed',
        result: 'empty',
        delivery: 'not_applicable',
        reason: 'dispatch_failed',
      },
    },
    {
      name: 'failed execution under message tool policy',
      input: {
        terminal: {
          durationMs: 250,
          dispatchError: new Error('boom'),
          sourceReplyDeliveryMode: 'message_tool_only',
        },
      },
      expected: {
        execution: 'failed',
        result: 'empty',
        delivery: 'not_applicable',
        reason: 'dispatch_failed',
      },
    },
    {
      name: 'timed out execution',
      input: {
        terminal: {
          durationMs: 250,
          dispatchError: new Error('aborted'),
          timedOut: true,
        },
      },
      expected: {
        execution: 'timed_out',
        result: 'empty',
        delivery: 'not_applicable',
        reason: 'timed_out',
      },
    },
    {
      name: 'cancelled execution',
      input: {
        terminal: {
          cancelled: true,
          dispatchError: new Error('aborted'),
          durationMs: 250,
        },
      },
      expected: {
        execution: 'cancelled',
        result: 'empty',
        delivery: 'not_applicable',
        reason: 'cancelled',
      },
    },
    {
      name: 'abandoned execution',
      input: {
        terminal: { abandoned: true, durationMs: 250 },
      },
      expected: {
        execution: 'abandoned',
        result: 'empty',
        delivery: 'not_applicable',
        reason: 'abandoned',
      },
    },
  ])(
    'classifies $name independently across three axes',
    ({ input, expected }) => {
      expect(recordTurn(input)).toMatchObject(expected);
    }
  );

  it('normalizes identity and retains only counts, never turn content', () => {
    expect(
      recordTurn({
        replyCount: 2,
        toolCount: 3,
        deliverySuccessCount: 1,
        terminal: { durationMs: 1250 },
      })
    ).toEqual({
      accountId: 'hosted',
      agentId: 'main',
      delivery: 'delivered',
      deliveryFailureCount: 0,
      deliverySuccessCount: 1,
      destinationKind: 'dm',
      durationMs: 1250,
      execution: 'completed',
      finalErrorReplyCount: 0,
      lastToolError: null,
      reason: 'reply_and_action',
      result: 'reply_and_action',
      runId: 'run-1',
      sessionKey: 'agent:main:tlon:direct:~nec',
      ship: 'zod',
      sourceReplyCount: 2,
      toolCallCount: 3,
      toolErrorCount: 0,
      trigger: 'dm',
    });
  });
});

describe('Tlon agent turn tool error recording', () => {
  it('accumulates tool errors and retains the latest failing call', () => {
    const turn = startTlonAgentTurn(
      { ...baseTurn, runId: 'run-tool-errors' },
      { observer: noOpObserver }
    );
    turn.run(() => {
      recordActiveTlonTurnToolCall({ toolName: 'tlon' });
      recordActiveTlonTurnToolCall({
        toolName: 'tlon',
        errorMessage: 'TimeoutError: active',
      });
      recordActiveTlonTurnToolCall({
        toolName: 'web_search',
        errorMessage: 'rate limited',
      });
    });

    expect(turn.finalize({ durationMs: 10 })).toMatchObject({
      toolCallCount: 3,
      toolErrorCount: 2,
      lastToolError: { toolName: 'web_search', message: 'rate limited' },
    });
  });

  it('never clears a recorded tool error when later calls succeed', () => {
    const turn = startTlonAgentTurn(
      { ...baseTurn, runId: 'run-tool-error-retained' },
      { observer: noOpObserver }
    );
    turn.run(() => {
      recordActiveTlonTurnToolCall({
        toolName: 'tlon',
        errorMessage: 'TimeoutError: active',
      });
      recordActiveTlonTurnToolCall({ toolName: 'tlon' });
      recordActiveTlonTurnToolCall();
    });

    expect(turn.finalize({ durationMs: 10 })).toMatchObject({
      toolCallCount: 3,
      toolErrorCount: 1,
      lastToolError: { toolName: 'tlon', message: 'TimeoutError: active' },
    });
  });

  it('keeps argument-less calls counting only tool calls', () => {
    expect(recordTurn({ toolCount: 2 })).toMatchObject({
      execution: 'completed',
      result: 'action_only',
      toolCallCount: 2,
      toolErrorCount: 0,
      lastToolError: null,
    });
  });

  it('carries tool error fields into the summary', () => {
    const turn = startTlonAgentTurn(
      { ...baseTurn, runId: 'run-tool-error-summary' },
      { observer: noOpObserver }
    );
    turn.run(() => {
      recordActiveTlonTurnToolCall({
        toolName: 'tlon',
        errorMessage: 'TimeoutError: active',
      });
    });

    const summary = turn.finalize({ durationMs: 10 });
    expect(summary.toolCallCount).toBe(1);
    expect(summary.toolErrorCount).toBe(1);
    expect(summary.lastToolError).toEqual({
      toolName: 'tlon',
      message: 'TimeoutError: active',
    });
  });
});

describe('Tlon agent turn async scope', () => {
  it('propagates through awaits and isolates concurrent turns', async () => {
    let releaseFirst!: () => void;
    const firstPaused = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = startTlonAgentTurn(
      { ...baseTurn, runId: 'run-first' },
      { observer: noOpObserver }
    );
    const second = startTlonAgentTurn(
      { ...baseTurn, runId: 'run-second' },
      { observer: noOpObserver }
    );

    const firstWork = first.run(async () => {
      recordActiveTlonTurnSourceReply();
      await firstPaused;
      recordActiveTlonTurnDelivery(true);
    });
    await second.run(async () => {
      await Promise.resolve();
      recordActiveTlonTurnToolCall();
    });
    releaseFirst();
    await firstWork;

    expect(first.finalize({ durationMs: 10 })).toMatchObject({
      runId: 'run-first',
      sourceReplyCount: 1,
      toolCallCount: 0,
      deliverySuccessCount: 1,
    });
    expect(second.finalize({ durationMs: 20 })).toMatchObject({
      runId: 'run-second',
      sourceReplyCount: 0,
      toolCallCount: 1,
      deliverySuccessCount: 0,
    });
  });

  it('finalizes once and ignores writes from late async work', async () => {
    let recordLate!: () => void;
    const turn = startTlonAgentTurn(baseTurn, { observer: noOpObserver });
    await turn.run(async () => {
      recordActiveTlonTurnSourceReply();
      recordLate = () => recordActiveTlonTurnDelivery(true);
    });

    const first = turn.finalize({ durationMs: 10 });
    recordLate();
    const second = turn.finalize({ durationMs: 999 });

    expect(second).toBe(first);
    expect(second.durationMs).toBe(10);
    expect(second.deliverySuccessCount).toBe(0);
  });

  it('records delivery operations and preserves their result or error', async () => {
    const success = startTlonAgentTurn(
      { ...baseTurn, runId: 'delivery-wrapper-success' },
      { observer: noOpObserver }
    );
    const result = await success.run(() =>
      observeActiveTlonTurnDelivery(async () => 'sent')
    );
    expect(result).toBe('sent');
    expect(success.finalize({ durationMs: 10 })).toMatchObject({
      delivery: 'delivered',
      deliveryFailureCount: 0,
      deliverySuccessCount: 1,
    });

    const failure = startTlonAgentTurn(
      { ...baseTurn, runId: 'delivery-wrapper-failure' },
      { observer: noOpObserver }
    );
    const sendError = new Error('send failed');
    await expect(
      failure.run(() =>
        observeActiveTlonTurnDelivery(async () => {
          throw sendError;
        })
      )
    ).rejects.toBe(sendError);
    expect(failure.finalize({ durationMs: 10 })).toMatchObject({
      delivery: 'failed',
      deliveryFailureCount: 1,
      deliverySuccessCount: 0,
    });
  });

  it('keeps observer failures out of the dispatch path', async () => {
    const observer: TlonAgentTurnObserver = {
      recordStarted: () => {
        throw new Error('meter unavailable');
      },
      recordTerminal: () => {
        throw new Error('logger unavailable');
      },
    };

    expect(() => startTlonAgentTurn(baseTurn, { observer })).not.toThrow();
    const turn = startTlonAgentTurn(baseTurn, { observer: noOpObserver });
    await turn.run(async () => undefined);
    const brokenTerminalObserver: TlonAgentTurnObserver = {
      recordStarted: () => undefined,
      recordTerminal: observer.recordTerminal,
    };
    const terminalTurn = startTlonAgentTurn(baseTurn, {
      observer: brokenTerminalObserver,
    });

    expect(() => terminalTurn.finalize({ durationMs: 10 })).not.toThrow();
    expect(turn.finalize({ durationMs: 10 }).execution).toBe('completed');
  });
});

type MetricPoint = {
  attributes: Record<string, string>;
  name: string;
  value: number;
};

function fakeMeterProvider(points: MetricPoint[]) {
  return {
    getMeter: () => ({
      createCounter: (name: string) => ({
        add: (value: number, attributes: Record<string, string>) => {
          points.push({ attributes, name, value });
        },
      }),
      createHistogram: (name: string) => ({
        record: (value: number, attributes: Record<string, string>) => {
          points.push({ attributes, name, value });
        },
      }),
    }),
  };
}

describe('Tlon agent turn OTEL observer', () => {
  it('emits low-cardinality started, terminal, duration, and log records', () => {
    const points: MetricPoint[] = [];
    const info = vi.fn();
    const provider = fakeMeterProvider(points);
    const observer = createTlonAgentTurnOtelObserver({
      getMeterProvider: () => provider,
      logger: { info },
    });
    const turn = startTlonAgentTurn(baseTurn, { observer });

    turn.run(() => {
      recordActiveTlonTurnSourceReply();
      recordActiveTlonTurnDelivery(true);
    });
    turn.finalize({ durationMs: 2500 });

    expect(points).toEqual([
      {
        name: 'tlon.agent.turns.started',
        value: 1,
        attributes: {
          destination_kind: 'dm',
          trigger: 'dm',
        },
      },
      {
        name: 'tlon.agent.turns',
        value: 1,
        attributes: {
          delivery: 'delivered',
          destination_kind: 'dm',
          execution: 'completed',
          reason: 'reply',
          result: 'reply',
          trigger: 'dm',
        },
      },
      {
        name: 'tlon.agent.turn.duration',
        value: 2.5,
        attributes: {
          delivery: 'delivered',
          destination_kind: 'dm',
          execution: 'completed',
          reason: 'reply',
          result: 'reply',
          trigger: 'dm',
        },
      },
    ]);
    expect(info).toHaveBeenCalledWith('tlon.agent_turn.terminal', {
      'tlon.turn.account_id': 'hosted',
      'tlon.turn.agent_id': 'main',
      'tlon.turn.delivery': 'delivered',
      'tlon.turn.delivery_failure_count': 0,
      'tlon.turn.delivery_success_count': 1,
      'tlon.turn.destination_kind': 'dm',
      'tlon.turn.duration_ms': 2500,
      'tlon.turn.event': 'tlon.agent_turn.terminal',
      'tlon.turn.execution': 'completed',
      'tlon.turn.final_error_reply_count': 0,
      'tlon.turn.reason': 'reply',
      'tlon.turn.result': 'reply',
      'tlon.turn.run_id': 'run-1',
      'tlon.turn.session_key': 'agent:main:tlon:direct:~nec',
      'tlon.turn.ship': 'zod',
      'tlon.turn.source_reply_count': 1,
      'tlon.turn.tool_call_count': 0,
      'tlon.turn.tool_error_count': 0,
      'tlon.turn.trigger': 'dm',
    });
  });

  it('rebinds instruments when diagnostics installs a meter provider', () => {
    const before: MetricPoint[] = [];
    const after: MetricPoint[] = [];
    let provider = fakeMeterProvider(before);
    const observer = createTlonAgentTurnOtelObserver({
      getMeterProvider: () => provider,
      logger: { info: () => undefined },
    });

    startTlonAgentTurn({ ...baseTurn, runId: 'before' }, { observer }).finalize(
      { durationMs: 10 }
    );
    provider = fakeMeterProvider(after);
    startTlonAgentTurn({ ...baseTurn, runId: 'after' }, { observer }).finalize({
      durationMs: 20,
    });

    expect(before.map((point) => point.name)).toEqual([
      'tlon.agent.turns.started',
      'tlon.agent.turns',
      'tlon.agent.turn.duration',
    ]);
    expect(after.map((point) => point.name)).toEqual([
      'tlon.agent.turns.started',
      'tlon.agent.turns',
      'tlon.agent.turn.duration',
    ]);
  });
});
