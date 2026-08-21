import type { ParticipantAgentActivityProjectionV1 } from '@tloncorp/api/client/participantAgentActivity';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { ContextLens } from './context-lens.js';
import { createGroupAgentActivityPublisher } from './group-agent-activity-publisher.js';
import type { GroupAgentActivityTransport } from './group-agent-activity-transport.js';

function makeLens(overrides: Partial<ContextLens> = {}): ContextLens {
  const now = 1_000;
  return {
    lensId: 'private-lens-id',
    botShip: '~bot',
    runId: 'run-1',
    messageId: '123456',
    sessionKeyHash: 'private-session',
    chatType: 'channel',
    runKind: 'conversation',
    visibility: 'owner',
    trigger: 'mention',
    triggerDetails: {
      type: 'mention',
      messageId: '123456',
      authorShip: '~requester',
      conversationId: 'chat/~host/general',
      conversationKind: 'channel',
    },
    retrySeed: {
      messageText: 'private original text',
      parentId: null,
      isThreadReply: false,
      replyParentId: null,
    },
    model: 'private-model',
    provider: 'private-provider',
    context: {
      currentMessage: true,
      threadMessages: 0,
      channelMessages: 0,
      citedPosts: 0,
      attachments: 0,
      pendingNudge: false,
      sources: [],
    },
    persistence: {
      postsReply: false,
      updatesSettings: false,
      writesMedia: false,
      emitsTelemetry: false,
      cachesHistory: false,
      events: [],
    },
    tools: {
      ownerOnlyAvailable: [],
      called: [],
      callCount: 0,
      lastStartedAt: null,
      runs: [],
    },
    outputs: [],
    activity: {
      schemaVersion: 1,
      eventCount: 1,
      lastEventAt: now,
      truncated: false,
      plan: {
        updatedAt: now,
        steps: [
          { id: 'step-1', title: 'Check the records', status: 'running' },
        ],
      },
      items: [
        {
          id: 'commentary-1',
          kind: 'commentary',
          title: 'Checking the records now.',
          status: 'running',
          startedAt: now,
          updatedAt: now,
          completedAt: null,
        },
      ],
    },
    lifecycle: {
      queuedAt: now,
      queuedMs: 0,
      dispatchStartedAt: now,
      firstToolStartedAt: null,
      completedAt: null,
      durationMs: null,
      timeoutMs: 900_000,
      timedOut: false,
      deliveredMessageCount: 0,
      queuedFinal: false,
      queuedFinalCount: 0,
      queuedBlockCount: 0,
    },
    status: 'dispatching',
    error: null,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 900_000,
    ...overrides,
  };
}

function projection(
  lens: ContextLens,
  surface: 'carrier' | 'final',
  finalReplyDelivered = false,
  revision = 1,
  outcome?: 'completed' | 'failed' | 'cancelled'
): ParticipantAgentActivityProjectionV1 {
  const sourceStep = lens.activity.plan?.steps[0];
  const timedOut = lens.status === 'timed_out';
  const state =
    outcome === 'cancelled'
      ? ('cancelled' as const)
      : outcome === 'failed'
        ? ('failed' as const)
        : timedOut
          ? ('timed_out' as const)
          : finalReplyDelivered || outcome === 'completed'
            ? sourceStep?.status === 'completed'
              ? ('completed' as const)
              : ('incomplete' as const)
            : ('working' as const);
  const stepStatus =
    state === 'cancelled'
      ? ('cancelled' as const)
      : state === 'failed' || state === 'timed_out'
        ? ('failed' as const)
        : state === 'incomplete'
          ? ('pending' as const)
          : sourceStep?.status === 'completed'
            ? ('completed' as const)
            : ('running' as const);
  return {
    schemaVersion: 1,
    publicRunId: 'public-run-1',
    surface,
    revision,
    triggerPostId: '123456',
    state,
    createdAt: lens.createdAt,
    updatedAt: lens.updatedAt,
    ...(state === 'working' ? {} : { completedAt: lens.updatedAt }),
    steps: [
      {
        id: 'public-step-1',
        title: sourceStep?.title ?? 'Check the records',
        status: stepStatus,
      },
    ],
    ...(timedOut
      ? { terminalReason: 'timeout' as const }
      : state === 'cancelled'
        ? { terminalReason: 'interrupted' as const }
        : state === 'failed'
          ? { terminalReason: 'failed' as const }
          : {}),
  };
}

function makeTransport(): GroupAgentActivityTransport {
  return {
    create: vi.fn(async () => ({ postId: 'carrier-1', sentAt: 1_100 })),
    update: vi.fn(async () => {}),
    resolve: vi.fn(async (sentAt, draft) => ({
      postId: 'final-1',
      sentAt,
      ...(draft.parentId ? { parentId: draft.parentId } : {}),
    })),
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function makePublisher(
  transport: GroupAgentActivityTransport,
  options: {
    retryDelaysMs?: readonly number[];
    retentionMs?: number;
  } = {}
) {
  return createGroupAgentActivityPublisher({
    transport,
    botShip: '~bot',
    getBotProfile: () => undefined,
    project: (lens, projectOptions) =>
      projection(
        lens,
        projectOptions.surface,
        projectOptions.finalReplyDelivered,
        projectOptions.revision,
        projectOptions.outcome
      ),
    serializeReferenceBlob: ({ participantActivity }) =>
      JSON.stringify(participantActivity),
    replaceParticipantActivity: (_blob, _lensId, activity) =>
      JSON.stringify(activity),
    storyFromText: (text) => [{ inline: [text] }],
    minUpdateIntervalMs: 0,
    ...options,
  });
}

function lensWithStep(
  lens: ContextLens,
  params: {
    status: ContextLens['status'];
    stepStatus: NonNullable<
      ContextLens['activity']['plan']
    >['steps'][number]['status'];
    title?: string;
    updatedAt: number;
  }
): ContextLens {
  return {
    ...lens,
    status: params.status,
    updatedAt: params.updatedAt,
    activity: {
      ...lens.activity,
      plan: {
        updatedAt: params.updatedAt,
        steps: [
          {
            id: 'step-1',
            title: params.title ?? 'Check the records',
            status: params.stepStatus,
          },
        ],
      },
    },
    lifecycle: {
      ...lens.lifecycle,
      ...(params.status === 'timed_out'
        ? {
            timedOut: true,
            completedAt: params.updatedAt,
            durationMs: params.updatedAt - lens.createdAt,
          }
        : params.status === 'completed'
          ? {
              completedAt: params.updatedAt,
              durationMs: params.updatedAt - lens.createdAt,
            }
          : {}),
    },
  };
}

describe('group participant agent activity publisher', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  test('publishes only structurally eligible channel conversation runs', async () => {
    const transport = makeTransport();
    const publisher = createGroupAgentActivityPublisher({
      transport,
      botShip: '~bot',
      getBotProfile: () => undefined,
      project: (lens, options) =>
        projection(
          lens,
          options.surface,
          options.finalReplyDelivered,
          options.revision,
          options.outcome
        ),
      serializeReferenceBlob: ({ participantActivity }) =>
        JSON.stringify(participantActivity),
      replaceParticipantActivity: (_blob, _lensId, activity) =>
        JSON.stringify(activity),
      storyFromText: (text) => [{ inline: [text] }],
      minUpdateIntervalMs: 0,
    });

    publisher.handleEvent({
      seq: 1,
      at: 1_000,
      phase: 'activity',
      lens: makeLens({ chatType: 'dm' }),
    });
    publisher.handleEvent({
      seq: 2,
      at: 1_000,
      phase: 'activity',
      lens: makeLens({
        activity: {
          schemaVersion: 1,
          eventCount: 0,
          lastEventAt: null,
          truncated: false,
          plan: null,
          items: [],
        },
      }),
    });
    publisher.handleEvent({
      seq: 3,
      at: 1_000,
      phase: 'activity',
      lens: makeLens({
        tools: {
          ...makeLens().tools,
          called: ['update_plan'],
          callCount: 3,
        },
        activity: {
          schemaVersion: 1,
          eventCount: 1,
          lastEventAt: 1_000,
          truncated: false,
          plan: {
            updatedAt: 1_000,
            steps: [
              { id: 'step-1', title: 'Answer the greeting', status: 'running' },
            ],
          },
          items: [],
        },
      }),
    });
    publisher.handleEvent({
      seq: 4,
      at: 1_000,
      phase: 'activity',
      lens: makeLens({
        activity: {
          schemaVersion: 1,
          eventCount: 1,
          lastEventAt: 1_000,
          truncated: false,
          plan: null,
          items: [
            {
              id: 'generic-reasoning',
              kind: 'item',
              title: 'Reasoning',
              status: 'running',
              startedAt: 1_000,
              updatedAt: 1_000,
              completedAt: null,
            },
          ],
        },
      }),
    });
    await publisher.flush();
    expect(transport.create).not.toHaveBeenCalled();

    publisher.handleEvent({
      seq: 5,
      at: 1_000,
      phase: 'activity',
      lens: makeLens({
        activity: {
          schemaVersion: 1,
          eventCount: 1,
          lastEventAt: 1_000,
          truncated: false,
          plan: null,
          items: [
            {
              id: 'commentary-1',
              kind: 'commentary',
              title: 'Checking the records now.',
              status: 'running',
              startedAt: 1_000,
              updatedAt: 1_000,
              completedAt: null,
            },
          ],
        },
      }),
    });
    await publisher.flush();
    expect(transport.create).toHaveBeenCalledTimes(1);
    expect(transport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'chat/~host/general',
        authorId: '~bot',
        story: [{ inline: ['Working…'] }],
      })
    );
  });

  test('keeps an existing public run eligible after its structural seed is cleared', async () => {
    const transport = makeTransport();
    const publisher = makePublisher(transport);
    const active = makeLens();
    publisher.handleEvent({ seq: 1, at: 1_000, phase: 'plan', lens: active });
    await publisher.flush();

    const cleared: ContextLens = {
      ...active,
      updatedAt: 2_000,
      activity: {
        schemaVersion: 1,
        eventCount: 0,
        lastEventAt: null,
        truncated: false,
        plan: null,
        items: [],
      },
    };
    expect(publisher.buildFinalProjection(cleared, 'completed')).not.toBeNull();
    await publisher.stop();
  });

  test('updates one carrier and keeps a thread carrier in its exact thread', async () => {
    const transport = makeTransport();
    const publisher = createGroupAgentActivityPublisher({
      transport,
      botShip: '~bot',
      getBotProfile: () => undefined,
      project: (lens, options) =>
        projection(
          lens,
          options.surface,
          options.finalReplyDelivered,
          options.revision,
          options.outcome
        ),
      serializeReferenceBlob: ({ participantActivity }) =>
        JSON.stringify(participantActivity),
      replaceParticipantActivity: (_blob, _lensId, activity) =>
        JSON.stringify(activity),
      storyFromText: (text) => [{ inline: [text] }],
      minUpdateIntervalMs: 0,
    });
    const threadLens = makeLens({
      retrySeed: {
        messageText: 'private',
        parentId: 'thread-root',
        isThreadReply: true,
        replyParentId: 'thread-root',
      },
    });

    publisher.handleEvent({
      seq: 1,
      at: 1_000,
      phase: 'plan',
      lens: threadLens,
    });
    await publisher.flush();
    expect(transport.create).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: 'thread-root' })
    );

    publisher.handleEvent({
      seq: 2,
      at: 2_000,
      phase: 'activity',
      lens: { ...threadLens, updatedAt: 2_000 },
    });
    await publisher.flush();
    expect(transport.create).toHaveBeenCalledTimes(1);
    // Private/timing-only Lens churn does not edit the public carrier.
    expect(transport.update).not.toHaveBeenCalled();

    publisher.handleEvent({
      seq: 3,
      at: 3_000,
      phase: 'plan',
      lens: {
        ...threadLens,
        updatedAt: 3_000,
        activity: {
          ...threadLens.activity,
          plan: {
            updatedAt: 3_000,
            steps: [
              {
                id: 'step-1',
                title: 'Verify the records',
                status: 'running',
              },
            ],
          },
        },
      },
    });
    await publisher.flush();
    expect(transport.update).toHaveBeenCalledTimes(1);
    expect(transport.update).toHaveBeenCalledWith(
      { postId: 'carrier-1', sentAt: 1_100 },
      expect.objectContaining({
        parentId: 'thread-root',
        participantActivity: expect.objectContaining({
          steps: [expect.objectContaining({ title: 'Verify the records' })],
        }),
      })
    );
  });

  test('publishes a liveness heartbeat for long silent work', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const transport = makeTransport();
    const publisher = createGroupAgentActivityPublisher({
      transport,
      botShip: '~bot',
      getBotProfile: () => undefined,
      project: (lens, options) =>
        projection(
          lens,
          options.surface,
          options.finalReplyDelivered,
          options.revision,
          options.outcome
        ),
      serializeReferenceBlob: ({ participantActivity }) =>
        JSON.stringify(participantActivity),
      replaceParticipantActivity: (_blob, _lensId, activity) =>
        JSON.stringify(activity),
      storyFromText: (text) => [{ inline: [text] }],
      minUpdateIntervalMs: 0,
      heartbeatIntervalMs: 60_000,
    });

    publisher.handleEvent({
      seq: 1,
      at: 1_000,
      phase: 'plan',
      lens: makeLens(),
    });
    await publisher.flush();
    expect(transport.update).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    await publisher.flush();
    expect(transport.update).toHaveBeenCalledTimes(1);
    expect(transport.update).toHaveBeenCalledWith(
      { postId: 'carrier-1', sentAt: 1_100 },
      expect.objectContaining({
        participantActivity: expect.objectContaining({
          state: 'working',
          revision: 2,
          updatedAt: 61_000,
        }),
      })
    );
    await publisher.stop();
  });

  test('terminalizes an active carrier instead of deleting it on stop', async () => {
    const transport = makeTransport();
    const publisher = createGroupAgentActivityPublisher({
      transport,
      botShip: '~bot',
      getBotProfile: () => undefined,
      project: (lens, options) =>
        projection(
          lens,
          options.surface,
          options.finalReplyDelivered,
          options.revision,
          options.outcome
        ),
      serializeReferenceBlob: ({ participantActivity }) =>
        JSON.stringify(participantActivity),
      replaceParticipantActivity: (_blob, _lensId, activity) =>
        JSON.stringify(activity),
      storyFromText: (text) => [{ inline: [text] }],
      minUpdateIntervalMs: 0,
    });

    publisher.handleEvent({
      seq: 1,
      at: 1_000,
      phase: 'plan',
      lens: makeLens(),
    });
    await publisher.flush();
    await publisher.stop();

    expect(transport.update).toHaveBeenLastCalledWith(
      { postId: 'carrier-1', sentAt: 1_100 },
      expect.objectContaining({
        story: [{ inline: ['The agent run was cancelled.'] }],
        participantActivity: expect.objectContaining({
          surface: 'carrier',
          state: 'cancelled',
          terminalReason: 'interrupted',
        }),
      })
    );
  });

  test('retries a failed terminal carrier edit with bounded backoff', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const transport = makeTransport();
    const publisher = createGroupAgentActivityPublisher({
      transport,
      botShip: '~bot',
      getBotProfile: () => undefined,
      project: (lens, options) =>
        projection(
          lens,
          options.surface,
          options.finalReplyDelivered,
          options.revision,
          options.outcome
        ),
      serializeReferenceBlob: ({ participantActivity }) =>
        JSON.stringify(participantActivity),
      replaceParticipantActivity: (_blob, _lensId, activity) =>
        JSON.stringify(activity),
      storyFromText: (text) => [{ inline: [text] }],
      minUpdateIntervalMs: 0,
      retryDelaysMs: [10],
    });

    publisher.handleEvent({
      seq: 1,
      at: 1_000,
      phase: 'plan',
      lens: makeLens(),
    });
    await publisher.flush();
    vi.mocked(transport.update)
      .mockRejectedValueOnce(new Error('host echo delayed'))
      .mockResolvedValue(undefined);

    const terminal = makeLens({
      status: 'timed_out',
      updatedAt: 2_000,
      lifecycle: {
        ...makeLens().lifecycle,
        timedOut: true,
        completedAt: 2_000,
        durationMs: 1_000,
      },
    });
    publisher.handleEvent({
      seq: 2,
      at: 2_000,
      phase: 'final',
      lens: terminal,
    });
    await publisher.flush();
    expect(transport.update).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10);
    await publisher.flush();
    expect(transport.update).toHaveBeenCalledTimes(2);
    expect(transport.update).toHaveBeenLastCalledWith(
      { postId: 'carrier-1', sentAt: 1_100 },
      expect.objectContaining({
        participantActivity: expect.objectContaining({ state: 'timed_out' }),
      })
    );
    await publisher.stop();
  });

  test('moves to the normal final reply and terminally reconciles its blob', async () => {
    const transport = makeTransport();
    const publisher = createGroupAgentActivityPublisher({
      transport,
      botShip: '~bot',
      getBotProfile: () => undefined,
      project: (lens, options) =>
        projection(
          lens,
          options.surface,
          options.finalReplyDelivered,
          options.revision,
          options.outcome
        ),
      serializeReferenceBlob: ({ participantActivity }) =>
        JSON.stringify(participantActivity),
      replaceParticipantActivity: (_blob, _lensId, activity) =>
        JSON.stringify(activity),
      storyFromText: (text) => [{ inline: [text] }],
      minUpdateIntervalMs: 0,
    });
    const active = makeLens();
    publisher.handleEvent({ seq: 1, at: 1_000, phase: 'plan', lens: active });
    await publisher.flush();

    const finalProjection = publisher.buildFinalProjection(
      active,
      'completed'
    )!;
    publisher.registerFinalReply({
      lens: active,
      sentAt: 2_000,
      story: [{ inline: ['Here is the answer.'] }],
      blob: JSON.stringify(finalProjection),
      participantActivity: finalProjection,
      outcome: 'completed',
    });
    await publisher.flush();
    // Keep the real carrier post (and any replies/reactions on it), but settle
    // its projection. Modern clients hide it in favor of the final reply.
    expect(transport.update).toHaveBeenCalledWith(
      { postId: 'carrier-1', sentAt: 1_100 },
      expect.objectContaining({
        story: [{ inline: ['Finished with incomplete steps.'] }],
        participantActivity: expect.objectContaining({
          surface: 'carrier',
          state: 'incomplete',
        }),
      })
    );
    // The final reply already contains this semantic snapshot, so do not
    // immediately edit it merely to advance timing metadata.
    expect(transport.resolve).not.toHaveBeenCalled();

    const terminal = makeLens({
      status: 'timed_out',
      updatedAt: 3_000,
      lifecycle: {
        ...active.lifecycle,
        timedOut: true,
        completedAt: 3_000,
        durationMs: 2_000,
      },
    });
    publisher.handleEvent({
      seq: 2,
      at: 3_000,
      phase: 'final',
      lens: terminal,
    });
    await publisher.flush();
    expect(transport.resolve).toHaveBeenCalledTimes(1);
    expect(transport.update).toHaveBeenCalledWith(
      { postId: 'final-1', sentAt: 2_000 },
      expect.objectContaining({
        story: [{ inline: ['Here is the answer.'] }],
        blob: expect.stringContaining('timed_out'),
        participantActivity: expect.objectContaining({
          surface: 'final',
          state: 'timed_out',
        }),
      })
    );
  });

  test('does not let an older final edit erase a newer terminal Lens event', async () => {
    const transport = makeTransport();
    const publisher = makePublisher(transport);
    const active = makeLens();
    publisher.handleEvent({ seq: 1, at: 1_000, phase: 'plan', lens: active });
    await publisher.flush();

    const initialFinal = publisher.buildFinalProjection(active, 'completed')!;
    publisher.registerFinalReply({
      lens: active,
      sentAt: 2_000,
      story: [{ inline: ['Here is the answer.'] }],
      blob: JSON.stringify(initialFinal),
      participantActivity: initialFinal,
      outcome: 'completed',
    });
    await publisher.flush();

    const firstFinalEditStarted = deferred<void>();
    const releaseFirstFinalEdit = deferred<void>();
    let deferFinalEdit = true;
    vi.mocked(transport.update).mockImplementation(async (post) => {
      if (post.postId === 'final-1' && deferFinalEdit) {
        deferFinalEdit = false;
        firstFinalEditStarted.resolve(undefined);
        await releaseFirstFinalEdit.promise;
      }
    });

    const timedOut = lensWithStep(active, {
      status: 'timed_out',
      stepStatus: 'running',
      updatedAt: 3_000,
    });
    publisher.handleEvent({
      seq: 2,
      at: 3_000,
      phase: 'final',
      lens: timedOut,
    });
    const flushing = publisher.flush();
    await firstFinalEditStarted.promise;

    const completed = lensWithStep(active, {
      status: 'completed',
      stepStatus: 'completed',
      title: 'Verified the records',
      updatedAt: 4_000,
    });
    publisher.handleEvent({
      seq: 3,
      at: 4_000,
      phase: 'final',
      lens: completed,
    });
    releaseFirstFinalEdit.resolve(undefined);
    await flushing;
    await publisher.flush();

    const finalDrafts = vi
      .mocked(transport.update)
      .mock.calls.filter(([post]) => post.postId === 'final-1')
      .map(([, draft]) => draft.participantActivity);
    expect(finalDrafts.map((draft) => draft.state)).toEqual([
      'timed_out',
      'completed',
    ]);
    expect(finalDrafts.at(-1)?.steps[0]?.title).toBe('Verified the records');
    await publisher.stop();
  });

  test('reconciles the final reply even when the carrier edit fails', async () => {
    const transport = makeTransport();
    const publisher = makePublisher(transport, { retryDelaysMs: [] });
    const active = makeLens();
    publisher.handleEvent({ seq: 1, at: 1_000, phase: 'plan', lens: active });
    await publisher.flush();

    const initialFinal = publisher.buildFinalProjection(active, 'completed')!;
    publisher.registerFinalReply({
      lens: active,
      sentAt: 2_000,
      story: [{ inline: ['Here is the answer.'] }],
      blob: JSON.stringify(initialFinal),
      participantActivity: initialFinal,
      outcome: 'completed',
    });
    await publisher.flush();
    vi.mocked(transport.update).mockClear();
    vi.mocked(transport.update).mockImplementation(async (post) => {
      if (post.postId === 'carrier-1') {
        throw new Error('carrier was removed');
      }
    });

    const timedOut = lensWithStep(active, {
      status: 'timed_out',
      stepStatus: 'running',
      updatedAt: 3_000,
    });
    publisher.handleEvent({
      seq: 2,
      at: 3_000,
      phase: 'final',
      lens: timedOut,
    });
    await publisher.flush();

    expect(transport.update).toHaveBeenCalledWith(
      { postId: 'final-1', sentAt: 2_000 },
      expect.objectContaining({
        participantActivity: expect.objectContaining({ state: 'timed_out' }),
      })
    );
    await publisher.stop();
  });

  test('does not create a carrier after the normal final reply exists', async () => {
    const transport = makeTransport();
    const publisher = makePublisher(transport);
    const active = makeLens();

    const initialFinal = publisher.buildFinalProjection(active, 'completed')!;
    publisher.registerFinalReply({
      lens: active,
      sentAt: 2_000,
      story: [{ inline: ['Here is the answer.'] }],
      blob: JSON.stringify(initialFinal),
      participantActivity: initialFinal,
      outcome: 'completed',
    });
    await publisher.flush();

    expect(transport.create).not.toHaveBeenCalled();
    expect(transport.resolve).not.toHaveBeenCalled();
    expect(transport.update).not.toHaveBeenCalled();
    await publisher.stop();
  });

  test('retries a failed shutdown terminal edit before clearing state', async () => {
    const transport = makeTransport();
    const publisher = makePublisher(transport);
    publisher.handleEvent({
      seq: 1,
      at: 1_000,
      phase: 'plan',
      lens: makeLens(),
    });
    await publisher.flush();
    vi.mocked(transport.update)
      .mockRejectedValueOnce(new Error('host echo delayed'))
      .mockResolvedValue(undefined);

    await publisher.stop();

    expect(transport.update).toHaveBeenCalledTimes(2);
    expect(transport.update).toHaveBeenLastCalledWith(
      { postId: 'carrier-1', sentAt: 1_100 },
      expect.objectContaining({
        participantActivity: expect.objectContaining({ state: 'cancelled' }),
      })
    );
  });

  test('terminalizes a create that was already in flight when shutdown began', async () => {
    const transport = makeTransport();
    const pendingCreate = deferred<{ postId: string; sentAt: number }>();
    vi.mocked(transport.create).mockImplementation(() => pendingCreate.promise);
    const publisher = makePublisher(transport);
    publisher.handleEvent({
      seq: 1,
      at: 1_000,
      phase: 'plan',
      lens: makeLens(),
    });
    await vi.waitFor(() => expect(transport.create).toHaveBeenCalledTimes(1));

    const stopping = publisher.stop();
    pendingCreate.resolve({ postId: 'carrier-1', sentAt: 1_100 });
    await stopping;

    expect(transport.create).toHaveBeenCalledTimes(1);
    expect(transport.update).toHaveBeenLastCalledWith(
      { postId: 'carrier-1', sentAt: 1_100 },
      expect.objectContaining({
        story: [{ inline: ['The agent run was cancelled.'] }],
        participantActivity: expect.objectContaining({ state: 'cancelled' }),
      })
    );
  });

  test('coalesces new activity while a failed create is backing off', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const transport = makeTransport();
    vi.mocked(transport.create)
      .mockRejectedValueOnce(new Error('host unavailable'))
      .mockResolvedValue({ postId: 'carrier-1', sentAt: 1_100 });
    const publisher = makePublisher(transport, { retryDelaysMs: [100] });
    const active = makeLens();
    publisher.handleEvent({ seq: 1, at: 1_000, phase: 'plan', lens: active });
    await publisher.flush();
    expect(transport.create).toHaveBeenCalledTimes(1);

    publisher.handleEvent({
      seq: 2,
      at: 2_000,
      phase: 'plan',
      lens: lensWithStep(active, {
        status: 'tool_running',
        stepStatus: 'running',
        title: 'Check the latest records',
        updatedAt: 2_000,
      }),
    });
    await vi.advanceTimersByTimeAsync(99);
    expect(transport.create).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await publisher.flush();
    expect(transport.create).toHaveBeenCalledTimes(2);
    expect(transport.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        participantActivity: expect.objectContaining({
          steps: [
            expect.objectContaining({ title: 'Check the latest records' }),
          ],
        }),
      })
    );
    await publisher.stop();
  });

  test('evicts owner Lens state after initial-create retries are exhausted', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const transport = makeTransport();
    vi.mocked(transport.create).mockRejectedValue(
      new Error('host unavailable')
    );
    const publisher = makePublisher(transport, {
      retryDelaysMs: [],
      retentionMs: 1_000,
    });
    const active = makeLens();
    publisher.handleEvent({ seq: 1, at: 1_000, phase: 'plan', lens: active });
    await publisher.flush();
    expect(transport.create).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    publisher.handleEvent({
      seq: 2,
      at: 2_000,
      phase: 'activity',
      lens: {
        ...active,
        updatedAt: 2_000,
        activity: {
          ...active.activity,
          plan: null,
          items: [],
        },
      },
    });
    await publisher.flush();

    // A retained failed state would accept this planless continuation and try
    // creation again. Eviction makes it ineligible as a new public run.
    expect(transport.create).toHaveBeenCalledTimes(1);
    await publisher.stop();
  });

  test('does not recreate a carrier for a late terminal event after eviction', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const transport = makeTransport();
    const publisher = makePublisher(transport, { retentionMs: 1_000 });
    const active = makeLens();
    publisher.handleEvent({ seq: 1, at: 1_000, phase: 'plan', lens: active });
    await publisher.flush();

    const completed = lensWithStep(active, {
      status: 'completed',
      stepStatus: 'completed',
      updatedAt: 2_000,
    });
    publisher.handleEvent({
      seq: 2,
      at: 2_000,
      phase: 'final',
      lens: completed,
    });
    await publisher.flush();
    expect(transport.create).toHaveBeenCalledTimes(1);
    expect(transport.update).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    publisher.handleEvent({
      seq: 3,
      at: 3_000,
      phase: 'final',
      lens: lensWithStep(active, {
        status: 'completed',
        stepStatus: 'completed',
        title: 'Late duplicate terminal event',
        updatedAt: 3_000,
      }),
    });
    await publisher.flush();

    expect(transport.create).toHaveBeenCalledTimes(1);
    expect(transport.update).toHaveBeenCalledTimes(1);
    await publisher.stop();
  });
});
