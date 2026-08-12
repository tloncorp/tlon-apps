import { A2UI } from '@tloncorp/api';
import { describe, expect, test } from 'vitest';

import {
  GROUP_INTRO_MESSAGE,
  INVITE_CARD_LEAD,
  INVITE_CARD_PROMPT,
  ONBOARDING_COMPLETE_LINE,
  ONBOARDING_PLUGIN_DIAGNOSTIC_PREFIX,
  PURPOSE_OPTIONS,
  PURPOSE_TOPICS,
  RESEARCHING_NOTEBOOK_LINE,
  TOPICS_PICKER_FOOTER,
  TOPICS_PICKER_PROMPT,
  WAITING_FOR_NOTEBOOK_LINE,
  onboardingPluginDiagnostic,
} from './agent-onboarding-config.js';
import {
  agentGroupAwaitingOpening,
  buildInviteCardBlob,
  buildPurposePickerBlob,
  buildServicesCardBlob,
  buildTimezonePickerBlob,
  buildTopicsPickerBlob,
  channelHasNoPosts,
  derivePendingPurposeFromHistory,
  descriptionHasAgentSetup,
  descriptionHasConfiguredJob,
  findAgentGroupsAwaitingOpening,
  findChatNestForGroup,
  findGroupForChannel,
  homeGroupAwaitingOpening,
  isFirstConfiguredSetup,
  isHomeGroupFlag,
  isPurposePickerChoice,
  pendingTopicsOfferFromHistory,
  purposePickerFallbackText,
  setupOutputNotebookNest,
  shouldOfferPickerOnJoin,
  shouldOfferPurposePicker,
  shouldOfferTopicsPicker,
  timezonePickerFallbackText,
  topicsPickerFallbackText,
} from './agent-onboarding.js';

const configEntry = (overrides: Record<string, unknown>) =>
  JSON.stringify([
    {
      type: 'tlon-group-agent-config',
      version: 1,
      purpose: '',
      instructions: '',
      agents: ['~pinser-botter-sampel-palnet'],
      jobs: [],
      updatedAt: 1,
      ...overrides,
    },
  ]);

const configuredDescription = configEntry({
  purpose: 'Keeps up with sourdough.',
});

const baseOpts = {
  senderIsOwner: true,
  groupHostIsOwner: true,
  groupDescription: '',
  messageText: 'hey',
  alreadyOffered: false,
};

const componentsOf = (blob: A2UI.BlobEntry) =>
  (blob.messages.find((m) => 'updateComponents' in m) as any).updateComponents
    .components as A2UI.Component[];

const catalogOf = (blob: A2UI.BlobEntry) =>
  (blob.messages.find((m) => 'createSurface' in m) as any).createSurface
    .catalogId as string;

const surfaceOf = (blob: A2UI.BlobEntry) =>
  (blob.messages.find((m) => 'createSurface' in m) as any).createSurface
    .surfaceId as string;

describe('group intro', () => {
  test('claims the agent, explains the durability, offers the rename', () => {
    // Posted as its own message before the picker; the picker asks the
    // question, so the intro must not also be asking one.
    expect(GROUP_INTRO_MESSAGE).toMatch(/your Tlonbot/i);
    expect(GROUP_INTRO_MESSAGE).toMatch(/stored in Tlon/i);
    expect(GROUP_INTRO_MESSAGE).toMatch(/model/i);
    expect(GROUP_INTRO_MESSAGE).toMatch(/own server/i);
    expect(GROUP_INTRO_MESSAGE).toMatch(/call me something else/i);
    expect(GROUP_INTRO_MESSAGE).not.toContain('?');
  });
});

describe('plugin diagnostic', () => {
  test('prints the running source commit and has an unknown fallback', () => {
    expect(onboardingPluginDiagnostic('db7081f1b')).toBe(
      `${ONBOARDING_PLUGIN_DIAGNOSTIC_PREFIX} db7081f1b`
    );
    expect(onboardingPluginDiagnostic('   ')).toBe(
      `${ONBOARDING_PLUGIN_DIAGNOSTIC_PREFIX} unknown`
    );
  });
});

describe('purpose picker card', () => {
  test('one Choice option per template, each posting its own card title', () => {
    const blob = buildPurposePickerBlob('chat/~sampel-palnet/home-group-chat');
    expect(A2UI.validateBlobEntry(blob)).toBe(true);
    expect(catalogOf(blob)).toBe('tlon.a2ui.basic.v2');

    const choice = componentsOf(blob).find(
      (c) => (c as { component: string }).component === 'Choice'
    ) as A2UI.Choice;
    expect(choice.options).toHaveLength(PURPOSE_OPTIONS.length);
    for (const [i, option] of choice.options.entries()) {
      expect(option.label).toBe(PURPOSE_OPTIONS[i].title);
      expect(option.description).toBe(PURPOSE_OPTIONS[i].description);
      expect(option.icon).toBe(PURPOSE_OPTIONS[i].icon);
      expect(option.accent).toBe(PURPOSE_OPTIONS[i].accent);
      expect(option.action.event.context.text).toBe(PURPOSE_OPTIONS[i].title);
      // The posted text must round-trip as a recognized choice, otherwise
      // the picker would be re-offered in response to its own tap.
      expect(isPurposePickerChoice(PURPOSE_OPTIONS[i].title)).toBe(true);
    }
  });

  test('option ids and titles are stable — both are wire values', () => {
    // Ids double as templateId provenance in group configs; titles are what
    // taps post back. Changing either is a wire change.
    expect(PURPOSE_OPTIONS.map((o) => o.id)).toEqual([
      'agent-daily-digest',
      'agent-tracking',
      'agent-research',
    ]);
    expect(PURPOSE_OPTIONS.map((o) => o.title)).toEqual([
      'A daily digest',
      'Tracking',
      'Research',
    ]);
  });

  test('fallback text names every option for old clients', () => {
    for (const template of PURPOSE_OPTIONS) {
      expect(purposePickerFallbackText()).toContain(template.title);
    }
  });

  test('surface ids are namespaced per channel', () => {
    expect(surfaceOf(buildPurposePickerBlob('chat/~a/one'))).not.toEqual(
      surfaceOf(buildPurposePickerBlob('chat/~b/two'))
    );
  });
});

describe('topics picker', () => {
  test('one unique pill per topic for every purpose, plus a submit label', () => {
    for (const option of PURPOSE_OPTIONS) {
      const blob = buildTopicsPickerBlob('nest', option.id)!;
      expect(A2UI.validateBlobEntry(blob)).toBe(true);
      const pills = componentsOf(blob).find(
        (c) => (c as { component: string }).component === 'SmallChoice'
      ) as A2UI.SmallChoice;
      expect(pills.options.map((o) => o.label)).toEqual([
        ...PURPOSE_TOPICS[option.id]!,
      ]);
      expect(pills.submitLabel).toBeTruthy();
      // The free-text field submits typed topics with the pills as one
      // message; without it "these plus my own" takes two.
      expect(
        (pills as { freeTextPlaceholder?: string }).freeTextPlaceholder
      ).toBeTruthy();
      const ids = pills.options.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test('the picker says the pills are not the only answer', () => {
    // Without this a wrapped row of chips reads as a closed menu, and the
    // agent handles typed answers exactly the same way.
    const blob = buildTopicsPickerBlob('nest', 'agent-research')!;
    const footer = componentsOf(blob).find(
      (c) => c.id === 'footer'
    ) as A2UI.Text;
    expect(footer.text).toBe(TOPICS_PICKER_FOOTER);
    expect(topicsPickerFallbackText('agent-research')).toContain(
      TOPICS_PICKER_FOOTER
    );
  });

  test('null for an unknown purpose rather than an empty picker', () => {
    expect(buildTopicsPickerBlob('nest', 'agent-nonexistent')).toBeNull();
  });

  test('fallback text names every topic, and still asks when purpose is unknown', () => {
    for (const topic of PURPOSE_TOPICS['agent-daily-digest']!) {
      expect(topicsPickerFallbackText('agent-daily-digest')).toContain(topic);
    }
    expect(topicsPickerFallbackText('agent-nonexistent')).toContain(
      'keep up with'
    );
  });
});

describe('timezone picker', () => {
  test('asks the client to resolve and send an IANA timezone', () => {
    const blob = buildTimezonePickerBlob('chat/~zod/home-group-chat');
    expect(blob).not.toBeNull();
    const serialized = JSON.stringify(blob);
    expect(serialized).toContain('tlon.sendMessage');
    expect(serialized).toContain('Timezone: {{tlon.timezone}}');
    expect(timezonePickerFallbackText()).toContain('America/New_York');
  });
});

describe('offer gates', () => {
  const tapped = { ...baseOpts, messageText: 'A daily digest' };

  test('purpose picker: owner first message in an unconfigured owned group only', () => {
    expect(shouldOfferPurposePicker(baseOpts)).toBe(true);
    // Human prose in the description is not configuration.
    expect(
      shouldOfferPurposePicker({
        ...baseOpts,
        groupDescription: 'a group about bread',
      })
    ).toBe(true);
    for (const off of [
      { alreadyOffered: true },
      { senderIsOwner: false },
      { groupHostIsOwner: false },
      { groupDescription: configuredDescription },
    ]) {
      expect(shouldOfferPurposePicker({ ...baseOpts, ...off })).toBe(false);
    }
    // Never in response to a tap on the picker itself.
    for (const template of PURPOSE_OPTIONS) {
      expect(
        shouldOfferPurposePicker({
          ...baseOpts,
          messageText: `  ${template.title.toUpperCase()}  `,
        })
      ).toBe(false);
    }
  });

  test('topics picker: accepts card and freeform purpose replies', () => {
    expect(shouldOfferTopicsPicker(tapped)).toEqual({
      purposeId: 'agent-daily-digest',
    });
    expect(
      shouldOfferTopicsPicker({
        ...tapped,
        messageText: 'Watch city council agendas for zoning changes',
      })
    ).toEqual({
      purposeId: 'agent-custom',
      purpose: 'Watch city council agendas for zoning changes',
    });
    for (const off of [
      { messageText: '   ' },
      { alreadyOffered: true },
      { senderIsOwner: false },
      { groupHostIsOwner: false },
      { groupDescription: configuredDescription },
    ]) {
      expect(shouldOfferTopicsPicker({ ...tapped, ...off })).toBeUndefined();
    }
  });

  test('join offer: only a newly created group the owner hosts', () => {
    const newGroup = {
      groupHostIsOwner: true,
      groupDescription: '',
      channelHasNoPosts: true as boolean | null,
      groupHasSingleChannel: true,
      alreadyOffered: false,
    };
    expect(shouldOfferPickerOnJoin(newGroup)).toBe(true);
    for (const off of [
      // A group with history is not an invitation to run setup, and an
      // uninspectable channel (null) must fail closed.
      { channelHasNoPosts: false as boolean | null },
      { channelHasNoPosts: null },
      // An established group can have an *empty chat* (its life lived in a
      // notebook or another channel); an empty channel alone is not newness.
      { groupHasSingleChannel: false },
      { groupHostIsOwner: false },
      { groupDescription: configuredDescription },
      { alreadyOffered: true },
    ]) {
      expect(shouldOfferPickerOnJoin({ ...newGroup, ...off })).toBe(false);
    }
  });
});

describe('descriptionHasAgentSetup', () => {
  test('an agents-only marker is not setup; purpose or jobs are', () => {
    // Naming who may act is the state a group is in *before* onboarding
    // (the client writes it so the agent's cards render). Treating it as
    // "configured" would suppress the very pickers that do the setup.
    const marker = configEntry({ agents: ['~zod'] });
    expect(descriptionHasAgentSetup(marker)).toBe(false);
    expect(
      shouldOfferPurposePicker({ ...baseOpts, groupDescription: marker })
    ).toBe(true);
    expect(descriptionHasAgentSetup(configuredDescription)).toBe(true);
    expect(
      descriptionHasAgentSetup(
        configEntry({ jobs: [{ id: 'daily', enabled: true }] })
      )
    ).toBe(true);
  });

  test('only a written job counts as a finished setup', () => {
    // What gates the closing invite card. A purpose with no job is a build
    // that announced itself and stopped, and posting the card there would
    // hand over a share link for a group that does nothing yet.
    expect(
      descriptionHasConfiguredJob(configEntry({ purpose: 'Keeps up.' }))
    ).toBe(false);
    expect(descriptionHasConfiguredJob(configEntry({ agents: ['~zod'] }))).toBe(
      false
    );
    expect(descriptionHasConfiguredJob('a group about bread')).toBe(false);
    expect(descriptionHasConfiguredJob(null)).toBe(false);
    expect(
      descriptionHasConfiguredJob(
        configEntry({ purpose: 'Keeps up.', jobs: [{ id: 'weekly' }] })
      )
    ).toBe(true);
  });

  test('prose, junk, and absence are all unconfigured', () => {
    for (const description of [
      'a group about bread',
      'we use tlon-group-agent-config here',
      '[{"type":',
      '[1,2,3]',
      '',
      null,
      undefined,
    ]) {
      expect(descriptionHasAgentSetup(description)).toBe(false);
    }
  });
});

describe('group/channel resolution', () => {
  const nest = 'chat/~ten/onboarding-test-chat';
  const groups = {
    '~ten/onboarding-test': {
      meta: { description: 'a group about bread' },
      'active-channels': [nest],
      channels: { [nest]: {} },
    },
    '~ten/gallery-only': {
      meta: { description: '' },
      'active-channels': ['heap/~ten/pics'],
      channels: { 'heap/~ten/pics': {} },
    },
  };
  const apiWith = (result: unknown) => ({ scry: async () => result });
  const failing = {
    scry: async () => {
      throw new Error('boom');
    },
  };

  test('findGroupForChannel resolves flag, host and description', async () => {
    expect(await findGroupForChannel(apiWith(groups), nest, {})).toEqual({
      flag: '~ten/onboarding-test',
      host: '~ten',
      description: 'a group about bread',
    });
    // Falls back to the channels map when active-channels is absent.
    expect(
      (
        await findGroupForChannel(
          apiWith({ '~ten/g': { meta: {}, channels: { [nest]: {} } } }),
          nest,
          {}
        )
      )?.flag
    ).toBe('~ten/g');
  });

  test('findChatNestForGroup resolves the chat nest', async () => {
    expect(
      await findChatNestForGroup(apiWith(groups), '~ten/onboarding-test', {})
    ).toEqual({
      nest,
      host: '~ten',
      description: 'a group about bread',
      channelCount: 1,
    });
    // Null for a group not in the scry yet (callers poll) or with no chat.
    expect(await findChatNestForGroup(apiWith(groups), '~ten/nope', {})).toBe(
      null
    );
    expect(
      await findChatNestForGroup(apiWith(groups), '~ten/gallery-only', {})
    ).toBe(null);
  });

  test('both return null on scry failure, missing group, or missing api', async () => {
    const errors: string[] = [];
    expect(
      await findGroupForChannel(failing, nest, { error: (m) => errors.push(m) })
    ).toBeNull();
    expect(errors).toHaveLength(1);
    expect(await findGroupForChannel(apiWith(groups), 'chat/~zzz/no', {})).toBe(
      null
    );
    expect(await findGroupForChannel(null, nest, {})).toBeNull();
    expect(await findChatNestForGroup(failing, nest, {})).toBe(null);
    expect(await findChatNestForGroup(null, nest, {})).toBe(null);
  });

  test('channelHasNoPosts: true only for a readable empty channel', async () => {
    expect(await channelHasNoPosts(apiWith({ posts: {} }), nest, {})).toBe(
      true
    );
    expect(
      await channelHasNoPosts(
        apiWith({ posts: { '170.141': { essay: {} } } }),
        nest,
        {}
      )
    ).toBe(false);
    // null means "couldn't inspect" — the caller must not treat the channel
    // as new, or the bot would post into groups it can't read.
    expect(await channelHasNoPosts(failing, nest, {})).toBe(null);
    expect(await channelHasNoPosts(null, nest, {})).toBe(null);
    expect(await channelHasNoPosts(apiWith(null), nest, {})).toBe(null);
  });
});

describe('pendingTopicsOfferFromHistory', () => {
  const BOT = '~pinser-botter-sampel-palnet';
  const OWNER = '~sampel-palnet';
  const opening = (t: number) => ({
    author: BOT,
    content: purposePickerFallbackText(),
    timestamp: t,
  });
  const tap = (t: number) => ({
    author: OWNER,
    content: 'A daily digest',
    timestamp: t,
  });
  const pills = (t: number) => ({
    author: BOT,
    content: topicsPickerFallbackText('agent-daily-digest'),
    timestamp: t,
  });

  test('finds a tap the gateway never answered', () => {
    // Observed live: the tap landed during a gateway restart, so no
    // message event ever produced the pills and the owner sat stuck.
    expect(
      pendingTopicsOfferFromHistory([opening(1), tap(2)], BOT, OWNER)
    ).toEqual({ purposeId: 'agent-daily-digest' });
    // A duplicate tap doesn't change the answer.
    expect(
      pendingTopicsOfferFromHistory([opening(1), tap(2), tap(3)], BOT, OWNER)
    ).toEqual({ purposeId: 'agent-daily-digest' });
  });

  test('recovers a freeform purpose and stays out once topics were offered', () => {
    expect(
      pendingTopicsOfferFromHistory(
        [
          opening(1),
          {
            author: OWNER,
            content: 'Watch city council agendas',
            timestamp: 2,
          },
        ],
        BOT,
        OWNER
      )
    ).toEqual({
      purposeId: 'agent-custom',
      purpose: 'Watch city council agendas',
    });
    expect(
      pendingTopicsOfferFromHistory([opening(1), tap(2), pills(3)], BOT, OWNER)
    ).toBeUndefined();
  });

  test('requires the opening picker in the transcript', () => {
    // A bare card-title message with no picker below it is just text.
    expect(pendingTopicsOfferFromHistory([tap(2)], BOT, OWNER)).toBeUndefined();
  });

  test('ignores owner messages from before the opening picker', () => {
    expect(
      pendingTopicsOfferFromHistory([tap(1), opening(2)], BOT, OWNER)
    ).toBeUndefined();
    expect(
      pendingTopicsOfferFromHistory([tap(1), opening(2), tap(3)], BOT, OWNER)
    ).toEqual({ purposeId: 'agent-daily-digest' });
  });
});

describe('setupOutputNotebookNest', () => {
  const groupsWith = (groups: Record<string, unknown>) => ({
    scry: async () => groups,
  });

  test('finds the owner-hosted notes channel, or waits when absent', async () => {
    const groups = groupsWith({
      '~nec/g': {
        channels: {
          'chat/~nec/g-chat': {},
          'notes/~nec/research-1': {},
        },
      },
    });
    expect(await setupOutputNotebookNest(groups, '~nec/g', {})).toBe(
      'notes/~nec/research-1'
    );
    expect(
      await setupOutputNotebookNest(
        groupsWith({ '~nec/g': { channels: { 'chat/~nec/g-chat': {} } } }),
        '~nec/g',
        {}
      )
    ).toBeNull();
  });
});

describe('invite card', () => {
  test('marks the durable end of the setup', () => {
    expect(INVITE_CARD_LEAD).toBe('Tlon is better with someone else in it.');
    expect(INVITE_CARD_PROMPT).toBe(
      'Tlon is better with someone else in it. Send them this link:'
    );
  });

  test('a valid blob whose button carries the group, not a link', () => {
    const blob = buildInviteCardBlob('chat/~ten/home-chat', '~ten/home-group')!;
    expect(blob).not.toBeNull();
    expect(A2UI.validateBlobEntry(blob)).toBe(true);
    const button = componentsOf(blob).find(
      (c) => (c as { component: string }).component === 'Button'
    ) as any;
    expect(button.action.event.name).toBe('tlon.inviteLink');
    // No URL travels in the card — the client resolves the live lure, so
    // nothing here can go stale.
    expect(button.action.event.context).toEqual({
      groupId: '~ten/home-group',
    });
    expect(JSON.stringify(blob)).not.toMatch(/https?:/);
  });

  test('surfaces are namespaced per channel', () => {
    expect(surfaceOf(buildInviteCardBlob('chat/~a/one', '~a/g')!)).not.toEqual(
      surfaceOf(buildInviteCardBlob('chat/~b/two', '~b/g')!)
    );
  });
});

describe('build progress', () => {
  test('reports the job, notebook, and research transitions', () => {
    expect(WAITING_FOR_NOTEBOOK_LINE).toBe(
      'Job scheduled. Creating a notebook channel to write into...'
    );
    expect(RESEARCHING_NOTEBOOK_LINE).toBe(
      'Notebook created. Searching the web and summarizing, this might take a sec...'
    );
    expect(ONBOARDING_COMPLETE_LINE).toBe(
      "Done! Today's scheduled task is in a Notebook channel in this group."
    );
  });
});

describe('findAgentGroupsAwaitingOpening', () => {
  const marker = JSON.stringify([
    {
      type: 'tlon-group-agent-config',
      version: 1,
      purpose: '',
      instructions: '',
      agents: ['~zod'],
      jobs: [],
      updatedAt: 1,
    },
  ]);
  const configured = JSON.stringify([
    {
      type: 'tlon-group-agent-config',
      version: 1,
      purpose: 'Tracks things.',
      agents: ['~zod'],
      jobs: [{ id: 'job-1' }],
      updatedAt: 1,
    },
  ]);
  const apiWith = (groups: Record<string, { description: string }>) => ({
    scry: async () =>
      Object.fromEntries(
        Object.entries(groups).map(([flag, { description }]) => [
          flag,
          { meta: { description }, channels: {} },
        ])
      ),
  });

  test('only marker-bearing, unconfigured, owner-hosted groups match', async () => {
    const api = apiWith({
      // The lost-opening case: created with the agent marker, never set up.
      '~ten/fresh-agent-group': { description: marker },
      // Ordinary groups must never match on shape — an empty owner-hosted
      // channel can be a muted or dormant group, not a pending onboarding.
      '~ten/plain-empty-group': { description: '' },
      '~ten/prose-group': { description: 'a group about bread' },
      // Setup already happened; nothing owed.
      '~ten/configured-group': { description: configured },
      // A persisted timezone transition remains a sweep candidate until its
      // picker is visible and answered.
      '~ten/timezone-owed': {
        description: configEntry({
          purpose: 'Daily research',
          onboarding: {
            state: 'awaiting-timezone',
            topics: 'Mycology',
          },
        }),
      },
      // Someone else's group, whatever it carries.
      '~bus/their-agent-group': { description: marker },
    });
    expect(await findAgentGroupsAwaitingOpening(api, {}, '~ten')).toEqual([
      '~ten/fresh-agent-group',
      '~ten/timezone-owed',
    ]);
    expect(await findAgentGroupsAwaitingOpening(api, {}, null)).toEqual([]);
  });

  test('bot-only posts leave the home group still awaiting its opening', () => {
    const BOT = '~pinser-botter-forhep-tanmel';
    const OWNER = '~forhep-tanmel';
    const legacyWelcome = {
      author: BOT,
      content: 'Welcome! This is your private group with me, your Tlonbot.',
    };
    // The provisioning-era welcome was posted as the bot and can't be
    // unsent; it must not block the opening for existing accounts.
    expect(homeGroupAwaitingOpening([legacyWelcome], BOT)).toBe(true);
    expect(homeGroupAwaitingOpening([], BOT)).toBe(true);
    // Anyone else speaking makes it a conversation.
    expect(
      homeGroupAwaitingOpening(
        [legacyWelcome, { author: OWNER, content: 'hello' }],
        BOT
      )
    ).toBe(false);
    // An opening already posted must not be doubled.
    expect(
      homeGroupAwaitingOpening(
        [legacyWelcome, { author: BOT, content: purposePickerFallbackText() }],
        BOT
      )
    ).toBe(false);
  });

  test('owner bootstrap posts do not block a new agent group opening', () => {
    const BOT = '~pinser-botter-forhep-tanmel';
    const OWNER = '~forhep-tanmel';
    expect(
      agentGroupAwaitingOpening(
        [
          { author: OWNER, content: 'Creating this group' },
          { author: BOT, content: 'Plugin diagnostic' },
        ],
        BOT,
        OWNER
      )
    ).toBe(true);
    expect(
      agentGroupAwaitingOpening(
        [{ author: '~someone-else', content: 'hello' }],
        BOT,
        OWNER
      )
    ).toBe(false);
    expect(
      agentGroupAwaitingOpening(
        [{ author: BOT, content: purposePickerFallbackText() }],
        BOT,
        OWNER
      )
    ).toBe(false);
  });

  test('the hosted home group is a candidate without a marker', async () => {
    // Provisioning force-joins the moon (no invite event) and writes no
    // marker, so an existing unconfigured home group must sweep on its
    // deterministic flag alone — and drop out once setup writes the config.
    expect(
      await findAgentGroupsAwaitingOpening(
        apiWith({ '~ten/home-group': { description: '' } }),
        {},
        '~ten'
      )
    ).toEqual(['~ten/home-group']);
    expect(
      await findAgentGroupsAwaitingOpening(
        apiWith({ '~ten/home-group': { description: configured } }),
        {},
        '~ten'
      )
    ).toEqual([]);
    // A home group that doesn't exist yet (self-hosted accounts) is not a
    // candidate — the sweep must not poll for a group that will never come.
    expect(
      await findAgentGroupsAwaitingOpening(
        apiWith({ '~ten/other': { description: '' } }),
        {},
        '~ten'
      )
    ).toEqual([]);
  });

  test('an unreadable scry yields no candidates', async () => {
    const errors: string[] = [];
    expect(
      await findAgentGroupsAwaitingOpening(
        {
          scry: async () => {
            throw new Error('boom');
          },
        },
        { error: (m) => errors.push(m) },
        '~ten'
      )
    ).toEqual([]);
    expect(errors).toHaveLength(1);
  });
});

describe('services card', () => {
  test('a valid blob whose button opens the allowlisted services screen', () => {
    const blob = buildServicesCardBlob('chat/~ten/home-chat')!;
    expect(blob).not.toBeNull();
    expect(A2UI.validateBlobEntry(blob)).toBe(true);
    const button = componentsOf(blob).find(
      (c) => (c as { component: string }).component === 'Button'
    ) as any;
    expect(button.action.event.name).toBe('tlon.navigate');
    // A named screen from the client's allowlist, not a free route — an
    // older client fails validation and falls back to the story text.
    expect(button.action.event.context.target).toEqual({
      type: 'screen',
      screen: 'botMcpSettings',
    });
  });

  test('the home group is the hosted account’s initial onboarding venue', () => {
    expect(isHomeGroupFlag('~ten/home-group', '~ten')).toBe(true);
    // Someone else's home group, a user-created group, no owner configured.
    expect(isHomeGroupFlag('~ten/home-group', '~zod')).toBe(false);
    expect(isHomeGroupFlag('~ten/garden-club', '~ten')).toBe(false);
    expect(isHomeGroupFlag('~ten/home-group', null)).toBe(false);
  });

  describe('isFirstConfiguredSetup', () => {
    const configured = JSON.stringify([
      {
        type: 'tlon-group-agent-config',
        version: 1,
        purpose: 'Tracks things.',
        agents: ['~zod'],
        jobs: [{ id: 'job-1' }],
        updatedAt: 1,
      },
    ]);
    const groupsWith = (entries: Record<string, string>) => ({
      scry: async () =>
        Object.fromEntries(
          Object.entries(entries).map(([flag, description]) => [
            flag,
            { meta: { description }, channels: {} },
          ])
        ),
    });

    test('true when this is the only configured group — however it was made', async () => {
      // A self-hosted account has no home group at all, so its first
      // user-created agent group is the initial onboarding.
      expect(
        await isFirstConfiguredSetup(
          groupsWith({ '~ten/v2n85usn': configured }),
          {},
          '~ten/v2n85usn'
        )
      ).toBe(true);
      // Unconfigured neighbours don't count as prior setups.
      expect(
        await isFirstConfiguredSetup(
          groupsWith({ '~ten/v2n85usn': configured, '~ten/plain': '' }),
          {},
          '~ten/v2n85usn'
        )
      ).toBe(true);
    });

    test("another ship's configured group is not this owner's history", async () => {
      // The bot can sit in someone else's agent group; its job says
      // nothing about whether *this* owner has been through a setup. Read
      // as a prior setup, it skipped the services card and settled the
      // closing early on the owner's genuine first one.
      expect(
        await isFirstConfiguredSetup(
          groupsWith({
            '~ten/v2n85usn': configured,
            '~sampel-palnet/theirs': configured,
          }),
          {},
          '~ten/v2n85usn'
        )
      ).toBe(true);
    });

    test('false once another group already carries a job', async () => {
      expect(
        await isFirstConfiguredSetup(
          groupsWith({ '~ten/second': configured, '~ten/first': configured }),
          {},
          '~ten/second'
        )
      ).toBe(false);
    });

    test('null on an unreadable scry, so the caller stays quiet', async () => {
      const errors: string[] = [];
      expect(
        await isFirstConfiguredSetup(
          {
            scry: async () => {
              throw new Error('boom');
            },
          },
          { error: (m) => errors.push(m) },
          '~ten/whatever'
        )
      ).toBeNull();
      expect(errors).toHaveLength(1);
    });
  });
});

describe('derivePendingPurposeFromHistory', () => {
  const BOT = '~zod';
  const OWNER = '~ten';
  const pills = {
    author: BOT,
    content: TOPICS_PICKER_PROMPT + ' Weather, News — or just tell me.',
  };
  const tap = { author: OWNER, content: 'A daily digest' };

  test('recovers the purpose when the pills went unanswered', () => {
    // Restart between posting the pills and the owner replying: the
    // in-memory pending map is gone, but the transcript is not.
    expect(
      derivePendingPurposeFromHistory(
        [
          { ...tap, timestamp: 1 },
          { ...pills, timestamp: 2 },
        ],
        BOT,
        OWNER
      )
    ).toEqual({ purposeId: 'agent-daily-digest' });
    // A duplicate card tap after the pills doesn't hide the pending pick:
    // the pills are still awaiting their real answer.
    expect(
      derivePendingPurposeFromHistory(
        [
          { ...tap, timestamp: 1 },
          { ...pills, timestamp: 2 },
          { ...tap, timestamp: 3 },
        ],
        BOT,
        OWNER
      )
    ).toEqual({ purposeId: 'agent-daily-digest' });
  });

  test('nothing to recover once the owner has said anything newer', () => {
    expect(
      derivePendingPurposeFromHistory(
        [
          { ...tap, timestamp: 1 },
          { ...pills, timestamp: 2 },
          { author: OWNER, content: 'Weather, News', timestamp: 3 },
        ],
        BOT,
        OWNER
      )
    ).toBeUndefined();
  });

  test('a tap with no pills posted after it is not recoverable', () => {
    // The pills post can fail, or the process can die before it lands. The
    // owner never saw the topics step, so their next message must not be
    // consumed as its answer — they get the picker offered again instead.
    expect(
      derivePendingPurposeFromHistory([{ ...tap, timestamp: 1 }], BOT, OWNER)
    ).toBeUndefined();
  });

  test('the reply being handled is skipped, not read as a newer message', () => {
    // History fetched mid-turn can already contain the post that triggered
    // this turn. Counting it as "some other owner message" abandoned recovery
    // and re-offered the picker over the answered one.
    const history = [
      { ...tap, timestamp: 1 },
      { ...pills, timestamp: 2 },
      { author: OWNER, content: 'Weather, News', timestamp: 3 },
    ];
    expect(
      derivePendingPurposeFromHistory(history, BOT, OWNER, 'Weather, News')
    ).toEqual({ purposeId: 'agent-daily-digest' });
    // Without being told, the same history reads as already answered.
    expect(
      derivePendingPurposeFromHistory(history, BOT, OWNER)
    ).toBeUndefined();
  });

  test('recovers a freeform purpose after the topics prompt', () => {
    expect(
      derivePendingPurposeFromHistory(
        [
          {
            author: OWNER,
            content: 'Watch city council agendas',
            timestamp: 1,
          },
          { ...pills, timestamp: 2 },
        ],
        BOT,
        OWNER
      )
    ).toEqual({
      purposeId: 'agent-custom',
      purpose: 'Watch city council agendas',
    });
  });

  test('nothing to recover from a channel with no picker exchange', () => {
    expect(
      derivePendingPurposeFromHistory(
        [{ author: OWNER, content: 'hey', timestamp: 1 }],
        BOT,
        OWNER
      )
    ).toBeUndefined();
    expect(derivePendingPurposeFromHistory([], BOT, OWNER)).toBeUndefined();
  });
});
