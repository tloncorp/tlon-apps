import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./urbit/upload.js', () => ({
  prepareOutboundMedia: vi.fn(),
}));

vi.mock('./urbit/send.js', () => ({
  buildMediaStory: vi.fn(() => [{ inline: ['mock'] }]),
  sendChannelPost: vi.fn(async () => ({
    channel: 'tlon',
    messageId: '~zod/123',
  })),
  sendDm: vi.fn(async () => ({
    channel: 'tlon',
    messageId: '~zod/123',
    sentAt: 1000,
  })),
  sendDmWithStory: vi.fn(async () => ({
    channel: 'tlon',
    messageId: '~zod/123',
    sentAt: 1000,
  })),
}));

vi.mock('./urbit/story.js', () => ({
  markdownToStory: vi.fn(() => [{ inline: ['text'] }]),
}));

vi.mock('./urbit/api-client.js', () => ({
  withAuthenticatedTlonApi: vi.fn(async (_opts, fn) => fn()),
}));

vi.mock('./urbit/auth.js', () => ({
  authenticate: vi.fn(),
}));

vi.mock('./urbit/context.js', () => ({
  ssrfPolicyFromAllowPrivateNetwork: vi.fn(),
}));

vi.mock('./urbit/fetch.js', () => ({
  urbitFetch: vi.fn(),
}));

vi.mock('./targets.js', () => ({
  formatTargetHint: vi.fn(() => '~ship or chat/~host/name'),
  normalizeShip: vi.fn((s: string) => s),
  parseTlonTarget: vi.fn((t: string) => {
    if (t.startsWith('~')) {
      return { kind: 'dm', ship: t };
    }
    if (t.includes('/')) {
      return { kind: 'channel', nest: t };
    }
    return null;
  }),
}));

vi.mock('./types.js', () => ({
  resolveTlonAccount: vi.fn(() => ({
    configured: true,
    ship: '~zod',
    url: 'http://localhost:8080',
    code: 'lit',
    allowPrivateNetwork: false,
    contextLens: { enabled: false },
  })),
}));

vi.mock('./context-lens.js', () => ({
  getActiveBackgroundContextLens: vi.fn(() => null),
  getActiveForegroundContextLensForConversation: vi.fn(() => null),
  recordBackgroundContextLensOutput: vi.fn(),
}));

vi.mock('./monitor/index.js', () => ({
  monitorTlonProvider: vi.fn(),
}));

vi.mock('./setup-surface.js', () => ({
  tlonSetupWizard: {},
}));

vi.mock('./urbit/blob.js', () => ({
  combineBlobFields: vi.fn(
    (...fields: Array<string | undefined>) =>
      fields.filter(Boolean).join('|') || undefined
  ),
  makeA2UIBlob: vi.fn(() => ({ type: 'a2ui' })),
  serializeBlobField: vi.fn(() => '[{"type":"a2ui"}]'),
  serializeContextLensReferenceBlob: vi.fn(),
}));

describe('sendMedia', () => {
  let tlonRuntimeOutbound: typeof import('./channel.runtime.js').tlonRuntimeOutbound;
  let prepareOutboundMedia: ReturnType<typeof vi.fn>;
  let sendDm: ReturnType<typeof vi.fn>;
  let sendDmWithStory: ReturnType<typeof vi.fn>;
  let sendChannelPost: ReturnType<typeof vi.fn>;

  const baseCtx = {
    cfg: {} as never,
    to: '~nec',
    text: 'hello',
    mediaUrl: undefined as string | undefined,
    accountId: null,
    replyToId: null,
    threadId: null,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ tlonRuntimeOutbound } = await import('./channel.runtime.js'));
    ({ prepareOutboundMedia } = await import('./urbit/upload.js'));
    ({ sendDm, sendDmWithStory, sendChannelPost } =
      await import('./urbit/send.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects on local path and does not post', async () => {
    prepareOutboundMedia.mockRejectedValue(
      new Error('Local file paths are not supported on this channel')
    );
    const { startTlonAgentTurn } = await import('./turn-recorder.js');
    const turn = startTlonAgentTurn(
      {
        accountId: 'hosted',
        agentId: 'main',
        destinationKind: 'dm',
        runId: 'media-failure',
        sessionKey: 'agent:main:tlon:direct:~nec',
        ship: '~zod',
        trigger: 'dm',
      },
      {
        observer: {
          recordStarted: () => undefined,
          recordTerminal: () => undefined,
        },
      }
    );

    await expect(
      turn.run(() =>
        tlonRuntimeOutbound.sendMedia({
          ...baseCtx,
          mediaUrl: '/pier/secret.png',
        })
      )
    ).rejects.toThrow('Local file paths are not supported');

    expect(sendDm).not.toHaveBeenCalled();
    expect(sendDmWithStory).not.toHaveBeenCalled();
    expect(sendChannelPost).not.toHaveBeenCalled();
    expect(turn.finalize({ durationMs: 10 })).toMatchObject({
      delivery: 'failed',
      deliveryFailureCount: 1,
      deliverySuccessCount: 0,
    });
  });

  it('posts exactly once with valid https URL', async () => {
    prepareOutboundMedia.mockResolvedValue({
      url: 'https://example.com/img.png',
      isImage: true,
    });
    const { startTlonAgentTurn } = await import('./turn-recorder.js');
    const turn = startTlonAgentTurn(
      {
        accountId: 'hosted',
        agentId: 'main',
        destinationKind: 'dm',
        runId: 'media-success',
        sessionKey: 'agent:main:tlon:direct:~nec',
        ship: '~zod',
        trigger: 'dm',
      },
      {
        observer: {
          recordStarted: () => undefined,
          recordTerminal: () => undefined,
        },
      }
    );

    await turn.run(() =>
      tlonRuntimeOutbound.sendMedia({
        ...baseCtx,
        mediaUrl: 'https://example.com/img.png',
      })
    );

    expect(sendDmWithStory).toHaveBeenCalledTimes(1);
    expect(sendChannelPost).not.toHaveBeenCalled();
    expect(turn.finalize({ durationMs: 10 })).toMatchObject({
      delivery: 'delivered',
      deliveryFailureCount: 0,
      deliverySuccessCount: 1,
    });
  });
});

describe('sendPayload', () => {
  it('preserves portable approval controls as a Tlon blob', async () => {
    vi.clearAllMocks();
    const { tlonRuntimeOutbound } = await import('./channel.runtime.js');
    const { sendDm } = await import('./urbit/send.js');
    const command = '/approve abc123 allow-once';

    await tlonRuntimeOutbound.sendPayload!({
      cfg: {} as never,
      to: '~nec',
      text: 'Approval required.',
      accountId: null,
      replyToId: null,
      threadId: null,
      payload: {
        text: 'Approval required.',
        presentation: {
          blocks: [
            {
              type: 'buttons',
              buttons: [
                {
                  label: 'Allow Once',
                  action: { type: 'command', command },
                },
              ],
            },
          ],
        },
      },
    });

    expect(sendDm).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Approval required.',
        blob: '[{"type":"a2ui"}]',
      })
    );
  });
});
