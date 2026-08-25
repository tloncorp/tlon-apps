import { A2UI, appendToPostBlob, parsePostBlob } from '@tloncorp/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TlonCronService } from '../cron-telemetry.js';
import {
  notesDeliveryTesting,
  recordDeliveredNote,
} from '../notes-delivery-state.js';
import {
  type AgentOnboardingRunRecord,
  claimAgentOnboardingRun,
  clearAgentOnboardingRunFallbackForTesting,
  getAgentOnboardingClaimOwnerId,
  recordAgentOnboardingRunEnqueued,
  recordAgentOnboardingRunOutcome,
  setAgentOnboardingRunStore,
} from './agent-onboarding-run-store.js';
import {
  agentOnboardingTesting,
  clearAgentOnboardingRuntime,
  drainAgentOnboardingRuntime,
  handleAgentOnboardingCronChanged,
  handleAgentOnboardingMessageSent,
  handleAgentOnboardingRequest,
  parseAgentOnboardingRequest,
  scanAgentOnboardingChannel,
} from './agent-onboarding.js';

const provision = {
  type: 'tlon-agent-provision' as const,
  version: 1 as const,
  provisionId: 'provision-1',
  groupId: '~ten/group',
  purposeId: 'agent-daily-digest',
  purpose: 'A daily digest',
  topics: ['AI', 'Climate'],
  timezone: 'America/New_York',
  scheduleHour: 8,
  scheduleMinute: 30,
  notebookNest: 'notes/~ten/updates',
  notebookTitle: 'Updates',
};

type RequestContext = Parameters<typeof handleAgentOnboardingRequest>[0];

function requestContext(
  overrides: Partial<RequestContext> = {}
): RequestContext {
  return {
    api: { scry: vi.fn() },
    botShip: '~bot',
    channelNest: 'chat/~ten/group/general',
    groupId: provision.groupId,
    ownerShip: '~ten',
    senderShip: '~ten',
    blob: appendToPostBlob(undefined, provision),
    ...overrides,
  };
}

type ScanContext = Parameters<
  typeof agentOnboardingTesting.rememberFirstRun
>[1];

function scanContext(overrides: Partial<ScanContext> = {}): ScanContext {
  return {
    api: { scry: vi.fn() },
    botShip: '~bot',
    channelNest: 'chat/~ten/group/general',
    groupId: provision.groupId,
    ownerShip: '~ten',
    ...overrides,
  };
}

function provisionedGroup(
  overrides: Partial<{
    hostUserId: string;
    channels: Array<{ id: string; type: string }>;
    members: Array<{
      contactId: string;
      status: string;
      roles: string[];
    }>;
  }> = {}
) {
  return {
    hostUserId: '~ten',
    channels: [{ id: provision.notebookNest, type: 'notes' }],
    members: [{ contactId: '~bot', status: 'joined', roles: ['admin'] }],
    ...overrides,
  };
}

function firstGroupIntro(timestamp = 0) {
  return {
    author: '~ten',
    content: "Let's get set up.",
    timestamp,
    blob: appendToPostBlob(undefined, {
      type: 'tlon-agent-intro-request' as const,
      version: 1 as const,
      groupId: provision.groupId,
      isFirstGroup: true,
    }),
  };
}

function botMarker(key: string, timestamp: number) {
  return {
    author: '~bot',
    content: key,
    timestamp,
    blob: appendToPostBlob(undefined, {
      type: 'tlon-agent-post-marker' as const,
      version: 1 as const,
      key,
    }),
  };
}

beforeEach(() => {
  notesDeliveryTesting.clear();
  agentOnboardingTesting.clearAllFirstRunCompletionRetries();
  clearAgentOnboardingRuntime();
  clearAgentOnboardingRunFallbackForTesting();
  setAgentOnboardingRunStore(null);
});

afterEach(() => {
  vi.useRealTimers();
});

function memoryRunStore() {
  const records = new Map<string, AgentOnboardingRunRecord>();
  return {
    register: vi.fn(async (key: string, value: AgentOnboardingRunRecord) => {
      records.set(key, value);
    }),
    registerIfAbsent: vi.fn(
      async (key: string, value: AgentOnboardingRunRecord) => {
        if (records.has(key)) return false;
        records.set(key, value);
        return true;
      }
    ),
    lookup: vi.fn(async (key: string) => records.get(key)),
    consume: vi.fn(async (key: string) => {
      const value = records.get(key);
      records.delete(key);
      return value;
    }),
    delete: vi.fn(async (key: string) => records.delete(key)),
    entries: vi.fn(async () =>
      [...records].map(([key, value]) => ({ key, value, createdAt: 0 }))
    ),
    clear: vi.fn(async () => records.clear()),
  };
}

describe('first-run durable claims', () => {
  const record = (claimOwnerId: string): AgentOnboardingRunRecord => ({
    provisionId: 'provision-1',
    jobId: 'job-1',
    groupId: '~ten/group',
    channelNest: 'chat/~ten/group/general',
    notebookNest: 'notes/~ten/updates',
    notebookName: 'Updates',
    purposeId: 'agent-daily-digest',
    topics: ['AI'],
    claimedAt: 1_000,
    claimOwnerId,
    status: 'claimed',
  });

  it('keeps a fresh claim owned by this process', async () => {
    const store = memoryRunStore();
    setAgentOnboardingRunStore(store);
    const initial = record(getAgentOnboardingClaimOwnerId());
    await store.register(initial.provisionId, initial);
    await expect(claimAgentOnboardingRun(initial, 1_001)).resolves.toEqual({
      outcome: 'owned-by-another-pass',
    });
  });

  it('reclaims a fresh unwitnessed claim left by an earlier process', async () => {
    const store = memoryRunStore();
    setAgentOnboardingRunStore(store);
    await store.register('provision-1', record('previous-process'));
    const initial = {
      ...record(getAgentOnboardingClaimOwnerId()),
      claimedAt: 31_001,
    };

    await expect(claimAgentOnboardingRun(initial, 1_001)).resolves.toEqual({
      outcome: 'enqueue',
    });
    await expect(store.lookup('provision-1')).resolves.toEqual(initial);
  });

  it('elects only one recovery pass for concurrent stale claims', async () => {
    const store = memoryRunStore();
    setAgentOnboardingRunStore(store);
    await store.register('provision-1', record('previous-process'));
    const initial = {
      ...record(getAgentOnboardingClaimOwnerId()),
      claimedAt: 31_001,
    };

    const outcomes = await Promise.all([
      claimAgentOnboardingRun(initial, 31_001),
      claimAgentOnboardingRun(initial, 31_001),
    ]);

    expect(outcomes).toContainEqual({ outcome: 'enqueue' });
    expect(outcomes).toContainEqual({ outcome: 'owned-by-another-pass' });
    expect(store.delete).toHaveBeenCalledOnce();
  });

  it('deduplicates an enqueue when the durable store is unavailable', async () => {
    const initial = record(getAgentOnboardingClaimOwnerId());
    await expect(claimAgentOnboardingRun(initial, 1_000)).resolves.toEqual({
      outcome: 'enqueue',
    });
    await recordAgentOnboardingRunEnqueued(initial, 'run-1', 1_000);

    await expect(
      claimAgentOnboardingRun(initial, 1_001)
    ).resolves.toMatchObject({
      outcome: 'recovered',
      record: { runId: 'run-1', status: 'enqueued' },
    });
  });

  it('attaches an exact completion that arrives before enqueue returns', async () => {
    const initial = record(getAgentOnboardingClaimOwnerId());
    await recordAgentOnboardingRunOutcome('run-1', {
      status: 'ok',
      delivered: true,
      observedAt: 1_001,
    });
    await recordAgentOnboardingRunEnqueued(initial, 'run-1', 1_000);

    await expect(
      claimAgentOnboardingRun(initial, 1_002)
    ).resolves.toMatchObject({
      outcome: 'recovered',
      record: {
        runId: 'run-1',
        outcome: { status: 'ok', delivered: true, observedAt: 1_001 },
      },
    });
  });

  it('waits for an in-flight exact outcome before writing enqueue state', async () => {
    const store = memoryRunStore();
    setAgentOnboardingRunStore(store);
    const initial = record(getAgentOnboardingClaimOwnerId());
    await store.register(initial.provisionId, initial);
    const originalEntries = store.entries.getMockImplementation()!;
    let releaseEntries!: () => void;
    const entriesBarrier = new Promise<void>((resolve) => {
      releaseEntries = resolve;
    });
    store.entries.mockImplementationOnce(async () => {
      await entriesBarrier;
      return originalEntries();
    });

    const outcomeFlight = recordAgentOnboardingRunOutcome('run-1', {
      status: 'ok',
      delivered: true,
      observedAt: 1_001,
    });
    const enqueueFlight = recordAgentOnboardingRunEnqueued(
      initial,
      'run-1',
      1_000
    );
    releaseEntries();
    await Promise.all([outcomeFlight, enqueueFlight]);

    await expect(store.lookup(initial.provisionId)).resolves.toMatchObject({
      runId: 'run-1',
      outcome: { status: 'ok', delivered: true, observedAt: 1_001 },
    });
  });

  it('preserves an exact delivered note id across later cron outcome writes', async () => {
    const store = memoryRunStore();
    setAgentOnboardingRunStore(store);
    const initial = record(getAgentOnboardingClaimOwnerId());
    await store.register(initial.provisionId, {
      ...initial,
      runId: 'run-1',
      status: 'enqueued',
    });

    await Promise.all([
      recordAgentOnboardingRunOutcome('run-1', {
        status: 'ok',
        delivered: true,
        noteId: 42,
        observedAt: 1_001,
      }),
      recordAgentOnboardingRunOutcome('run-1', {
        status: 'ok',
        delivered: true,
        observedAt: 1_002,
      }),
    ]);

    await expect(store.lookup(initial.provisionId)).resolves.toMatchObject({
      outcome: { status: 'ok', delivered: true, noteId: 42 },
    });
  });
});

describe('first-run correlation', () => {
  it('keeps reprovisioned runs distinct and rejects an ambiguous notebook fallback', () => {
    const context = scanContext();
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'run-1' },
      context,
      provision
    );
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'run-2' },
      context,
      { ...provision, provisionId: 'provision-2' }
    );

    expect(
      agentOnboardingTesting.findFirstRunCorrelation(
        undefined,
        provision.notebookNest
      )
    ).toBeNull();
    expect(
      agentOnboardingTesting.findFirstRunCorrelation('run-1', undefined)?.[1]
        .provisionId
    ).toBe(provision.provisionId);
    expect(
      agentOnboardingTesting.findFirstRunCorrelation(
        'unrelated-run',
        undefined,
        'job-1',
        true
      )
    ).toBeNull();
  });
});

describe('agent onboarding requests', () => {
  it('stops a startup reconciliation before reading after abort', async () => {
    const abortController = new AbortController();
    const fetchHistory = vi.fn(async () => []);
    abortController.abort(new Error('monitor stopped'));

    await expect(
      scanAgentOnboardingChannel(
        {
          abortSignal: abortController.signal,
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/general',
          groupId: provision.groupId,
          ownerShip: '~ten',
        },
        { fetchHistory }
      )
    ).rejects.toThrow('monitor stopped');
    expect(fetchHistory).not.toHaveBeenCalled();
  });

  it('does not fetch history for ordinary owner chat', async () => {
    const fetchHistory = vi.fn(async () => {
      throw new Error('history unavailable');
    });
    await expect(
      handleAgentOnboardingRequest(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/general',
          groupId: provision.groupId,
          ownerShip: '~ten',
          senderShip: '~ten',
          rawText: 'How is the weather?',
          blob: null,
        },
        { fetchHistory }
      )
    ).resolves.toBe(false);
    expect(fetchHistory).not.toHaveBeenCalled();
  });
  it('recognizes only canonical typed requests', () => {
    expect(
      parseAgentOnboardingRequest(
        appendToPostBlob(undefined, {
          type: 'tlon-agent-intro-request',
          version: 1,
          groupId: '~ten/group',
        })
      )
    ).toMatchObject({ type: 'tlon-agent-intro-request' });
    expect(
      parseAgentOnboardingRequest(appendToPostBlob(undefined, provision))
    ).toEqual(provision);
    expect(parseAgentOnboardingRequest('not-json')).toBeNull();
  });

  it('keeps the services follow-up action flat', () => {
    const services = agentOnboardingTesting.buildServicesSurface(
      'pitch',
      '~ten/group',
      'provision-1'
    );
    const servicesRoot = services.messages.find(
      (message) => 'updateComponents' in message
    );
    // Providers and connection status belong to the client; the coordinator
    // sends only the bounded menu configuration and its navigation target.
    const servicesComponents =
      servicesRoot && 'updateComponents' in servicesRoot
        ? servicesRoot.updateComponents.components
        : [];
    expect(servicesComponents.find(({ id }) => id === 'root')).toMatchObject({
      id: 'root',
      component: 'Column',
      children: ['pitch', 'providers'],
    });
    const menu = servicesComponents.find(({ id }) => id === 'providers') as
      | A2UI.McpConnect
      | undefined;
    expect(menu).toMatchObject({
      component: 'McpConnect',
      maxVisible: 4,
      seeAllLabel: 'See all connectors',
      submitLabel: 'Use for this group',
      completionLabel: 'Done',
      completionAction: {
        event: { name: A2UI.action.sendMessage, context: { text: 'Done' } },
      },
    });
    expect(menu?.action.event.name).toBe(A2UI.action.navigate);
    expect(menu?.configureAction).toMatchObject({
      event: {
        name: A2UI.action.configureAgentProviders,
        context: {
          groupId: '~ten/group',
          provisionId: 'provision-1',
          providerIds: [],
        },
      },
    });
    expect(servicesComponents.find(({ id }) => id === 'done')).toBeUndefined();
    expect(A2UI.validateBlobEntry(services)).toBe(true);
  });

  it('waits for Done on the services card before offering the app tour', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    const history = [
      firstGroupIntro(),
      botMarker('intro', 0.1),
      botMarker('purpose-picker', 0.2),
      {
        author: '~bot',
        content: 'ready',
        timestamp: 1,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-provision-ack',
          version: 1,
          provisionId: provision.provisionId,
          cronJobId: 'job-1',
        }),
      },
      {
        author: '~bot',
        content: 'Connect anything you’d like, or tap Done to continue.',
        timestamp: 2,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-post-marker',
          version: 1,
          key: 'services-card',
        }),
      },
      { author: '~ten', content: 'Done', timestamp: 3 },
    ];

    await expect(
      handleAgentOnboardingRequest(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/general',
          groupId: provision.groupId,
          ownerShip: '~ten',
          senderShip: '~ten',
          rawText: 'Done',
        },
        { fetchHistory: vi.fn(async () => history), sendPost }
      )
    ).resolves.toBe(true);

    expect(sendPost).toHaveBeenCalledOnce();
    expect(JSON.stringify(sendPost.mock.calls[0]?.[0])).toContain(
      'Want me to tell you more about what you can do here?'
    );
    expect(parsePostBlob(sendPost.mock.calls[0]?.[0].blob)).toContainEqual(
      expect.objectContaining({
        type: 'tlon-agent-post-marker',
        key: 'onboarding-follow-up',
      })
    );
  });

  it('preserves a valid tour reply when a newer freeform message follows it', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    const history = [
      firstGroupIntro(),
      botMarker('intro', 0.1),
      botMarker('purpose-picker', 0.2),
      {
        author: '~bot',
        content: 'ready',
        timestamp: 1,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-provision-ack',
          version: 1,
          provisionId: provision.provisionId,
          cronJobId: 'job-1',
        }),
      },
      botMarker('onboarding-follow-up', 2),
      { author: '~ten', content: 'Yes', timestamp: 3 },
      { author: '~ten', content: 'What happens next?', timestamp: 4 },
    ];

    await expect(
      scanAgentOnboardingChannel(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/general',
          groupId: provision.groupId,
          ownerShip: '~ten',
        },
        { fetchHistory: vi.fn(async () => history), sendPost }
      )
    ).resolves.toBe(true);

    expect(sendPost).toHaveBeenCalledOnce();
    expect(parsePostBlob(sendPost.mock.calls[0]?.[0].blob)).toContainEqual(
      expect.objectContaining({
        type: 'tlon-agent-post-marker',
        key: 'bot-tour-offer',
      })
    );
  });

  it('loads extended history when an old orientation card is answered', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    const history = [
      firstGroupIntro(),
      {
        author: '~bot',
        content: 'ready',
        timestamp: 1,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-provision-ack',
          version: 1,
          provisionId: provision.provisionId,
          cronJobId: 'job-1',
        }),
      },
      botMarker('onboarding-follow-up', 2),
      { author: '~ten', content: 'Yes', timestamp: 100 },
    ];
    const fetchHistory = vi.fn(
      async (_api: unknown, _nest: string, count: number) =>
        count === 500 ? history : history.slice(-1)
    );

    await expect(
      handleAgentOnboardingRequest(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/general',
          groupId: provision.groupId,
          ownerShip: '~ten',
          senderShip: '~ten',
          rawText: 'Yes',
        },
        { fetchHistory, sendPost }
      )
    ).resolves.toBe(true);

    expect(fetchHistory).toHaveBeenCalledWith(
      expect.anything(),
      'chat/~ten/general',
      500
    );
    expect(sendPost).toHaveBeenCalledOnce();
    expect(parsePostBlob(sendPost.mock.calls[0]?.[0].blob)).toContainEqual(
      expect.objectContaining({
        type: 'tlon-agent-post-marker',
        key: 'bot-tour-offer',
      })
    );
  });

  it('loads extended history when an old purpose picker is answered', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    const history = [
      firstGroupIntro(),
      botMarker('intro', 0.1),
      botMarker('purpose-picker', 0.2),
      { author: '~ten', content: 'A daily digest', timestamp: 100 },
    ];
    const fetchHistory = vi.fn(
      async (_api: unknown, _nest: string, count: number) =>
        count === 500 ? history : history.slice(-1)
    );

    await expect(
      handleAgentOnboardingRequest(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/general',
          groupId: provision.groupId,
          ownerShip: '~ten',
          senderShip: '~ten',
          rawText: 'A daily digest',
        },
        { fetchHistory, sendPost }
      )
    ).resolves.toBe(true);

    expect(fetchHistory).toHaveBeenCalledWith(
      expect.anything(),
      'chat/~ten/general',
      500
    );
    expect(parsePostBlob(sendPost.mock.calls[0]?.[0].blob)).toContainEqual(
      expect.objectContaining({
        type: 'tlon-agent-post-marker',
        key: 'topics-picker',
      })
    );
  });

  it('recovers a durable services completion after a plugin restart', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    const history = [
      firstGroupIntro(),
      botMarker('intro', 0.1),
      botMarker('purpose-picker', 0.2),
      {
        author: '~bot',
        content: 'ready',
        timestamp: 1,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-provision-ack',
          version: 1,
          provisionId: provision.provisionId,
          cronJobId: 'job-1',
        }),
      },
      {
        author: '~bot',
        content: 'Connect anything you’d like, or tap Done to continue.',
        timestamp: 2,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-post-marker',
          version: 1,
          key: 'services-card',
        }),
      },
      { author: '~ten', content: 'Done', timestamp: 3 },
    ];

    await expect(
      scanAgentOnboardingChannel(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/general',
          groupId: provision.groupId,
          ownerShip: '~ten',
        },
        { fetchHistory: vi.fn(async () => history), sendPost }
      )
    ).resolves.toBe(true);

    expect(sendPost).toHaveBeenCalledOnce();
    expect(JSON.stringify(sendPost.mock.calls[0]?.[0])).toContain(
      'Want me to tell you more about what you can do here?'
    );
  });

  it('restores an enqueued run after its request leaves bounded history', async () => {
    const store = memoryRunStore();
    setAgentOnboardingRunStore(store);
    await store.register(provision.provisionId, {
      provisionId: provision.provisionId,
      jobId: 'job-1',
      runId: 'run-outside-history',
      groupId: provision.groupId,
      channelNest: 'chat/~ten/general',
      notebookNest: provision.notebookNest,
      notebookName: 'Updates',
      purposeId: provision.purposeId,
      topics: [...provision.topics],
      provision,
      claimedAt: 1,
      enqueuedAt: 1,
      status: 'enqueued',
    });

    await expect(
      scanAgentOnboardingChannel(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/general',
          groupId: provision.groupId,
          ownerShip: '~ten',
        },
        {
          fetchHistory: vi.fn(async () => []),
          getCron: () => ({}) as TlonCronService,
        }
      )
    ).resolves.toBe(true);

    expect(
      agentOnboardingTesting.findFirstRunCorrelation('run-outside-history')
    ).not.toBeNull();
  });

  it('ends an additional group setup after services without onboarding tours', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    const trackStep = vi.fn();
    const history = [
      {
        author: '~ten',
        content: "Let's get set up.",
        timestamp: 0,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-intro-request',
          version: 1,
          groupId: provision.groupId,
        }),
      },
      botMarker('purpose-picker', 0.5),
      {
        author: '~bot',
        content: 'ready',
        timestamp: 1,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-provision-ack',
          version: 1,
          provisionId: provision.provisionId,
          cronJobId: 'job-1',
        }),
      },
      {
        author: '~bot',
        content: 'Connect anything you’d like, or tap Done to continue.',
        timestamp: 2,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-post-marker',
          version: 1,
          key: 'services-card',
        }),
      },
      { author: '~ten', content: 'Done', timestamp: 3 },
    ];

    await expect(
      scanAgentOnboardingChannel(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/general',
          groupId: provision.groupId,
          ownerShip: '~ten',
          trackStep,
        },
        { fetchHistory: vi.fn(async () => history), sendPost }
      )
    ).resolves.toBe(true);

    expect(sendPost).toHaveBeenCalledOnce();
    expect(JSON.stringify(sendPost.mock.calls[0]?.[0])).toContain(
      'All set. Ask me here anytime'
    );
    expect(JSON.stringify(sendPost.mock.calls[0]?.[0])).not.toContain(
      'what you can do here'
    );
    expect(parsePostBlob(sendPost.mock.calls[0]?.[0].blob)).toContainEqual(
      expect.objectContaining({
        type: 'tlon-agent-post-marker',
        key: 'group-setup-complete',
      })
    );
    expect(trackStep).toHaveBeenCalledWith({
      step: 'onboarding_completed',
      completionPath: 'additional_group_completed',
    });
  });

  it('offers each orientation step as a simple Yes/No choice', () => {
    const surface = agentOnboardingTesting.buildTourChoiceSurface(
      'agent-onboarding-app-tour:~ten/group',
      'Want a quick tour?'
    );
    expect(A2UI.validateBlobEntry(surface)).toBe(true);
    const update = surface.messages.find(
      (message) => 'updateComponents' in message
    );
    const components =
      update && 'updateComponents' in update
        ? update.updateComponents.components
        : [];
    expect(components.find(({ id }) => id === 'prompt')).toMatchObject({
      component: 'Text',
      text: 'Want a quick tour?',
    });
    const choice = components.find(
      (component): component is A2UI.Choice => component.component === 'Choice'
    );
    expect(choice?.options.map((option) => option.action.event)).toEqual([
      { name: A2UI.action.sendMessage, context: { text: 'Yes' } },
      { name: A2UI.action.sendMessage, context: { text: 'No' } },
    ]);
  });

  it('runs the post-setup tours in order and only after each Yes', async () => {
    const sent: Array<{ story: unknown; blob?: string }> = [];
    const sendPost = vi.fn(async (post: { story: unknown; blob?: string }) => {
      sent.push(post);
      return { channel: 'tlon' as const, messageId: 'post', sentAt: 0 };
    });
    const trackStep = vi.fn();
    const history = [
      firstGroupIntro(),
      {
        author: '~bot',
        content: 'ready',
        timestamp: 1,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-provision-ack',
          version: 1,
          provisionId: provision.provisionId,
          cronJobId: 'job-1',
        }),
      },
      {
        author: '~bot',
        content: 'Want me to tell you more about what you can do here?',
        timestamp: 2,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-post-marker',
          version: 1,
          key: 'onboarding-follow-up',
        }),
      },
      { author: '~ten', content: 'Yes', timestamp: 3 },
    ];
    const context = {
      api: { scry: vi.fn() },
      botShip: '~bot',
      channelNest: 'chat/~ten/general',
      groupId: provision.groupId,
      ownerShip: '~ten',
      senderShip: '~ten',
      trackStep,
    };

    await expect(
      handleAgentOnboardingRequest(
        { ...context, rawText: 'Yes' },
        { fetchHistory: vi.fn(async () => history), sendPost }
      )
    ).resolves.toBe(true);
    expect(sent).toHaveLength(1);
    expect(JSON.stringify(sent[0])).toContain('Tlon is organized into groups');
    expect(JSON.stringify(sent[0])).toContain(
      'Want me to tell you more about what Tlonbot can do for you?'
    );
    expect(parsePostBlob(sent[0]!.blob)).toContainEqual(
      expect.objectContaining({
        type: 'tlon-agent-post-marker',
        key: 'bot-tour-offer',
      })
    );
    expect(trackStep).toHaveBeenCalledWith({
      step: 'app_tour_answered',
      answer: 'yes',
    });
    trackStep.mockClear();

    history.push(
      {
        author: '~bot',
        content: 'bot tour',
        timestamp: 4,
        blob: sent[0]!.blob,
      },
      { author: '~ten', content: 'Yes', timestamp: 5 }
    );
    await expect(
      handleAgentOnboardingRequest(
        { ...context, rawText: 'Yes' },
        { fetchHistory: vi.fn(async () => history), sendPost }
      )
    ).resolves.toBe(true);
    expect(sent).toHaveLength(2);
    expect(JSON.stringify(sent[1])).toContain(
      'Try asking me to adjust tomorrow’s update or investigate something now.'
    );
    expect(parsePostBlob(sent[1]!.blob)).toContainEqual(
      expect.objectContaining({
        type: 'tlon-agent-post-marker',
        key: 'orientation-complete',
      })
    );
    expect(trackStep.mock.calls).toEqual([
      [{ step: 'bot_tour_answered', answer: 'yes' }],
      [
        {
          step: 'onboarding_completed',
          completionPath: 'bot_tour_completed',
        },
      ],
    ]);
  });

  it('ends the optional tour cleanly after No', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    const trackStep = vi.fn();
    const history = [
      firstGroupIntro(),
      {
        author: '~bot',
        content: 'ready',
        timestamp: 1,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-provision-ack',
          version: 1,
          provisionId: provision.provisionId,
          cronJobId: 'job-1',
        }),
      },
      {
        author: '~bot',
        content: 'Want me to tell you more about what you can do here?',
        timestamp: 2,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-post-marker',
          version: 1,
          key: 'onboarding-follow-up',
        }),
      },
      { author: '~ten', content: 'No', timestamp: 3 },
    ];

    await expect(
      handleAgentOnboardingRequest(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/general',
          groupId: provision.groupId,
          ownerShip: '~ten',
          senderShip: '~ten',
          rawText: 'No',
          trackStep,
        },
        { fetchHistory: vi.fn(async () => history), sendPost }
      )
    ).resolves.toBe(true);
    expect(sendPost).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(sendPost.mock.calls[0]?.[0])).toContain(
      'You can ask me anytime'
    );
    expect(JSON.stringify(sendPost.mock.calls[0]?.[0])).not.toContain(
      'what Tlonbot can do'
    );
    expect(trackStep.mock.calls).toEqual([
      [{ step: 'app_tour_answered', answer: 'no' }],
      [
        {
          step: 'onboarding_completed',
          completionPath: 'app_tour_declined',
        },
      ],
    ]);
  });

  it('tracks declining the Tlonbot tour as a distinct completion path', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    const trackStep = vi.fn();
    const history = [
      firstGroupIntro(),
      {
        author: '~bot',
        content: 'ready',
        timestamp: 1,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-provision-ack' as const,
          version: 1 as const,
          provisionId: provision.provisionId,
          cronJobId: 'job-1',
        }),
      },
      botMarker('bot-tour-offer', 2),
      { author: '~ten', content: 'No', timestamp: 3 },
    ];

    await expect(
      handleAgentOnboardingRequest(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/general',
          groupId: provision.groupId,
          ownerShip: '~ten',
          senderShip: '~ten',
          rawText: 'No',
          trackStep,
        },
        { fetchHistory: vi.fn(async () => history), sendPost }
      )
    ).resolves.toBe(true);

    expect(trackStep.mock.calls).toEqual([
      [{ step: 'bot_tour_answered', answer: 'no' }],
      [
        {
          step: 'onboarding_completed',
          completionPath: 'bot_tour_declined',
        },
      ],
    ]);
  });

  it('catches an intro request that arrived before the channel was watched', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    const introBlob = appendToPostBlob(undefined, {
      type: 'tlon-agent-intro-request',
      version: 1,
      groupId: '~ten/group',
      isFirstGroup: true,
    });

    await expect(
      scanAgentOnboardingChannel(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/general',
          groupId: '~ten/group',
          ownerShip: '~ten',
        },
        {
          fetchHistory: vi.fn(async () => [
            {
              author: '~ten',
              content: "Let's get set up.",
              timestamp: 1,
              blob: introBlob,
            },
          ]),
          sendPost,
        }
      )
    ).resolves.toBe(true);
    expect(sendPost).toHaveBeenCalledTimes(2);
  });

  it('describes only the provisioned home group as the first group', async () => {
    const promptFor = async (isFirstGroup?: boolean) => {
      clearAgentOnboardingRuntime();
      const sent: Array<{ blob?: string; story?: unknown }> = [];
      const introBlob = appendToPostBlob(undefined, {
        type: 'tlon-agent-intro-request',
        version: 1,
        groupId: '~ten/group',
        ...(isFirstGroup ? { isFirstGroup: true } : {}),
      });

      await handleAgentOnboardingRequest(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/general',
          groupId: '~ten/group',
          ownerShip: '~ten',
          senderShip: '~ten',
          blob: introBlob,
        },
        {
          fetchHistory: vi.fn(async () => [
            {
              author: '~ten',
              content: "Let's get set up.",
              timestamp: 1,
              blob: introBlob,
            },
          ]),
          sleep: vi.fn(async () => {}),
          sendPost: vi.fn(async (post: { blob?: string }) => {
            sent.push(post);
            return { channel: 'tlon' as const, messageId: 'post', sentAt: 0 };
          }),
        }
      );

      return sent;
    };

    const firstGroup = await promptFor(true);
    expect(firstGroup).toHaveLength(2);
    expect(JSON.stringify(firstGroup[0]?.story)).toContain(
      'I can keep you informed, help you learn, or follow a question over time.'
    );
    expect(JSON.stringify(parsePostBlob(firstGroup[1]?.blob))).toContain(
      'What can I help you with?'
    );

    const additionalGroup = await promptFor();
    expect(additionalGroup).toHaveLength(1);
    expect(JSON.stringify(parsePostBlob(additionalGroup[0]?.blob))).toContain(
      'What can I help you with?'
    );
  });

  it('recognizes an unmarked legacy intro without suppressing other steps', () => {
    const history = [
      {
        author: '~bot',
        content:
          "I'm your Tlonbot. I can go off and do things — look things up, " +
          'keep track of what changes, and write it down for you.',
        timestamp: 1,
      },
    ];

    expect(agentOnboardingTesting.hasPostMarker(history, '~bot', 'intro')).toBe(
      true
    );
    expect(
      agentOnboardingTesting.hasPostMarker(history, '~bot', 'purpose-picker')
    ).toBe(false);
    expect(
      agentOnboardingTesting.hasPostMarker(history, '~other', 'intro')
    ).toBe(false);
  });

  it('posts each picker as a durable channel message', async () => {
    const sent: Array<{ story: unknown; blob?: string }> = [];
    const sendPost = vi.fn(async (post: { story: unknown; blob?: string }) => {
      sent.push(post);
      return { channel: 'tlon' as const, messageId: 'post', sentAt: 0 };
    });
    const base = {
      api: { scry: vi.fn() },
      botShip: '~bot',
      channelNest: 'chat/~ten/general',
      groupId: '~ten/group',
      ownerShip: '~ten',
      senderShip: '~ten',
    };
    const history: Array<{
      author: string;
      content: string;
      timestamp: number;
      blob?: string;
    }> = [
      {
        author: '~ten',
        content: "Let's get set up.",
        timestamp: 1,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-intro-request',
          version: 1,
          groupId: '~ten/group',
          isFirstGroup: true,
        }),
      },
    ];

    await handleAgentOnboardingRequest(
      { ...base, blob: history[0].blob },
      { fetchHistory: vi.fn(async () => history), sendPost }
    );
    expect(sent).toHaveLength(2);
    expect(JSON.stringify(parsePostBlob(sent[1].blob))).not.toContain(
      'the cards are only starts'
    );
    history.push(
      {
        author: '~bot',
        content: 'intro',
        timestamp: 2,
        blob: sent[0].blob,
      },
      {
        author: '~bot',
        content: 'purpose',
        timestamp: 3,
        blob: sent[1].blob,
      },
      {
        author: '~ten',
        content: 'A daily digest',
        timestamp: 4,
      }
    );

    await handleAgentOnboardingRequest(
      { ...base, rawText: 'A daily digest', blob: undefined },
      { fetchHistory: vi.fn(async () => history), sendPost }
    );
    expect(sent).toHaveLength(3);
    const topicsA2UI = parsePostBlob(sent[2].blob).find(
      (entry) => entry.type === 'a2ui'
    );
    expect(topicsA2UI).toMatchObject({ storyMode: 'fallback' });
    expect(JSON.stringify(topicsA2UI)).toContain(
      'What should I keep an eye on?'
    );
    expect(JSON.stringify(topicsA2UI)).not.toContain(
      'tell me here in the chat'
    );
    expect(JSON.stringify(topicsA2UI)).toContain('tlon.provisionAgent');
    history.push(
      {
        author: '~bot',
        content: 'topics',
        timestamp: 5,
        blob: sent[2].blob,
      },
      {
        author: '~ten',
        content: 'Open hardware, Space weather',
        timestamp: 6,
      }
    );

    await handleAgentOnboardingRequest(
      {
        ...base,
        rawText: 'Open hardware, Space weather',
        blob: undefined,
      },
      { fetchHistory: vi.fn(async () => history), sendPost }
    );
    // Topic confirmation is a client-owned provision action because only the
    // client knows the device timezone. A raw-text recovery must never revive
    // the retired timezone prompt or button.
    expect(sent).toHaveLength(3);
    expect(JSON.stringify(sent)).not.toContain('timezone-picker');
    expect(JSON.stringify(sent)).not.toContain('Use my current timezone');
    expect(JSON.stringify(sent)).not.toContain('One last detail');
  });

  it('shows thinking and paces consecutive onboarding messages', async () => {
    let now = 0;
    const events: string[] = [];
    const introBlob = appendToPostBlob(undefined, {
      type: 'tlon-agent-intro-request',
      version: 1,
      groupId: '~ten/group',
      isFirstGroup: true,
    });
    const sendPost = vi.fn(async ({ blob }: { blob?: string }) => {
      const marker = parsePostBlob(blob).find(
        (entry) => entry.type === 'tlon-agent-post-marker'
      );
      events.push(
        `post:${marker?.type === 'tlon-agent-post-marker' ? marker.key : 'unknown'}`
      );
      return { channel: 'tlon' as const, messageId: 'post', sentAt: now };
    });

    await handleAgentOnboardingRequest(
      {
        api: { scry: vi.fn() },
        botShip: '~bot',
        channelNest: 'chat/~ten/general',
        groupId: '~ten/group',
        ownerShip: '~ten',
        senderShip: '~ten',
        blob: introBlob,
        presentation: {
          startThinking: () => events.push('thinking:start'),
          stopThinking: () => events.push('thinking:stop'),
        },
      },
      {
        fetchHistory: vi.fn(async () => [
          {
            author: '~ten',
            content: "Let's get set up.",
            timestamp: 1,
            blob: introBlob,
          },
        ]),
        now: () => now,
        // Fixed at the midpoint so jitter resolves to 1x and the delays are
        // reproducible; the jitter range itself is asserted below.
        random: () => 0.5,
        sleep: vi.fn(async (ms) => {
          events.push(`sleep:${ms}`);
          now += ms;
        }),
        sendPost,
      }
    );

    // Presence must bracket the whole sequence — a pause with no indicator
    // reads as the app hanging rather than the bot thinking.
    expect(events[0]).toBe('thinking:start');
    expect(events.at(-1)).toBe('thinking:stop');
    expect(events.filter((e) => e.startsWith('post:'))).toEqual([
      'post:intro',
      'post:purpose-picker',
    ]);

    // Every post is preceded by a pause, and the pause is composed rather than
    // a flat floor: it scales with the message and stays inside the clamp.
    const sleeps = events
      .filter((e) => e.startsWith('sleep:'))
      .map((e) => Number(e.slice('sleep:'.length)));
    expect(sleeps).toHaveLength(2);
    expect(sleeps[0]).toBeGreaterThanOrEqual(2_000);
    expect(sleeps[1]).toBeGreaterThanOrEqual(1_750);
    for (const ms of sleeps) {
      expect(ms).toBeGreaterThanOrEqual(800);
      expect(ms).toBeLessThanOrEqual(3500);
    }
    expect(new Set(sleeps).size).toBeGreaterThan(1);
  });

  it('jitters pacing so the rhythm is not metronomic', async () => {
    const delaysFor = async (random: () => number) => {
      clearAgentOnboardingRuntime();
      const sleeps: number[] = [];
      let now = 0;
      const introBlob = appendToPostBlob(undefined, {
        type: 'tlon-agent-intro-request',
        version: 1,
        groupId: '~ten/group',
        isFirstGroup: true,
      });
      await handleAgentOnboardingRequest(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/general',
          groupId: '~ten/group',
          ownerShip: '~ten',
          senderShip: '~ten',
          blob: introBlob,
          presentation: {
            startThinking: () => {},
            stopThinking: () => {},
          },
        },
        {
          fetchHistory: vi.fn(async () => []),
          now: () => now,
          random,
          sleep: vi.fn(async (ms) => {
            sleeps.push(ms);
            now += ms;
          }),
          sendPost: vi.fn(async () => ({
            channel: 'tlon' as const,
            messageId: 'post',
            sentAt: now,
          })),
        }
      );
      return sleeps;
    };

    const low = await delaysFor(() => 0);
    const mid = await delaysFor(() => 0.5);
    const high = await delaysFor(() => 1);

    // ±20% around the composed delay, so two consecutive setups never share a
    // rhythm — and the clamp still holds at both extremes.
    expect(low[0]).toBeLessThan(mid[0]!);
    expect(high[0]).toBeGreaterThan(mid[0]!);
    expect(low[0]).toBeGreaterThanOrEqual(Math.round(mid[0]! * 0.8) - 1);
    expect(high[0]).toBeLessThanOrEqual(Math.round(mid[0]! * 1.2) + 1);
  });

  it('always clears thinking presence when an onboarding post fails', async () => {
    const introBlob = appendToPostBlob(undefined, {
      type: 'tlon-agent-intro-request',
      version: 1,
      groupId: '~ten/group',
      isFirstGroup: true,
    });
    const startThinking = vi.fn();
    const stopThinking = vi.fn();

    await expect(
      handleAgentOnboardingRequest(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/general',
          groupId: '~ten/group',
          ownerShip: '~ten',
          senderShip: '~ten',
          blob: introBlob,
          presentation: {
            startThinking,
            stopThinking,
            minResponseDelayMs: 0,
          },
        },
        {
          fetchHistory: vi.fn(async () => [
            {
              author: '~ten',
              content: "Let's get set up.",
              timestamp: 1,
              blob: introBlob,
            },
          ]),
          sendPost: vi.fn(async () => {
            throw new Error('send failed');
          }),
        }
      )
    ).rejects.toThrow('send failed');
    expect(startThinking).toHaveBeenCalledOnce();
    expect(stopThinking).toHaveBeenCalledOnce();
  });

  it('always clears thinking presence when initial cron setup fails', async () => {
    const startThinking = vi.fn();
    const stopThinking = vi.fn();
    const cron = {
      list: vi.fn(async () => {
        throw new Error('cron unavailable');
      }),
    } as unknown as TlonCronService;

    await expect(
      handleAgentOnboardingRequest(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/group/general',
          groupId: provision.groupId,
          ownerShip: '~ten',
          senderShip: '~ten',
          blob: appendToPostBlob(undefined, provision),
          presentation: {
            startThinking,
            stopThinking,
            minResponseDelayMs: 0,
          },
        },
        {
          fetchHistory: vi.fn(async () => []),
          getCron: () => cron,
          getGroup: vi.fn(async () => ({
            hostUserId: '~ten',
            channels: [
              { id: provision.notebookNest, type: 'notes', title: 'Updates' },
            ],
            members: [
              {
                contactId: '~bot',
                status: 'joined',
                roles: ['admin'],
              },
            ],
          })),
        }
      )
    ).rejects.toThrow('cron unavailable');
    expect(startThinking).toHaveBeenCalledOnce();
    expect(stopThinking).toHaveBeenCalledOnce();
  });

  it('consumes picker replies from production-shaped history before model dispatch', async () => {
    const sent: Array<{ story: unknown; blob?: string }> = [];
    const sendPost = vi.fn(async (post: { story: unknown; blob?: string }) => {
      sent.push(post);
      return { channel: 'tlon' as const, messageId: 'post', sentAt: 0 };
    });
    const introBlob = appendToPostBlob(undefined, {
      type: 'tlon-agent-intro-request',
      version: 1,
      groupId: '~ten/group',
      isFirstGroup: true,
    });
    const base = {
      api: { scry: vi.fn() },
      botShip: '~bot',
      botProfile: { nickname: "Napdet's Tlonbot", avatar: '' },
      channelNest: 'chat/~ten/general',
      groupId: '~ten/group',
      ownerShip: '~ten',
      senderShip: '~ten',
    };

    await handleAgentOnboardingRequest(
      { ...base, blob: introBlob },
      {
        fetchHistory: vi.fn(async () => [
          {
            author: '~ten',
            content: "Let's get set up.",
            timestamp: 1,
            blob: introBlob,
          },
        ]),
        sendPost,
      }
    );

    base.api.scry.mockResolvedValue({
      posts: {
        intro: {
          seal: { id: 'intro' },
          essay: {
            author: {
              ship: '~bot',
              nickname: "Napdet's Tlonbot",
              avatar: '',
            },
            sent: 2,
            content: [{ inline: ['intro'] }],
            blob: sent[0].blob,
          },
        },
        purpose: {
          seal: { id: 'purpose' },
          essay: {
            author: {
              ship: '~bot',
              nickname: "Napdet's Tlonbot",
              avatar: '',
            },
            sent: 3,
            content: [{ inline: ['What would be useful for this group?'] }],
            blob: sent[1].blob,
          },
        },
        reply: {
          seal: { id: 'reply' },
          essay: {
            author: '~ten',
            sent: 4,
            content: [{ inline: ['A daily digest'] }],
          },
        },
      },
    });

    await expect(
      handleAgentOnboardingRequest(
        {
          ...base,
          rawText: 'A daily digest',
          blob: undefined,
        },
        { sendPost }
      )
    ).resolves.toBe(true);
    expect(sent).toHaveLength(3);
    expect(JSON.stringify(parsePostBlob(sent[2].blob))).toContain(
      'tlon.provisionAgent'
    );
  });

  it.each([
    ['A daily digest', 'A daily digest—great', 'What should I keep an eye on?'],
    ['Learn something', 'Great', 'What would you like to understand better?'],
    ['Research', 'Got it', 'What question or field should I follow closely?'],
  ])('uses purpose-specific topic copy for %s', (reply, detail, question) => {
    const purpose = agentOnboardingTesting.purposeForReply(reply);
    expect(purpose?.topicsPrompt).toContain(detail);
    expect(purpose?.topicsPrompt).toContain(question);
  });

  it('leaves unsupported free-text purpose replies to ordinary chat', () => {
    expect(
      agentOnboardingTesting.purposeForReply('Invent a different workflow')
    ).toBeNull();
    expect(
      agentOnboardingTesting.purposePickerFallbackText('Choose')
    ).not.toContain('or just tell me');
  });

  it.each([
    ['agent-daily-digest', 'write a fresh digest in Field notes'],
    ['agent-learning', 'write one useful idea in Field notes'],
    [
      'agent-research',
      'write a source-backed update in Field notes, this group’s notebook',
    ],
  ])('explains the ongoing cadence for %s', (purposeId, expectation) => {
    // Every variant has to name the notebook it writes into. "Publish", and
    // worse "publish here", read as chat — an owner watched a notebook appear
    // in the sidebar having never been told it existed.
    const cadence = agentOnboardingTesting.provisionCadence(
      purposeId,
      'Field notes'
    );
    expect(cadence).toContain(expectation);
    expect(cadence).toContain('notebook');
    expect(cadence).not.toContain('publish');
  });

  it('explains learning rotation without promising an unverified next topic', () => {
    const cadence = agentOnboardingTesting.provisionCadence(
      'agent-learning',
      'Updates'
    );
    expect(cadence).toContain('rotating through your topics');
    expect(cadence).not.toContain('Music theory first');
    expect(cadence).not.toContain('then Architecture');
  });

  it('derives the notebook name the sidebar shows', () => {
    expect(
      agentOnboardingTesting.notebookDisplayName('notes/~zod/daily-digest')
    ).toBe('Daily digest');
    expect(
      agentOnboardingTesting.notebookDisplayName('notes/~zod/updates')
    ).toBe('Updates');
  });

  it.each([['agent-daily-digest'], ['agent-learning'], ['agent-research']])(
    'pitches services by benefit, not mechanism, for %s',
    (purposeId) => {
      // The old copy named calendars/docs/notes and no reason to connect them,
      // and read identically whichever purpose the owner picked.
      const pitch = agentOnboardingTesting.servicesPitch(purposeId);
      expect(pitch).toMatch(/^Connect your/);
      expect(pitch).not.toContain('to give me more to work with');
    }
  );

  it('describes the recurring schedule after the forced first entry', () => {
    expect(
      agentOnboardingTesting.scheduleConfirmation({
        scheduleHour: 8,
        scheduleMinute: 0,
        timezone: 'America/New_York',
      } as never)
    ).toBe('After this first entry, new ones arrive at 8:00 AM.');
    expect(
      agentOnboardingTesting.scheduleConfirmation({
        scheduleHour: 0,
        scheduleMinute: 5,
        timezone: 'Asia/Tokyo',
      } as never)
    ).toBe('After this first entry, new ones arrive at 12:05 AM.');
  });
});

describe('primary onboarding cron slot', () => {
  function cronHarness(initial: Record<string, unknown>[] = []) {
    let jobs = initial.map((job) => ({ ...job }));
    const cron = {
      list: vi.fn(async () => jobs),
      add: vi.fn(async (input) => {
        jobs.push({ id: 'job-1', ...input });
      }),
      update: vi.fn(async (id, patch) => {
        jobs = jobs.map((job) => (job.id === id ? { ...job, ...patch } : job));
      }),
      remove: vi.fn(),
    } as unknown as TlonCronService;
    return { cron, getJobs: () => jobs };
  }

  it('rejects a live provision superseded in durable history', async () => {
    const getCron = vi.fn();
    const newerProvision = {
      ...provision,
      provisionId: 'provision-2',
      topics: ['Robotics'],
    };
    await expect(
      handleAgentOnboardingRequest(requestContext(), {
        fetchHistory: vi.fn(async () => [
          {
            author: '~ten',
            content: 'AI, Climate',
            timestamp: 1,
            blob: appendToPostBlob(undefined, provision),
          },
          {
            author: '~ten',
            content: 'Robotics',
            timestamp: 2,
            blob: appendToPostBlob(undefined, newerProvision),
          },
        ]),
        getCron,
      })
    ).resolves.toBe(true);

    expect(getCron).not.toHaveBeenCalled();
  });

  it('adds, verifies, and then no-ops the stable group slot', async () => {
    const harness = cronHarness();
    await expect(
      agentOnboardingTesting.upsertPrimaryJob(
        harness.cron,
        provision,
        'chat/~ten/group/general'
      )
    ).resolves.toBe('job-1');
    expect(harness.cron.add).toHaveBeenCalledOnce();

    await agentOnboardingTesting.upsertPrimaryJob(
      harness.cron,
      provision,
      'chat/~ten/group/general'
    );
    expect(harness.cron.add).toHaveBeenCalledOnce();
    expect(harness.cron.update).not.toHaveBeenCalled();
    expect(harness.getJobs()[0].description).toBe(
      'tlon-agent-primary:~ten/group'
    );
  });

  it('serializes concurrent creation of the stable group slot', async () => {
    const harness = cronHarness();

    await Promise.all([
      agentOnboardingTesting.upsertPrimaryJob(
        harness.cron,
        provision,
        'chat/~ten/group/general'
      ),
      agentOnboardingTesting.upsertPrimaryJob(
        harness.cron,
        provision,
        'chat/~ten/group/general'
      ),
    ]);

    expect(harness.cron.add).toHaveBeenCalledOnce();
    expect(harness.getJobs()).toHaveLength(1);
  });

  it('serializes distinct provider updates without dropping the newest one', async () => {
    const harness = cronHarness();
    await agentOnboardingTesting.upsertPrimaryJob(
      harness.cron,
      provision,
      'chat/~ten/group/general'
    );

    await Promise.all([
      agentOnboardingTesting.upsertPrimaryJob(
        harness.cron,
        provision,
        'chat/~ten/group/general',
        ['gmail']
      ),
      agentOnboardingTesting.upsertPrimaryJob(
        harness.cron,
        provision,
        'chat/~ten/group/general',
        ['notion']
      ),
    ]);

    expect(harness.cron.update).toHaveBeenCalledTimes(2);
    expect(harness.getJobs()[0]).toMatchObject({
      payload: { message: expect.stringContaining('["notion"]') },
    });
  });

  it('accepts the runtime text alias when verifying an existing slot', async () => {
    const initial = cronHarness();
    await agentOnboardingTesting.upsertPrimaryJob(
      initial.cron,
      provision,
      'chat/~ten/group/general'
    );
    const job = initial.getJobs()[0] as Record<string, unknown> & {
      payload: { message: string };
    };
    const runtime = cronHarness([
      {
        ...job,
        payload: {
          ...job.payload,
          text: job.payload.message,
          message: undefined,
        },
      },
    ]);

    await agentOnboardingTesting.upsertPrimaryJob(
      runtime.cron,
      provision,
      'chat/~ten/group/general'
    );
    expect(runtime.cron.update).not.toHaveBeenCalled();
  });

  it('updates the same slot when the plan changes', async () => {
    const harness = cronHarness();
    await agentOnboardingTesting.upsertPrimaryJob(
      harness.cron,
      provision,
      'chat/~ten/group/general'
    );
    await agentOnboardingTesting.upsertPrimaryJob(
      harness.cron,
      {
        ...provision,
        provisionId: 'provision-2',
        topics: ['Robotics'],
      },
      'chat/~ten/group/general'
    );
    expect(harness.cron.update).toHaveBeenCalledOnce();
    expect(harness.getJobs()).toHaveLength(1);
    expect(harness.getJobs()[0].name).toContain('Robotics');
  });

  it('keeps the recurring prompt useful without granting Tlon access', () => {
    const prompt = agentOnboardingTesting.buildRecurringPrompt(provision);
    expect(prompt).toContain(provision.topics.join(', '));
    expect(prompt).not.toContain('tlon notes');
    expect(prompt).toContain('order items by urgency');
    expect(prompt).toContain('concise and scannable');
  });

  it('keeps research updates narrow, sourced, and honest about freshness', () => {
    const prompt = agentOnboardingTesting.buildRecurringPrompt({
      ...provision,
      purposeId: 'agent-research',
      purpose: 'Research',
    });
    expect(prompt).toContain('Prioritize primary sources and direct links');
    expect(prompt).toContain('publication dates from event dates');
    expect(prompt).toContain('uncertainty or conflicting evidence');
    expect(prompt).toContain('nothing meaningful changed');
  });

  it('builds a progressive entry for the learning flow', () => {
    const prompt = agentOnboardingTesting.buildRecurringPrompt({
      ...provision,
      purposeId: 'agent-learning',
      purpose: 'Learn something',
      topics: ['Music theory', 'Cryptography'],
    });
    expect(prompt).toContain('topics are: Music theory, Cryptography');
    expect(prompt).toContain('Cover exactly one topic');
    expect(prompt).toContain('never combine or force connections');
    expect(prompt).toContain('Rotate through the list over time');
    expect(prompt).toContain('one useful idea');
    expect(prompt).not.toContain('baseline');
  });

  it('uses the current host payload schema and explicit Notes delivery', async () => {
    const harness = cronHarness();
    await agentOnboardingTesting.upsertPrimaryJob(
      harness.cron,
      provision,
      'chat/~ten/group/general'
    );
    expect(harness.getJobs()[0]).toMatchObject({
      payload: {
        kind: 'agentTurn',
        message: expect.stringContaining('Return only the finished note'),
        toolsAllow: ['group:web'],
      },
      delivery: {
        mode: 'announce',
        channel: 'tlon',
        to: provision.notebookNest,
        failureDestination: {
          mode: 'announce',
          channel: 'tlon',
          to: 'chat/~ten/group/general',
        },
      },
    });
  });

  it('adds only the MCP meta-tools and a read-only provider policy', async () => {
    const harness = cronHarness();
    await agentOnboardingTesting.upsertPrimaryJob(
      harness.cron,
      provision,
      'chat/~ten/group/general',
      ['gmail', 'notion']
    );
    expect(harness.getJobs()[0]).toMatchObject({
      payload: {
        toolsAllow: [
          'group:web',
          'mcp_list_upstreams',
          'mcp_search',
          'mcp_describe',
          'mcp_call',
        ],
        message: expect.stringMatching(
          /gmail.*notion.*read-only.*Never create, update, delete, send, publish/s
        ),
      },
    });
  });

  it('updates the existing group slot from an owner provider config', async () => {
    const harness = cronHarness();
    await agentOnboardingTesting.upsertPrimaryJob(
      harness.cron,
      provision,
      'chat/~ten/group/general'
    );
    const history = [
      {
        author: '~ten',
        content: 'AI, Climate',
        timestamp: 1,
        blob: appendToPostBlob(undefined, provision),
      },
      {
        author: '~bot',
        content: 'Ready',
        timestamp: 2,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-provision-ack',
          version: 1,
          provisionId: provision.provisionId,
          cronJobId: 'job-1',
        }),
      },
    ];
    Object.assign(harness.getJobs()[0], {
      name: 'My edited digest',
      schedule: {
        kind: 'cron',
        expr: '15 10 * * 1-5',
        tz: 'America/Chicago',
      },
      payload: {
        ...(harness.getJobs()[0].payload as object),
        message: 'Use my custom editorial instructions.',
      },
    });
    await handleAgentOnboardingRequest(
      {
        api: { scry: vi.fn() },
        botShip: '~bot',
        channelNest: 'chat/~ten/group/general',
        groupId: provision.groupId,
        ownerShip: '~ten',
        senderShip: '~ten',
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-provider-config',
          version: 1,
          provisionId: provision.provisionId,
          groupId: provision.groupId,
          providerIds: ['gmail'],
        }),
      },
      {
        fetchHistory: vi.fn(async () => history),
        getCron: () => harness.cron,
      }
    );
    expect(harness.getJobs()).toHaveLength(1);
    expect(harness.cron.update).toHaveBeenCalledOnce();
    expect(harness.getJobs()[0]).toMatchObject({
      name: 'My edited digest',
      schedule: {
        kind: 'cron',
        expr: '15 10 * * 1-5',
        tz: 'America/Chicago',
      },
      payload: {
        toolsAllow: expect.arrayContaining(['group:web', 'mcp_call']),
        message: expect.stringMatching(
          /Use my custom editorial instructions.*\["gmail"\]/s
        ),
      },
    });
  });

  it('updates providers after the original transcript leaves recent history', async () => {
    const store = memoryRunStore();
    setAgentOnboardingRunStore(store);
    const harness = cronHarness();
    await agentOnboardingTesting.upsertPrimaryJob(
      harness.cron,
      provision,
      'chat/~ten/group/general'
    );
    await store.register(provision.provisionId, {
      provisionId: provision.provisionId,
      jobId: 'job-1',
      groupId: provision.groupId,
      channelNest: 'chat/~ten/group/general',
      notebookNest: provision.notebookNest,
      notebookName: provision.notebookTitle,
      purposeId: provision.purposeId,
      topics: [...provision.topics],
      provision,
      claimedAt: 1,
      enqueuedAt: 1,
      completedAt: 2,
      status: 'completed',
    });

    await handleAgentOnboardingRequest(
      {
        api: { scry: vi.fn() },
        botShip: '~bot',
        channelNest: 'chat/~ten/group/general',
        groupId: provision.groupId,
        ownerShip: '~ten',
        senderShip: '~ten',
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-provider-config',
          version: 1,
          provisionId: provision.provisionId,
          groupId: provision.groupId,
          providerIds: ['gmail'],
        }),
      },
      {
        fetchHistory: vi.fn(async () => []),
        getCron: () => harness.cron,
      }
    );

    expect(harness.cron.update).toHaveBeenCalledOnce();
    expect(harness.getJobs()[0]).toMatchObject({
      payload: { message: expect.stringContaining('["gmail"]') },
    });
  });

  it('rejects a provider config for a superseded provision', async () => {
    const harness = cronHarness();
    await agentOnboardingTesting.upsertPrimaryJob(
      harness.cron,
      provision,
      'chat/~ten/group/general'
    );
    const history = [
      {
        author: '~ten',
        content: 'AI, Climate',
        timestamp: 1,
        blob: appendToPostBlob(undefined, provision),
      },
      {
        author: '~bot',
        content: 'Ready',
        timestamp: 2,
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-provision-ack',
          version: 1,
          provisionId: provision.provisionId,
          cronJobId: 'job-1',
        }),
      },
      {
        author: '~ten',
        content: 'Robotics',
        timestamp: 3,
        blob: appendToPostBlob(undefined, {
          ...provision,
          provisionId: 'provision-2',
          topics: ['Robotics'],
        }),
      },
    ];

    await handleAgentOnboardingRequest(
      {
        api: { scry: vi.fn() },
        botShip: '~bot',
        channelNest: 'chat/~ten/group/general',
        groupId: provision.groupId,
        ownerShip: '~ten',
        senderShip: '~ten',
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-provider-config',
          version: 1,
          provisionId: provision.provisionId,
          groupId: provision.groupId,
          providerIds: ['gmail'],
        }),
      },
      {
        fetchHistory: vi.fn(async () => history),
        getCron: () => harness.cron,
      }
    );

    expect(harness.cron.update).not.toHaveBeenCalled();
  });

  it('rejects a durable superseded provider config outside history', async () => {
    const store = memoryRunStore();
    setAgentOnboardingRunStore(store);
    const harness = cronHarness();
    await agentOnboardingTesting.upsertPrimaryJob(
      harness.cron,
      provision,
      'chat/~ten/group/general'
    );
    const durableRecord = (provisionId: string, claimedAt: number) => ({
      provisionId,
      jobId: 'job-1',
      groupId: provision.groupId,
      channelNest: 'chat/~ten/group/general',
      notebookNest: provision.notebookNest,
      notebookName: provision.notebookTitle,
      purposeId: provision.purposeId,
      topics: [...provision.topics],
      provision: { ...provision, provisionId },
      claimedAt,
      status: 'completed' as const,
    });
    await store.register(
      provision.provisionId,
      durableRecord('provision-1', 1)
    );
    await store.register('provision-2', durableRecord('provision-2', 2));

    await handleAgentOnboardingRequest(
      {
        api: { scry: vi.fn() },
        botShip: '~bot',
        channelNest: 'chat/~ten/group/general',
        groupId: provision.groupId,
        ownerShip: '~ten',
        senderShip: '~ten',
        blob: appendToPostBlob(undefined, {
          type: 'tlon-agent-provider-config',
          version: 1,
          provisionId: provision.provisionId,
          groupId: provision.groupId,
          providerIds: ['gmail'],
        }),
      },
      {
        fetchHistory: vi.fn(async () => []),
        getCron: () => harness.cron,
      }
    );

    expect(harness.cron.update).not.toHaveBeenCalled();
  });
});

describe('provision coordinator ordering', () => {
  it('uses the legacy cron run method when enqueueRun is unavailable', async () => {
    const run = vi.fn(async () => ({ enqueued: true, runId: 'legacy-run' }));
    const cron = {
      list: vi.fn(async () => []),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      run,
    } as unknown as TlonCronService;

    await expect(
      agentOnboardingTesting.ensureFirstRunEnqueued(
        cron,
        'job-1',
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/group/legacy',
          groupId: provision.groupId,
          ownerShip: '~ten',
        },
        provision,
        'Updates',
        100
      )
    ).resolves.toBe('enqueued');

    expect(run).toHaveBeenCalledWith('job-1', 'force');
  });

  it('reports each funnel step exactly once, in order', async () => {
    // An unfired analytics event is invisible, so the funnel's shape is worth
    // pinning: these are the steps a healthy setup must emit, and the order is
    // what makes drop-off computable.
    const steps: string[] = [];
    const trackStep = (report: { step: string; outcome?: string }) =>
      steps.push(`${report.step}:${report.outcome ?? 'ok'}`);
    const history: Array<{
      author: string;
      content: string;
      timestamp: number;
      blob?: string;
    }> = [];
    let jobs: Record<string, unknown>[] = [];
    const cron = {
      list: vi.fn(async () => jobs),
      add: vi.fn(async (input) => {
        jobs = [{ id: 'job-1', ...input }];
      }),
      update: vi.fn(),
      remove: vi.fn(),
      enqueueRun: vi.fn(async () => ({ enqueued: true, runId: 'run-1' })),
    } as unknown as TlonCronService;

    const context = {
      api: {
        scry: vi.fn(async () => ({
          groups: {
            [provision.groupId]: {
              channels: { [provision.notebookNest]: {} },
              seats: { '~bot': { roles: ['admin'] } },
            },
          },
        })),
      },
      botShip: '~bot',
      channelNest: 'chat/~ten/group/general',
      groupId: provision.groupId,
      ownerShip: '~ten',
      senderShip: '~ten',
      blob: appendToPostBlob(undefined, provision),
      trackStep,
    };
    const deps = {
      fetchHistory: vi.fn(async () => history),
      getCron: () => cron,
      sendPost: vi.fn(async ({ blob }: { blob?: string }) => {
        history.push({
          author: '~bot',
          content: '',
          timestamp: Date.now(),
          blob,
        });
        return { channel: 'tlon' as const, messageId: 'post', sentAt: 0 };
      }),
    };

    await handleAgentOnboardingRequest(context, deps);
    // The durable provision remains in reconciliation history. Replaying it
    // must not inflate the funnel or enqueue a second first run.
    await handleAgentOnboardingRequest(context, deps);

    expect(steps).toEqual([
      'provision_received:ok',
      'cron_created:ok',
      'first_run_enqueued:ok',
    ]);
    expect(cron.enqueueRun).toHaveBeenCalledOnce();
  });

  it('reports a rejected provision as a failed step', async () => {
    const steps: Array<{ step: string; outcome?: string; errorText?: string }> =
      [];
    await handleAgentOnboardingRequest(
      {
        api: {
          // Owner mismatch: the group is hosted by someone else.
          scry: vi.fn(async () => ({
            groups: {
              [provision.groupId]: {
                channels: { [provision.notebookNest]: {} },
                seats: { '~bot': { roles: ['admin'] } },
              },
            },
          })),
        },
        botShip: '~bot',
        channelNest: 'chat/~ten/group/general',
        groupId: provision.groupId,
        ownerShip: '~ten',
        senderShip: '~ten',
        blob: appendToPostBlob(undefined, {
          ...provision,
          notebookNest: 'notes/~ten/not-a-listed-channel',
        }),
        trackStep: (report) => steps.push(report),
      },
      {
        fetchHistory: vi.fn(async () => []),
        getGroup: vi.fn(async () => ({
          hostUserId: '~other',
          channels: [{ id: provision.notebookNest, type: 'notes' }],
          members: [],
        })),
        getCron: () => undefined as never,
        sendPost: vi.fn(),
      }
    );

    // The drop-off has to be visible, not just absent from the funnel.
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      step: 'provision_received',
      outcome: 'failed',
    });
  });

  it('retries a valid provision while notebook membership converges', async () => {
    const trackStep = vi.fn();
    await expect(
      handleAgentOnboardingRequest(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/group/general',
          groupId: provision.groupId,
          ownerShip: '~ten',
          senderShip: '~ten',
          blob: appendToPostBlob(undefined, provision),
          trackStep,
        },
        {
          fetchHistory: vi.fn(async () => []),
          getGroup: vi.fn(async () => ({
            hostUserId: '~ten',
            channels: [],
            members: [
              { contactId: '~bot', status: 'joined', roles: ['admin'] },
            ],
          })),
          getCron: () => undefined as never,
          sendPost: vi.fn(),
        }
      )
    ).rejects.toThrow('onboarding notebook is not available yet');
    expect(trackStep).not.toHaveBeenCalled();
  });

  it('waits for the bot admin promotion before provisioning', async () => {
    const withoutAdmin = {
      hostUserId: '~ten',
      channels: [{ id: provision.notebookNest, type: 'notes' }],
      members: [{ contactId: '~bot', status: 'joined', roles: [] }],
    };
    const withAdmin = {
      ...withoutAdmin,
      members: [{ contactId: '~bot', status: 'joined', roles: ['admin'] }],
    };
    const getGroup = vi
      .fn()
      .mockResolvedValueOnce(withoutAdmin)
      .mockResolvedValue(withAdmin);
    const sleep = vi.fn(async () => {});
    let jobs: Record<string, unknown>[] = [];
    const cron = {
      list: vi.fn(async () => jobs),
      add: vi.fn(async (input: Record<string, unknown>) => {
        jobs = [{ id: 'job-1', ...input }];
      }),
      update: vi.fn(),
      remove: vi.fn(),
      enqueueRun: vi.fn(async () => ({ enqueued: true, runId: 'run-1' })),
    } as unknown as TlonCronService;

    await expect(
      handleAgentOnboardingRequest(requestContext(), {
        fetchHistory: vi.fn(async () => []),
        getCron: () => cron,
        getGroup,
        sendPost: vi.fn(async () => ({
          channel: 'tlon' as const,
          messageId: 'post',
          sentAt: 0,
        })),
        sleep,
      })
    ).resolves.toBe(true);

    expect(getGroup).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
    expect(cron.enqueueRun).toHaveBeenCalledOnce();
  });

  it('keeps a durable provision retryable until admin promotion arrives', async () => {
    const withoutAdmin = {
      hostUserId: '~ten',
      channels: [{ id: provision.notebookNest, type: 'notes' }],
      members: [{ contactId: '~bot', status: 'joined', roles: [] }],
    };
    await expect(
      handleAgentOnboardingRequest(requestContext(), {
        fetchHistory: vi.fn(async () => []),
        getCron: () => undefined as never,
        getGroup: vi.fn(async () => withoutAdmin),
        sendPost: vi.fn(),
        sleep: vi.fn(async () => {}),
      })
    ).rejects.toThrow('agent is not an admin yet');
  });

  it('enqueues the first run before announcing that writing started', async () => {
    const events: string[] = [];
    const history: Array<{
      author: string;
      content: string;
      timestamp: number;
      blob?: string;
    }> = [];
    let jobs: Record<string, any>[] = [];
    const cron = {
      list: vi.fn(async () => jobs),
      add: vi.fn(async (input) => {
        events.push('cron:add');
        jobs = [{ id: 'job-1', ...input }];
      }),
      update: vi.fn(),
      remove: vi.fn(),
      enqueueRun: vi.fn(async () => {
        events.push('cron:enqueue');
        return { enqueued: true, runId: 'first-run-1' };
      }),
    } as unknown as TlonCronService;

    await handleAgentOnboardingRequest(
      {
        api: {
          scry: vi.fn(async () => ({
            groups: {
              [provision.groupId]: {
                channels: { [provision.notebookNest]: {} },
                seats: { '~bot': { roles: ['admin'] } },
              },
            },
          })),
        },
        botShip: '~bot',
        channelNest: 'chat/~ten/group/general',
        groupId: provision.groupId,
        ownerShip: '~ten',
        senderShip: '~ten',
        blob: appendToPostBlob(undefined, provision),
      },
      {
        fetchHistory: vi.fn(async () => history),
        getCron: () => cron,
        sendPost: vi.fn(async ({ blob }) => {
          const entries = parsePostBlob(blob);
          const marker =
            entries.find(
              (entry) =>
                entry.type === 'tlon-agent-post-marker' &&
                entry.key.startsWith('ack:')
            ) ??
            entries.find((entry) => entry.type === 'tlon-agent-post-marker');
          if (marker?.type === 'tlon-agent-post-marker') {
            events.push(`post:${marker.key}`);
          }
          history.push({
            author: '~bot',
            content: '',
            timestamp: Date.now(),
            blob,
          });
          return { channel: 'tlon' as const, messageId: 'post', sentAt: 0 };
        }),
      }
    );

    // Two beats now, not one: the acknowledgement, then the "writing it now"
    // status. The handoff tip and the services pitch are no longer part of
    // this post at all — they wait until the first entry has actually landed.
    expect(events).toEqual([
      'cron:add',
      'cron:enqueue',
      'post:ack:provision-1',
      'post:first-entry-pending',
    ]);
    expect(
      parsePostBlob(history[0]?.blob).filter(
        (entry) => entry.type === 'tlon-agent-post-marker'
      )
    ).toEqual([expect.objectContaining({ key: 'ack:provision-1' })]);
    expect(JSON.stringify(parsePostBlob(history[0]?.blob))).not.toContain(
      'Connect services'
    );
  });

  it('releases a durable claim when enqueue rejects', async () => {
    const store = memoryRunStore();
    setAgentOnboardingRunStore(store);
    let jobs: Record<string, unknown>[] = [];
    const cron = {
      list: vi.fn(async () => jobs),
      add: vi.fn(async (input) => {
        jobs = [{ id: 'job-1', ...input }];
      }),
      update: vi.fn(),
      remove: vi.fn(),
      enqueueRun: vi
        .fn()
        .mockRejectedValueOnce(new Error('enqueue unavailable'))
        .mockResolvedValueOnce({ enqueued: true, runId: 'run-1' }),
    } as unknown as TlonCronService;
    const context = requestContext();
    const deps = {
      fetchHistory: vi.fn(async () => []),
      getCron: () => cron,
      getGroup: vi.fn(async () => ({
        hostUserId: '~ten',
        channels: [{ id: provision.notebookNest, type: 'notes' }],
        members: [{ contactId: '~bot', status: 'joined', roles: ['admin'] }],
      })),
      sendPost: vi.fn(async () => ({
        channel: 'tlon' as const,
        messageId: 'post',
        sentAt: 0,
      })),
    };

    await expect(handleAgentOnboardingRequest(context, deps)).rejects.toThrow(
      'enqueue unavailable'
    );
    await expect(store.lookup(provision.provisionId)).resolves.toBeUndefined();
    await expect(handleAgentOnboardingRequest(context, deps)).resolves.toBe(
      true
    );
    expect(cron.enqueueRun).toHaveBeenCalledTimes(2);
    await expect(store.lookup(provision.provisionId)).resolves.toMatchObject({
      status: 'enqueued',
      runId: 'run-1',
    });
  });

  it('re-enqueues with an exact run id when persisting an enqueue fails', async () => {
    const store = memoryRunStore();
    store.register.mockRejectedValueOnce(new Error('state store unavailable'));
    setAgentOnboardingRunStore(store);
    let now = 100;
    let jobs: Record<string, any>[] = [];
    const cron = {
      list: vi.fn(async () => jobs),
      add: vi.fn(async (input) => {
        jobs = [{ id: 'job-1', ...input }];
      }),
      update: vi.fn(),
      remove: vi.fn(),
      enqueueRun: vi.fn(async () => ({ enqueued: true, runId: 'run-1' })),
    } as unknown as TlonCronService;
    const history: Array<{
      author: string;
      content: string;
      timestamp: number;
      blob?: string;
    }> = [];
    const context = requestContext();
    const deps = {
      fetchHistory: vi.fn(async () => history),
      getCron: () => cron,
      getGroup: vi.fn(async () => ({
        hostUserId: '~ten',
        channels: [{ id: provision.notebookNest, type: 'notes' }],
        members: [{ contactId: '~bot', status: 'joined', roles: ['admin'] }],
      })),
      now: () => now,
      sendPost: vi.fn(async ({ blob }: { blob?: string }) => {
        history.push({
          author: '~bot',
          content: '',
          timestamp: now,
          blob,
        });
        return { channel: 'tlon' as const, messageId: 'post', sentAt: 0 };
      }),
    };

    await expect(handleAgentOnboardingRequest(context, deps)).rejects.toThrow(
      'state store unavailable'
    );
    now = 101;
    await expect(handleAgentOnboardingRequest(context, deps)).rejects.toThrow(
      'still being claimed'
    );

    jobs[0] = { ...jobs[0], state: { runningAtMs: 200 } };
    now = 30_101;
    await expect(handleAgentOnboardingRequest(context, deps)).resolves.toBe(
      true
    );

    expect(cron.enqueueRun).toHaveBeenCalledTimes(2);
    await expect(store.lookup(provision.provisionId)).resolves.toMatchObject({
      status: 'enqueued',
    });
    expect(history).toHaveLength(2);
  });

  it('does not enqueue twice when acknowledgement fails after enqueue', async () => {
    const store = memoryRunStore();
    setAgentOnboardingRunStore(store);
    const history: Array<{
      author: string;
      content: string;
      timestamp: number;
      blob?: string;
    }> = [];
    let jobs: Record<string, unknown>[] = [];
    const cron = {
      list: vi.fn(async () => jobs),
      add: vi.fn(async (input) => {
        jobs = [{ id: 'job-1', ...input }];
      }),
      update: vi.fn(),
      remove: vi.fn(),
      enqueueRun: vi.fn(async () => ({ enqueued: true, runId: 'run-1' })),
    } as unknown as TlonCronService;
    let failAck = true;
    const sendPost = vi.fn(async ({ blob }) => {
      if (failAck) {
        failAck = false;
        throw new Error('ship disconnected after enqueue');
      }
      history.push({
        author: '~bot',
        content: '',
        timestamp: Date.now(),
        blob,
      });
      return { channel: 'tlon' as const, messageId: 'post', sentAt: 0 };
    });
    const context = requestContext();
    const deps = {
      fetchHistory: vi.fn(async () => history),
      getCron: () => cron,
      getGroup: vi.fn(async () => ({
        hostUserId: '~ten',
        channels: [{ id: provision.notebookNest, type: 'notes' }],
        members: [{ contactId: '~bot', status: 'joined', roles: ['admin'] }],
      })),
      sendPost,
    };

    await expect(handleAgentOnboardingRequest(context, deps)).rejects.toThrow(
      'ship disconnected after enqueue'
    );
    await expect(handleAgentOnboardingRequest(context, deps)).resolves.toBe(
      true
    );

    expect(cron.enqueueRun).toHaveBeenCalledOnce();
    expect(await store.lookup(provision.provisionId)).toMatchObject({
      status: 'enqueued',
      runId: 'run-1',
    });
    expect(history).toHaveLength(2);
  });

  it('finishes a completed first run discovered after plugin restart', async () => {
    const store = memoryRunStore();
    setAgentOnboardingRunStore(store);
    await store.register(provision.provisionId, {
      provisionId: provision.provisionId,
      jobId: 'job-1',
      runId: 'run-before-restart',
      groupId: provision.groupId,
      channelNest: 'chat/~ten/group/general',
      notebookNest: provision.notebookNest,
      notebookName: 'Updates',
      purposeId: provision.purposeId,
      topics: [...provision.topics],
      claimedAt: 100,
      enqueuedAt: 100,
      outcome: {
        status: 'ok',
        delivered: true,
        noteId: 91,
        observedAt: 200,
      },
      status: 'enqueued',
    });
    const ackBlob = appendToPostBlob(
      appendToPostBlob(undefined, {
        type: 'tlon-agent-provision-ack',
        version: 1,
        provisionId: provision.provisionId,
        cronJobId: 'job-1',
      }),
      {
        type: 'tlon-agent-post-marker',
        version: 1,
        key: `ack:${provision.provisionId}`,
      }
    );
    const history = [
      {
        author: '~ten',
        content: 'AI, Climate',
        timestamp: 1,
        blob: appendToPostBlob(undefined, provision),
      },
      { author: '~bot', content: 'Ready', timestamp: 2, blob: ackBlob },
    ];
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    const cron = {
      list: vi.fn(async () => [
        {
          id: 'job-1',
          state: {
            lastRunAtMs: 200,
            lastRunStatus: 'ok',
            lastDelivered: true,
          },
        },
      ]),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      enqueueRun: vi.fn(),
    } as unknown as TlonCronService;

    await handleAgentOnboardingRequest(requestContext(), {
      fetchHistory: vi.fn(async () => history),
      getCron: () => cron,
      getGroup: vi.fn(async () => ({
        hostUserId: '~ten',
        channels: [{ id: provision.notebookNest, type: 'notes' }],
        members: [{ contactId: '~bot', status: 'joined', roles: ['admin'] }],
      })),
      sendPost,
      sleep: vi.fn(async () => {}),
    });

    expect(cron.enqueueRun).not.toHaveBeenCalled();
    expect(sendPost).toHaveBeenCalledTimes(2);
    expect(sendPost.mock.calls[0]?.[0].story).toContainEqual({
      block: {
        cite: {
          chan: { nest: provision.notebookNest, where: '/note/91' },
        },
      },
    });
    expect(await store.lookup(provision.provisionId)).toMatchObject({
      status: 'completed',
    });
  });

  it('fails a restored successful run whose note delivery failed', async () => {
    const context = scanContext();
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'run-before-restart' },
      context,
      provision,
      'Updates',
      'job-1',
      100
    );
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    const cron = {
      list: vi.fn(async () => [
        {
          id: 'job-1',
          state: {
            lastRunAtMs: 200,
            lastRunStatus: 'ok',
            lastDelivered: false,
          },
        },
      ]),
    } as unknown as TlonCronService;

    await agentOnboardingTesting.reconcileRestoredFirstRun(
      cron,
      {
        provisionId: provision.provisionId,
        jobId: 'job-1',
        runId: 'run-before-restart',
        groupId: provision.groupId,
        channelNest: context.channelNest,
        notebookNest: provision.notebookNest,
        notebookName: 'Updates',
        purposeId: provision.purposeId,
        topics: [...provision.topics],
        claimedAt: 100,
        enqueuedAt: 100,
        outcome: {
          status: 'error',
          delivered: false,
          observedAt: 200,
        },
        status: 'enqueued',
      },
      {
        fetchHistory: vi.fn(async () => []),
        sendPost,
        sleep: vi.fn(async () => {}),
      }
    );

    expect(JSON.stringify(sendPost.mock.calls[0]?.[0].story)).toContain(
      'couldn’t publish the first entry'
    );
  });

  it('does not infer the forced-run outcome from aggregate job state', async () => {
    const sendPost = vi.fn();
    const list = vi.fn(async () => [
      {
        id: 'job-1',
        state: {
          lastRunAtMs: 200,
          lastRunStatus: 'ok' as const,
          lastDelivered: true,
        },
      },
    ]);

    await agentOnboardingTesting.reconcileRestoredFirstRun(
      { list } as unknown as TlonCronService,
      {
        provisionId: provision.provisionId,
        jobId: 'job-1',
        runId: 'forced-run',
        groupId: provision.groupId,
        channelNest: 'chat/~ten/group/general',
        notebookNest: provision.notebookNest,
        notebookName: 'Updates',
        purposeId: provision.purposeId,
        topics: [...provision.topics],
        claimedAt: 100,
        enqueuedAt: 100,
        status: 'enqueued',
      },
      { fetchHistory: vi.fn(async () => []), sendPost }
    );

    expect(list).not.toHaveBeenCalled();
    expect(sendPost).not.toHaveBeenCalled();
  });

  it('keeps an acknowledged restart retryable until cron is available', async () => {
    const ackBlob = appendToPostBlob(
      appendToPostBlob(undefined, {
        type: 'tlon-agent-provision-ack',
        version: 1,
        provisionId: provision.provisionId,
        cronJobId: 'job-1',
      }),
      {
        type: 'tlon-agent-post-marker',
        version: 1,
        key: `ack:${provision.provisionId}`,
      }
    );
    const history = [
      {
        author: '~ten',
        content: 'AI, Climate',
        timestamp: 1,
        blob: appendToPostBlob(undefined, provision),
      },
      { author: '~bot', content: 'Ready', timestamp: 2, blob: ackBlob },
    ];

    await expect(
      handleAgentOnboardingRequest(requestContext(), {
        fetchHistory: vi.fn(async () => history),
        getCron: () => undefined as never,
        getGroup: vi.fn(async () => ({
          hostUserId: '~ten',
          channels: [{ id: provision.notebookNest, type: 'notes' }],
          members: [{ contactId: '~bot', status: 'joined', roles: ['admin'] }],
        })),
      })
    ).rejects.toThrow('cron service is not available while restoring setup');
  });

  it('posts a note reference when the correlated first run finishes', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    const sleep = vi.fn(async () => {});
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'first-run-complete' },
      scanContext(),
      provision
    );

    const listNotes = vi
      .fn()
      // Delivery can beat Notes indexing; the reveal should wait briefly for
      // the new note instead of permanently omitting its reference.
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: `${provision.notebookNest}/12`,
          notebookFlag: provision.notebookNest,
          noteId: 12,
          title: 'First entry',
          createdBy: '~bot',
          createdAt: Date.now() + 1,
        },
      ]);

    await handleAgentOnboardingCronChanged(
      {
        action: 'finished',
        jobId: 'job-1',
        runId: 'first-run-complete',
        status: 'ok',
        delivered: true,
      } as never,
      {
        fetchHistory: vi.fn(async () => []),
        listNotes,
        sendPost,
        sleep,
      }
    );

    expect(sendPost).toHaveBeenCalledTimes(2);
    expect(listNotes).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 1_000);
    expect(sleep).toHaveBeenNthCalledWith(2, 5_500);
    const reveal = sendPost.mock.calls[0]?.[0];
    // The sentence carries the entry on its own — the cite renders as
    // "Content not available" until the client has synced the notes channel,
    // so the card is a bonus, not the message.
    expect(JSON.stringify(reveal.story)).toContain('Your first entry is ready');
    expect(JSON.stringify(reveal.story)).toContain('First entry');
    expect(JSON.stringify(reveal.story)).toContain('notebook');
    expect(reveal.story).toContainEqual({
      block: {
        cite: {
          chan: { nest: provision.notebookNest, where: '/note/12' },
        },
      },
    });
    // Keyed per channel, not per provision: re-provisioning minted a new id
    // and let the same reveal post three times in one setup.
    expect(parsePostBlob(reveal.blob)).toContainEqual(
      expect.objectContaining({
        type: 'tlon-agent-post-marker',
        key: 'first-entry-ping',
      })
    );
    expect(parsePostBlob(sendPost.mock.calls[1]?.[0].blob)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tlon-agent-post-marker',
          key: 'services-card',
        }),
        expect.objectContaining({ type: 'a2ui' }),
      ])
    );
    expect(JSON.stringify(sendPost.mock.calls[1]?.[0])).toContain('McpConnect');
    expect(JSON.stringify(sendPost.mock.calls[1]?.[0])).toContain(
      'tap Done to continue'
    );
  });

  it('waits for an explicit delivery result after a successful run', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'first-run-delivery-pending' },
      {
        api: { scry: vi.fn() },
        botShip: '~bot',
        channelNest: 'chat/~ten/group/delivery-pending',
        groupId: provision.groupId,
        ownerShip: '~ten',
      },
      provision
    );

    await handleAgentOnboardingCronChanged(
      {
        action: 'finished',
        jobId: 'job-1',
        runId: 'first-run-delivery-pending',
        status: 'ok',
        delivered: null,
      } as never,
      { fetchHistory: vi.fn(async () => []), sendPost }
    );

    expect(sendPost).not.toHaveBeenCalled();
    expect(
      agentOnboardingTesting.findFirstRunCorrelation(
        'first-run-delivery-pending'
      )
    ).not.toBeNull();
  });

  it('ignores a successful cron completion with a different run id', async () => {
    const sendPost = vi.fn();
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'expected-run' },
      scanContext(),
      provision,
      undefined,
      'shared-job'
    );

    await handleAgentOnboardingCronChanged(
      {
        action: 'finished',
        jobId: 'shared-job',
        runId: 'unrelated-run',
        status: 'ok',
        delivered: true,
      } as never,
      { fetchHistory: vi.fn(async () => []), sendPost }
    );

    expect(sendPost).not.toHaveBeenCalled();
    expect(
      agentOnboardingTesting.findFirstRunCorrelation('expected-run')
    ).not.toBeNull();
  });

  it('does not mistake an older notebook entry for the first run', async () => {
    const listNotes = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: `${provision.notebookNest}/10`,
          notebookFlag: provision.notebookNest,
          noteId: 10,
          title: 'Unrelated owner entry',
          createdBy: '~ten',
          createdAt: 120,
        },
        {
          id: `${provision.notebookNest}/8`,
          notebookFlag: provision.notebookNest,
          noteId: 8,
          title: 'Older entry',
          createdBy: '~bot',
          createdAt: 90,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: `${provision.notebookNest}/9`,
          notebookFlag: provision.notebookNest,
          noteId: 9,
          title: 'Current entry',
          createdBy: '~bot',
          createdAt: 110,
        },
      ]);
    const sleep = vi.fn(async () => {});

    await expect(
      agentOnboardingTesting.findNewestNoteWithRetry(
        provision.notebookNest,
        listNotes,
        sleep,
        100,
        '~bot'
      )
    ).resolves.toMatchObject({ noteId: 9, title: 'Current entry' });
    expect(listNotes).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it('aborts note lookup while the monitor is draining', async () => {
    const controller = new AbortController();
    const listNotes = vi.fn(async () => {
      controller.abort();
      return [];
    });

    await expect(
      agentOnboardingTesting.findNewestNoteWithRetry(
        provision.notebookNest,
        listNotes,
        vi.fn(async () => {}),
        100,
        '~bot',
        controller.signal
      )
    ).rejects.toThrow();
    expect(listNotes).toHaveBeenCalledOnce();
  });

  it('uses the authoritative created note when cron completion wins the hook race', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    const listNotes = vi.fn(async () => []);
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'first-run-authoritative' },
      scanContext(),
      provision
    );
    recordDeliveredNote(provision.notebookNest, {
      id: 77,
      title: 'Authoritative entry',
    });

    await handleAgentOnboardingCronChanged(
      {
        action: 'finished',
        jobId: 'job-1',
        runId: 'first-run-authoritative',
        status: 'ok',
        delivered: true,
      } as never,
      {
        fetchHistory: vi.fn(async () => []),
        listNotes,
        sendPost,
        sleep: vi.fn(async () => {}),
      }
    );

    expect(listNotes).not.toHaveBeenCalled();
    expect(sendPost.mock.calls[0]?.[0].story).toContainEqual({
      block: {
        cite: {
          chan: { nest: provision.notebookNest, where: '/note/77' },
        },
      },
    });
    expect(JSON.stringify(sendPost.mock.calls[0]?.[0].story)).toContain(
      'Authoritative entry'
    );
  });

  it('posts a terminal status when the initial run fails', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    const trackStep = vi.fn();
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'first-run-failed' },
      {
        api: { scry: vi.fn() },
        botShip: '~bot',
        channelNest: 'chat/~ten/group/general',
        groupId: provision.groupId,
        ownerShip: '~ten',
        trackStep,
      },
      provision
    );

    await handleAgentOnboardingCronChanged(
      {
        action: 'finished',
        jobId: 'job-1',
        runId: 'first-run-failed',
        status: 'error',
        delivered: false,
      } as never,
      {
        fetchHistory: vi.fn(async () => []),
        sendPost,
        sleep: vi.fn(async () => {}),
      }
    );

    expect(sendPost).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(sendPost.mock.calls[0]?.[0].story)).toContain(
      'couldn’t publish the first entry'
    );
    expect(parsePostBlob(sendPost.mock.calls[0]?.[0].blob)).toContainEqual(
      expect.objectContaining({
        type: 'tlon-agent-post-marker',
        key: 'first-entry-failed',
      })
    );
    expect(trackStep).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'first_entry_revealed',
        outcome: 'failed',
      })
    );
    expect(parsePostBlob(sendPost.mock.calls[1]?.[0].blob)).toContainEqual(
      expect.objectContaining({
        type: 'tlon-agent-post-marker',
        key: 'services-card',
      })
    );
  });

  it('posts a terminal status when execution succeeds but delivery fails', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'first-run-undelivered' },
      scanContext(),
      provision
    );

    await handleAgentOnboardingCronChanged(
      {
        action: 'finished',
        jobId: 'job-1',
        runId: 'first-run-undelivered',
        status: 'ok',
        delivered: false,
      } as never,
      {
        fetchHistory: vi.fn(async () => []),
        sendPost,
        sleep: vi.fn(async () => {}),
      }
    );

    expect(sendPost).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(sendPost.mock.calls[0]?.[0].story)).toContain(
      'couldn’t publish the first entry'
    );
  });

  it('persists a matched outcome before posting the reveal', async () => {
    const store = memoryRunStore();
    setAgentOnboardingRunStore(store);
    await store.register(provision.provisionId, {
      provisionId: provision.provisionId,
      jobId: 'job-1',
      runId: 'matched-run',
      groupId: provision.groupId,
      channelNest: 'chat/~ten/group/general',
      notebookNest: provision.notebookNest,
      notebookName: provision.notebookTitle,
      purposeId: provision.purposeId,
      topics: [...provision.topics],
      provision,
      claimedAt: 1,
      enqueuedAt: 1,
      status: 'enqueued',
    });
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'matched-run' },
      scanContext(),
      provision,
      provision.notebookTitle,
      'job-1'
    );

    await expect(
      handleAgentOnboardingCronChanged(
        {
          action: 'finished',
          jobId: 'job-1',
          runId: 'matched-run',
          status: 'ok',
          delivered: true,
        } as never,
        {
          fetchHistory: vi.fn(async () => []),
          sendPost: vi.fn(async () => {
            throw new Error('transport closed during reveal');
          }),
          sleep: vi.fn(async () => {}),
        }
      )
    ).rejects.toThrow('transport closed during reveal');

    await expect(store.lookup(provision.provisionId)).resolves.toMatchObject({
      status: 'enqueued',
      outcome: { status: 'ok', delivered: true },
    });
  });

  it('retries a matched outcome after a transient store failure', async () => {
    const store = memoryRunStore();
    const sleep = vi.fn(async () => {});
    setAgentOnboardingRunStore(store);
    await store.register(provision.provisionId, {
      provisionId: provision.provisionId,
      jobId: 'job-1',
      runId: 'transient-store-run',
      groupId: provision.groupId,
      channelNest: 'chat/~ten/group/general',
      notebookNest: provision.notebookNest,
      notebookName: provision.notebookTitle,
      purposeId: provision.purposeId,
      topics: [...provision.topics],
      provision,
      claimedAt: 1,
      enqueuedAt: 1,
      status: 'enqueued',
    });
    store.register.mockRejectedValueOnce(new Error('temporary store failure'));
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'transient-store-run' },
      scanContext(),
      provision,
      provision.notebookTitle,
      'job-1'
    );

    await handleAgentOnboardingCronChanged(
      {
        action: 'finished',
        jobId: 'job-1',
        runId: 'transient-store-run',
        status: 'ok',
        delivered: true,
      } as never,
      {
        fetchHistory: vi.fn(async () => []),
        listNotes: vi.fn(async () => []),
        sendPost: vi.fn(async () => ({
          channel: 'tlon' as const,
          messageId: 'post',
          sentAt: 0,
        })),
        sleep,
      }
    );

    expect(sleep).toHaveBeenCalledWith(100);
    await expect(store.lookup(provision.provisionId)).resolves.toMatchObject({
      outcome: { status: 'ok', delivered: true },
    });
  });

  it('retries a failed-run notification after transient history failure', async () => {
    vi.useFakeTimers();
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    const trackStep = vi.fn();
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'first-run-failure-retry' },
      {
        api: { scry: vi.fn() },
        botShip: '~bot',
        channelNest: 'chat/~ten/group/general',
        groupId: provision.groupId,
        ownerShip: '~ten',
        trackStep,
      },
      provision
    );
    const fetchHistory = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary history failure'))
      .mockResolvedValue([]);
    const event = {
      action: 'finished',
      jobId: 'job-1',
      runId: 'first-run-failure-retry',
      status: 'error',
      delivered: false,
    } as never;

    await expect(
      handleAgentOnboardingCronChanged(event, {
        fetchHistory,
        sendPost,
        sleep: vi.fn(async () => {}),
      })
    ).rejects.toThrow('temporary history failure');
    expect(sendPost).not.toHaveBeenCalled();
    expect(trackStep).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchHistory).toHaveBeenCalledTimes(2);
    expect(sendPost).toHaveBeenCalledTimes(2);
    expect(trackStep).toHaveBeenCalledTimes(2);
  });

  it('uses successful Notes delivery when the host drops cron completion', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'first-run-delivery-fallback' },
      scanContext(),
      provision
    );

    const listNotes = vi.fn(async () => [
      {
        noteId: 42,
        title: 'First entry',
        createdAt: Date.now() + 1,
        createdBy: '~bot',
      },
    ]);
    await handleAgentOnboardingMessageSent(
      {
        to: provision.notebookNest,
        content: '# First entry',
        success: true,
        messageId: '~bot/notes-42',
        // An authoritative but unrelated run id must not fall back to the
        // notebook destination and complete onboarding.
        runId: 'nested-model-run',
      },
      {
        fetchHistory: vi.fn(async () => []),
        listNotes,
        sendPost,
        sleep: vi.fn(async () => {}),
      }
    );
    await handleAgentOnboardingCronChanged(
      {
        action: 'finished',
        jobId: 'job-1',
        runId: 'first-run-delivery-fallback',
        status: 'ok',
        delivered: true,
      } as never,
      {
        fetchHistory: vi.fn(async () => []),
        listNotes,
        sendPost,
        sleep: vi.fn(async () => {}),
      }
    );

    expect(sendPost).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(sendPost.mock.calls[0]?.[0].story)).toContain(
      'Your first entry is ready'
    );
    expect(sendPost.mock.calls[0]?.[0].story).toContainEqual({
      block: {
        cite: {
          chan: { nest: provision.notebookNest, where: '/note/42' },
        },
      },
    });
    expect(listNotes).toHaveBeenCalled();
  });

  it('suppresses completion presentation for a superseded provision', async () => {
    const store = memoryRunStore();
    setAgentOnboardingRunStore(store);
    await store.register('provision-newer', {
      ...provision,
      provisionId: 'provision-newer',
      jobId: 'job-newer',
      channelNest: 'chat/~ten/group/general',
      notebookName: 'Updates',
      claimedAt: Date.now() + 1,
      status: 'enqueued',
    });
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'superseded-run' },
      scanContext(),
      provision
    );
    const sendPost = vi.fn();

    await handleAgentOnboardingCronChanged(
      {
        action: 'finished',
        jobId: 'unknown:superseded-run',
        runId: 'superseded-run',
        status: 'ok',
        delivered: true,
      } as never,
      { fetchHistory: vi.fn(async () => []), sendPost }
    );

    expect(sendPost).not.toHaveBeenCalled();
    expect(
      agentOnboardingTesting.findFirstRunCorrelation('superseded-run')
    ).toBeNull();
  });

  it('ignores a notebook send from a different contextual run', async () => {
    const sendPost = vi.fn();
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'expected-run' },
      {
        api: { scry: vi.fn() },
        botShip: '~bot',
        channelNest: 'chat/~ten/group/contextual-run',
        groupId: provision.groupId,
        ownerShip: '~ten',
      },
      provision
    );

    await handleAgentOnboardingMessageSent(
      {
        success: true,
        to: provision.notebookNest,
        messageId: '~bot/notes-99',
      } as never,
      { fetchHistory: vi.fn(async () => []), sendPost },
      'unrelated-run'
    );

    expect(sendPost).not.toHaveBeenCalled();
    expect(
      agentOnboardingTesting.findFirstRunCorrelation('expected-run')
    ).not.toBeNull();
  });

  it('ignores a failure-destination send from the expected run', async () => {
    const sendPost = vi.fn();
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'expected-run' },
      {
        api: { scry: vi.fn() },
        botShip: '~bot',
        channelNest: 'chat/~ten/group/contextual-run',
        groupId: provision.groupId,
        ownerShip: '~ten',
      },
      provision
    );

    await handleAgentOnboardingMessageSent(
      {
        success: true,
        to: 'chat/~ten/group/contextual-run',
        messageId: '~bot/chat-99',
      } as never,
      { fetchHistory: vi.fn(async () => []), sendPost },
      'expected-run'
    );

    expect(sendPost).not.toHaveBeenCalled();
    expect(
      agentOnboardingTesting.findFirstRunCorrelation('expected-run')
    ).not.toBeNull();
  });

  it('coalesces completion hooks and retries after failure', async () => {
    vi.useFakeTimers();
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'first-run-race' },
      scanContext(),
      provision
    );
    const fetchHistory = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary history failure'))
      .mockResolvedValue([]);
    const results = await Promise.allSettled([
      handleAgentOnboardingMessageSent(
        {
          to: provision.notebookNest,
          content: '# Entry',
          success: true,
          messageId: '~bot/notes-42',
          runId: 'nested-run',
        },
        {
          fetchHistory,
          listNotes: vi.fn(async () => []),
          sendPost,
          sleep: vi.fn(async () => {}),
        }
      ),
      handleAgentOnboardingCronChanged(
        {
          action: 'finished',
          jobId: 'unknown:first-run-race',
          runId: 'first-run-race',
          status: 'ok',
          delivered: true,
        } as never,
        {
          fetchHistory,
          listNotes: vi.fn(async () => []),
          sendPost,
          sleep: vi.fn(async () => {}),
        }
      ),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(fetchHistory).toHaveBeenCalledOnce();
    expect(sendPost).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchHistory).toHaveBeenCalledTimes(2);
    expect(sendPost).toHaveBeenCalledTimes(2);
  });

  it('blocks new lifecycle completions once runtime draining begins', async () => {
    const api = { scry: vi.fn() };
    let releaseHistory!: (history: never[]) => void;
    const historyBarrier = new Promise<never[]>((resolve) => {
      releaseHistory = resolve;
    });
    const fetchHistory = vi.fn(() => historyBarrier);
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'draining-run' },
      {
        api,
        botShip: '~bot',
        channelNest: 'chat/~ten/group/general',
        groupId: provision.groupId,
        ownerShip: '~ten',
      },
      provision
    );

    const existingCompletion = handleAgentOnboardingMessageSent(
      {
        success: true,
        to: provision.notebookNest,
        messageId: '~bot/notes-42',
      } as never,
      { fetchHistory, sendPost, sleep: vi.fn(async () => {}) },
      'draining-run'
    );
    await vi.waitFor(() => expect(fetchHistory).toHaveBeenCalledOnce());

    const drain = drainAgentOnboardingRuntime(api);
    expect(
      agentOnboardingTesting.findFirstRunCorrelation('draining-run')
    ).toBeNull();
    await handleAgentOnboardingCronChanged(
      {
        action: 'finished',
        jobId: 'job-1',
        runId: 'draining-run',
        status: 'ok',
        delivered: false,
      } as never,
      { fetchHistory, sendPost }
    );

    releaseHistory([]);
    await Promise.all([existingCompletion, drain]);
    expect(fetchHistory).toHaveBeenCalledOnce();
    expect(sendPost).toHaveBeenCalledTimes(2);
  });

  it('does not mutate cron or post when the sender is not the owner', async () => {
    const getCron = vi.fn();
    const sendPost = vi.fn();

    await expect(
      handleAgentOnboardingRequest(
        {
          api: { scry: vi.fn() },
          botShip: '~bot',
          channelNest: 'chat/~ten/group/general',
          groupId: provision.groupId,
          ownerShip: '~ten',
          senderShip: '~zod',
          blob: appendToPostBlob(undefined, provision),
        },
        { getCron, sendPost }
      )
    ).resolves.toBe(true);
    expect(getCron).not.toHaveBeenCalled();
    expect(sendPost).not.toHaveBeenCalled();
  });
});
