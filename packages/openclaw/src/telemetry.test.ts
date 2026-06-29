import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  _testing,
  createTlonTelemetry,
  recordToolCall,
  reportCronRun,
  reportHarnessDebug,
  reportHarnessError,
  reportOutboundRoute,
  reportPluginError,
  reportSessionDiagnostic,
  reportSessionLifecycle,
  reportSessionTurnCreated,
  reportTelemetryError,
  setDebugTelemetryReporter,
  setErrorTelemetryReporter,
  setOutboundRouteReporter,
  setSessionTelemetryReporter,
} from './telemetry.js';
import { summarizeTlonCommand } from './tlon-tool-command.js';

const postHogMocks = vi.hoisted(() => ({
  identify: vi.fn(),
  capture: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn(),
}));

vi.mock('posthog-node', () => ({
  PostHog: vi.fn(function MockPostHog() {
    return postHogMocks;
  }),
}));

const VERSION_IDENTITY_MATCH = {
  harness: 'openclaw',
  pluginVersion: expect.any(String),
  pluginCommit: expect.any(String),
  pluginFingerprint: expect.stringMatching(/^fp1:[a-f0-9]{12}$/),
  adapterVersion: expect.any(String),
  adapterFingerprint: expect.stringMatching(/^fp1:[a-f0-9]{12}$/),
};

describe('telemetry tool tracking', () => {
  beforeEach(() => {
    _testing.clearToolCalls();
    _testing.clearSessionContexts();
    _testing.clearHarnessDebugSnapshots();
    _testing.clearCronRuns();
    setSessionTelemetryReporter(null);
    setDebugTelemetryReporter(null);
    setErrorTelemetryReporter(null);
    postHogMocks.identify.mockClear();
    postHogMocks.capture.mockClear();
    postHogMocks.flush.mockClear();
    postHogMocks.shutdown.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
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
    deliverySkipReason?: 'empty' | 'silent' | 'heartbeat';
    sourceReplyDeliveryMode?: string | null;
  }) {
    const telemetry = createEnabledTelemetry();
    const replyTelemetry = telemetry?.startReply({
      sessionKey: params?.sessionKey ?? 'session-1',
      runId: 'run-1',
      accountId: 'default',
      agentId: 'agent-main',
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
      failedCounts: { tool: 0, block: 0, final: 0 },
      deliverySkipReason: params?.deliverySkipReason ?? null,
      sourceReplyDeliveryMode: params?.sourceReplyDeliveryMode ?? 'automatic',
      beforeAgentRunBlocked: false,
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
      runId: 'run-1',
      accountId: 'default',
      agentId: 'agent-main',
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
      failedCounts: { tool: 0, block: 0, final: 0 },
      sourceReplyDeliveryMode: 'automatic',
      beforeAgentRunBlocked: false,
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

  it('captures delivery skip reason only for no-reply outcomes', async () => {
    await captureReply({
      deliveredMessageCount: 0,
      deliverySkipReason: 'silent',
    });
    expect(
      postHogMocks.capture.mock.calls.at(-1)?.[0]?.properties.deliverySkipReason
    ).toBe('silent');

    await captureReply({
      deliveredMessageCount: 1,
      deliverySkipReason: 'silent',
    });
    expect(
      postHogMocks.capture.mock.calls.at(-1)?.[0]?.properties.deliverySkipReason
    ).toBeNull();

    await captureReply({
      deliveredMessageCount: 0,
      sourceReplyDeliveryMode: 'message_tool_only',
    });
    expect(
      postHogMocks.capture.mock.calls.at(-1)?.[0]?.properties.deliverySkipReason
    ).toBe('source_reply_delivery_mode_message_tool_only');
  });

  it('classifies direct send and dispatcher failures as errors', async () => {
    const telemetry = createEnabledTelemetry();
    const replyTelemetry = telemetry?.startReply({
      sessionKey: 'session-1',
      runId: 'run-1',
      accountId: 'default',
      agentId: 'agent-main',
      ownerShip: '~zod',
      botShip: '~nec',
      chatType: 'groupChannel',
      destinationKind: 'groupChannel',
      isThreadReply: true,
      senderRole: 'user',
      attachmentCount: 0,
    });

    await replyTelemetry?.capture({
      sendAttemptCount: 1,
      sendErrorCount: 1,
      sendErrorKind: 'final',
      deliveredMessageCount: 0,
      replyCharCount: 0,
      replyWordCount: 0,
      replyMediaCount: 0,
      dispatchDurationMs: 750,
      queuedFinal: false,
      queuedFinalCount: 0,
      queuedBlockCount: 0,
      failedCounts: { tool: 0, block: 0, final: 1 },
      sourceReplyDeliveryMode: 'automatic',
      beforeAgentRunBlocked: true,
      provider: 'anthropic',
      model: 'claude-test',
      thinkLevel: 'medium',
    });

    const props = postHogMocks.capture.mock.calls.at(-1)?.[0]?.properties;
    expect(props).toMatchObject({
      outcome: 'error',
      destinationKind: 'groupChannel',
      sendAttemptCount: 1,
      sendError: true,
      sendErrorCount: 1,
      sendErrorKind: 'final',
      failedFinalCount: 1,
      failedReplyCount: 1,
      sourceReplyDeliveryMode: 'automatic',
      beforeAgentRunBlocked: true,
    });
  });

  it('emits abandoned reply telemetry for stale traces', () => {
    vi.useFakeTimers();

    const telemetry = createEnabledTelemetry();
    telemetry?.startReply({
      sessionKey: 'session-1',
      runId: 'run-1',
      accountId: 'default',
      agentId: 'agent-main',
      ownerShip: '~zod',
      botShip: '~nec',
      chatType: 'dm',
      isThreadReply: false,
      senderRole: 'owner',
      attachmentCount: 0,
    });

    vi.advanceTimersByTime(_testing.getReplyTraceTtlMs());

    const props = postHogMocks.capture.mock.calls.at(-1)?.[0]?.properties;
    expect(props).toMatchObject({
      outcome: 'abandoned',
      abandonedReason: 'stale',
      sessionKey: 'session-1',
      runId: 'run-1',
      deliveredMessageCount: 0,
      sendAttemptCount: 0,
    });
  });

  it('captures camelCase reply telemetry properties with turn context', async () => {
    const telemetry = createEnabledTelemetry();
    const replyTelemetry = telemetry?.startReply({
      sessionKey: 'session-1',
      runId: 'run-1',
      accountId: 'default',
      agentId: 'agent-main',
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
      failedCounts: { tool: 0, block: 0, final: 0 },
      sourceReplyDeliveryMode: 'automatic',
      beforeAgentRunBlocked: false,
      provider: 'anthropic',
      model: 'claude-test',
      thinkLevel: null,
    });

    expect(postHogMocks.identify).toHaveBeenCalledWith({
      distinctId: '~zod',
      properties: expect.objectContaining({
        logSource: 'openclawPlugin',
        tlonOwnerShip: '~zod',
        tlonBotShip: '~nec',
        harness: 'openclaw',
        pluginVersion: expect.any(String),
        pluginFingerprint: expect.stringMatching(/^fp1:[a-f0-9]{12}$/),
      }),
    });

    expect(postHogMocks.capture).toHaveBeenCalledWith({
      distinctId: '~zod',
      event: 'TlonBot Reply Handled',
      properties: expect.objectContaining({
        logSource: 'openclawPlugin',
        harness: 'openclaw',
        pluginVersion: expect.any(String),
        pluginCommit: expect.any(String),
        pluginFingerprint: expect.stringMatching(/^fp1:[a-f0-9]{12}$/),
        adapterVersion: expect.any(String),
        adapterFingerprint: expect.stringMatching(/^fp1:[a-f0-9]{12}$/),
        botShip: '~nec',
        ownerShip: '~zod',
        sessionKey: 'session-1',
        sessionId: null,
        runId: 'run-1',
        accountId: 'default',
        agentId: 'agent-main',
        outcome: 'responded',
        chatType: 'dm',
        destinationKind: 'dm',
        isThreadReply: false,
        senderRole: 'owner',
        attachmentCount: 1,
        hasAttachments: true,
        sendAttemptCount: 0,
        sendError: false,
        sendErrorCount: 0,
        sendErrorKind: null,
        deliveredMessageCount: 1,
        replyCharCount: 42,
        replyWordCount: 7,
        replyMediaCount: 0,
        dispatchDurationMs: 250,
        queuedFinal: false,
        queuedFinalCount: 1,
        queuedBlockCount: 0,
        failedToolCount: 0,
        failedBlockCount: 0,
        failedFinalCount: 0,
        failedReplyCount: 0,
        deliverySkipReason: null,
        sourceReplyDeliveryMode: 'automatic',
        beforeAgentRunBlocked: false,
        dispatchError: false,
        dispatchErrorKind: null,
        abandonedReason: null,
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
      }),
    });

    const capturedEvent = postHogMocks.capture.mock.calls[0]?.[0];
    expect(capturedEvent?.properties).not.toHaveProperty('channel');
    expect(capturedEvent?.properties).not.toHaveProperty('messageId');
    expect(capturedEvent?.properties).not.toHaveProperty('messageIds');
    expect(capturedEvent?.properties).not.toHaveProperty('inboundMessageId');
    expect(capturedEvent?.properties).not.toHaveProperty('outboundMessageIds');

    await telemetry?.close();

    expect(postHogMocks.flush).toHaveBeenCalledTimes(1);
    expect(postHogMocks.shutdown).toHaveBeenCalledTimes(1);
  });

  it('threads OpenClaw sessionId from lifecycle into reply telemetry', async () => {
    const telemetry = createEnabledTelemetry()!;
    const replyTelemetry = telemetry.startReply({
      sessionKey: 'session-1',
      runId: 'run-1',
      accountId: 'default',
      agentId: 'agent-main',
      ownerShip: '~zod',
      botShip: '~nec',
      chatType: 'dm',
      isThreadReply: false,
      senderRole: 'owner',
      attachmentCount: 0,
    });

    reportSessionLifecycle({
      lifecycleEvent: 'session_start',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      agentId: 'agent-main',
    });

    await replyTelemetry.capture({
      deliveredMessageCount: 1,
      replyCharCount: 12,
      replyWordCount: 2,
      replyMediaCount: 0,
      dispatchDurationMs: 150,
      queuedFinal: true,
      queuedFinalCount: 1,
      queuedBlockCount: 0,
      provider: null,
      model: null,
      thinkLevel: null,
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.event).toBe('TlonBot Reply Handled');
    expect(call.properties).toMatchObject({
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      runId: 'run-1',
    });
  });

  it('captures gateway connected with version identity', () => {
    const telemetry = createEnabledTelemetry()!;
    telemetry.captureGatewayConnected({
      ownerShip: '~zod',
      botShip: '~nec',
      tlonSkillVersion: '0.3.2',
      accountId: 'default',
      configured: true,
      watchedChannelCount: 3,
      dmAllowlistCount: 2,
      defaultAuthorizedShipsCount: 1,
      pendingApprovalCount: 4,
      autoDiscoverChannels: true,
      ownerListenEnabled: true,
    });

    expect(postHogMocks.capture).toHaveBeenCalledWith({
      distinctId: '~zod',
      event: 'TlonBot Gateway Connected',
      properties: expect.objectContaining({
        logSource: 'openclawPlugin',
        ...VERSION_IDENTITY_MATCH,
        botShip: '~nec',
        ownerShip: '~zod',
        tlonSkillVersion: '0.3.2',
        accountId: 'default',
        configured: true,
        watchedChannelCount: 3,
        dmAllowlistCount: 2,
        defaultAuthorizedShipsCount: 1,
        pendingApprovalCount: 4,
        autoDiscoverChannels: true,
        ownerListenEnabled: true,
      }),
    });
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
        properties: expect.objectContaining({
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
        }),
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
        properties: expect.objectContaining({
          logSource: 'openclawPlugin',
          tlonOwnerShip: '~zod',
          tlonBotShip: '~nec',
        }),
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
        properties: expect.objectContaining({
          logSource: 'openclawPlugin',
          botShip: '~nec',
          ownerShip: '~zod',
          nudgeStage: 3,
          nudgeSentAt: 1000,
          reengagedAt: 5000,
          reengagementDelayMs: 4000,
          channel: 'tlon',
          accountId: 'default',
        }),
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
        properties: expect.objectContaining({
          logSource: 'openclawPlugin',
          tlonOwnerShip: '~zod',
          tlonBotShip: '~nec',
        }),
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

  async function rememberSessionForDiagnostics(
    telemetry: NonNullable<ReturnType<typeof createEnabledTelemetry>>
  ) {
    const replyTelemetry = telemetry.startReply({
      sessionKey: 'session-1',
      runId: 'run-1',
      accountId: 'default',
      agentId: 'agent-main',
      ownerShip: '~zod',
      botShip: '~nec',
      chatType: 'dm',
      isThreadReply: false,
      senderRole: 'owner',
      attachmentCount: 0,
    });

    await replyTelemetry.capture({
      deliveredMessageCount: 1,
      replyCharCount: 10,
      replyWordCount: 2,
      replyMediaCount: 0,
      dispatchDurationMs: 100,
      queuedFinal: true,
      queuedFinalCount: 1,
      queuedBlockCount: 0,
      provider: null,
      model: null,
      thinkLevel: null,
    });
    postHogMocks.capture.mockClear();
  }

  function bindSessionReporter(
    telemetry: NonNullable<ReturnType<typeof createEnabledTelemetry>>
  ) {
    setSessionTelemetryReporter((report) => {
      switch (report.kind) {
        case 'lifecycle':
          telemetry.captureSessionLifecycle(report.event);
          break;
        case 'watchdog':
          telemetry.captureSessionWatchdog(report.event);
          break;
        case 'recovery':
          telemetry.captureSessionRecovery(report.event);
          break;
      }
    });
  }

  function bindErrorReporter(
    telemetry: NonNullable<ReturnType<typeof createEnabledTelemetry>>
  ) {
    setErrorTelemetryReporter((report) => {
      switch (report.kind) {
        case 'harness':
          telemetry.captureHarnessError({
            ...report.event,
            accountId: report.event.accountId ?? 'default',
            ownerShip: report.event.ownerShip ?? '~zod',
            botShip: report.event.botShip || '~nec',
          });
          break;
        case 'plugin':
          telemetry.capturePluginError({
            harness: 'openclaw',
            pluginErrorSource: report.event.pluginErrorSource,
            accountId: report.event.accountId ?? 'default',
            ownerShip: report.event.ownerShip ?? '~zod',
            botShip: report.event.botShip ?? '~nec',
            errorKind: report.event.errorKind ?? null,
            errorText: report.event.errorText,
            attempt: report.event.attempt ?? null,
          });
          break;
        case 'telemetry':
          telemetry.captureTelemetryError({
            harness: 'openclaw',
            telemetrySource: report.event.telemetrySource,
            sourceEventName: report.event.sourceEventName ?? null,
            sessionKey: report.event.sessionKey ?? null,
            sessionId: report.event.sessionId ?? null,
            runId: report.event.runId ?? null,
            accountId: report.event.accountId ?? 'default',
            agentId: report.event.agentId ?? null,
            ownerShip: report.event.ownerShip ?? '~zod',
            botShip: report.event.botShip ?? '~nec',
            errorKind: report.event.errorKind ?? null,
            errorText: report.event.errorText,
          });
          break;
      }
    });
  }

  function bindDebugReporter(
    telemetry: NonNullable<ReturnType<typeof createEnabledTelemetry>>
  ) {
    setDebugTelemetryReporter((event) =>
      telemetry.captureHarnessDebug({
        ...event,
        accountId: event.accountId ?? 'default',
        ownerShip: event.ownerShip ?? '~zod',
        botShip: event.botShip || '~nec',
      })
    );
  }

  it('reports lifecycle hooks only for remembered Tlon sessions', async () => {
    const telemetry = createEnabledTelemetry()!;
    bindSessionReporter(telemetry);
    await rememberSessionForDiagnostics(telemetry);

    reportSessionLifecycle({
      lifecycleEvent: 'session_start',
      sessionKey: 'unknown-session',
      sessionId: 'ignored',
    });
    expect(postHogMocks.capture).not.toHaveBeenCalled();

    reportSessionLifecycle({
      lifecycleEvent: 'session_end',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      agentId: 'agent-main',
      reason: 'idle',
      messageCount: 3,
      durationMs: 1200,
      transcriptArchived: true,
      hasNextSession: true,
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.event).toBe('TlonBot Session Lifecycle');
    expect(call.properties).toMatchObject({
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      accountId: 'default',
      agentId: 'agent-main',
      ownerShip: '~zod',
      botShip: '~nec',
      destinationKind: 'dm',
      lifecycleEvent: 'session_end',
      reason: 'idle',
      messageCount: 3,
      durationMs: 1200,
      transcriptArchived: true,
      hasNextSession: true,
    });
  });

  it('reports high-signal watchdog and recovery diagnostics for remembered sessions', async () => {
    const telemetry = createEnabledTelemetry()!;
    bindSessionReporter(telemetry);
    await rememberSessionForDiagnostics(telemetry);

    reportSessionDiagnostic({
      type: 'session.stalled',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      state: 'processing',
      ageMs: 60_000,
      queueDepth: 1,
      reason: 'tool_call_stalled',
      classification: 'blocked_tool_call',
      activeWorkKind: 'tool_call',
      activeToolName: 'tlon',
      activeToolAgeMs: 55_000,
      lastProgressAgeMs: 56_000,
      lastProgressReason: 'tool:tlon:started',
      terminalProgressStale: true,
    });

    let call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.event).toBe('TlonBot Session Watchdog');
    expect(call.properties).toMatchObject({
      diagnosticType: 'session.stalled',
      sessionKey: 'session-1',
      classification: 'blocked_tool_call',
      activeWorkKind: 'tool_call',
      activeToolName: 'tlon',
      terminalProgressStale: true,
    });

    reportSessionDiagnostic({
      type: 'session.recovery.completed',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      state: 'processing',
      stateGeneration: 7,
      ageMs: 90_000,
      queueDepth: 1,
      activeWorkKind: 'tool_call',
      status: 'released',
      action: 'release_lane',
      outcomeReason: 'stale_session_state',
      released: 1,
      stale: true,
    });

    call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.event).toBe('TlonBot Session Recovery');
    expect(call.properties).toMatchObject({
      diagnosticType: 'session.recovery.completed',
      sessionKey: 'session-1',
      stateGeneration: 7,
      status: 'released',
      action: 'release_lane',
      outcomeReason: 'stale_session_state',
      released: 1,
      stale: true,
    });
  });

  it('captures harness debug breadcrumbs for remembered Tlon sessions', async () => {
    const telemetry = createEnabledTelemetry()!;
    bindDebugReporter(telemetry);
    await rememberSessionForDiagnostics(telemetry);

    reportHarnessDebug({
      harnessEventType: 'context.assembled',
      debugEventKind: 'context',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      runId: 'run-2',
      agentId: 'agent-main',
      provider: 'anthropic',
      model: 'claude-test',
      messageCount: 12,
      historyTextChars: 3456,
      promptChars: 7890,
      contextTokenBudget: 200000,
      reserveTokens: 20000,
      contextChannel: 'tlon',
      contextTrigger: 'message',
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.event).toBe('TlonBot Harness Debug');
    expect(call.properties).toMatchObject({
      harness: 'openclaw',
      harnessEventType: 'context.assembled',
      debugEventKind: 'context',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      runId: 'run-2',
      accountId: 'default',
      agentId: 'agent-main',
      ownerShip: '~zod',
      botShip: '~nec',
      provider: 'anthropic',
      model: 'claude-test',
      messageCount: 12,
      historyTextChars: 3456,
      promptChars: 7890,
      contextTokenBudget: 200000,
      reserveTokens: 20000,
      contextChannel: 'tlon',
      contextTrigger: 'message',
      harnessDebugSequence: 1,
      contextAssembledSeen: true,
      runStartedSeen: false,
      modelCallStartedSeen: false,
    });
    expect(Object.hasOwn(call.properties, 'message')).toBe(false);
    expect(Object.hasOwn(call.properties, 'logAttributes')).toBe(false);
    expect(Object.hasOwn(call.properties, 'contextEngineTaskId')).toBe(false);
  });

  it('resets harness debug breadcrumbs when a reused session starts a new run', async () => {
    const telemetry = createEnabledTelemetry()!;
    bindDebugReporter(telemetry);
    await rememberSessionForDiagnostics(telemetry);

    reportHarnessDebug({
      harnessEventType: 'harness.run.started',
      debugEventKind: 'harness',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      runId: 'run-1',
    });
    reportHarnessDebug({
      harnessEventType: 'context.assembled',
      debugEventKind: 'context',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      runId: 'run-1',
    });
    reportHarnessDebug({
      harnessEventType: 'run.started',
      debugEventKind: 'run',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      runId: 'run-2',
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.event).toBe('TlonBot Harness Debug');
    expect(call.properties).toMatchObject({
      harnessEventType: 'run.started',
      runId: 'run-2',
      harnessDebugSequence: 1,
      runStartedSeen: true,
      contextAssembledSeen: false,
      modelCallStartedSeen: false,
      harnessRunStartedSeen: false,
      toolExecutionStartedSeen: false,
    });
  });

  it('captures tool and model call identifiers on harness debug events', async () => {
    const telemetry = createEnabledTelemetry()!;
    bindDebugReporter(telemetry);
    await rememberSessionForDiagnostics(telemetry);

    reportHarnessDebug({
      harnessEventType: 'tool.execution.completed',
      debugEventKind: 'tool',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      runId: 'run-2',
      toolName: 'read',
      toolCallId: 'call-read-1',
      toolSource: 'core',
      toolOwner: 'openclaw',
      durationMs: 42,
    });

    let call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.event).toBe('TlonBot Harness Debug');
    expect(call.properties).toMatchObject({
      harnessEventType: 'tool.execution.completed',
      debugEventKind: 'tool',
      toolName: 'read',
      toolCallId: 'call-read-1',
      toolSource: 'core',
      toolOwner: 'openclaw',
      durationMs: 42,
    });

    reportHarnessDebug({
      harnessEventType: 'model.call.completed',
      debugEventKind: 'model',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      runId: 'run-2',
      provider: 'openrouter',
      model: 'anthropic/claude-haiku-4.5',
      modelCallId: 'model-call-1',
      durationMs: 2997,
      requestPayloadBytes: 12345,
      responseStreamBytes: 6789,
      timeToFirstByteMs: 321,
    });

    call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.properties).toMatchObject({
      harnessEventType: 'model.call.completed',
      debugEventKind: 'model',
      modelCallId: 'model-call-1',
      durationMs: 2997,
      requestPayloadBytes: 12345,
      responseStreamBytes: 6789,
      timeToFirstByteMs: 321,
    });
  });

  it('captures selected log attributes on harness debug events', async () => {
    const telemetry = createEnabledTelemetry()!;
    bindDebugReporter(telemetry);
    await rememberSessionForDiagnostics(telemetry);

    reportHarnessDebug({
      harnessEventType: 'log.record',
      debugEventKind: 'log',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      runId: 'run-2',
      logLevel: 'WARN',
      loggerName: 'context-engine',
      codeFunctionName: 'runContextTask',
      codeLine: 42,
      message:
        '[context-engine] deferred turn maintenance queued taskId=abc123 lane=context-engine-turn-maintenance:session-1 operation=assemble',
      logAttributes: {
        taskId: 'abc123',
        lane: 'context-engine-turn-maintenance:session-1',
        operation: 'assemble',
        pluginId: 'lossless-claw',
        durationMs: 123,
        retryable: true,
        'bad key': 'dropped',
      },
      contextEngineEvent: 'log.record',
      contextEngineTaskId: 'abc123',
      contextEngineOperation: 'assemble',
      contextEngineLane: 'context-engine-turn-maintenance:session-1',
      pluginId: 'lossless-claw',
      durationMs: 123,
      errorName: 'TimeoutError',
      errorCode: 'ETIMEDOUT',
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.event).toBe('TlonBot Harness Debug');
    expect(call.properties).toMatchObject({
      harnessEventType: 'log.record',
      debugEventKind: 'log',
      logLevel: 'WARN',
      loggerName: 'context-engine',
      codeFunctionName: 'runContextTask',
      codeLine: 42,
      pluginId: 'lossless-claw',
      durationMs: 123,
      contextEngineTaskId: 'abc123',
      contextEngineOperation: 'assemble',
      contextEngineLane: 'context-engine-turn-maintenance:session-1',
      errorName: 'TimeoutError',
      errorCode: 'ETIMEDOUT',
      lastContextEngineTaskId: 'abc123',
      lastContextEngineOperation: 'assemble',
      lastContextEngineLane: 'context-engine-turn-maintenance:session-1',
    });
    expect(call.properties.logAttributes).toMatchObject({
      taskId: 'abc123',
      lane: 'context-engine-turn-maintenance:session-1',
      operation: 'assemble',
      pluginId: 'lossless-claw',
      durationMs: 123,
      retryable: true,
    });
    expect(call.properties.logAttributes['bad key']).toBeUndefined();
  });

  it('enriches watchdog diagnostics with the last harness debug snapshot', async () => {
    const telemetry = createEnabledTelemetry()!;
    bindSessionReporter(telemetry);
    await rememberSessionForDiagnostics(telemetry);
    const longContextEngineMessage =
      '[context-engine] deferred turn maintenance queued taskId=abc123 sessionKey=session-1 lane=context-engine-turn-maintenance:session-1 ' +
      `detail=${'x'.repeat(320)}`;

    reportHarnessDebug({
      harnessEventType: 'run.started',
      debugEventKind: 'run',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      runId: 'run-2',
      agentId: 'agent-main',
      provider: 'anthropic',
      model: 'claude-test',
    });
    reportHarnessDebug({
      harnessEventType: 'log.record',
      debugEventKind: 'log',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      runId: 'run-2',
      logLevel: 'INFO',
      message: longContextEngineMessage,
      contextEngineEvent: 'log.record',
      contextEngineTaskId: 'abc123',
      contextEngineOperation: 'maintenance',
      contextEngineLane: 'context-engine-turn-maintenance:session-1',
    });
    postHogMocks.capture.mockClear();

    reportSessionDiagnostic({
      type: 'session.stalled',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      state: 'processing',
      ageMs: 360_000,
      queueDepth: 2,
      reason: 'active_work_without_progress',
      classification: 'stalled_agent_run',
      activeWorkKind: 'embedded_run',
      lastProgressAgeMs: 300_000,
      lastProgressReason: 'embedded_run:started',
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.event).toBe('TlonBot Session Watchdog');
    expect(call.properties).toMatchObject({
      reason: 'active_work_without_progress',
      classification: 'stalled_agent_run',
      activeWorkKind: 'embedded_run',
      lastProgressReason: 'embedded_run:started',
      harnessDebugSequence: 2,
      lastHarnessEventType: 'log.record',
      lastHarnessEventRunId: 'run-2',
      lastHarnessProvider: 'anthropic',
      lastHarnessModel: 'claude-test',
      runStartedSeen: true,
      contextAssembledSeen: false,
      modelCallStartedSeen: false,
      lastContextEngineEvent: 'log.record',
      lastContextEngineTaskId: 'abc123',
      lastContextEngineOperation: 'maintenance',
      lastContextEngineLane: 'context-engine-turn-maintenance:session-1',
      lastContextEngineMessage: longContextEngineMessage,
    });
    expect(call.properties.lastHarnessEventAgeMs).toEqual(expect.any(Number));
    expect(call.properties.lastContextEngineEventAgeMs).toEqual(
      expect.any(Number)
    );
  });

  it('reports harness errors only for remembered Tlon sessions', async () => {
    const telemetry = createEnabledTelemetry()!;
    bindErrorReporter(telemetry);
    await rememberSessionForDiagnostics(telemetry);

    reportHarnessError({
      harnessEventType: 'model.call.error',
      errorScope: 'model',
      sessionKey: 'unknown-session',
      runId: 'ignored-run',
      provider: 'anthropic',
      model: 'claude-test',
      errorCategory: 'network',
      failureKind: 'connection_reset',
      durationMs: 1234,
      errorText: 'full\nmodel\nerror',
    });
    expect(postHogMocks.capture).not.toHaveBeenCalled();

    reportSessionTurnCreated({
      type: 'session.turn.created',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      runId: 'run-2',
      agentId: 'agent-main',
    });
    reportHarnessError({
      harnessEventType: 'model.call.error',
      errorScope: 'model',
      sessionKey: 'session-1',
      provider: 'anthropic',
      model: 'claude-test',
      errorCategory: 'network',
      failureKind: 'connection_reset',
      durationMs: 1234,
      errorText: 'full\nmodel\nerror',
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.event).toBe('TlonBot Harness Error');
    expect(call.properties).toMatchObject({
      harness: 'openclaw',
      harnessEventType: 'model.call.error',
      errorScope: 'model',
      sessionKey: 'session-1',
      sessionId: 'openclaw-session-1',
      runId: 'run-2',
      accountId: 'default',
      agentId: 'agent-main',
      ownerShip: '~zod',
      botShip: '~nec',
      destinationKind: 'dm',
      provider: 'anthropic',
      model: 'claude-test',
      errorCategory: 'network',
      failureKind: 'connection_reset',
      durationMs: 1234,
      errorText: 'full\nmodel\nerror',
    });
  });

  it('attributes a cron run failure as isCron, bypassing the remembered-session gate', () => {
    const telemetry = createEnabledTelemetry()!;
    bindErrorReporter(telemetry);

    // No inbound reply ever remembered this session — a scheduled cron run.
    reportCronRun({
      sessionKey: 'cron-session',
      runId: 'cron-run',
      jobId: 'job-7',
    });
    reportHarnessError({
      harnessEventType: 'model.call.error',
      errorScope: 'model',
      sessionKey: 'cron-session',
      runId: 'cron-run',
      provider: 'anthropic',
      model: 'claude-test',
      errorCategory: 'network',
      failureKind: 'connection_reset',
      errorText: 'model unresponsive',
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.event).toBe('TlonBot Harness Error');
    expect(call.properties).toMatchObject({
      harnessEventType: 'model.call.error',
      errorScope: 'model',
      sessionKey: 'cron-session',
      runId: 'cron-run',
      isCron: true,
      cronJobId: 'job-7',
    });
  });

  it('attributes a runId-less cron failure best-effort', () => {
    const telemetry = createEnabledTelemetry()!;
    bindErrorReporter(telemetry);

    reportCronRun({ sessionKey: 'cron-session', jobId: 'job-9' });
    reportHarnessError({
      harnessEventType: 'harness.run.error',
      errorScope: 'harness',
      sessionKey: 'cron-session',
      errorText: 'run failed',
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.properties).toMatchObject({
      errorScope: 'harness',
      isCron: true,
      cronJobId: 'job-9',
    });
  });

  it('does not attribute a different run reusing the cron session key', async () => {
    const telemetry = createEnabledTelemetry()!;
    bindErrorReporter(telemetry);
    await rememberSessionForDiagnostics(telemetry);

    reportCronRun({
      sessionKey: 'session-1',
      runId: 'cron-run',
      jobId: 'job-7',
    });
    reportHarnessError({
      harnessEventType: 'model.call.error',
      errorScope: 'model',
      sessionKey: 'session-1',
      runId: 'interactive-run',
      errorText: 'model unresponsive',
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.event).toBe('TlonBot Harness Error');
    expect(call.properties.isCron).toBe(false);
    expect(Object.hasOwn(call.properties, 'cronJobId')).toBe(false);
  });

  it('does not attribute non-gateway scopes (tool errors) during a cron run', async () => {
    const telemetry = createEnabledTelemetry()!;
    bindErrorReporter(telemetry);
    await rememberSessionForDiagnostics(telemetry);

    reportCronRun({
      sessionKey: 'session-1',
      runId: 'cron-run',
      jobId: 'job-7',
    });
    reportHarnessError({
      harnessEventType: 'tool.execution.error',
      errorScope: 'tool',
      sessionKey: 'session-1',
      runId: 'cron-run',
      toolName: 'tlon',
      errorText: 'tool blew up',
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.properties.errorScope).toBe('tool');
    expect(call.properties.isCron).toBe(false);
  });

  it('does not mis-attribute an interactive run after a runId-less cron hook in the same session', async () => {
    const telemetry = createEnabledTelemetry()!;
    bindErrorReporter(telemetry);
    await rememberSessionForDiagnostics(telemetry);

    // Cron hook fired before a runId was assigned (the documented main-session
    // topology): records sawCronWithoutRunId, no runId. This must NOT poison
    // later interactive runs that reuse the same session key.
    reportCronRun({ sessionKey: 'session-1', jobId: 'job-7' });
    reportHarnessError({
      harnessEventType: 'model.call.error',
      errorScope: 'model',
      sessionKey: 'session-1',
      runId: 'interactive-run',
      errorText: 'model unresponsive',
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.event).toBe('TlonBot Harness Error');
    expect(call.properties.isCron).toBe(false);
    expect(Object.hasOwn(call.properties, 'cronJobId')).toBe(false);
  });

  it('does not bleed another cron run\'s job id into a matched run with no job id', () => {
    const telemetry = createEnabledTelemetry()!;
    bindErrorReporter(telemetry);

    // run-a recorded with a runId but no job id; a later run sets a different one.
    reportCronRun({ sessionKey: 'cron-session', runId: 'run-a' });
    reportCronRun({ sessionKey: 'cron-session', runId: 'run-b', jobId: 'job-b' });
    reportHarnessError({
      harnessEventType: 'model.call.error',
      errorScope: 'model',
      sessionKey: 'cron-session',
      runId: 'run-a',
      errorText: 'model unresponsive',
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.properties.isCron).toBe(true);
    // run-a carried no job id; it must not inherit run-b's 'job-b'.
    expect(Object.hasOwn(call.properties, 'cronJobId')).toBe(false);
  });

  it('reports process-level harness diagnostics without a session key', () => {
    const telemetry = createEnabledTelemetry()!;
    bindErrorReporter(telemetry);

    reportHarnessError({
      harnessEventType: 'diagnostic.liveness.warning',
      errorScope: 'runtime',
      outcome: 'warning',
      errorCategory: 'liveness_warning',
      failureKind: 'event_loop_delay',
      durationMs: 30_000,
      errorText: 'reasons=event_loop_delay eventLoopDelayP99Ms=250',
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.event).toBe('TlonBot Harness Error');
    expect(call.properties).toMatchObject({
      harness: 'openclaw',
      harnessEventType: 'diagnostic.liveness.warning',
      errorScope: 'runtime',
      accountId: 'default',
      ownerShip: '~zod',
      botShip: '~nec',
      outcome: 'warning',
      errorCategory: 'liveness_warning',
      failureKind: 'event_loop_delay',
      durationMs: 30_000,
      errorText: 'reasons=event_loop_delay eventLoopDelayP99Ms=250',
    });
    expect(Object.hasOwn(call.properties, 'sessionKey')).toBe(false);
    expect(Object.hasOwn(call.properties, 'sessionId')).toBe(false);
    expect(Object.hasOwn(call.properties, 'runId')).toBe(false);
    expect(Object.hasOwn(call.properties, 'agentId')).toBe(false);
    expect(Object.hasOwn(call.properties, 'destinationKind')).toBe(false);
  });

  it('captures plugin errors without throttling or truncating error text', () => {
    const telemetry = createEnabledTelemetry()!;
    bindErrorReporter(telemetry);

    reportPluginError({
      pluginErrorSource: 'chat_firehose',
      errorKind: 'Error',
      errorText: 'first full error\nwith details',
      attempt: null,
    });
    reportPluginError({
      pluginErrorSource: 'chat_firehose',
      errorKind: 'Error',
      errorText: 'second full error\nwith details',
      attempt: null,
    });

    const calls = postHogMocks.capture.mock.calls.map((call) => call[0]);
    expect(calls).toHaveLength(2);
    expect(calls[0].event).toBe('TlonBot Plugin Error');
    expect(calls[0].properties).toMatchObject({
      harness: 'openclaw',
      pluginErrorSource: 'chat_firehose',
      accountId: 'default',
      ownerShip: '~zod',
      botShip: '~nec',
      errorKind: 'Error',
      errorText: 'first full error\nwith details',
    });
    expect(Object.hasOwn(calls[0].properties, 'attempt')).toBe(false);
    expect(calls[1].properties.errorText).toBe(
      'second full error\nwith details'
    );
  });

  it('captures telemetry observer failures', () => {
    const telemetry = createEnabledTelemetry()!;
    bindErrorReporter(telemetry);

    reportTelemetryError({
      telemetrySource: 'diagnostic_internal',
      sourceEventName: 'model.call.error',
      sessionKey: 'session-1',
      errorKind: 'TypeError',
      errorText: 'observer exploded\nwith details',
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.event).toBe('TlonBot Telemetry Error');
    expect(call.properties).toMatchObject({
      harness: 'openclaw',
      telemetrySource: 'diagnostic_internal',
      sourceEventName: 'model.call.error',
      sessionKey: 'session-1',
      accountId: 'default',
      ownerShip: '~zod',
      botShip: '~nec',
      errorKind: 'TypeError',
      errorText: 'observer exploded\nwith details',
    });
  });
});

describe('outbound route telemetry', () => {
  beforeEach(() => {
    _testing.clearSessionContexts();
    _testing.clearHarnessDebugSnapshots();
    postHogMocks.identify.mockClear();
    postHogMocks.capture.mockClear();
    setOutboundRouteReporter(null);
    setSessionTelemetryReporter(null);
    setDebugTelemetryReporter(null);
    setErrorTelemetryReporter(null);
  });

  function createEnabledTelemetry() {
    return createTlonTelemetry({
      config: { enabled: true, apiKey: 'phc_test', host: null },
    });
  }

  it('captures a webchat (off-Tlon) send as the tracked leak', () => {
    const telemetry = createEnabledTelemetry();
    telemetry?.captureOutboundRoute({
      ownerShip: '~zod',
      botShip: '~nec',
      resolvedChannel: 'webchat',
      routedToTlon: false,
      targetKind: 'unknown',
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.event).toBe('TlonBot Outbound Routed');
    expect(call.distinctId).toBe('~zod');
    expect(call.properties.resolvedChannel).toBe('webchat');
    expect(call.properties.routedToTlon).toBe(false);
  });

  it('captures a healthy Tlon send', () => {
    const telemetry = createEnabledTelemetry();
    telemetry?.captureOutboundRoute({
      ownerShip: '~zod',
      botShip: '~nec',
      resolvedChannel: 'tlon',
      routedToTlon: true,
      targetKind: 'dm',
    });

    const call = postHogMocks.capture.mock.calls.at(-1)?.[0];
    expect(call.properties.routedToTlon).toBe(true);
    expect(call.properties.targetKind).toBe('dm');
  });

  it('skips capture when ownerShip is not configured', () => {
    const telemetry = createEnabledTelemetry();
    telemetry?.captureOutboundRoute({
      ownerShip: null,
      botShip: '~nec',
      resolvedChannel: 'webchat',
      routedToTlon: false,
      targetKind: 'unknown',
    });
    expect(postHogMocks.capture).not.toHaveBeenCalled();
  });

  it('reportOutboundRoute forwards to the registered reporter, and null clears it', () => {
    const reporter = vi.fn();
    setOutboundRouteReporter(reporter);
    reportOutboundRoute({
      resolvedChannel: 'webchat',
      routedToTlon: false,
      targetKind: 'unknown',
    });
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter.mock.calls[0][0].routedToTlon).toBe(false);

    setOutboundRouteReporter(null);
    reportOutboundRoute({
      resolvedChannel: 'tlon',
      routedToTlon: true,
      targetKind: 'dm',
    });
    expect(reporter).toHaveBeenCalledTimes(1);
  });
});
