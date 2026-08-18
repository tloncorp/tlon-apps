import { A2UI, appendToPostBlob, parsePostBlob } from '@tloncorp/api';
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
  notebookTitle: 'Updates',
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
    const services = agentOnboardingTesting.buildServicesSurface(
      'pitch',
      '~ten/group',
      'provision-1'
    );
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
    // Providers and connection status belong to the client; the coordinator
    // sends only the bounded menu configuration and its navigation target.
    const servicesComponents =
      servicesRoot && 'updateComponents' in servicesRoot
        ? servicesRoot.updateComponents.components
        : [];
    expect(servicesComponents.find(({ id }) => id === 'root')).toMatchObject({
      id: 'root',
      component: 'Column',
    });
    const menu = servicesComponents.find(({ id }) => id === 'providers') as
      | A2UI.McpConnect
      | undefined;
    expect(menu).toMatchObject({
      component: 'McpConnect',
      maxVisible: 4,
      seeAllLabel: 'See all connectors',
      submitLabel: 'Use for this group',
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
  });

  it('offers optional orientation topics in one compound selector', () => {
    const surface =
      agentOnboardingTesting.buildOrientationSurface('~ten/group');
    expect(A2UI.validateBlobEntry(surface)).toBe(true);
    const update = surface.messages.find(
      (message) => 'updateComponents' in message
    );
    const components =
      update && 'updateComponents' in update
        ? update.updateComponents.components
        : [];
    const selector = components.find(
      (component): component is A2UI.SmallChoice =>
        component.component === 'SmallChoice'
    );
    expect(selector).toMatchObject({
      submitLabel: 'Continue',
      options: [
        { id: 'groups-and-channels', label: 'Groups and channels' },
        { id: 'your-tlon-computer', label: 'Your Tlon computer' },
        { id: 'other-capabilities', label: 'What else can you do?' },
        { id: 'finished', label: 'I’m good for now' },
      ],
      action: {
        event: { name: A2UI.action.sendMessage, context: { text: '' } },
      },
    });
    expect(
      components.filter((component) => component.component === 'Button')
    ).toHaveLength(0);
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

  it('describes only the provisioned home group as the first group', async () => {
    const promptFor = async (isFirstGroup?: boolean) => {
      const sent: Array<{ blob?: string }> = [];
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

      return JSON.stringify(parsePostBlob(sent[1]?.blob));
    };

    await expect(promptFor(true)).resolves.toContain(
      'What can I help you with?'
    );
    await expect(promptFor()).resolves.toContain('What can I help you with?');
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
      const sleeps: number[] = [];
      let now = 0;
      const introBlob = appendToPostBlob(undefined, {
        type: 'tlon-agent-intro-request',
        version: 1,
        groupId: '~ten/group',
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
    expect(purpose.topicsPrompt).toContain(detail);
    expect(purpose.topicsPrompt).toContain(question);
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
      'Field notes',
      ['Music theory']
    );
    expect(cadence).toContain(expectation);
    expect(cadence).toContain('notebook');
    expect(cadence).not.toContain('publish');
  });

  it('explains learning rotation without promising an unverified next topic', () => {
    const cadence = agentOnboardingTesting.provisionCadence(
      'agent-learning',
      'Updates',
      ['Music theory', 'Architecture', 'Cryptography']
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
      payload: {
        toolsAllow: expect.arrayContaining(['group:web', 'mcp_call']),
        message: expect.stringContaining('["gmail"]'),
      },
    });
  });
});

describe('provision coordinator ordering', () => {
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

  it('posts a note reference when the correlated first run finishes', async () => {
    const sendPost = vi.fn(async () => ({
      channel: 'tlon' as const,
      messageId: 'post',
      sentAt: 0,
    }));
    const sleep = vi.fn(async () => {});
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

    expect(sendPost).toHaveBeenCalledTimes(3);
    expect(listNotes).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 500);
    expect(sleep).toHaveBeenNthCalledWith(2, 3_500);
    expect(sleep).toHaveBeenNthCalledWith(3, 3_500);
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
    expect(JSON.stringify(sendPost.mock.calls[2]?.[0].story)).toContain(
      'You’re all set. Is there anything else I can help you with?'
    );
    expect(JSON.stringify(sendPost.mock.calls[2]?.[0])).toContain(
      'Groups and channels'
    );
    expect(parsePostBlob(sendPost.mock.calls[2]?.[0].blob)).toContainEqual(
      expect.objectContaining({
        type: 'tlon-agent-post-marker',
        key: 'onboarding-follow-up',
      })
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
      }
    );

    expect(sendPost).toHaveBeenCalledOnce();
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
      { fetchHistory: vi.fn(async () => []), sendPost }
    );

    expect(sendPost).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(sendPost.mock.calls[0]?.[0].story)).toContain(
      'Your first entry is ready'
    );
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
