import { describe, expect, it, vi } from 'vitest';

import {
  type TlonAgentTurnObserver,
  startTlonAgentTurn,
} from '../turn-recorder.js';
import { prepareChannelSummary } from './channel-summary.js';

const noOpObserver: TlonAgentTurnObserver = {
  recordStarted: () => undefined,
  recordTerminal: () => undefined,
};

function startSummaryTurn() {
  return startTlonAgentTurn(
    {
      accountId: 'hosted',
      agentId: 'main',
      destinationKind: 'group_channel',
      inputMessageId: '~zod/1704067200000',
      runId: 'summary-run',
      sessionKey: 'agent:main:tlon:group:chat/~zod/general',
      ship: '~bot',
      trigger: 'summarization',
    },
    { observer: noOpObserver }
  );
}

describe('channel summary fallback recording', () => {
  it.each([
    {
      name: 'no-history',
      loadHistory: async () => [] as string[],
      reason: 'posted no-history summary response',
      text: "I couldn't fetch any messages for this channel.",
    },
    {
      name: 'history-fetch-error',
      loadHistory: async () => {
        throw new Error('history unavailable');
      },
      reason: 'posted summary error response',
      text: 'history unavailable',
    },
  ])('records the $name reply as delivered', async (scenario) => {
    const dispatchFallback = vi.fn(async () => ({ messageId: '~bot/1' }));

    const result = await prepareChannelSummary({
      dispatchFallback,
      dispatchStartTime: 90,
      loadHistory: scenario.loadHistory,
      now: () => 100,
      turnRecorder: startSummaryTurn(),
    });

    expect(result.kind).toBe('fallback');
    if (result.kind !== 'fallback') {
      throw new Error('expected a fallback reply');
    }
    expect(result.fallback.reason).toBe(scenario.reason);
    expect(result.fallback.text).toContain(scenario.text);
    expect(dispatchFallback).toHaveBeenCalledWith(result.fallback);
    expect(result.summary).toMatchObject({
      delivery: 'delivered',
      deliverySuccessCount: 1,
      dispatch: 'attempted',
      dispatchAttemptCount: 1,
      execution: 'completed',
      reason: 'reply',
      result: 'reply',
      sourceReplyCount: 1,
    });
  });
});
