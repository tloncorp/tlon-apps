import { beforeEach, describe, expect, it, vi } from 'vitest';

import { _testing, createTlonTelemetry, recordToolCall } from './telemetry.js';
import { summarizeTlonCommand } from './tlon-tool-command.js';

const postHogMocks = vi.hoisted(() => ({
  identify: vi.fn(),
  capture: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn(),
}));

vi.mock('posthog-node', () => ({
  PostHog: vi.fn(
    class MockPostHog {
      constructor() {
        return postHogMocks;
      }
    }
  ),
}));

describe('telemetry tool tracking', () => {
  beforeEach(() => {
    _testing.clearToolCalls();
    postHogMocks.identify.mockClear();
    postHogMocks.capture.mockClear();
    postHogMocks.flush.mockClear();
    postHogMocks.shutdown.mockClear();
  });

  function createEnabledTelemetry() {
    return createTlonTelemetry({
      config: {
        enabled: true,
        apiKey: 'phc_test',
        host: 'https://us.i.posthog.com',
      },
    });
  }

  async function captureReply(params?: {
    sessionKey?: string;
    deliveredMessageCount?: number;
    dispatchError?: unknown;
  }) {
    const telemetry = createEnabledTelemetry();
    const replyTelemetry = telemetry?.startReply({
      sessionKey: params?.sessionKey ?? 'session-1',
      ownerShip: '~zod',
      botShip: '~nec',
      chatType: 'dm',
      isThreadReply: false,
      senderRole: 'owner',
      attachmentCount: 1,
    });

    await replyTelemetry?.capture({
      deliveredMessageCount: params?.deliveredMessageCount ?? 1,
      replyCharCount: 42,
      replyWordCount: 7,
      replyMediaCount: 0,
      dispatchDurationMs: 250,
      queuedFinal: false,
      queuedFinalCount: 1,
      queuedBlockCount: 0,
      provider: 'anthropic',
      model: 'claude-test',
      thinkLevel: null,
      dispatchError: params?.dispatchError,
    });

    await telemetry?.close();
    return postHogMocks.capture.mock.calls.at(-1)?.[0];
  }

  it('captures only tool calls recorded after reply tracking starts', async () => {
    recordToolCall({
      sessionKey: 'session-1',
      toolName: 'read',
      durationMs: 25,
    });

    const telemetry = createEnabledTelemetry();
    const replyTelemetry = telemetry?.startReply({
      sessionKey: 'session-1',
      ownerShip: '~zod',
      botShip: '~nec',
      chatType: 'dm',
      isThreadReply: false,
      senderRole: 'owner',
      attachmentCount: 1,
    });

    recordToolCall({
      sessionKey: 'session-1',
      toolName: 'web_search',
      durationMs: 125,
    });
    recordToolCall({
      sessionKey: 'session-1',
      toolName: 'read',
      error: 'tool failed',
    });

    await replyTelemetry?.capture({
      deliveredMessageCount: 1,
      replyCharCount: 42,
      replyWordCount: 7,
      replyMediaCount: 0,
      dispatchDurationMs: 250,
      queuedFinal: false,
      queuedFinalCount: 1,
      queuedBlockCount: 0,
      provider: 'anthropic',
      model: 'claude-test',
      thinkLevel: null,
    });

    expect(postHogMocks.capture).toHaveBeenCalledWith({
      distinctId: '~zod',
      event: 'TlonBot Reply Handled',
      properties: expect.objectContaining({
        toolCount: 2,
        toolNames: ['web_search', 'read'],
        toolTotalDurationMs: 125,
        toolErrorCount: 1,
        toolCalls: [
          {
            toolName: 'web_search',
            durationMs: 125,
            error: null,
            summaryKey: null,
          },
          {
            toolName: 'read',
            durationMs: null,
            error: 'tool failed',
            summaryKey: null,
          },
        ],
        tlonToolCallCount: 0,
        tlonToolSummaryKeys: [],
        tlonToolChannelKinds: [],
        tlonToolUpdateFields: [],
      }),
    });

    await telemetry?.close();
  });

  it('ignores missing session keys', async () => {
    recordToolCall({
      sessionKey: '',
      toolName: 'web_search',
      durationMs: 50,
    });

    const capturedEvent = await captureReply({ sessionKey: 'session-2' });

    expect(capturedEvent?.properties.toolCalls).toEqual([]);
    expect(capturedEvent?.properties.toolNames).toEqual([]);
    expect(capturedEvent?.properties.toolCount).toBe(0);
    expect(capturedEvent?.properties.toolTotalDurationMs).toBe(0);
    expect(capturedEvent?.properties.toolErrorCount).toBe(0);
    expect(capturedEvent?.properties.tlonToolCallCount).toBe(0);
    expect(capturedEvent?.properties.tlonToolSummaryKeys).toEqual([]);
    expect(capturedEvent?.properties.tlonToolChannelKinds).toEqual([]);
    expect(capturedEvent?.properties.tlonToolUpdateFields).toEqual([]);
  });

  it('classifies reply outcomes', async () => {
    await captureReply({ deliveredMessageCount: 1 });
    expect(
      postHogMocks.capture.mock.calls.at(-1)?.[0]?.properties.outcome
    ).toBe('responded');

    await captureReply({ deliveredMessageCount: 0 });
    expect(
      postHogMocks.capture.mock.calls.at(-1)?.[0]?.properties.outcome
    ).toBe('no_reply');

    await captureReply({
      deliveredMessageCount: 0,
      dispatchError: new Error('boom'),
    });
    expect(
      postHogMocks.capture.mock.calls.at(-1)?.[0]?.properties.outcome
    ).toBe('error');
  });

  it('captures camelCase telemetry properties without routing metadata', async () => {
    const telemetry = createEnabledTelemetry();
    const replyTelemetry = telemetry?.startReply({
      sessionKey: 'session-1',
      ownerShip: '~zod',
      botShip: '~nec',
      chatType: 'dm',
      isThreadReply: false,
      senderRole: 'owner',
      attachmentCount: 1,
    });

    recordToolCall({
      sessionKey: 'session-1',
      toolName: 'web_search',
      durationMs: 125,
    });

    await replyTelemetry?.capture({
      deliveredMessageCount: 1,
      replyCharCount: 42,
      replyWordCount: 7,
      replyMediaCount: 0,
      dispatchDurationMs: 250,
      queuedFinal: false,
      queuedFinalCount: 1,
      queuedBlockCount: 0,
      provider: 'anthropic',
      model: 'claude-test',
      thinkLevel: null,
    });

    expect(postHogMocks.identify).toHaveBeenCalledWith({
      distinctId: '~zod',
      properties: {
        logSource: 'openclawPlugin',
        tlonOwnerShip: '~zod',
        tlonBotShip: '~nec',
      },
    });

    expect(postHogMocks.capture).toHaveBeenCalledWith({
      distinctId: '~zod',
      event: 'TlonBot Reply Handled',
      properties: {
        logSource: 'openclawPlugin',
        botShip: '~nec',
        ownerShip: '~zod',
        outcome: 'responded',
        chatType: 'dm',
        isThreadReply: false,
        senderRole: 'owner',
        attachmentCount: 1,
        hasAttachments: true,
        deliveredMessageCount: 1,
        replyCharCount: 42,
        replyWordCount: 7,
        replyMediaCount: 0,
        dispatchDurationMs: 250,
        queuedFinal: false,
        queuedFinalCount: 1,
        queuedBlockCount: 0,
        provider: 'anthropic',
        model: 'claude-test',
        thinkLevel: null,
        toolCount: 1,
        toolNames: ['web_search'],
        toolTotalDurationMs: 125,
        toolErrorCount: 0,
        toolCalls: [
          {
            toolName: 'web_search',
            durationMs: 125,
            error: null,
            summaryKey: null,
          },
        ],
        tlonToolCallCount: 0,
        tlonToolSummaryKeys: [],
        tlonToolChannelKinds: [],
        tlonToolUpdateFields: [],
      },
    });

    const capturedEvent = postHogMocks.capture.mock.calls[0]?.[0];
    expect(capturedEvent?.properties).not.toHaveProperty('accountId');
    expect(capturedEvent?.properties).not.toHaveProperty('agentId');
    expect(capturedEvent?.properties).not.toHaveProperty('channel');

    await telemetry?.close();

    expect(postHogMocks.flush).toHaveBeenCalledTimes(1);
    expect(postHogMocks.shutdown).toHaveBeenCalledTimes(1);
  });

  describe('captureHeartbeatNudge', () => {
    it('emits correct PostHog event with all properties (success case includes messageId and nudgeSentAtMs)', () => {
      const telemetry = createEnabledTelemetry()!;
      telemetry.captureHeartbeatNudge({
        ownerShip: '~zod',
        botShip: '~nec',
        nudgeStage: 2,
        nudgeTarget: '~zod',
        channel: 'tlon',
        success: true,
        accountId: 'default',
        messageId: '~nec/170.141.184.506.511.632.882.809.306.892.730.368.000',
        nudgeSentAtMs: 1700000000000,
      });

      expect(postHogMocks.capture).toHaveBeenCalledWith({
        distinctId: '~zod',
        event: 'TlonBot Heartbeat Nudge Sent',
        properties: {
          logSource: 'openclawPlugin',
          botShip: '~nec',
          ownerShip: '~zod',
          trigger: 'heartbeat',
          nudgeStage: 2,
          nudgeTarget: '~zod',
          channel: 'tlon',
          success: true,
          accountId: 'default',
          messageId: '~nec/170.141.184.506.511.632.882.809.306.892.730.368.000',
          nudgeSentAtMs: 1700000000000,
        },
      });
    });

    it('writes null messageId and null nudgeSentAtMs on send failure', () => {
      const telemetry = createEnabledTelemetry()!;
      telemetry.captureHeartbeatNudge({
        ownerShip: '~zod',
        botShip: '~nec',
        nudgeStage: 1,
        nudgeTarget: '~zod',
        channel: 'tlon',
        success: false,
        accountId: 'default',
        messageId: null,
        nudgeSentAtMs: null,
      });

      const captured = postHogMocks.capture.mock.calls.at(-1)?.[0];
      expect(captured.properties.success).toBe(false);
      expect(captured.properties.messageId).toBeNull();
      expect(captured.properties.nudgeSentAtMs).toBeNull();
    });

    it('identifies owner on first call', () => {
      const telemetry = createEnabledTelemetry()!;
      telemetry.captureHeartbeatNudge({
        ownerShip: '~zod',
        botShip: '~nec',
        nudgeStage: 1,
        nudgeTarget: '~zod',
        channel: 'tlon',
        success: true,
        accountId: null,
        messageId: '~nec/some-id',
        nudgeSentAtMs: 1700000000000,
      });

      expect(postHogMocks.identify).toHaveBeenCalledWith({
        distinctId: '~zod',
        properties: {
          logSource: 'openclawPlugin',
          tlonOwnerShip: '~zod',
          tlonBotShip: '~nec',
        },
      });
    });

    it('skips if ownerShip is empty', () => {
      const telemetry = createEnabledTelemetry()!;
      telemetry.captureHeartbeatNudge({
        ownerShip: '',
        botShip: '~nec',
        nudgeStage: 1,
        nudgeTarget: '',
        channel: 'tlon',
        success: true,
        accountId: null,
        messageId: null,
        nudgeSentAtMs: null,
      });

      expect(postHogMocks.capture).not.toHaveBeenCalled();
    });
  });

  describe('captureHeartbeatReengagement', () => {
    it('emits correct PostHog event with all properties', () => {
      const telemetry = createEnabledTelemetry()!;
      telemetry.captureHeartbeatReengagement({
        ownerShip: '~zod',
        botShip: '~nec',
        nudgeStage: 3,
        nudgeSentAt: 1000,
        reengagedAt: 5000,
        reengagementDelayMs: 4000,
        channel: 'tlon',
        accountId: 'default',
      });

      expect(postHogMocks.capture).toHaveBeenCalledWith({
        distinctId: '~zod',
        event: 'TlonBot Heartbeat Nudge Reengaged',
        properties: {
          logSource: 'openclawPlugin',
          botShip: '~nec',
          ownerShip: '~zod',
          nudgeStage: 3,
          nudgeSentAt: 1000,
          reengagedAt: 5000,
          reengagementDelayMs: 4000,
          channel: 'tlon',
          accountId: 'default',
        },
      });
    });

    it('identifies owner on first call', () => {
      const telemetry = createEnabledTelemetry()!;
      telemetry.captureHeartbeatReengagement({
        ownerShip: '~zod',
        botShip: '~nec',
        nudgeStage: 1,
        nudgeSentAt: 1000,
        reengagedAt: 2000,
        reengagementDelayMs: 1000,
        channel: 'tlon',
        accountId: null,
      });

      expect(postHogMocks.identify).toHaveBeenCalledWith({
        distinctId: '~zod',
        properties: {
          logSource: 'openclawPlugin',
          tlonOwnerShip: '~zod',
          tlonBotShip: '~nec',
        },
      });
    });

    it('skips if ownerShip is empty', () => {
      const telemetry = createEnabledTelemetry()!;
      telemetry.captureHeartbeatReengagement({
        ownerShip: '',
        botShip: '~nec',
        nudgeStage: 1,
        nudgeSentAt: 1000,
        reengagedAt: 2000,
        reengagementDelayMs: 1000,
        channel: 'tlon',
        accountId: null,
      });

      expect(postHogMocks.capture).not.toHaveBeenCalled();
    });
  });

  it('reply telemetry still works independently', async () => {
    const capturedEvent = await captureReply();
    expect(capturedEvent?.event).toBe('TlonBot Reply Handled');
    expect(capturedEvent?.properties.outcome).toBe('responded');
  });

  it('captures privacy-safe tlon command summaries', async () => {
    const telemetry = createEnabledTelemetry();
    const replyTelemetry = telemetry?.startReply({
      sessionKey: 'session-1',
      ownerShip: '~zod',
      botShip: '~nec',
      chatType: 'dm',
      isThreadReply: false,
      senderRole: 'owner',
      attachmentCount: 0,
    });

    recordToolCall({
      sessionKey: 'session-1',
      toolName: 'tlon',
      durationMs: 80,
      context: summarizeTlonCommand(
        'groups invite ~zod/quiet-launch ~sampel-palnet ~marzod-marnec'
      ),
    });
    recordToolCall({
      sessionKey: 'session-1',
      toolName: 'tlon',
      durationMs: 40,
      context: summarizeTlonCommand(
        'contacts update-profile --nickname "PM Bot" --avatar https://assets.example.com/private.png'
      ),
    });
    recordToolCall({
      sessionKey: 'session-1',
      toolName: 'tlon',
      durationMs: 30,
      context: summarizeTlonCommand(
        'groups add-channel ~zod/quiet-launch "Photos" --kind heap'
      ),
    });

    await replyTelemetry?.capture({
      deliveredMessageCount: 1,
      replyCharCount: 42,
      replyWordCount: 7,
      replyMediaCount: 0,
      dispatchDurationMs: 250,
      queuedFinal: false,
      queuedFinalCount: 1,
      queuedBlockCount: 0,
      provider: 'anthropic',
      model: 'claude-test',
      thinkLevel: null,
    });

    expect(postHogMocks.capture).toHaveBeenCalledWith({
      distinctId: '~zod',
      event: 'TlonBot Reply Handled',
      properties: expect.objectContaining({
        tlonToolCallCount: 3,
        tlonToolSummaryKeys: [
          'groups.invite',
          'contacts.update-profile',
          'groups.add-channel',
        ],
        tlonToolChannelKinds: ['heap'],
        tlonToolUpdateFields: ['nickname', 'avatar'],
        toolCalls: [
          {
            toolName: 'tlon',
            durationMs: 80,
            error: null,
            summaryKey: 'groups.invite',
          },
          {
            toolName: 'tlon',
            durationMs: 40,
            error: null,
            summaryKey: 'contacts.update-profile',
          },
          {
            toolName: 'tlon',
            durationMs: 30,
            error: null,
            summaryKey: 'groups.add-channel',
          },
        ],
      }),
    });

    const capturedEvent = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(JSON.stringify(capturedEvent?.properties)).not.toContain(
      '~zod/quiet-launch'
    );
    expect(JSON.stringify(capturedEvent?.properties)).not.toContain(
      '~sampel-palnet'
    );
    expect(JSON.stringify(capturedEvent?.properties)).not.toContain('PM Bot');
    expect(JSON.stringify(capturedEvent?.properties)).not.toContain(
      'https://assets.example.com/private.png'
    );

    await telemetry?.close();
  });
});
