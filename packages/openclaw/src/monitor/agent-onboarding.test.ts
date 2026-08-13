import { appendToPostBlob, parsePostBlob } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import type { TlonCronService } from '../cron-telemetry.js';
import {
  agentOnboardingTesting,
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
};

describe('agent onboarding requests', () => {
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

  it('builds a valid single client-local surface', () => {
    const surface = agentOnboardingTesting.buildOnboardingSurface('~ten/group');
    expect(surface.messages).toHaveLength(2);
    expect(
      surface.messages.find((message) => 'updateComponents' in message)
    ).toMatchObject({
      updateComponents: {
        root: 'root',
        components: [{ id: 'root', component: 'AgentOnboarding' }],
      },
    });
  });

  it('keeps onboarding follow-up actions flat', () => {
    const invite = agentOnboardingTesting.buildInviteSurface('~ten/group');
    const services = agentOnboardingTesting.buildServicesSurface();
    const inviteRoot = invite.messages.find(
      (message) => 'updateComponents' in message
    );
    const servicesRoot = services.messages.find(
      (message) => 'updateComponents' in message
    );

    expect(
      inviteRoot &&
        'updateComponents' in inviteRoot &&
        inviteRoot.updateComponents.components.find(({ id }) => id === 'root')
    ).toEqual({
      id: 'root',
      component: 'Column',
      children: ['invite'],
    });
    expect(
      servicesRoot &&
        'updateComponents' in servicesRoot &&
        servicesRoot.updateComponents.components.find(({ id }) => id === 'root')
    ).toMatchObject({ id: 'root', component: 'Button', child: 'label' });
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
      'posts a fresh morning digest'
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
    expect(sent).toHaveLength(4);
    const timezone = parsePostBlob(sent[3].blob).find(
      (entry) => entry.type === 'a2ui'
    );
    expect(JSON.stringify(timezone)).toContain('tlon.provisionAgent');
    expect(JSON.stringify(timezone)).toContain('Open hardware');
    expect(JSON.stringify(timezone)).toContain(
      'Open hardware and Space weather—got it. One last detail:'
    );
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
            content: [{ inline: ['What should this group do?'] }],
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
    ['A daily digest', 'posts a fresh morning digest', 'What should it cover?'],
    [
      'Learn something',
      'builds your understanding over time',
      'What should we explore?',
    ],
    [
      'Research',
      'begins with an overview, then follows meaningful new work',
      'What do you want to learn about?',
    ],
  ])('uses purpose-specific topic copy for %s', (reply, detail, question) => {
    const purpose = agentOnboardingTesting.purposeForReply(reply);
    expect(purpose.topicsPrompt).toContain(detail);
    expect(purpose.topicsPrompt).toContain(question);
  });

  it.each([
    ['agent-daily-digest', 'publish a fresh digest here each day'],
    [
      'agent-learning',
      'publish a short explainer on one topic each day, rotating through your list',
    ],
    ['agent-research', 'publish a fresh research update here each day'],
  ])('explains the ongoing cadence for %s', (purposeId, expectation) => {
    expect(agentOnboardingTesting.provisionCadence(purposeId)).toContain(
      expectation
    );
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

  it('makes every purpose first-run-aware in the recurring prompt', () => {
    expect(agentOnboardingTesting.buildRecurringPrompt(provision)).toContain(
      `tlon notes notes ${provision.notebookNest}`
    );
    expect(agentOnboardingTesting.buildRecurringPrompt(provision)).toContain(
      provision.topics.join(', ')
    );
  });

  it('builds a progressive entry for the learning flow', () => {
    const prompt = agentOnboardingTesting.buildRecurringPrompt({
      ...provision,
      purposeId: 'agent-learning',
      purpose: 'Learn something',
      topics: ['Music theory', 'Cryptography'],
    });
    expect(prompt).toContain(
      'topics, in rotation order, are: Music theory, Cryptography'
    );
    expect(prompt).toContain('Cover exactly one topic per entry');
    expect(prompt).toContain('never combine or force connections');
    expect(prompt).toContain('use the next topic in the list');
    expect(prompt).toContain('the next useful idea');
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
});

describe('provision coordinator ordering', () => {
  it('posts a durable ack before forcing the first run', async () => {
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
          const marker = entries.find(
            (entry) => entry.type === 'tlon-agent-post-marker'
          );
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

    expect(events).toEqual([
      'cron:add',
      'post:ack:provision-1',
      'post:handoff',
      'post:services-card',
      'cron:enqueue',
    ]);
  });

  it('posts a note reference when the correlated first run finishes', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'first-run-complete' },
      {
        api: { scry: vi.fn() },
        botShip: '~bot',
        channelNest: 'chat/~ten/group/general',
        groupId: provision.groupId,
        ownerShip: '~ten',
      },
      provision
    );

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
        listNotes: vi.fn(async () => [
          {
            id: `${provision.notebookNest}/12`,
            notebookFlag: provision.notebookNest,
            noteId: 12,
            title: 'First entry',
          },
        ]),
        sendPost,
      }
    );

    expect(sendPost).toHaveBeenCalledOnce();
    expect(JSON.stringify(sendPost.mock.calls[0]?.[0].story)).toContain(
      "Your group's first entry is ready:"
    );
    expect(sendPost.mock.calls[0]?.[0].story).toContainEqual({
      block: {
        cite: {
          chan: { nest: provision.notebookNest, where: '/note/12' },
        },
      },
    });
    expect(parsePostBlob(sendPost.mock.calls[0]?.[0].blob)).toContainEqual(
      expect.objectContaining({
        type: 'tlon-agent-post-marker',
        key: 'first-entry-ping:provision-1',
      })
    );
  });

  it('uses successful Notes delivery when the host drops cron completion', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    agentOnboardingTesting.rememberFirstRun(
      { enqueued: true, runId: 'first-run-delivery-fallback' },
      {
        api: { scry: vi.fn() },
        botShip: '~bot',
        channelNest: 'chat/~ten/group/general',
        groupId: provision.groupId,
        ownerShip: '~ten',
      },
      provision
    );

    await handleAgentOnboardingMessageSent(
      {
        to: provision.notebookNest,
        content: '# First entry',
        success: true,
        // The delivery hook can expose the nested model run rather than the
        // outer manual cron run, so the exact Notes target is the fallback.
        runId: 'nested-model-run',
      },
      {
        fetchHistory: vi.fn(async () => []),
        listNotes: vi.fn(async () => []),
        sendPost,
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
      { fetchHistory: vi.fn(async () => []), sendPost }
    );

    expect(sendPost).toHaveBeenCalledOnce();
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
