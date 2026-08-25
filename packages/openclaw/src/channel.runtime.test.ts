import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getNotebook = vi.fn();
const createNote = vi.fn();
const listNotes = vi.fn();
const prepareOutboundMedia = vi.fn();
const getActiveForegroundContextLensForConversation = vi.fn<() => unknown>(
  () => null
);
const resolveTlonAccount = vi.fn(() => ({
  configured: true,
  ship: '~zod',
  url: 'http://localhost:8080',
  code: 'lit',
  allowPrivateNetwork: false,
  contextLens: { enabled: false },
}));

vi.mock('@tloncorp/api', () => ({
  notes: { getNotebook, createNote, listNotes },
  scry: vi.fn(),
}));

vi.mock('./urbit/upload.js', () => ({
  prepareOutboundMedia,
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
    if (t.startsWith('notes/')) {
      return { kind: 'notebook', nest: t };
    }
    if (t.includes('/')) {
      return { kind: 'channel', nest: t };
    }
    return null;
  }),
}));

vi.mock('./types.js', () => ({
  resolveTlonAccount,
}));

vi.mock('./context-lens.js', () => ({
  getActiveBackgroundContextLens: vi.fn(() => null),
  getActiveForegroundContextLensForConversation,
  recordBackgroundContextLensOutput: vi.fn(),
}));

vi.mock('./monitor/index.js', () => ({
  monitorTlonProvider: vi.fn(),
}));

vi.mock('./setup-surface.js', () => ({
  tlonSetupWizard: {},
}));

vi.mock('./urbit/blob.js', () => ({
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
    resolveTlonAccount.mockReturnValue({
      configured: true,
      ship: '~zod',
      url: 'http://localhost:8080',
      code: 'lit',
      allowPrivateNetwork: false,
      contextLens: { enabled: false },
    });
    getActiveForegroundContextLensForConversation.mockReturnValue(null);
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

describe('notes delivery', () => {
  let tlonRuntimeOutbound: typeof import('./channel.runtime.js').tlonRuntimeOutbound;
  let sendChannelPost: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    resolveTlonAccount.mockReturnValue({
      configured: true,
      ship: '~zod',
      url: 'http://localhost:8080',
      code: 'lit',
      allowPrivateNetwork: false,
      contextLens: { enabled: false },
    });
    getActiveForegroundContextLensForConversation.mockReturnValue(null);
    getNotebook.mockResolvedValue({ rootFolderId: 17 });
    createNote.mockResolvedValue({ id: 42, title: 'Untitled' });
    listNotes.mockResolvedValue([]);
    ({ tlonRuntimeOutbound } = await import('./channel.runtime.js'));
    ({ sendChannelPost } = await import('./urbit/send.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a Markdown note in the notebook root folder', async () => {
    createNote.mockResolvedValue({ id: 42, title: 'Tuesday briefing' });
    const result = await tlonRuntimeOutbound.sendText({
      cfg: {} as never,
      to: 'notes/~ten/updates',
      text: '# Tuesday briefing\n\nThe full report.',
      accountId: null,
      replyToId: null,
      threadId: null,
    });

    expect(getNotebook).toHaveBeenCalledWith('notes/~ten/updates');
    expect(createNote).toHaveBeenCalledWith({
      flag: 'notes/~ten/updates',
      folder: 17,
      title: 'Tuesday briefing',
      body: 'The full report.',
    });
    expect(sendChannelPost).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      channel: 'tlon',
      messageId: '~zod/notes-42',
    });
  });

  it('recovers the created id from older hosts with a bare response', async () => {
    createNote.mockResolvedValue(null);
    listNotes.mockResolvedValue([
      {
        noteId: 47,
        title: 'Tuesday briefing',
        createdAt: Date.now(),
      },
    ]);

    const result = await tlonRuntimeOutbound.sendText({
      cfg: {} as never,
      to: 'notes/~ten/updates',
      text: '# Tuesday briefing\n\nThe full report.',
      accountId: null,
      replyToId: null,
      threadId: null,
    });

    expect(result).toMatchObject({ messageId: '~zod/notes-47' });
  });

  it('bypasses chat chunking for a notebook payload', async () => {
    createNote.mockResolvedValue({ id: 43, title: 'Long briefing' });
    const body = 'x'.repeat(20_000);

    await tlonRuntimeOutbound.sendPayload!({
      cfg: {} as never,
      to: 'notes/~ten/updates',
      text: body,
      payload: { text: `# Long briefing\n\n${body}` },
      accountId: null,
      replyToId: null,
      threadId: null,
    });

    expect(createNote).toHaveBeenCalledOnce();
    expect(createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        flag: 'notes/~ten/updates',
        title: 'Long briefing',
        body,
      })
    );
  });

  it('prepares every notebook payload attachment before linking it', async () => {
    createNote.mockResolvedValue({ id: 44, title: 'Briefing' });
    prepareOutboundMedia
      .mockResolvedValueOnce({ url: 'https://cdn.test/one', isImage: true })
      .mockResolvedValueOnce({ url: 'https://cdn.test/two', isImage: false });

    await tlonRuntimeOutbound.sendPayload!({
      cfg: {} as never,
      to: 'notes/~ten/updates',
      text: 'Briefing',
      payload: {
        text: '# Briefing',
        mediaUrls: ['https://source.test/one', 'https://source.test/two'],
      },
      accountId: null,
      replyToId: null,
      threadId: null,
    });

    expect(prepareOutboundMedia).toHaveBeenCalledTimes(2);
    expect(createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('https://cdn.test/one'),
      })
    );
    expect(createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('https://cdn.test/two'),
      })
    );
  });

  it('retains chunking for an ordinary chat payload', async () => {
    await tlonRuntimeOutbound.sendPayload!({
      cfg: {} as never,
      to: 'chat/~ten/general',
      text: 'x'.repeat(20_001),
      payload: { text: 'x'.repeat(20_001) },
      accountId: null,
      replyToId: null,
      threadId: null,
    });

    expect(sendChannelPost).toHaveBeenCalledTimes(3);
  });

  it('records notebook delivery in the active context lens', async () => {
    const recordOutput = vi.fn();
    const recordPersistence = vi.fn();
    resolveTlonAccount.mockReturnValue({
      configured: true,
      ship: '~zod',
      url: 'http://localhost:8080',
      code: 'lit',
      allowPrivateNetwork: false,
      contextLens: { enabled: true },
    });
    getActiveForegroundContextLensForConversation.mockReturnValue({
      lensId: 'lens-1',
      registry: { recordOutput, recordPersistence },
    });
    createNote.mockResolvedValue({ id: 42, title: 'Tuesday briefing' });

    await tlonRuntimeOutbound.sendText({
      cfg: {} as never,
      to: 'notes/~ten/updates',
      text: '# Tuesday briefing\n\nThe full report.',
      accountId: null,
      replyToId: null,
      threadId: null,
    });

    expect(getActiveForegroundContextLensForConversation).toHaveBeenCalledWith(
      'notes/~ten/updates'
    );
    expect(recordOutput).toHaveBeenCalledWith(
      'lens-1',
      expect.objectContaining({
        messageId: '~zod/notes-42',
        conversationId: 'notes/~ten/updates',
      })
    );
    expect(recordPersistence).toHaveBeenCalledWith('lens-1', {
      postsReply: true,
    });
  });

  it('preserves a non-heading first line in the note body', async () => {
    await tlonRuntimeOutbound.sendText({
      cfg: {} as never,
      to: 'notes/~ten/updates',
      text: 'Tuesday briefing\n\nThe full report.',
      accountId: null,
      replyToId: null,
      threadId: null,
    });

    expect(createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Tuesday briefing',
        body: 'Tuesday briefing\n\nThe full report.',
      })
    );
  });
});
