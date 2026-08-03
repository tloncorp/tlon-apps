import { A2UI } from '@tloncorp/api';
import { describe, expect, test } from 'vitest';

import {
  GROUP_INTRO_MESSAGE,
  PURPOSE_JOBS,
  PURPOSE_OPTIONS,
  PURPOSE_TOPICS,
} from './agent-onboarding-config.js';
import {
  buildPurposePickerBlob,
  buildTopicsPickerBlob,
  channelHasNoPosts,
  descriptionHasAgentSetup,
  findChatNestForGroup,
  findGroupForChannel,
  isHomeGroupFlag,
  isPurposePickerChoice,
  purposePickerFallbackText,
  renderSetupDirective,
  shouldOfferPickerOnJoin,
  shouldOfferPurposePicker,
  shouldOfferTopicsPicker,
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
      const ids = pills.options.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
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
      alreadyOffered: false,
    };
    expect(shouldOfferPickerOnJoin(newGroup)).toBe(true);
    for (const off of [
      // A group with history is not an invitation to run setup, and an
      // uninspectable channel (null) must fail closed.
      { channelHasNoPosts: false as boolean | null },
      { channelHasNoPosts: null },
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
    ).toEqual({ nest, host: '~ten', description: 'a group about bread' });
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

describe('renderSetupDirective', () => {
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

  test('gives the group an icon alongside the rename, best effort', () => {
    const directive = renderSetupDirective('agent-research', 'Mycology')!;
    expect(directive).toContain('--image');
    expect(directive).toContain('tlon upload');
    // Tied to the rename, so an owner-named group keeps its own icon, and
    // never allowed to stall the rest of the setup.
    expect(directive).toContain('Only alongside the rename');
    expect(directive).toContain('skip the icon');
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
    expect(directive).toContain("Don't create the output channel during setup");
    expect(directive).toContain('"outputNest" empty');
    // An empty toolsAllow schedules a job that wakes with zero tools.
    expect(directive).toContain('toolsAllow');
    expect(directive).toContain('Omit');
  });

  test('the payload routes output to a notes channel, with the 404 fallback', () => {
    for (const purposeId of Object.keys(PURPOSE_JOBS)) {
      const directive = renderSetupDirective(purposeId, 'Sleep')!;
      // This rides in the payload — the text the cron runs every time.
      expect(directive).toContain("this group's notes channel");
      expect(directive).toContain('create one in this group first');
      expect(directive).toContain('--kind notes');
      expect(directive).toContain('append to that same channel');
      // A ship without the %notes desk 404s; diary is retired, so chat is
      // the fallback — said once, not on every run.
      expect(directive).toContain('HTTP 404');
      expect(directive).toContain('say once — not every run');
    }
  });

  test('the first group ends by asking for an invite, later ones by offering tweaks', () => {
    // The splash used to ask for contacts here; the conversational flow
    // replaced it, so the home group has to make the ask itself.
    const home = renderSetupDirective('agent-research', 'Mycology', {
      isHomeGroup: true,
    })!;
    expect(home).toContain('invite link');
    expect(home).toContain('bring a friend');

    const later = renderSetupDirective('agent-research', 'Mycology')!;
    expect(later).not.toContain('invite link');
    // Both still confirm with a real first run.
    expect(later).toContain('Run the job once right now');
    expect(home).toContain('Run the job once right now');
  });

  test('confirmation: output jobs run once now, tracking asks for an entry', () => {
    for (const id of ['agent-daily-digest', 'agent-research']) {
      const directive = renderSetupDirective(id, 'News')!;
      expect(directive).toContain('Run the job once right now');
      expect(directive).toContain('enumerating the sources');
    }
    const tracking = renderSetupDirective('agent-tracking', 'Sleep, Mood')!;
    expect(tracking).toContain("don't run the job");
    expect(tracking).toContain('first entry');
    expect(tracking).toContain('alongside: Sleep, Mood');
  });
});

describe('isHomeGroupFlag', () => {
  test("only the owner's own home-group slug", () => {
    expect(isHomeGroupFlag('~ten/home-group', '~ten')).toBe(true);
    expect(isHomeGroupFlag('~TEN/home-group', '~ten')).toBe(true);
    // Someone else's home group is just a group to us.
    expect(isHomeGroupFlag('~zod/home-group', '~ten')).toBe(false);
    expect(isHomeGroupFlag('~ten/v1qqiguv', '~ten')).toBe(false);
    expect(isHomeGroupFlag(null, '~ten')).toBe(false);
    expect(isHomeGroupFlag('~ten/home-group', null)).toBe(false);
  });
});
