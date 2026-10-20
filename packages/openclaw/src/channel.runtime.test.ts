import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ALL_ONLY } from './urbit/story.js';

const getNotebook = vi.fn();
const createNote = vi.fn();
const listNotes = vi.fn();
const prepareOutboundMedia = vi.fn();
const getActiveForegroundContextLensForConversation = vi.fn<() => unknown>(
  () => null
);
const resolveTlonAccount = vi.fn(() => ({
  accountId: 'secondary',
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
  buildMediaText: vi.fn((text: string) => text),
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

vi.mock('./urbit/story.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./urbit/story.js')>()),
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
      accountId: 'secondary',
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

  it('rejects disallowed local media and does not post', async () => {
    prepareOutboundMedia.mockRejectedValue(
      new Error('Could not read local media from the allowed directories.')
    );
    const { startTlonAgentTurn } = await import('./turn-recorder.js');
    const recordDispatchAttempted = vi.fn();
    const recordDispatchFailed = vi.fn();
    const turn = startTlonAgentTurn(
      {
        accountId: 'hosted',
        agentId: 'main',
        destinationKind: 'dm',
        inputMessageId: '~nec/111',
        runId: 'media-failure',
        sessionKey: 'agent:main:tlon:direct:~nec',
        ship: 'zod',
        trigger: 'dm',
      },
      {
        observer: {
          recordDispatchAttempted,
          recordDispatchFailed,
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
    ).rejects.toThrow('Could not read local media');

    expect(sendDm).not.toHaveBeenCalled();
    expect(sendDmWithStory).not.toHaveBeenCalled();
    expect(sendChannelPost).not.toHaveBeenCalled();
    expect(recordDispatchAttempted).not.toHaveBeenCalled();
    expect(recordDispatchFailed).not.toHaveBeenCalled();
    expect(turn.finalize({ durationMs: 10 })).toMatchObject({
      delivery: 'not_applicable',
      deliveryFailureCount: 0,
      deliverySuccessCount: 0,
      dispatch: 'not_applicable',
      dispatchAttemptCount: 0,
    });
  });

  it('attributes sends to the resolved outbound account and ship', async () => {
    const { startTlonAgentTurn } = await import('./turn-recorder.js');
    const recordDispatchAttempted = vi.fn();
    const turn = startTlonAgentTurn(
      {
        accountId: 'primary',
        agentId: 'main',
        destinationKind: 'dm',
        inputMessageId: '~nec/111',
        runId: 'cross-account',
        sessionKey: 'agent:main:tlon:direct:~nec',
        ship: '~nec',
        trigger: 'dm',
      },
      {
        observer: {
          recordDispatchAttempted,
          recordStarted: () => undefined,
          recordTerminal: () => undefined,
        },
      }
    );

    await turn.run(() =>
      tlonRuntimeOutbound.sendText({
        ...baseCtx,
        accountId: 'secondary',
      })
    );

    expect(recordDispatchAttempted).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        accountId: 'secondary',
        ship: 'zod',
      })
    );
  });

  it('passes local media access to the uploader and posts the uploaded URL', async () => {
    const mediaLocalRoots = ['/pier/bot/.openclaw/media'];
    const mediaReadFile = vi.fn();
    const mediaUrl = `${mediaLocalRoots[0]}/cat.png`;
    prepareOutboundMedia.mockResolvedValue({
      url: 'https://storage.example.com/cat.png',
      isImage: true,
    });
    await tlonRuntimeOutbound.sendMedia({
      ...baseCtx,
      mediaUrl,
      mediaLocalRoots,
      mediaReadFile,
    });
    expect(prepareOutboundMedia).toHaveBeenCalledWith(mediaUrl, {
      mediaAccess: undefined,
      mediaLocalRoots,
      mediaReadFile,
    });
    expect(sendDmWithStory).toHaveBeenCalledOnce();
    const { buildMediaStory } = await import('./urbit/send.js');
    expect(buildMediaStory).toHaveBeenCalledWith(
      baseCtx.text,
      { url: 'https://storage.example.com/cat.png', isImage: true },
      expect.any(Object)
    );
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
        inputMessageId: '~nec/222',
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

  it('records the actual outbound destination kind for cross-target sends', async () => {
    const { startTlonAgentTurn } = await import('./turn-recorder.js');
    const recordDispatchAttempted = vi.fn();
    const recordMoonReplyEnqueued = vi.fn();
    const turn = startTlonAgentTurn(
      {
        accountId: 'hosted',
        agentId: 'main',
        destinationKind: 'dm',
        inputMessageId: '~nec/333',
        runId: 'cross-target',
        sessionKey: 'agent:main:tlon:direct:~nec',
        ship: '~zod',
        trigger: 'dm',
      },
      {
        observer: {
          recordDispatchAttempted,
          recordMoonReplyEnqueued,
          recordStarted: () => undefined,
          recordTerminal: () => undefined,
        },
      }
    );

    await turn.run(() =>
      tlonRuntimeOutbound.sendText({
        ...baseCtx,
        to: 'chat/~zod/general',
      })
    );

    expect(sendDm).not.toHaveBeenCalled();
    expect(sendChannelPost).toHaveBeenCalledTimes(1);
    expect(recordDispatchAttempted).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationKind: 'group_channel',
      })
    );
    expect(recordMoonReplyEnqueued).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationKind: 'group_channel',
        outputMessageId: '~zod/123',
      })
    );
  });
});

describe('role mentions', () => {
  let tlonRuntimeOutbound: typeof import('./channel.runtime.js').tlonRuntimeOutbound;
  let sendDmWithStory: ReturnType<typeof vi.fn>;
  let sendChannelPost: ReturnType<typeof vi.fn>;
  let buildMediaStory: ReturnType<typeof vi.fn>;
  let roleIdsForNest: ReturnType<typeof vi.fn>;
  let unpublish: () => void;

  const ctx = {
    cfg: {} as never,
    accountId: 'secondary',
    replyToId: null,
    threadId: null,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    resolveTlonAccount.mockReturnValue({
      accountId: 'secondary',
      configured: true,
      ship: '~zod',
      url: 'http://localhost:8080',
      code: 'lit',
      allowPrivateNetwork: false,
      contextLens: { enabled: false },
    });
    getActiveForegroundContextLensForConversation.mockReturnValue(null);
    ({ tlonRuntimeOutbound } = await import('./channel.runtime.js'));
    ({ sendDmWithStory, sendChannelPost, buildMediaStory } =
      (await import('./urbit/send.js')) as never);
    const story = await import('./urbit/story.js');
    const actual = await vi.importActual<typeof story>('./urbit/story.js');
    vi.mocked(story.markdownToStory).mockImplementation(actual.markdownToStory);
    const scope = await import('./role-mention-scope.js');
    roleIdsForNest = vi.fn(async () => new Set(['admin']));
    const resolver = { roleIdsForNest };
    scope.publishRoleMentionResolver('secondary', resolver);
    unpublish = () => scope.unpublishRoleMentionResolver('secondary', resolver);
  });

  afterEach(async () => {
    unpublish();
    // Back to the stub the other suites expect.
    vi.mocked((await import('./urbit/story.js')).markdownToStory).mockReset();
    vi.restoreAllMocks();
  });

  it('sendText to a channel converts a known role and passes through unknown', async () => {
    await tlonRuntimeOutbound.sendText({
      ...ctx,
      to: 'chat/~zod/general',
      text: 'ping @admin and @mods',
    });
    expect(roleIdsForNest).toHaveBeenCalledExactlyOnceWith('chat/~zod/general');
    expect(sendChannelPost).toHaveBeenCalledWith(
      expect.objectContaining({
        story: [{ inline: ['ping ', { sect: 'admin' }, ' and @mods'] }],
      })
    );
  });

  it('sendText to a DM converts @all only', async () => {
    await tlonRuntimeOutbound.sendText({
      ...ctx,
      to: '~nec',
      text: '@all and @admin',
    });
    expect(roleIdsForNest).not.toHaveBeenCalled();
    expect(sendDmWithStory).toHaveBeenCalledWith(
      expect.objectContaining({
        story: [{ inline: [{ sect: null }, ' and @admin'] }],
      })
    );
  });

  it('sendText without @ performs no role lookup', async () => {
    await tlonRuntimeOutbound.sendText({
      ...ctx,
      to: 'chat/~zod/general',
      text: 'plain words',
    });
    expect(roleIdsForNest).not.toHaveBeenCalled();
    expect(sendChannelPost).toHaveBeenCalledWith(
      expect.objectContaining({ story: [{ inline: ['plain words'] }] })
    );
  });

  it('sendText to a notebook does no role lookup', async () => {
    getNotebook.mockResolvedValue({ rootFolderId: 17 });
    createNote.mockResolvedValue({ id: 42, title: 'Notes' });
    listNotes.mockResolvedValue([]);
    await tlonRuntimeOutbound.sendText({
      ...ctx,
      to: 'notes/~zod/book',
      text: '# Notes\n\nping @admin and @all',
    });
    expect(createNote).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'ping @admin and @all' })
    );
    expect(roleIdsForNest).not.toHaveBeenCalled();
  });

  it('sendMedia passes the channel scope for a caption', async () => {
    const media = { url: 'https://example.com/img.png', isImage: true };
    prepareOutboundMedia.mockResolvedValue(media);
    await tlonRuntimeOutbound.sendMedia({
      ...ctx,
      to: 'chat/~zod/general',
      text: 'look @admin',
      mediaUrl: media.url,
    });
    expect(buildMediaStory).toHaveBeenCalledExactlyOnceWith(
      'look @admin',
      media,
      { roleMentions: { roleIds: new Set(['admin']) } }
    );
  });

  it('sendMedia without a caption or to a DM does no lookup', async () => {
    const media = { url: 'https://example.com/img.png', isImage: true };
    prepareOutboundMedia.mockResolvedValue(media);
    await tlonRuntimeOutbound.sendMedia({
      ...ctx,
      to: 'chat/~zod/general',
      text: undefined as never,
      mediaUrl: media.url,
    });
    await tlonRuntimeOutbound.sendMedia({
      ...ctx,
      to: '~nec',
      text: 'look @admin',
      mediaUrl: media.url,
    });
    expect(roleIdsForNest).not.toHaveBeenCalled();
    expect(buildMediaStory).toHaveBeenNthCalledWith(1, undefined, media, {
      roleMentions: ALL_ONLY,
    });
    expect(buildMediaStory).toHaveBeenNthCalledWith(2, 'look @admin', media, {
      roleMentions: ALL_ONLY,
    });
  });
});

describe('notes delivery', () => {
  let tlonRuntimeOutbound: typeof import('./channel.runtime.js').tlonRuntimeOutbound;
  let sendChannelPost: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    resolveTlonAccount.mockReturnValue({
      accountId: 'secondary',
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

  it.each(['sendText', 'sendMedia'] as const)(
    '%s observes only the notebook write',
    async (method) => {
      const { startTlonAgentTurn } = await import('./turn-recorder.js');
      const recordDispatchAttempted = vi.fn();
      const recordDispatchFailed = vi.fn();
      const recordMoonReplyEnqueued = vi.fn();
      const turn = startTlonAgentTurn(
        {
          accountId: 'primary',
          agentId: 'main',
          destinationKind: 'dm',
          inputMessageId: '~nec/111',
          runId: 'notebook-write',
          sessionKey: 'agent:main:tlon:direct:~nec',
          ship: '~nec',
          trigger: 'dm',
        },
        {
          observer: {
            recordDispatchAttempted,
            recordDispatchFailed,
            recordMoonReplyEnqueued,
            recordStarted: () => undefined,
            recordTerminal: () => undefined,
          },
        }
      );
      prepareOutboundMedia.mockResolvedValue({
        url: 'https://example.com/image.png',
      });
      const send = () =>
        turn.run(() =>
          tlonRuntimeOutbound[method]({
            cfg: {} as never,
            to: 'notes/~ten/updates',
            text: '# Report',
            mediaUrl: 'https://example.com/image.png',
            accountId: null,
            replyToId: null,
            threadId: null,
          })
        );

      getNotebook.mockRejectedValueOnce(new Error('notebook unavailable'));
      await expect(send()).rejects.toThrow('notebook unavailable');
      listNotes.mockRejectedValueOnce(new Error('listing unavailable'));
      await expect(send()).rejects.toThrow('listing unavailable');
      expect(createNote).not.toHaveBeenCalled();
      expect(recordDispatchAttempted).not.toHaveBeenCalled();
      expect(recordDispatchFailed).not.toHaveBeenCalled();

      createNote.mockImplementationOnce(async () => {
        expect(recordDispatchAttempted).toHaveBeenCalledTimes(1);
        throw new Error('write failed');
      });
      await expect(send()).rejects.toThrow('write failed');
      expect(recordDispatchFailed).toHaveBeenCalledTimes(1);

      await expect(send()).resolves.toMatchObject({
        messageId: '~zod/notes-42',
      });
      expect(recordDispatchAttempted).toHaveBeenLastCalledWith(
        expect.objectContaining({
          accountId: 'secondary',
          destinationKind: 'notebook',
          ship: 'zod',
        })
      );

      expect(recordMoonReplyEnqueued).toHaveBeenLastCalledWith(
        expect.objectContaining({ outputMessageId: '~zod/notes-42' })
      );

      createNote.mockResolvedValueOnce(null);
      listNotes
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('recovery failed'));
      await expect(send()).rejects.toThrow('recovery failed');
      expect(recordDispatchFailed).toHaveBeenCalledTimes(1);
      expect(recordMoonReplyEnqueued.mock.calls.at(-1)?.[0]).not.toHaveProperty(
        'outputMessageId'
      );
      expect(turn.finalize({ durationMs: 10 })).toMatchObject({
        dispatchAttemptCount: 3,
        deliveryFailureCount: 1,
        deliverySuccessCount: 2,
      });
    }
  );

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
    listNotes.mockResolvedValueOnce([]).mockResolvedValue([
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

  it('does not recover a timestamp-less pre-existing note', async () => {
    createNote.mockResolvedValue(null);
    const oldNote = { noteId: 41, title: 'Tuesday briefing' };
    listNotes
      .mockResolvedValueOnce([oldNote])
      .mockResolvedValue([oldNote, { noteId: 47, title: 'Tuesday briefing' }]);

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
      accountId: 'secondary',
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

describe('gateway startup catch-up wiring', () => {
  afterEach(() => vi.restoreAllMocks());

  it('publishes readiness from the provider and cancels immediately on host abort', async () => {
    const { startTlonGatewayAccount } = await import('./channel.runtime.js');
    const { monitorTlonProvider } = await import('./monitor/index.js');
    const { getRestartCatchupCoordinator } =
      await import('./restart-catchup.js');
    const connected = vi.fn();
    const stop = vi.fn();
    const readsReady = Promise.resolve();
    const attach = vi
      .spyOn(getRestartCatchupCoordinator(), 'attachMonitor')
      .mockReturnValue({ connected, stop, settled: () => readsReady });
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const connection = {
      isConnected: () => true,
      readSettings: vi.fn(),
      establishActivityReadBaseline: vi.fn(),
      replayMissedMessages: vi.fn(),
    };
    vi.mocked(monitorTlonProvider).mockImplementationOnce(async (opts) => {
      opts?.onReady?.(connection);
      await pending;
    });
    const abort = new AbortController();
    const cfg = {};
    const running = startTlonGatewayAccount({
      cfg,
      account: { accountId: 'default', ship: '~zod' },
      abortSignal: abort.signal,
      setStatus: vi.fn(),
      runtime: {},
    } as never);
    expect(attach).toHaveBeenCalledWith('default', cfg);
    expect(connected).toHaveBeenCalledWith(connection);
    expect(vi.mocked(monitorTlonProvider).mock.lastCall?.[0]).toMatchObject({
      activityReadsReady: readsReady,
    });
    abort.abort();
    expect(stop).toHaveBeenCalledTimes(1);
    finish();
    await running;
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it('cleans up catch-up eligibility when authentication or provider bootstrap fails', async () => {
    const { startTlonGatewayAccount } = await import('./channel.runtime.js');
    const { monitorTlonProvider } = await import('./monitor/index.js');
    const { getRestartCatchupCoordinator } =
      await import('./restart-catchup.js');
    const connected = vi.fn();
    const stop = vi.fn();
    vi.spyOn(getRestartCatchupCoordinator(), 'attachMonitor').mockReturnValue({
      connected,
      stop,
      settled: () => Promise.resolve(),
    });
    vi.mocked(monitorTlonProvider).mockRejectedValueOnce(
      new Error('authentication failed')
    );
    await expect(
      startTlonGatewayAccount({
        cfg: {},
        account: { accountId: 'default' },
        abortSignal: new AbortController().signal,
        setStatus: vi.fn(),
        runtime: {},
      } as never)
    ).rejects.toThrow('authentication failed');
    expect(connected).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
