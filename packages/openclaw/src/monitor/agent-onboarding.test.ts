import { A2UI } from '@tloncorp/api';
import { describe, expect, test } from 'vitest';

import {
  GROUP_INTRO_MESSAGE,
  PURPOSE_JOBS,
  PURPOSE_OPTIONS,
  PURPOSE_TOPICS,
  TOPICS_PICKER_FOOTER,
  TOPICS_PICKER_PROMPT,
} from './agent-onboarding-config.js';
import {
  brokenConfigDescriptionError,
  buildInviteCardBlob,
  buildPurposePickerBlob,
  buildServicesCardBlob,
  buildTopicsPickerBlob,
  channelHasNoPosts,
  derivePendingPurposeFromHistory,
  descriptionHasAgentSetup,
  descriptionHasConfiguredJob,
  findAgentGroupsAwaitingOpening,
  findChatNestForGroup,
  findGroupForChannel,
  firstConfiguredJob,
  homeGroupAwaitingOpening,
  isFirstConfiguredSetup,
  isHomeGroupFlag,
  isPurposePickerChoice,
  pendingTopicsOfferFromHistory,
  purposePickerFallbackText,
  renderFinishingDirective,
  renderNotebookEntryDirective,
  renderSetupDirective,
  setupOutputNotebookNest,
  shouldOfferPickerOnJoin,
  shouldOfferPurposePicker,
  shouldOfferTopicsPicker,
  topicsPickerAnswered,
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

  test('topics picker: follows a card tap, mapping title to purpose id', () => {
    expect(shouldOfferTopicsPicker(tapped)).toBe('agent-daily-digest');
    for (const off of [
      { messageText: 'hey' },
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
    ).toBe('agent-daily-digest');
    // A duplicate tap doesn't change the answer.
    expect(
      pendingTopicsOfferFromHistory([opening(1), tap(2), tap(3)], BOT, OWNER)
    ).toBe('agent-daily-digest');
  });

  test('stays out once pills exist or the owner moved on', () => {
    expect(
      pendingTopicsOfferFromHistory([opening(1), tap(2), pills(3)], BOT, OWNER)
    ).toBeUndefined();
    expect(
      pendingTopicsOfferFromHistory(
        [
          opening(1),
          tap(2),
          { author: OWNER, content: 'actually, hello?', timestamp: 3 },
        ],
        BOT,
        OWNER
      )
    ).toBeUndefined();
  });

  test('requires the opening picker in the transcript', () => {
    // A bare card-title message with no picker below it is just text.
    expect(pendingTopicsOfferFromHistory([tap(2)], BOT, OWNER)).toBeUndefined();
  });
});

describe('setupOutputNotebookNest', () => {
  const groupsWith = (groups: Record<string, unknown>) => ({
    scry: async () => groups,
  });

  test('prefers the recorded outputNest, skipping chat fallbacks', async () => {
    const config = JSON.stringify([
      {
        type: 'tlon-group-agent-config',
        version: 1,
        agents: ['~zod'],
        jobs: [{ id: 'digest', outputNest: 'notes/~zod/daily-digest-1' }],
      },
    ]);
    expect(
      await setupOutputNotebookNest(groupsWith({}), '~nec/g', config, {})
    ).toBe('notes/~zod/daily-digest-1');
    // The 404-fallback path records a chat nest — that is not a notebook.
    const chatFallback = config.replace(
      'notes/~zod/daily-digest-1',
      'chat/~nec/home-group-chat'
    );
    expect(
      await setupOutputNotebookNest(groupsWith({}), '~nec/g', chatFallback, {})
    ).toBeNull();
  });

  test('a recorded chat nest wins over a notes channel in the group', async () => {
    // The case above only proved the chat nest returned null when there was
    // no notebook to find anyway. A job that writes to chat inside a group
    // that *has* a notebook must still report none: otherwise the closing
    // waits for a day-one entry in a channel this job never writes to, and
    // the owner's app creating one mid-setup is enough to trigger it.
    const chatOutput = JSON.stringify([
      {
        type: 'tlon-group-agent-config',
        version: 1,
        agents: ['~zod'],
        jobs: [{ id: 'digest', outputNest: 'chat/~nec/home-group-chat' }],
      },
    ]);
    const groups = groupsWith({
      '~nec/g': { channels: { 'notes/~zod/research-1': {} } },
    });
    expect(
      await setupOutputNotebookNest(groups, '~nec/g', chatOutput, {})
    ).toBeNull();
  });

  test('an unrecorded outputNest still falls through to the group', async () => {
    // Only a *recorded* nest is a decision. Before the agent writes one
    // down, the group scan is how the owner's fresh notebook is found.
    const noOutput = JSON.stringify([
      {
        type: 'tlon-group-agent-config',
        version: 1,
        agents: ['~zod'],
        jobs: [{ id: 'digest', outputNest: '' }, { id: 'other' }],
      },
    ]);
    const groups = groupsWith({
      '~nec/g': { channels: { 'notes/~zod/research-1': {} } },
    });
    expect(await setupOutputNotebookNest(groups, '~nec/g', noOutput, {})).toBe(
      'notes/~zod/research-1'
    );
  });

  test('falls back to the group notes channel, or null without one', async () => {
    const groups = groupsWith({
      '~nec/g': {
        channels: {
          'chat/~nec/g-chat': {},
          'notes/~zod/research-1': {},
        },
      },
    });
    expect(await setupOutputNotebookNest(groups, '~nec/g', '', {})).toBe(
      'notes/~zod/research-1'
    );
    expect(
      await setupOutputNotebookNest(
        groupsWith({ '~nec/g': { channels: { 'chat/~nec/g-chat': {} } } }),
        '~nec/g',
        '',
        {}
      )
    ).toBeNull();
  });
});

describe('brokenConfigDescriptionError', () => {
  test('flags only config-shaped text that fails to parse', () => {
    // The observed live failure: a shell-truncated write stored the front
    // half of the config, cut mid-string inside the job prompt.
    const truncated =
      '[{"type":"tlon-group-agent-config","version":1,"jobs":[{"prompt":"Put together todays';
    expect(brokenConfigDescriptionError(truncated)).toBeTruthy();
    // Also observed live: the tool ran no shell, so the description became
    // the literal substitution text instead of the file's JSON.
    expect(
      brokenConfigDescriptionError('$(cat /tmp/daily-digest-config.json)')
    ).toContain('unexpanded');
    expect(brokenConfigDescriptionError('a group about bread')).toBeNull();
    expect(brokenConfigDescriptionError('')).toBeNull();
    expect(brokenConfigDescriptionError(null)).toBeNull();
    expect(
      brokenConfigDescriptionError(
        JSON.stringify([
          { type: 'tlon-group-agent-config', version: 1, agents: ['~zod'] },
        ])
      )
    ).toBeNull();
  });

  test('flags valid JSON the app would not recognize as config', () => {
    // A bare job array without the typed wrapper parses cleanly and reads
    // as "no config" — the same silent stall as a parse failure.
    expect(
      brokenConfigDescriptionError(
        JSON.stringify([{ id: 'digest', prompt: 'x' }])
      )
    ).toContain('no recognized config entry');
    expect(brokenConfigDescriptionError('[]')).toContain(
      'no recognized config entry'
    );
    // Wrong version is unrecognized too.
    expect(
      brokenConfigDescriptionError(
        JSON.stringify([
          { type: 'tlon-group-agent-config', version: 2, agents: ['~zod'] },
        ])
      )
    ).toContain('no recognized config entry');
  });
});

describe('renderSetupDirective', () => {
  test('forbids progress narration and doubled announcements', () => {
    // Observed live: the model posted every setup step into the chat the
    // owner was watching ("renaming the group", "notebook exists", a
    // timeout complaint) and announced completion twice after a retry.
    const directive = renderSetupDirective('agent-daily-digest', 'News')!;
    expect(directive).toContain('Do not narrate progress');
    expect(directive).toMatch(/sent once,\s*never repeated/);
  });

  test('the config write goes through a file, not a shell argument', () => {
    // Observed live: the deployed CLI predates --description-stdin, the
    // model fell back to a hand-escaped inline argument, and the shell cut
    // the JSON at an apostrophe — storing a truncated description the app
    // reads as "no config". Quoted command substitution from a file works
    // on every CLI version and can't lose quotes.
    const directive = renderSetupDirective('agent-research', 'Mycology')!;
    expect(directive).toContain(
      '--description "$(cat /tmp/tlon-group-config.json)"'
    );
    expect(directive).not.toContain('--description-stdin');
    expect(directive).toMatch(/re-run the identical command once/i);
  });

  test('renders each purpose verbatim from its template', () => {
    for (const option of PURPOSE_OPTIONS) {
      // A card without a template would silently degrade to a
      // model-composed cron prompt, defeating the point of templating.
      const job = PURPOSE_JOBS[option.id]!;
      const directive = renderSetupDirective(option.id, 'Peptides, Mycology')!;
      expect(directive).toContain(
        job.prompt.replaceAll('{{topics}}', 'Peptides, Mycology')
      );
      expect(directive).toContain(job.schedule);
      expect(directive).toContain(`templateId: ${option.id}`);
      expect(directive).not.toContain('{{');
    }
    expect(renderSetupDirective('agent-research', '  Homelabs  ')).toContain(
      'Research update: Homelabs'
    );
    expect(renderSetupDirective('agent-nonexistent', 'x')).toBeNull();
  });

  test('tracking seeds the owner-hosted notebook with the sample entry', () => {
    // Tracking's first scheduled run may be a day away, so its day-one
    // entry is a seed rather than a check-in. The agent supplies the
    // words; the sweep supplies the nest and the moment.
    const directive = renderSetupDirective('agent-tracking', 'HRV, Dreams')!;
    expect(directive).toContain("don't go looking for the notebook");
    expect(directive).toContain('Tlon hands you its nest');
    expect(directive).toContain(
      'Analysis and summaries of your HRV, Dreams entries will land in ' +
        'this notebook.'
    );
    // Digest and research seed nothing.
    expect(renderSetupDirective('agent-daily-digest', 'News')).not.toContain(
      'About this notebook'
    );
  });

  test('the config example is the whole description, not a bare job', () => {
    // Regression: the example showed only the job object, and the agent wrote
    // *that* as the description — no type, no agents, no jobs wrapper. The
    // client then stopped recognizing the agent, so every card in the group
    // stopped rendering and the raw JSON became the group's description.
    const directive = renderSetupDirective('agent-research', 'Mycology')!;
    expect(directive).toContain('"type":"tlon-group-agent-config"');
    expect(directive).toContain('"jobs":[{');
    expect(directive).toContain('"agents":');
    expect(directive).toMatch(/whole description is exactly this array/i);
  });

  test('every job runs daily', () => {
    // A job that fires weekly is a job the owner forgets they have, and the
    // promise the setup makes is that something arrives tomorrow morning.
    for (const [purposeId, job] of Object.entries(PURPOSE_JOBS)) {
      const [, , dayOfMonth, month, dayOfWeek] = job.schedule.split(' ');
      expect(
        [dayOfMonth, month, dayOfWeek],
        `${purposeId} should run every day`
      ).toEqual(['*', '*', '*']);
    }
  });

  test('the build defers the name and the icon to the finishing turn', () => {
    // Both are cosmetic and the icon half is the least reliable step in the
    // build — image generation is slow and `tlon upload` has been failing
    // outright. Run first, they spend the turn before the config, the
    // notebook and the entry exist; run last, a failure costs a name and a
    // picture on a group that already works.
    const directive = renderSetupDirective('agent-research', 'Mycology')!;
    expect(directive).not.toContain('--image');
    expect(directive).not.toContain('tlon upload');
    expect(directive).toContain('do NOT rename the group');
    expect(directive).toContain('do NOT generate an icon in this turn');
    // The config is what makes the owner's app create the notebook, so it
    // has to be the first thing written, not the last.
    expect(directive).toContain('FIRST: write the group config');
  });

  test('the finishing steps ride the entry directive, and stand alone', () => {
    const withEntry = renderNotebookEntryDirective('notes/~zod/d', {
      title: 'Daily Digest',
    });
    // Order: entry first, then the look.
    expect(withEntry.indexOf('--markdown')).toBeLessThan(
      withEntry.indexOf('--image')
    );
    expect(withEntry).toContain('Last, once the entry is written');
    expect(withEntry).toContain('tlon upload');
    expect(withEntry).toContain('skip the icon');

    // A notebook that never arrives must not cost the rename outright.
    const finishing = renderFinishingDirective();
    expect(finishing).toContain('never appeared');
    expect(finishing).toContain('--image');
    expect(finishing).toContain('placeholder name');
    expect(finishing).not.toContain('--markdown');
  });

  test('pins the values the model must not improvise', () => {
    const directive = renderSetupDirective('agent-tracking', 'Sleep')!;
    expect(directive).toContain('Do not rewrite');
    expect(directive).toContain('The group description is the config JSON');
    expect(directive).toContain('"prompt" field');
    expect(directive).toContain("owner's timezone");
    expect(directive).toContain('Never create a group');
    // Setup must not create the output channel — the first run does, so the
    // notebook arrives holding a real entry instead of sitting empty.
    expect(directive).toContain('Never create a channel either');
    expect(directive).toContain('"outputNest" stays');
    // An empty toolsAllow schedules a job that wakes with zero tools.
    expect(directive).toContain('toolsAllow');
    expect(directive).toContain('Omit');
  });

  test('the build never creates, finds, or writes the notebook itself', () => {
    // Both halves are live failures. The agent hosting its own notebook
    // put the channel on the bot's moon; then "poll for the owner's and
    // write" had the model write *first*, into a nest it picked, before
    // the channel existed — the poke was accepted and the entry vanished.
    // Discovery and timing moved to the sweep, which can see the channel.
    for (const purposeId of Object.keys(PURPOSE_JOBS)) {
      const directive = renderSetupDirective(purposeId, 'Sleep')!;
      expect(directive).toContain("The notebook is the OWNER's channel");
      expect(directive).toContain('NEVER create a channel');
      expect(directive).toContain('do NOT write the entry yet');
      expect(directive).toContain('Tlon watches for the notebook itself');
      expect(directive).not.toContain('channels create');
      expect(directive).not.toContain('--kind notes');
      // The old self-service instructions must not linger anywhere in the
      // payload the cron runs every time.
      expect(directive).not.toContain('re-check every fifteen seconds');
      expect(directive).not.toContain('tlon channels groups');
    }
  });

  test('the entry directive names the nest and forbids the dead flag', () => {
    const directive = renderNotebookEntryDirective('notes/~zod/daily', {
      title: 'Daily Digest',
      prompt: 'Summarize the day.',
    });
    expect(directive).toContain('notes/~zod/daily');
    expect(directive).toContain('Daily Digest');
    expect(directive).toContain('Summarize the day.');
    expect(directive).toContain('--markdown <file>');
    expect(directive).toContain('Never `--stdin`');
    // Silent, like every other step of the build.
    expect(directive).toContain('post nothing about it in chat');
    // A job with neither title nor prompt still yields a usable ask.
    const bare = renderNotebookEntryDirective('notes/~zod/daily', null);
    expect(bare).toContain('notes/~zod/daily');
    expect(bare).toContain('--markdown <file>');
  });

  test('firstConfiguredJob reads the job the entry directive describes', () => {
    const withJob = JSON.stringify([
      {
        type: 'tlon-group-agent-config',
        version: 1,
        agents: ['~zod'],
        jobs: [{ title: 'Daily Digest', prompt: 'Summarize.' }],
      },
    ]);
    expect(firstConfiguredJob(withJob)).toEqual({
      title: 'Daily Digest',
      prompt: 'Summarize.',
    });
    // A config that carries no job yet is a build still running.
    const marker = JSON.stringify([
      { type: 'tlon-group-agent-config', version: 1, agents: ['~zod'] },
    ]);
    expect(firstConfiguredJob(marker)).toBeNull();
    expect(firstConfiguredJob('a group about bread')).toBeNull();
    expect(firstConfiguredJob(null)).toBeNull();
  });

  test('every setup ends with the invite ask, and never a hand-made link', () => {
    // The splash screen that asked for contacts is gone; this is the only
    // ask left. Tlon posts the link card itself, so the agent must not
    // paste or promise one.
    for (const purposeId of Object.keys(PURPOSE_JOBS)) {
      const directive = renderSetupDirective(purposeId, 'Mycology')!;
      expect(directive).toContain('bring a friend');
      expect(directive).toContain('never paste, invent, or promise a link');
    }
  });

  test('confirmation: output jobs run once now, tracking asks for an entry', () => {
    for (const id of ['agent-daily-digest', 'agent-research']) {
      const directive = renderSetupDirective(id, 'News')!;
      expect(directive).toContain('Run the job once right now');
      // Sources are listed as a statement — the invite is the only closing
      // question, so the confirmation must not end on one of its own.
      expect(directive).toContain('list the sources you used');
      expect(directive).toContain('the only question');
    }
    const tracking = renderSetupDirective('agent-tracking', 'Sleep, Mood')!;
    expect(tracking).toContain("don't run the job");
    expect(tracking).toContain('first entry');
    expect(tracking).toContain('alongside: Sleep, Mood');
  });
});

describe('invite card', () => {
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
      // Someone else's group, whatever it carries.
      '~bus/their-agent-group': { description: marker },
    });
    expect(await findAgentGroupsAwaitingOpening(api, {}, '~ten')).toEqual([
      '~ten/fresh-agent-group',
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

describe('topicsPickerAnswered', () => {
  const BOT = '~zod';
  const OWNER = '~ten';
  const pills = {
    author: BOT,
    content: TOPICS_PICKER_PROMPT + ' Weather, News — or just tell me.',
  };
  const tap = { author: OWNER, content: 'A daily digest' };

  test('true only for a substantive owner post newer than the pills', () => {
    const answered = [
      { ...tap, timestamp: 1 },
      { ...pills, timestamp: 2 },
      { author: OWNER, content: 'Sleep, Mood', timestamp: 3 },
    ];
    expect(topicsPickerAnswered(answered, BOT, OWNER)).toBe(true);
    // The reply being handled right now is not its own evidence.
    expect(topicsPickerAnswered(answered, BOT, OWNER, 'Sleep, Mood')).toBe(
      false
    );
    // Unanswered pills are the derivePendingPurpose case, not this one.
    expect(
      topicsPickerAnswered(
        [
          { ...tap, timestamp: 1 },
          { ...pills, timestamp: 2 },
        ],
        BOT,
        OWNER
      )
    ).toBe(false);
    // No pills ever posted (e.g. an ordinary group whose opening picker
    // went unanswered) must never read as a setup in flight.
    expect(
      topicsPickerAnswered(
        [
          { ...tap, timestamp: 1 },
          { author: OWNER, content: 'plain chat', timestamp: 2 },
        ],
        BOT,
        OWNER
      )
    ).toBe(false);
    // Owner chatter older than the pills doesn't answer them.
    expect(
      topicsPickerAnswered(
        [
          { author: OWNER, content: 'earlier chatter', timestamp: 1 },
          { ...pills, timestamp: 2 },
        ],
        BOT,
        OWNER
      )
    ).toBe(false);
    // A duplicate card tap after the pills (dropped live, kept by the
    // transcript) is not a topics answer.
    expect(
      topicsPickerAnswered(
        [
          { ...tap, timestamp: 1 },
          { ...pills, timestamp: 2 },
          { ...tap, timestamp: 3 },
        ],
        BOT,
        OWNER
      )
    ).toBe(false);
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
    ).toBe('agent-daily-digest');
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
    ).toBe('agent-daily-digest');
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
    ).toBe('agent-daily-digest');
    // Without being told, the same history reads as already answered.
    expect(
      derivePendingPurposeFromHistory(history, BOT, OWNER)
    ).toBeUndefined();
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
