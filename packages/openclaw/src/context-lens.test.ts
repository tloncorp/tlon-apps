import { describe, expect, it } from 'vitest';

import {
  findRecentContextLensById,
  listRecentContextLensEvents,
  publishContextLensEvent,
  subscribeToContextLensEvents,
} from './context-lens-events.js';
import {
  bindContextLensToSession,
  buildRetryDispatch,
  createContextLensRegistry,
  createRetrySeed,
  ensureBackgroundContextLensForSession,
  finalizeBackgroundContextLensForSession,
  getActiveBackgroundContextLens,
  getActiveForegroundContextLensForConversation,
  hashSessionKey,
  recordBackgroundContextLensOutput,
  recordContextLensToolResultForSession,
  recordContextLensToolStartForSession,
  retrySeedMessageTextIsCiteFree,
  scheduleBackgroundContextLensFinalization,
  unbindContextLensFromSession,
} from './context-lens.js';

describe('context lens registry', () => {
  it('creates redacted receipts without storing raw session keys or prompt text', () => {
    const registry = createContextLensRegistry({ ttlMs: 1_000 });
    const lens = registry.create({
      messageId: 'message-1',
      chatType: 'dm',
      runKind: 'conversation',
      visibility: 'owner',
      trigger: 'dm',
      sessionKey: 'agent:test:tlon:direct:~ten',
      now: 100,
    });

    expect(lens).toMatchObject({
      messageId: 'message-1',
      chatType: 'dm',
      runKind: 'conversation',
      visibility: 'owner',
      trigger: 'dm',
      sessionKeyHash: hashSessionKey('agent:test:tlon:direct:~ten'),
      status: 'assembling',
      context: {
        currentMessage: true,
        threadMessages: 0,
        channelMessages: 0,
        citedPosts: 0,
        attachments: 0,
        pendingNudge: false,
      },
    });
    expect(JSON.stringify(lens)).not.toContain('agent:test:tlon:direct:~ten');
    expect(JSON.stringify(lens)).not.toContain('~ten');
  });

  it('records context and persistence facts by patching nested fields', () => {
    const registry = createContextLensRegistry();
    const lens = registry.create({
      messageId: 'message-2',
      chatType: 'channel',
      trigger: 'mention',
      sessionKey: 'session-2',
      senderShip: '~ten',
      conversationId: 'chat/~ten/test',
      receivedAt: 123,
      preview: 'hello bot',
    });

    registry.recordContext(lens.lensId, {
      channelMessages: 12,
      citedPosts: 2,
      attachments: 1,
    });
    registry.recordContextSource(lens.lensId, {
      kind: 'message',
      label: 'Recent channel activity',
      sourceId: 'chat/~ten/test',
      included: true,
      reason: '12 recent channel messages',
    });
    registry.recordPersistence(lens.lensId, {
      cachesHistory: true,
      writesMedia: true,
      emitsTelemetry: true,
    });
    registry.recordPersistenceEvent(lens.lensId, {
      kind: 'conversation_state',
      action: 'read',
      location: 'openclaw',
      status: 'ok',
      key: 'session:abc',
      at: 456,
    });
    registry.setStatus(lens.lensId, 'dispatching');
    registry.recordLifecycle(lens.lensId, {
      dispatchStartedAt: 123,
      timeoutMs: 90_000,
    });
    registry.recordToolCall(lens.lensId, 'tlon', { phase: 'start' });
    registry.recordToolCall(lens.lensId, 'tlon');
    registry.completeOpenToolRuns(lens.lensId);
    registry.recordOutput(lens.lensId, {
      messageId: '~zod/170.141.184',
      conversationId: 'chat/~ten/test',
      kind: 'channel',
      sentAt: 789,
      preview: 'reply',
      chunkIndex: 0,
    });

    expect(registry.get(lens.lensId)).toMatchObject({
      status: 'dispatching',
      triggerDetails: {
        type: 'mention',
        messageId: 'message-2',
        authorShip: '~ten',
        conversationId: 'chat/~ten/test',
        receivedAt: 123,
        preview: 'hello bot',
      },
      context: {
        currentMessage: true,
        threadMessages: 0,
        channelMessages: 12,
        citedPosts: 2,
        attachments: 1,
        pendingNudge: false,
        sources: expect.arrayContaining([
          expect.objectContaining({
            label: 'Current message',
            included: true,
            preview: 'hello bot',
          }),
          expect.objectContaining({
            label: 'Recent channel activity',
            included: true,
          }),
        ]),
      },
      persistence: {
        postsReply: false,
        updatesSettings: false,
        writesMedia: true,
        emitsTelemetry: true,
        cachesHistory: true,
        events: [
          expect.objectContaining({
            kind: 'conversation_state',
            action: 'read',
            location: 'openclaw',
          }),
        ],
      },
      tools: {
        ownerOnlyAvailable: [],
        called: ['tlon'],
        callCount: 2,
        runs: [
          expect.objectContaining({
            callIndex: 1,
            name: 'tlon',
            phase: 'start',
            status: 'completed',
          }),
          expect.objectContaining({
            callIndex: 2,
            name: 'tlon',
            status: 'completed',
          }),
        ],
      },
      outputs: [
        expect.objectContaining({
          messageId: '~zod/170.141.184',
          kind: 'channel',
          preview: 'reply',
        }),
      ],
      lifecycle: {
        dispatchStartedAt: 123,
        timeoutMs: 90_000,
        deliveredMessageCount: 0,
        queuedFinal: false,
      },
    });
  });

  it('records summarization triggers distinctly from ordinary mentions', () => {
    const registry = createContextLensRegistry();
    const lens = registry.create({
      messageId: 'summary-message',
      chatType: 'channel',
      trigger: 'summarization',
      sessionKey: 'session-summary',
      senderShip: '~ten',
      conversationId: 'chat/~ten/test',
      preview: 'summarize this channel',
    });

    expect(lens).toMatchObject({
      trigger: 'summarization',
      triggerDetails: {
        type: 'summarization',
        messageId: 'summary-message',
        conversationKind: 'channel',
      },
    });
  });

  it('records no-reply and timeout lifecycle outcomes without raw content', () => {
    const registry = createContextLensRegistry();
    const noReply = registry.create({ messageId: 'message-3', chatType: 'dm' });
    const timedOut = registry.create({
      messageId: 'message-4',
      chatType: 'dm',
    });

    registry.recordLifecycle(noReply.lensId, {
      completedAt: 500,
      durationMs: 250,
      deliveredMessageCount: 0,
    });
    registry.setStatus(noReply.lensId, 'no_reply');

    registry.recordLifecycle(timedOut.lensId, {
      completedAt: 1_000,
      durationMs: 120_000,
      timeoutMs: 120_000,
      timedOut: true,
    });
    registry.setStatus(
      timedOut.lensId,
      'timed_out',
      new Error('dispatch timed out')
    );

    expect(registry.get(noReply.lensId)).toMatchObject({
      status: 'no_reply',
      lifecycle: {
        durationMs: 250,
        deliveredMessageCount: 0,
        timedOut: false,
      },
    });
    expect(registry.get(timedOut.lensId)).toMatchObject({
      status: 'timed_out',
      error: 'dispatch timed out',
      lifecycle: {
        durationMs: 120_000,
        timeoutMs: 120_000,
        timedOut: true,
      },
    });
  });

  it('records completed tool durations from session tool results', () => {
    const registry = createContextLensRegistry();
    const sessionKey = 'session-tool-result';
    const lens = registry.create({
      messageId: 'message-tool-result',
      chatType: 'dm',
      sessionKey,
    });

    bindContextLensToSession(sessionKey, registry, lens.lensId);

    try {
      recordContextLensToolStartForSession(sessionKey, 'read', {
        argumentSummary: '2 keys: path, line',
      });
      recordContextLensToolStartForSession(sessionKey, 'tlon');
      expect(registry.get(lens.lensId)?.status).toBe('tool_running');
      recordContextLensToolResultForSession(sessionKey, 'read', {
        durationMs: 17,
      });
      registry.completeOpenToolRuns(lens.lensId);
    } finally {
      unbindContextLensFromSession(sessionKey, lens.lensId);
    }

    expect(registry.get(lens.lensId)?.tools.runs).toEqual([
      expect.objectContaining({
        name: 'read',
        status: 'completed',
        durationMs: 17,
        argumentSummary: '2 keys: path, line',
      }),
      expect.objectContaining({
        name: 'tlon',
        status: 'completed',
      }),
    ]);
  });

  it('correlates tool results by tool call id before falling back to tool name', () => {
    const registry = createContextLensRegistry();
    const sessionKey = 'session-tool-call-id';
    const lens = registry.create({
      messageId: 'message-tool-call-id',
      chatType: 'dm',
      sessionKey,
    });

    bindContextLensToSession(sessionKey, registry, lens.lensId);

    try {
      recordContextLensToolStartForSession(sessionKey, 'read', {
        toolCallId: 'call-a',
      });
      recordContextLensToolStartForSession(sessionKey, 'read', {
        toolCallId: 'call-b',
      });
      recordContextLensToolResultForSession(sessionKey, 'read', {
        toolCallId: 'call-b',
        durationMs: 25,
      });
    } finally {
      unbindContextLensFromSession(sessionKey, lens.lensId);
    }

    expect(registry.get(lens.lensId)?.tools.runs).toEqual([
      expect.objectContaining({
        name: 'read',
        toolCallId: 'call-a',
        status: 'running',
      }),
      expect.objectContaining({
        name: 'read',
        toolCallId: 'call-b',
        status: 'completed',
        durationMs: 25,
      }),
    ]);
    expect(registry.get(lens.lensId)?.status).toBe('tool_running');
  });

  it('returns to dispatching after the last running tool completes', () => {
    const registry = createContextLensRegistry();
    const sessionKey = 'session-tool-status';
    const lens = registry.create({
      messageId: 'message-tool-status',
      chatType: 'dm',
      sessionKey,
    });

    bindContextLensToSession(sessionKey, registry, lens.lensId);

    try {
      recordContextLensToolStartForSession(sessionKey, 'read');
      recordContextLensToolResultForSession(sessionKey, 'read', {
        durationMs: 10,
      });
    } finally {
      unbindContextLensFromSession(sessionKey, lens.lensId);
    }

    expect(registry.get(lens.lensId)?.status).toBe('dispatching');
  });

  it('attributes thread-suffixed session keys to the parent binding', () => {
    const registry = createContextLensRegistry();
    const sessionKey = 'agent:main:tlon:channel:chat/~zod/general';
    const lens = registry.create({
      messageId: 'message-thread-fallback',
      chatType: 'channel',
      sessionKey,
    });

    bindContextLensToSession(sessionKey, registry, lens.lensId);

    try {
      const threadKey = `${sessionKey}:thread:170.141.184`;
      recordContextLensToolStartForSession(threadKey, 'read');
      recordContextLensToolResultForSession(threadKey, 'read', {
        durationMs: 7,
      });
    } finally {
      unbindContextLensFromSession(sessionKey, lens.lensId);
    }

    expect(registry.get(lens.lensId)?.tools.runs).toEqual([
      expect.objectContaining({
        name: 'read',
        status: 'completed',
        durationMs: 7,
      }),
    ]);
  });

  it('binds and unbinds a lens under multiple session key forms', () => {
    const registry = createContextLensRegistry();
    const keys = ['agent:main:tlon', 'agent:main:tlon:direct:~ten'] as const;
    const lens = registry.create({
      messageId: 'message-multi-key',
      chatType: 'dm',
    });

    bindContextLensToSession(keys, registry, lens.lensId);

    try {
      recordContextLensToolStartForSession(keys[1], 'read');
      recordContextLensToolResultForSession(keys[0], 'read', { durationMs: 3 });
    } finally {
      unbindContextLensFromSession(keys, lens.lensId);
    }

    expect(registry.get(lens.lensId)?.tools.runs).toEqual([
      expect.objectContaining({
        name: 'read',
        status: 'completed',
        durationMs: 3,
      }),
    ]);
    expect(recordContextLensToolStartForSession(keys[0], 'read')).toBeNull();
    expect(recordContextLensToolStartForSession(keys[1], 'read')).toBeNull();
  });

  it('reuses the parent background binding for thread-suffixed session keys', () => {
    const sessionKey = 'session-background-thread';
    const first = ensureBackgroundContextLensForSession(sessionKey, {
      runKind: 'cron',
      trigger: 'cron',
    });
    const second = ensureBackgroundContextLensForSession(
      `${sessionKey}:thread:7`
    );

    try {
      expect(first?.created).toBe(true);
      expect(second?.created).toBe(false);
      expect(second?.lens.lensId).toBe(first?.lens.lensId);
    } finally {
      finalizeBackgroundContextLensForSession(sessionKey);
    }
  });

  it('exposes the most recent background lens for stamping and records its outputs', async () => {
    const registry = createContextLensRegistry();
    const conversationKey = 'session-active-conversation';
    const conversation = registry.create({
      messageId: 'message-active-conversation',
      chatType: 'dm',
      sessionKey: conversationKey,
    });
    bindContextLensToSession(conversationKey, registry, conversation.lensId);

    const older = ensureBackgroundContextLensForSession('session-active-bg-a', {
      runKind: 'internal',
      trigger: 'tool',
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const newer = ensureBackgroundContextLensForSession('session-active-bg-b', {
      runKind: 'cron',
      trigger: 'cron',
    });

    try {
      // Conversation bindings are never stamp candidates; the most recently
      // updated background lens wins.
      expect(getActiveBackgroundContextLens()?.lensId).toBe(newer?.lens.lensId);

      recordBackgroundContextLensOutput(newer?.lens.lensId ?? '', {
        messageId: '~zod/170.141.184',
        conversationId: '~ten',
        kind: 'dm',
        sentAt: 123,
        preview: 'cron reply',
      });
      const finalNewer = finalizeBackgroundContextLensForSession(
        'session-active-bg-b'
      );
      expect(finalNewer?.outputs).toEqual([
        expect.objectContaining({
          messageId: '~zod/170.141.184',
          conversationId: '~ten',
          kind: 'dm',
          preview: 'cron reply',
        }),
      ]);

      // Finalized lenses drop out of the candidate set.
      expect(getActiveBackgroundContextLens()?.lensId).toBe(older?.lens.lensId);
      finalizeBackgroundContextLensForSession('session-active-bg-a');
      expect(getActiveBackgroundContextLens()).toBeNull();
    } finally {
      finalizeBackgroundContextLensForSession('session-active-bg-a');
      finalizeBackgroundContextLensForSession('session-active-bg-b');
      unbindContextLensFromSession(conversationKey, conversation.lensId);
    }
  });

  it('resolves the foreground dispatch lens for a conversation so message-tool posts attribute correctly', () => {
    const registry = createContextLensRegistry();
    const sessionKey = 'session-fg-dm';
    const lens = registry.create({
      messageId: 'message-fg-dm',
      chatType: 'dm',
      sessionKey,
      conversationId: '~ten',
    });
    bindContextLensToSession(sessionKey, registry, lens.lensId);

    // A concurrent background run for an unrelated conversation must not match.
    const background = ensureBackgroundContextLensForSession('session-fg-bg', {
      runKind: 'cron',
      trigger: 'cron',
    });

    try {
      // Foreground bindings are not background-stamp candidates.
      expect(getActiveBackgroundContextLens()?.lensId).toBe(
        background?.lens.lensId
      );

      const resolved = getActiveForegroundContextLensForConversation('~ten');
      expect(resolved?.lensId).toBe(lens.lensId);
      expect(resolved?.registry).toBe(registry);

      // Conversations without an active foreground run resolve to null.
      expect(getActiveForegroundContextLensForConversation('~zod')).toBeNull();
      expect(getActiveForegroundContextLensForConversation('')).toBeNull();

      // The resolved registry records the tool-driven post as a run output.
      resolved?.registry.recordOutput(resolved.lensId, {
        messageId: '~zod/170.141.184',
        conversationId: '~ten',
        kind: 'dm',
        sentAt: 456,
        preview: 'cat from the internet',
      });
      expect(registry.get(lens.lensId)?.outputs).toEqual([
        expect.objectContaining({
          messageId: '~zod/170.141.184',
          preview: 'cat from the internet',
        }),
      ]);
    } finally {
      finalizeBackgroundContextLensForSession('session-fg-bg');
      unbindContextLensFromSession(sessionKey, lens.lensId);
    }
  });

  it('records blocked tool calls from session tool results', () => {
    const registry = createContextLensRegistry();
    const sessionKey = 'session-blocked-tool';
    const lens = registry.create({
      messageId: 'message-blocked-tool',
      chatType: 'dm',
      sessionKey,
    });

    bindContextLensToSession(sessionKey, registry, lens.lensId);

    try {
      recordContextLensToolStartForSession(sessionKey, 'read');
      recordContextLensToolResultForSession(sessionKey, 'read', {
        status: 'blocked',
        error: 'read is not available',
      });
    } finally {
      unbindContextLensFromSession(sessionKey, lens.lensId);
    }

    expect(registry.get(lens.lensId)?.tools.runs).toEqual([
      expect.objectContaining({
        name: 'read',
        status: 'blocked',
        error: 'read is not available',
      }),
    ]);
  });

  it('creates and finalizes owner-visible background tool runs', () => {
    const sessionKey = 'session-background-tool';
    const background = ensureBackgroundContextLensForSession(sessionKey, {
      runKind: 'cron',
      trigger: 'cron',
      preview: 'cron tool activity',
    });

    expect(background?.created).toBe(true);
    expect(background?.lens).toMatchObject({
      chatType: 'internal',
      runKind: 'cron',
      visibility: 'owner',
      trigger: 'cron',
      triggerDetails: {
        conversationKind: 'internal',
        preview: 'cron tool activity',
      },
    });

    recordContextLensToolStartForSession(sessionKey, 'cron');
    recordContextLensToolResultForSession(sessionKey, 'cron', {
      durationMs: 42,
    });
    const finalLens = finalizeBackgroundContextLensForSession(sessionKey);

    expect(finalLens).toMatchObject({
      status: 'completed',
      lifecycle: {
        deliveredMessageCount: 0,
      },
      tools: {
        runs: [
          expect.objectContaining({
            name: 'cron',
            status: 'completed',
            durationMs: 42,
          }),
        ],
      },
    });
    expect(recordContextLensToolStartForSession(sessionKey, 'cron')).toBeNull();
  });

  it('groups background tool calls until the session is idle', async () => {
    const sessionKey = 'session-background-debounce';
    const finalized: Array<{
      lensId: string;
      tools: { runs: Array<{ name: string; status: string }> };
    }> = [];
    ensureBackgroundContextLensForSession(sessionKey, {
      runKind: 'cron',
      trigger: 'cron',
      preview: 'cron tool activity',
    });

    recordContextLensToolStartForSession(sessionKey, 'cron');
    recordContextLensToolResultForSession(sessionKey, 'cron', {
      durationMs: 42,
    });
    scheduleBackgroundContextLensFinalization(
      sessionKey,
      (lens) => finalized.push(lens),
      20
    );

    await new Promise((resolve) => setTimeout(resolve, 5));
    ensureBackgroundContextLensForSession(sessionKey);
    recordContextLensToolStartForSession(sessionKey, 'tlon');
    recordContextLensToolResultForSession(sessionKey, 'tlon', {
      durationMs: 12,
    });
    scheduleBackgroundContextLensFinalization(
      sessionKey,
      (lens) => finalized.push(lens),
      20
    );

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(finalized).toHaveLength(1);
    expect(finalized[0]?.tools.runs).toEqual([
      expect.objectContaining({ name: 'cron', status: 'completed' }),
      expect.objectContaining({ name: 'tlon', status: 'completed' }),
    ]);
  });

  it('applies the registry visibility default when create() omits visibility', () => {
    const registry = createContextLensRegistry({
      visibilityDefault: 'internal',
    });
    const defaulted = registry.create({
      messageId: 'vis-default',
      chatType: 'dm',
    });
    const explicit = registry.create({
      messageId: 'vis-explicit',
      chatType: 'dm',
      visibility: 'participants',
    });

    expect(defaulted.visibility).toBe('internal');
    expect(explicit.visibility).toBe('participants');
  });

  it('does not retain lenses when disabled, so record calls no-op', () => {
    const registry = createContextLensRegistry({ disabled: true });
    const lens = registry.create({
      messageId: 'disabled-lens',
      chatType: 'dm',
    });

    expect(lens.lensId).toBeTruthy();
    expect(registry.get(lens.lensId)).toBeNull();
    expect(registry.recordToolCall(lens.lensId, 'tlon')).toBeNull();
    expect(registry.setStatus(lens.lensId, 'dispatching')).toBeNull();
    expect(registry.listRecent()).toEqual([]);
  });

  it('expires old lenses and caps registry size', () => {
    const registry = createContextLensRegistry({
      ttlMs: 1_000_000,
      maxEntries: 2,
    });
    const now = Date.now();
    const first = registry.create({ messageId: 'first', chatType: 'dm', now });
    const second = registry.create({
      messageId: 'second',
      chatType: 'dm',
      now: now + 5,
    });
    const third = registry.create({
      messageId: 'third',
      chatType: 'dm',
      now: now + 6,
    });

    expect(registry.get(first.lensId)).toBeNull();
    expect(registry.get(second.lensId)?.messageId).toBe('second');
    expect(registry.get(third.lensId)?.messageId).toBe('third');

    registry.prune(now + 1_000_006);
    expect(registry.get(second.lensId)).toBeNull();
    expect(registry.get(third.lensId)).toBeNull();
  });
});

describe('context lens event bus', () => {
  it('does not expose expired lens snapshots from the global event store', () => {
    const registry = createContextLensRegistry();
    const expired = registry.create({
      messageId: 'message-expired-event',
      chatType: 'dm',
      trigger: 'dm',
      now: 100,
      ttlMs: 1,
    });

    publishContextLensEvent('created', expired);

    expect(findRecentContextLensById(expired.lensId)).toBeNull();
    expect(listRecentContextLensEvents()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lens: expect.objectContaining({ lensId: expired.lensId }),
        }),
      ])
    );
  });

  it('continues publishing when a listener throws', () => {
    const registry = createContextLensRegistry();
    const lens = registry.create({
      messageId: 'message-listener-throw',
      chatType: 'dm',
      trigger: 'dm',
    });
    const received: string[] = [];
    const unsubscribeThrowing = subscribeToContextLensEvents(() => {
      throw new Error('closed response');
    });
    const unsubscribeReceiving = subscribeToContextLensEvents((event) => {
      received.push(event.lens.lensId);
    });

    try {
      expect(() => publishContextLensEvent('created', lens)).not.toThrow();
      expect(received).toContain(lens.lensId);
    } finally {
      unsubscribeThrowing();
      unsubscribeReceiving();
    }
  });

  it('shares recent events across repeated module loads', async () => {
    const registry = createContextLensRegistry();
    const lens = registry.create({
      messageId: 'message-global-bus',
      chatType: 'dm',
      trigger: 'dm',
      sessionKey: 'session-global-bus',
    });

    publishContextLensEvent('created', lens);

    // @ts-expect-error Vitest supports query-string imports for duplicate module instances.
    const duplicateBus = await import('./context-lens-events.js?duplicate');

    expect(duplicateBus.findRecentContextLensById(lens.lensId)).toMatchObject({
      lensId: lens.lensId,
      messageId: 'message-global-bus',
    });
  });
});

describe('retry seed and dispatch', () => {
  it('captures retryOf and retrySeed on create and preserves them through clones', () => {
    const registry = createContextLensRegistry();
    const lens = registry.create({
      messageId: 'message-retry-1',
      chatType: 'channel',
      trigger: 'retry',
      sessionKey: 'session-retry-1',
      senderShip: '~ten',
      conversationId: 'chat/~ten/test',
      retryOf: 'lens-original',
      retrySeed: {
        messageText: 'hello again',
        blobField: '{"k":"v"}',
        parentId: '170.1',
        isThreadReply: true,
        replyParentId: '170.2',
        cachesHistory: true,
      },
    });

    expect(lens.retryOf).toBe('lens-original');
    expect(lens.retrySeed).toEqual({
      messageText: 'hello again',
      blobField: '{"k":"v"}',
      parentId: '170.1',
      isThreadReply: true,
      replyParentId: '170.2',
      cachesHistory: true,
    });

    const fetched = registry.get(lens.lensId);
    expect(fetched?.retrySeed).toEqual(lens.retrySeed);
    // Clones are independent copies, not shared references.
    expect(fetched?.retrySeed).not.toBe(lens.retrySeed);
  });

  it('caps oversized retry seed text and drops oversized blobs', () => {
    const registry = createContextLensRegistry();
    const lens = registry.create({
      messageId: 'message-retry-2',
      chatType: 'dm',
      trigger: 'dm',
      sessionKey: 'session-retry-2',
      senderShip: '~ten',
      retrySeed: {
        messageText: 'x'.repeat(20_000),
        blobField: 'y'.repeat(10_000),
      },
    });

    expect(lens.retrySeed?.messageText.length).toBe(16_384);
    expect(lens.retrySeed?.blobField).toBeUndefined();
  });

  it("builds a retry dispatch from a failed run's seed", () => {
    const registry = createContextLensRegistry();
    const lens = registry.create({
      messageId: 'message-retry-3',
      chatType: 'channel',
      trigger: 'mention',
      sessionKey: 'session-retry-3',
      senderShip: '~ten',
      conversationId: 'chat/~ten/test',
      preview: 'preview text',
      retrySeed: {
        messageText: 'full original text',
        messageTextIsCiteFree: true,
        blobField: null,
        parentId: '170.5',
        isThreadReply: true,
        replyParentId: null,
        cachesHistory: true,
      },
    });
    const aborted = registry.setStatus(lens.lensId, 'aborted');
    expect(aborted).not.toBeNull();

    const result = buildRetryDispatch(aborted!);
    expect(result).toEqual({
      ok: true,
      dispatch: {
        messageId: 'message-retry-3',
        senderShip: '~ten',
        messageText: 'full original text',
        messageTextIsCiteFree: true,
        blobField: null,
        messageContent: null,
        isGroup: true,
        channelNest: 'chat/~ten/test',
        parentId: '170.5',
        isThreadReply: true,
        replyParentId: null,
        cachesHistory: true,
        degraded: false,
      },
    });
  });

  it('keeps a legacy retry and its retry-of-a-retry unmarked as cite-free', () => {
    const registry = createContextLensRegistry();
    const lens = registry.create({
      messageId: 'message-retry-legacy',
      chatType: 'channel',
      trigger: 'retry',
      sessionKey: 'session-retry-legacy',
      senderShip: '~ten',
      conversationId: 'chat/~ten/test',
      retrySeed: {
        messageText: '> ~quoted wrote: baked-in quote\n\nfollow-up question',
        messageContent: [{ inline: ['follow-up question'] }],
      },
    });
    const failed = registry.setStatus(lens.lensId, 'error', new Error('boom'));

    const dispatch = buildRetryDispatch(failed!);

    expect(dispatch).toMatchObject({ ok: true });
    if (dispatch.ok) {
      expect(dispatch.dispatch).not.toHaveProperty('messageTextIsCiteFree');
      expect(
        createRetrySeed({
          messageText: dispatch.dispatch.messageText,
          ...(retrySeedMessageTextIsCiteFree(
            dispatch.dispatch.messageTextIsCiteFree
          )
            ? { messageTextIsCiteFree: true }
            : {}),
        })
      ).not.toHaveProperty('messageTextIsCiteFree');
    }
  });

  it('marks retry seeds cite-free only for explicitly cite-free dispatches', () => {
    expect(
      createRetrySeed({
        messageText: 'cite-free message',
        ...(retrySeedMessageTextIsCiteFree(true)
          ? { messageTextIsCiteFree: true }
          : {}),
      })
    ).toMatchObject({ messageTextIsCiteFree: true });
    expect(
      createRetrySeed({
        messageText: 'legacy message',
        ...(retrySeedMessageTextIsCiteFree(undefined)
          ? { messageTextIsCiteFree: true }
          : {}),
      })
    ).not.toHaveProperty('messageTextIsCiteFree');
  });

  it('falls back to the preview as degraded when the run predates retrySeed', () => {
    const registry = createContextLensRegistry();
    const lens = registry.create({
      messageId: 'message-retry-4',
      chatType: 'dm',
      trigger: 'dm',
      sessionKey: 'session-retry-4',
      senderShip: '~ten',
      preview: 'truncated preview',
    });
    const failed = registry.setStatus(lens.lensId, 'error', new Error('boom'));

    const result = buildRetryDispatch(failed!);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dispatch.messageText).toBe('truncated preview');
      expect(result.dispatch.degraded).toBe(true);
      expect(result.dispatch.isGroup).toBe(false);
    }
  });

  it('refuses non-retryable, internal, and incomplete runs', () => {
    const registry = createContextLensRegistry();

    const completed = registry.create({
      messageId: 'message-retry-5',
      chatType: 'dm',
      trigger: 'dm',
      sessionKey: 'session-retry-5',
      senderShip: '~ten',
      preview: 'done',
    });
    const completedLens = registry.setStatus(completed.lensId, 'completed');
    expect(buildRetryDispatch(completedLens!)).toEqual({
      ok: false,
      reason: 'status completed is not retryable',
    });

    const internal = registry.create({
      messageId: 'message-retry-6',
      chatType: 'internal',
      trigger: 'cron',
      sessionKey: 'session-retry-6',
      preview: 'cron run',
    });
    const internalLens = registry.setStatus(internal.lensId, 'error');
    expect(buildRetryDispatch(internalLens!).ok).toBe(false);

    const noAuthor = registry.create({
      messageId: 'message-retry-7',
      chatType: 'dm',
      trigger: 'dm',
      sessionKey: 'session-retry-7',
      preview: 'anonymous',
    });
    const noAuthorLens = registry.setStatus(noAuthor.lensId, 'timed_out');
    expect(buildRetryDispatch(noAuthorLens!)).toEqual({
      ok: false,
      reason: 'original run has no author ship',
    });

    const noText = registry.create({
      messageId: 'message-retry-8',
      chatType: 'dm',
      trigger: 'dm',
      sessionKey: 'session-retry-8',
      senderShip: '~ten',
    });
    const noTextLens = registry.setStatus(noText.lensId, 'no_reply');
    expect(buildRetryDispatch(noTextLens!)).toEqual({
      ok: false,
      reason: 'no message text, blob, or content available to retry',
    });
  });

  it('retries a blob-only run with no text', () => {
    const registry = createContextLensRegistry({ ttlMs: 60_000 });
    const blobOnly = registry.create({
      messageId: 'message-retry-blob',
      chatType: 'dm',
      trigger: 'dm',
      sessionKey: 'session-retry-blob',
      senderShip: '~ten',
      retrySeed: {
        messageText: '',
        blobField: '{"voice":"memo"}',
      },
    });
    const blobOnlyLens = registry.setStatus(blobOnly.lensId, 'no_reply');
    const result = buildRetryDispatch(blobOnlyLens!);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dispatch.messageText).toBe('');
      expect(result.dispatch.blobField).toBe('{"voice":"memo"}');
    }
  });

  it('preserves messageContent so image-block media can be re-attached', () => {
    const registry = createContextLensRegistry({ ttlMs: 60_000 });
    const messageContent = [
      { block: { image: { src: 'https://example.com/cat.png' } } },
    ];
    // an image-only message: no text, no blobField, media lives in the Story
    const imageRun = registry.create({
      messageId: 'message-retry-image',
      chatType: 'dm',
      trigger: 'dm',
      sessionKey: 'session-retry-image',
      senderShip: '~ten',
      retrySeed: {
        messageText: '',
        messageContent,
      },
    });
    const imageLens = registry.setStatus(imageRun.lensId, 'error');
    const result = buildRetryDispatch(imageLens!);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dispatch.messageText).toBe('');
      expect(result.dispatch.messageContent).toEqual(messageContent);
    }
  });
});
