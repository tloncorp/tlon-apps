import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  clearTlonStalledSessionPresence,
  createTlonStalledSessionPresenceReporter,
  createTlonStalledSessionState,
  formatTlonStalledPresenceText,
  handleTlonStalledSessionDiagnostic,
  installTlonStalledSessionPresence,
  parseOpenClawStalledSessionLog,
  resolveTlonStalledSessionTarget,
} from './stalled-session.js';

const {
  clearConversationPresence,
  diagnosticListeners,
  logTransports,
  registerLogTransport,
  setConversationPresence,
  onDiagnosticEvent,
} = vi.hoisted(() => ({
  clearConversationPresence: vi.fn(async () => {}),
  diagnosticListeners: new Set<(event: Record<string, unknown>) => void>(),
  logTransports: new Set<(record: Record<string, unknown>) => void>(),
  onDiagnosticEvent: vi.fn(
    (listener: (event: Record<string, unknown>) => void) => {
      diagnosticListeners.add(listener);
      return () => diagnosticListeners.delete(listener);
    }
  ),
  registerLogTransport: vi.fn(
    (transport: (record: Record<string, unknown>) => void) => {
      logTransports.add(transport);
      return () => logTransports.delete(transport);
    }
  ),
  setConversationPresence: vi.fn(async () => {}),
}));

vi.mock('@tloncorp/api', () => ({
  clearConversationPresence,
  setConversationPresence,
}));

vi.mock('openclaw/plugin-sdk', () => ({
  onDiagnosticEvent,
  registerLogTransport,
}));

function createHarness() {
  const presenceReporter = {
    clear: vi.fn(async () => {}),
    publish: vi.fn(async () => {}),
  };
  const sendDm = vi.fn(async () => ({
    channel: 'tlon' as const,
    messageId: '~bot/1',
    sentAt: 1,
  }));
  const sendChannelPost = vi.fn(async () => ({
    channel: 'tlon' as const,
    messageId: '~bot/1',
  }));
  return {
    accountId: 'default',
    botShipName: '~bot',
    getBotProfile: () => ({ avatar: '', nickname: 'OpenClaw' }),
    now: () => 100_000,
    presenceReporter,
    sendChannelPost,
    sendDm,
    state: createTlonStalledSessionState(),
  };
}

async function flushAsync() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('stalled session target parsing', () => {
  test('resolves a direct Tlon session key', () => {
    expect(
      resolveTlonStalledSessionTarget('agent:main:tlon:direct:~LABDER-BOLLUD')
    ).toMatchObject({
      agentId: 'main',
      conversationId: '~labder-bollud',
      kind: 'dm',
      ship: '~labder-bollud',
    });
  });

  test('resolves an account-scoped direct Tlon session key', () => {
    expect(
      resolveTlonStalledSessionTarget(
        'agent:main:tlon:alt:direct:labder-bollud'
      )
    ).toMatchObject({
      accountId: 'alt',
      conversationId: '~labder-bollud',
      kind: 'dm',
    });
  });

  test('resolves a channel session key with a thread suffix', () => {
    expect(
      resolveTlonStalledSessionTarget(
        'agent:main:tlon:group:chat/~ZOD/general:thread:1701411845'
      )
    ).toMatchObject({
      conversationId: 'chat/~zod/general',
      kind: 'channel',
      nest: 'chat/~zod/general',
      threadId: '1701411845',
    });
  });

  test('ignores non-Tlon session keys', () => {
    expect(
      resolveTlonStalledSessionTarget('agent:main:discord:direct:123')
    ).toBeNull();
  });
});

describe('stalled session diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diagnosticListeners.clear();
    logTransports.clear();
  });

  test('formats stalled presence with a /stop prompt', () => {
    expect(formatTlonStalledPresenceText({ ageMs: 145_000 })).toBe(
      'OpenClaw stalled 2m 25s - send /stop'
    );
  });

  test('parses the OpenClaw stalled session diagnostic log line', () => {
    expect(
      parseOpenClawStalledSessionLog(
        '2026-06-24T19:10:54.100+00:00 [diagnostic] stalled session: sessionId=8f5e75ae-ab59-4cd4-a8e7-3898ee6ce881 sessionKey=agent:main:tlon:direct:~labder-bollud state=processing age=145s queueDepth=3 reason=active_work_without_progress classification=stalled_agent_run activeWorkKind=embedded_run lastProgress=embedded_run:started lastProgressAge=370s recovery=none'
      )
    ).toMatchObject({
      activeWorkKind: 'embedded_run',
      ageMs: 145_000,
      classification: 'stalled_agent_run',
      lastProgress: 'embedded_run:started',
      lastProgressAgeMs: 370_000,
      queueDepth: 3,
      reason: 'active_work_without_progress',
      sessionKey: 'agent:main:tlon:direct:~labder-bollud',
    });
  });

  test('publishes stalled presence and sends a direct prompt', async () => {
    const h = createHarness();
    await handleTlonStalledSessionDiagnostic({
      ...h,
      diagnostic: {
        ageMs: 145_000,
        queueDepth: 3,
        reason: 'active_work_without_progress',
        sessionKey: 'agent:main:tlon:direct:~labder-bollud',
      },
    });

    expect(h.presenceReporter.publish).toHaveBeenCalledWith({
      conversationId: '~labder-bollud',
      diagnostic: expect.objectContaining({
        reason: 'active_work_without_progress',
      }),
    });
    expect(h.sendDm).toHaveBeenCalledWith(
      expect.objectContaining({
        fromShip: '~bot',
        text: expect.stringContaining('`/stop`'),
        toShip: '~labder-bollud',
      })
    );
  });

  test('sends channel prompts as replies when the stalled key names a thread', async () => {
    const h = createHarness();
    await handleTlonStalledSessionDiagnostic({
      ...h,
      diagnostic: {
        sessionKey: 'agent:main:tlon:group:chat/~zod/general:thread:1701411845',
      },
    });

    expect(h.sendChannelPost).toHaveBeenCalledWith(
      expect.objectContaining({
        fromShip: '~bot',
        nest: 'chat/~zod/general',
        replyToId: '1701411845',
      })
    );
    expect(h.sendDm).not.toHaveBeenCalled();
  });

  test('message prompt is cooldown-protected while presence still updates', async () => {
    const h = createHarness();
    const diagnostic = {
      sessionKey: 'agent:main:tlon:direct:~labder-bollud',
    };

    await handleTlonStalledSessionDiagnostic({ ...h, diagnostic });
    await handleTlonStalledSessionDiagnostic({ ...h, diagnostic });

    expect(h.presenceReporter.publish).toHaveBeenCalledTimes(2);
    expect(h.sendDm).toHaveBeenCalledTimes(1);
  });

  test('ignores diagnostics for another Tlon account', async () => {
    const h = createHarness();
    await handleTlonStalledSessionDiagnostic({
      ...h,
      diagnostic: {
        sessionKey: 'agent:main:tlon:alt:direct:~labder-bollud',
      },
    });

    expect(h.presenceReporter.publish).not.toHaveBeenCalled();
    expect(h.sendDm).not.toHaveBeenCalled();
  });

  test('clears stalled presence when the session becomes idle', async () => {
    const h = createHarness();
    await handleTlonStalledSessionDiagnostic({
      ...h,
      diagnostic: {
        sessionKey: 'agent:main:tlon:direct:~labder-bollud',
      },
    });

    await clearTlonStalledSessionPresence({
      ...h,
      sessionKey: 'agent:main:tlon:direct:~labder-bollud',
    });

    expect(h.presenceReporter.clear).toHaveBeenCalledWith({
      conversationId: '~labder-bollud',
    });
  });

  test('default reporter publishes stalled data on the computing topic', async () => {
    const reporter = createTlonStalledSessionPresenceReporter();
    await reporter.publish({
      conversationId: '~labder-bollud',
      diagnostic: {
        classification: 'stalled_agent_run',
        sessionKey: 'agent:main:tlon:direct:~labder-bollud',
      },
    });

    expect(setConversationPresence).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: '~labder-bollud',
        topic: 'computing',
        disclose: [],
        timeout: '~m5',
        display: {
          text: 'OpenClaw stalled - send /stop',
          blob: expect.any(String),
        },
      })
    );
    const call = setConversationPresence.mock.calls[0]?.[0];
    expect(JSON.parse(call.display.blob)).toMatchObject({
      classification: 'stalled_agent_run',
      interruptCommands: ['/stop', 'stop', 'abort', 'interrupt'],
      stalled: true,
      suggestedCommand: '/stop',
      thinking: true,
    });
  });

  test('installer listens to structured diagnostics and diagnostic log fallback', async () => {
    const h = createHarness();
    const cleanup = installTlonStalledSessionPresence(h);

    expect(diagnosticListeners.size).toBe(1);
    expect(logTransports.size).toBe(1);

    diagnosticListeners.forEach((listener) =>
      listener({
        ageMs: 121_000,
        sessionKey: 'agent:main:tlon:direct:~labder-bollud',
        type: 'session.stuck',
      })
    );
    await flushAsync();
    expect(h.presenceReporter.publish).toHaveBeenCalledWith({
      conversationId: '~labder-bollud',
      diagnostic: expect.objectContaining({
        ageMs: 121_000,
        sessionKey: 'agent:main:tlon:direct:~labder-bollud',
      }),
    });

    logTransports.forEach((transport) =>
      transport({
        argumentsArray: [
          '[diagnostic]',
          'stalled session: sessionId=s1 sessionKey=agent:main:tlon:direct:~nec state=processing age=145s queueDepth=3 reason=active_work_without_progress classification=stalled_agent_run',
        ],
      })
    );
    await flushAsync();
    expect(h.presenceReporter.publish).toHaveBeenCalledWith({
      conversationId: '~nec',
      diagnostic: expect.objectContaining({
        classification: 'stalled_agent_run',
        queueDepth: 3,
      }),
    });

    diagnosticListeners.forEach((listener) =>
      listener({
        sessionKey: 'agent:main:tlon:direct:~labder-bollud',
        state: 'idle',
        type: 'session.state',
      })
    );
    await flushAsync();
    expect(h.presenceReporter.clear).toHaveBeenCalledWith({
      conversationId: '~labder-bollud',
    });

    cleanup();
    expect(diagnosticListeners.size).toBe(0);
    expect(logTransports.size).toBe(0);
  });
});
