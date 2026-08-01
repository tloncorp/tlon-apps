import { A2UI } from '@tloncorp/api';
import { describe, expect, test } from 'vitest';

import {
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
  isPurposePickerChoice,
  purposeIdForChoice,
  purposePickerFallbackText,
  renderSetupDirective,
  shouldOfferPickerOnJoin,
  shouldOfferPurposePicker,
  shouldOfferTopicsPicker,
  topicsPickerFallbackText,
} from './agent-onboarding.js';

const configuredDescription = JSON.stringify([
  {
    type: 'tlon-group-agent-config',
    version: 1,
    purpose: 'Keeps up with sourdough.',
    instructions: 'Be useful.',
    agents: ['~pinser-botter-sampel-palnet'],
    jobs: [],
    updatedAt: 1,
  },
]);

const baseOpts = {
  senderIsOwner: true,
  groupHostIsOwner: true,
  groupDescription: '',
  messageText: 'hey',
  alreadyOffered: false,
};

function componentsOf(blob: ReturnType<typeof buildPurposePickerBlob>) {
  const update = blob.messages.find((m) => 'updateComponents' in m);
  return (update as any).updateComponents.components as A2UI.Component[];
}

function catalogOf(blob: ReturnType<typeof buildPurposePickerBlob>) {
  const create = blob.messages.find((m) => 'createSurface' in m);
  return (create as any).createSurface.catalogId as string;
}

/**
 * Every tappable thing in the blob, as (id, posted text) pairs — a Choice
 * option and a v1 Button are the same affordance to the user, so the picker's
 * behavioral guarantees are asserted against this rather than against either
 * layout. Keeps these tests true in both builds (see the note on
 * PURPOSE_OPTIONS: outside the workspace, @tloncorp/api may predate `Choice`).
 */
function tappableOptions(blob: ReturnType<typeof buildPurposePickerBlob>) {
  const components = componentsOf(blob);
  const found: { id: string; text: string }[] = [];
  for (const component of components) {
    if (component.component === 'Button') {
      const label = components.find((c) => c.id === component.child);
      found.push({
        id: component.id.replace(/^pick-/, ''),
        text:
          component.action.event.name === A2UI.action.sendMessage
            ? component.action.event.context.text
            : (label as A2UI.Text | undefined)?.text ?? '',
      });
    } else if ((component as { component: string }).component === 'Choice') {
      for (const option of (component as A2UI.Choice).options) {
        found.push({
          id: option.id,
          text:
            option.action.event.name === A2UI.action.sendMessage
              ? option.action.event.context.text
              : '',
        });
      }
    }
  }
  return found;
}

/** Whether the resolved @tloncorp/api knows the `Choice` primitive. */
const apiSupportsChoice = A2UI.validateBlobEntry({
  type: 'a2ui',
  version: 1,
  messages: [
    {
      version: 'v0.9',
      createSurface: { surfaceId: 's', catalogId: 'tlon.a2ui.basic.v2' },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 's',
        root: 'c',
        components: [
          {
            id: 'c',
            component: 'Choice',
            options: [
              {
                id: 'o',
                label: 'o',
                action: {
                  event: {
                    name: A2UI.action.sendMessage,
                    context: { text: 'o' },
                  },
                },
              },
            ],
          },
        ],
      },
    },
  ],
} as never);

describe('purpose picker card', () => {
  test('builds a valid a2ui blob with one tappable option per template', () => {
    const blob = buildPurposePickerBlob('chat/~sampel-palnet/home-group-chat');
    expect(A2UI.validateBlobEntry(blob)).toBe(true);
    expect(tappableOptions(blob)).toHaveLength(PURPOSE_OPTIONS.length);
  });

  test('each option posts its own card title as the user reply', () => {
    const options = tappableOptions(buildPurposePickerBlob('nest'));

    for (const template of PURPOSE_OPTIONS) {
      const option = options.find((o) => o.id === template.id);
      expect(option).toBeDefined();
      expect(option!.text).toBe(template.title);
      // The posted text must round-trip as a recognized choice, otherwise the
      // picker would be re-offered in response to its own tap.
      expect(isPurposePickerChoice(template.title)).toBe(true);
    }
  });

  test('prefers the design Choice layout, falling back when unsupported', () => {
    const blob = buildPurposePickerBlob('nest');
    const kinds = componentsOf(blob).map(
      (c) => (c as { component: string }).component
    );

    if (apiSupportsChoice) {
      expect(kinds).toContain('Choice');
      expect(kinds).not.toContain('Button');
      expect(catalogOf(blob)).toBe('tlon.a2ui.basic.v2');
    } else {
      expect(kinds).not.toContain('Choice');
      expect(kinds).toContain('Button');
      expect(catalogOf(blob)).toBe('tlon.a2ui.basic.v1');
    }
  });

  test('fallback text names every option for old clients', () => {
    const text = purposePickerFallbackText();
    for (const template of PURPOSE_OPTIONS) {
      expect(text).toContain(template.title);
    }
  });

  test('surface ids are namespaced per channel', () => {
    const a = buildPurposePickerBlob('chat/~a/one');
    const b = buildPurposePickerBlob('chat/~b/two');
    const surfaceOf = (blob: typeof a) =>
      (blob.messages.find((m) => 'createSurface' in m) as any).createSurface
        .surfaceId;
    expect(surfaceOf(a)).not.toEqual(surfaceOf(b));
  });
});

describe('topics picker', () => {
  test('every purpose has topic suggestions', () => {
    for (const option of PURPOSE_OPTIONS) {
      expect(PURPOSE_TOPICS[option.id]?.length).toBeGreaterThan(0);
    }
  });

  test('builds a valid blob with one pill per topic', () => {
    for (const option of PURPOSE_OPTIONS) {
      const blob = buildTopicsPickerBlob('nest', option.id);
      // Null only when the resolved api predates SmallChoice; in the workspace
      // it is always present.
      expect(blob).not.toBeNull();
      expect(A2UI.validateBlobEntry(blob)).toBe(true);
      const update = blob!.messages.find((m) => 'updateComponents' in m);
      const components = (update as any).updateComponents
        .components as A2UI.Component[];
      const pills = components.find(
        (c) => (c as { component: string }).component === 'SmallChoice'
      ) as A2UI.SmallChoice | undefined;
      expect(pills?.options.map((o) => o.label)).toEqual([
        ...PURPOSE_TOPICS[option.id]!,
      ]);
      expect(pills?.submitLabel).toBeTruthy();
    }
  });

  test('returns null for an unknown purpose rather than an empty picker', () => {
    expect(buildTopicsPickerBlob('nest', 'agent-nonexistent')).toBeNull();
  });

  test('pill ids are unique and stable', () => {
    const blob = buildTopicsPickerBlob('nest', 'agent-daily-digest')!;
    const update = blob.messages.find((m) => 'updateComponents' in m);
    const pills = (
      (update as any).updateComponents.components as A2UI.Component[]
    ).find(
      (c) => (c as { component: string }).component === 'SmallChoice'
    ) as A2UI.SmallChoice;
    const ids = pills.options.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      buildTopicsPickerBlob('other-nest', 'agent-daily-digest')
    ).not.toBeNull();
  });

  test('surface ids are namespaced per channel', () => {
    const surfaceOf = (nest: string) =>
      (
        buildTopicsPickerBlob(nest, 'agent-daily-digest')!.messages.find(
          (m) => 'createSurface' in m
        ) as any
      ).createSurface.surfaceId;
    expect(surfaceOf('chat/~a/one')).not.toEqual(surfaceOf('chat/~b/two'));
  });

  test('fallback text names every topic for old clients', () => {
    const text = topicsPickerFallbackText('agent-daily-digest');
    for (const topic of PURPOSE_TOPICS['agent-daily-digest']!) {
      expect(text).toContain(topic);
    }
  });

  test('fallback text still asks the question for an unknown purpose', () => {
    expect(topicsPickerFallbackText('agent-nonexistent')).toContain(
      'keep up with'
    );
  });
});

describe('purposeIdForChoice', () => {
  test('maps a card title to its purpose id, case and space insensitive', () => {
    for (const option of PURPOSE_OPTIONS) {
      expect(purposeIdForChoice(`  ${option.title.toUpperCase()} `)).toBe(
        option.id
      );
    }
  });

  test('returns undefined for anything else', () => {
    expect(purposeIdForChoice('sourdough baking')).toBeUndefined();
    expect(purposeIdForChoice('')).toBeUndefined();
  });
});

describe('shouldOfferTopicsPicker', () => {
  const tapped = { ...baseOpts, messageText: 'A daily digest' };

  test('offers after the owner taps a purpose card', () => {
    expect(shouldOfferTopicsPicker(tapped)).toBe('agent-daily-digest');
  });

  test('does not offer for a message that is not a card tap', () => {
    expect(shouldOfferTopicsPicker(baseOpts)).toBeUndefined();
  });

  test('does not offer twice', () => {
    expect(
      shouldOfferTopicsPicker({ ...tapped, alreadyOffered: true })
    ).toBeUndefined();
  });

  test('does not offer to non-owners or in groups the owner does not host', () => {
    expect(
      shouldOfferTopicsPicker({ ...tapped, senderIsOwner: false })
    ).toBeUndefined();
    expect(
      shouldOfferTopicsPicker({ ...tapped, groupHostIsOwner: false })
    ).toBeUndefined();
  });

  test('does not offer when the group is already configured', () => {
    expect(
      shouldOfferTopicsPicker({
        ...tapped,
        groupDescription: configuredDescription,
      })
    ).toBeUndefined();
  });
});

describe('shouldOfferPurposePicker', () => {
  test('offers on the owner first message in an unconfigured owned group', () => {
    expect(shouldOfferPurposePicker(baseOpts)).toBe(true);
  });

  test('does not offer twice', () => {
    expect(
      shouldOfferPurposePicker({ ...baseOpts, alreadyOffered: true })
    ).toBe(false);
  });

  test('does not offer to non-owners or in groups the owner does not host', () => {
    expect(
      shouldOfferPurposePicker({ ...baseOpts, senderIsOwner: false })
    ).toBe(false);
    expect(
      shouldOfferPurposePicker({ ...baseOpts, groupHostIsOwner: false })
    ).toBe(false);
  });

  test('does not offer when the group already has an agent config', () => {
    expect(
      shouldOfferPurposePicker({
        ...baseOpts,
        groupDescription: configuredDescription,
      })
    ).toBe(false);
  });

  test('leaves human descriptions alone', () => {
    expect(
      shouldOfferPurposePicker({
        ...baseOpts,
        groupDescription: 'a group about bread',
      })
    ).toBe(true);
  });

  test('does not re-offer in response to a card tap', () => {
    for (const template of PURPOSE_OPTIONS) {
      expect(
        shouldOfferPurposePicker({
          ...baseOpts,
          messageText: `  ${template.title.toUpperCase()}  `,
        })
      ).toBe(false);
    }
  });
});

describe('descriptionHasAgentSetup', () => {
  test('detects a real config entry array', () => {
    expect(descriptionHasAgentSetup(configuredDescription)).toBe(true);
  });

  test('an agents-only marker is not setup', () => {
    // Naming who may act is the state a group is in *before* onboarding
    // (the client writes it so the agent's cards render). Treating it as
    // "configured" would suppress the very pickers that do the setup.
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
    expect(descriptionHasAgentSetup(marker)).toBe(false);
    // ...and the pickers still offer with the marker present.
    expect(
      shouldOfferPurposePicker({ ...baseOpts, groupDescription: marker })
    ).toBe(true);
    expect(
      shouldOfferTopicsPicker({
        ...baseOpts,
        groupDescription: marker,
        messageText: 'A daily digest',
      })
    ).toBe('agent-daily-digest');
  });

  test('a job without a purpose still counts as setup', () => {
    const jobsOnly = JSON.stringify([
      {
        type: 'tlon-group-agent-config',
        version: 1,
        purpose: '',
        instructions: '',
        agents: ['~zod'],
        jobs: [{ id: 'daily', enabled: true }],
        updatedAt: 1,
      },
    ]);
    expect(descriptionHasAgentSetup(jobsOnly)).toBe(true);
  });

  test('treats plain human descriptions as unconfigured', () => {
    expect(descriptionHasAgentSetup('a group about bread')).toBe(false);
    expect(descriptionHasAgentSetup('')).toBe(false);
    expect(descriptionHasAgentSetup(null)).toBe(false);
    expect(descriptionHasAgentSetup(undefined)).toBe(false);
  });

  test('does not false-positive on prose that mentions the type name', () => {
    expect(
      descriptionHasAgentSetup('we use tlon-group-agent-config here')
    ).toBe(false);
  });

  test('tolerates malformed json', () => {
    expect(descriptionHasAgentSetup('[{"type":')).toBe(false);
    expect(descriptionHasAgentSetup('[1,2,3]')).toBe(false);
  });

  test('option ids and titles are stable', () => {
    // The ids double as templateId provenance in written group configs and
    // the titles are what taps post back — changing either is a wire change.
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
});

describe('findGroupForChannel', () => {
  const nest = 'chat/~ten/onboarding-test-chat';
  const groups = {
    '~ten/onboarding-test': {
      meta: { description: 'a group about bread' },
      'active-channels': [nest],
      channels: { [nest]: {} },
    },
    '~other/unrelated': {
      meta: { description: '' },
      'active-channels': ['chat/~other/x'],
    },
  };

  test('resolves flag, host and description for the channel', async () => {
    const found = await findGroupForChannel(
      { scry: async () => groups },
      nest,
      {}
    );
    expect(found).toEqual({
      flag: '~ten/onboarding-test',
      host: '~ten',
      description: 'a group about bread',
    });
  });

  test('finds groups via channels map when active-channels is absent', async () => {
    const found = await findGroupForChannel(
      {
        scry: async () => ({
          '~ten/g': { meta: {}, channels: { [nest]: {} } },
        }),
      },
      nest,
      {}
    );
    expect(found?.flag).toBe('~ten/g');
    expect(found?.description).toBe('');
  });

  test('returns null when no group owns the channel', async () => {
    const found = await findGroupForChannel(
      { scry: async () => groups },
      'chat/~zzz/nope',
      {}
    );
    expect(found).toBeNull();
  });

  test('returns null on scry failure and logs', async () => {
    const errors: string[] = [];
    const found = await findGroupForChannel(
      {
        scry: async () => {
          throw new Error('boom');
        },
      },
      nest,
      { error: (m) => errors.push(m) }
    );
    expect(found).toBeNull();
    expect(errors).toHaveLength(1);
  });

  test('returns null without an api client', async () => {
    expect(await findGroupForChannel(null, nest, {})).toBeNull();
  });
});

describe('purpose picker layout selection', () => {
  test('uses the design Choice layout when the resolved api supports it', () => {
    const blob = buildPurposePickerBlob('nest');
    const update: any = blob.messages.find((m: any) => m.updateComponents);
    const components = update.updateComponents.components;
    const choice = components.find((c: any) => c.component === 'Choice');
    const catalogId = (blob.messages.find((m: any) => m.createSurface) as any)
      .createSurface.catalogId;

    if (choice) {
      // Design layout: one Choice group carrying every option, with the icon
      // and accent the design specifies.
      expect(catalogId).toBe('tlon.a2ui.basic.v2');
      expect(choice.options).toHaveLength(PURPOSE_OPTIONS.length);
      for (const [i, option] of choice.options.entries()) {
        expect(option.label).toBe(PURPOSE_OPTIONS[i].title);
        expect(option.description).toBe(PURPOSE_OPTIONS[i].description);
        expect(option.icon).toBe(PURPOSE_OPTIONS[i].icon);
        expect(option.accent).toBe(PURPOSE_OPTIONS[i].accent);
        expect(option.action.event.context.text).toBe(PURPOSE_OPTIONS[i].title);
      }
    } else {
      // Fallback: v1 Card+Button layout, still one tappable target per option
      // posting the same text, so behaviour is identical either way.
      expect(catalogId).toBe('tlon.a2ui.basic.v1');
      const buttons = components.filter((c: any) => c.component === 'Button');
      expect(buttons).toHaveLength(PURPOSE_OPTIONS.length);
      for (const [i, button] of buttons.entries()) {
        expect(button.action.event.context.text).toBe(PURPOSE_OPTIONS[i].title);
      }
    }
  });

  test('whichever layout is used, the blob validates and taps round-trip', () => {
    const blob = buildPurposePickerBlob('nest');
    expect(A2UI.validateBlobEntry(blob)).toBe(true);
    for (const option of PURPOSE_OPTIONS) {
      expect(isPurposePickerChoice(option.title)).toBe(true);
    }
  });
});

describe('findChatNestForGroup', () => {
  const flag = '~ten/home-group';
  const groups = {
    [flag]: {
      meta: { description: '' },
      'active-channels': ['chat/~ten/home-group-chat'],
      channels: { 'chat/~ten/home-group-chat': {} },
    },
    '~ten/gallery-only': {
      meta: { description: '' },
      'active-channels': ['heap/~ten/pics'],
      channels: { 'heap/~ten/pics': {} },
    },
  };
  const apiWith = (result: unknown) => ({
    scry: async () => result,
  });

  test('resolves the chat nest, host and description', async () => {
    const info = await findChatNestForGroup(apiWith(groups), flag, {});
    expect(info).toEqual({
      nest: 'chat/~ten/home-group-chat',
      host: '~ten',
      description: '',
    });
  });

  test('returns null for a group not in the scry yet', async () => {
    // The join ack races the group data landing — callers poll on null.
    expect(await findChatNestForGroup(apiWith(groups), '~ten/nope', {})).toBe(
      null
    );
  });

  test('returns null for a group with no chat channel', async () => {
    expect(
      await findChatNestForGroup(apiWith(groups), '~ten/gallery-only', {})
    ).toBe(null);
  });

  test('returns null on scry failure or missing api', async () => {
    const failing = {
      scry: async () => {
        throw new Error('boom');
      },
    };
    expect(await findChatNestForGroup(failing, flag, {})).toBe(null);
    expect(await findChatNestForGroup(null, flag, {})).toBe(null);
  });
});

describe('channelHasNoPosts', () => {
  const nest = 'chat/~ten/home-group-chat';
  const apiWith = (result: unknown) => ({
    scry: async () => result,
  });

  test('true for an empty posts map', async () => {
    expect(await channelHasNoPosts(apiWith({ posts: {} }), nest, {})).toBe(
      true
    );
  });

  test('false once anything has been posted', async () => {
    expect(
      await channelHasNoPosts(
        apiWith({ posts: { '170.141': { essay: {} } } }),
        nest,
        {}
      )
    ).toBe(false);
  });

  test('fails closed: null on scry failure, missing api, or null result', async () => {
    // null means "couldn't inspect" — the caller must not treat the channel
    // as new, or the bot would post into groups it can't read.
    const failing = {
      scry: async () => {
        throw new Error('boom');
      },
    };
    expect(await channelHasNoPosts(failing, nest, {})).toBe(null);
    expect(await channelHasNoPosts(null, nest, {})).toBe(null);
    expect(await channelHasNoPosts(apiWith(null), nest, {})).toBe(null);
  });
});

describe('shouldOfferPickerOnJoin', () => {
  const newGroup = {
    groupHostIsOwner: true,
    groupDescription: '',
    channelHasNoPosts: true as boolean | null,
    alreadyOffered: false,
  };

  test('offers in a newly created group the owner hosts', () => {
    expect(shouldOfferPickerOnJoin(newGroup)).toBe(true);
  });

  test('stays silent in an established group', () => {
    // Being added to a group with history is not an invitation to run setup.
    expect(
      shouldOfferPickerOnJoin({ ...newGroup, channelHasNoPosts: false })
    ).toBe(false);
  });

  test('stays silent when the channel could not be inspected', () => {
    expect(
      shouldOfferPickerOnJoin({ ...newGroup, channelHasNoPosts: null })
    ).toBe(false);
  });

  test('stays silent in groups the owner does not host', () => {
    expect(
      shouldOfferPickerOnJoin({ ...newGroup, groupHostIsOwner: false })
    ).toBe(false);
  });

  test('stays silent when already configured or already offered', () => {
    expect(
      shouldOfferPickerOnJoin({
        ...newGroup,
        groupDescription: configuredDescription,
      })
    ).toBe(false);
    expect(shouldOfferPickerOnJoin({ ...newGroup, alreadyOffered: true })).toBe(
      false
    );
  });
});

describe('renderSetupDirective', () => {
  test('every purpose card has a job template', () => {
    // A card without a template silently degrades to a model-composed cron
    // prompt, defeating the point of templating.
    for (const option of PURPOSE_OPTIONS) {
      expect(PURPOSE_JOBS[option.id]).toBeDefined();
    }
  });

  test('carries the rendered template verbatim', () => {
    const directive = renderSetupDirective(
      'agent-daily-digest',
      'Peptides, Mycology'
    );
    expect(directive).not.toBeNull();
    const expectedPrompt = PURPOSE_JOBS[
      'agent-daily-digest'
    ]!.prompt.replaceAll('{{topics}}', 'Peptides, Mycology');
    expect(directive).toContain(expectedPrompt);
    expect(directive).toContain(PURPOSE_JOBS['agent-daily-digest']!.schedule);
    // No unfilled placeholders may survive rendering.
    expect(directive).not.toContain('{{');
  });

  test('substitutes into the title and trims the reply', () => {
    const directive = renderSetupDirective('agent-research', '  Homelabs  ');
    expect(directive).toContain('Research update: Homelabs');
  });

  test('directs verbatim use and the config mirror', () => {
    const directive = renderSetupDirective('agent-tracking', 'Sleep')!;
    expect(directive).toContain('Do not rewrite');
    expect(directive).toContain('The group description is the config JSON');
    expect(directive).toContain('"prompt" field');
    expect(directive).toContain("owner's timezone");
  });

  test('every job sends its output to a notes channel it creates itself', () => {
    for (const purposeId of Object.keys(PURPOSE_JOBS)) {
      const directive = renderSetupDirective(purposeId, 'Sleep')!;
      // The rule has to ride in the payload, since that is what the cron
      // runs verbatim on every future run — not just at setup.
      expect(directive).toContain("this group's notes channel");
      expect(directive).toContain('create one in this group first');
      expect(directive).toContain('--kind notes');
      expect(directive).toContain('append to that same channel');
      // A ship without the %notes desk 404s. Chat is then the only
      // destination the CLI can reach — `diary` is retired and refused —
      // and the fallback has to be said once, not on every run.
      expect(directive).toContain('HTTP 404');
      expect(directive).toContain('%notes desk');
      expect(directive).toContain('say once — not every run');
    }
  });

  test('carries the picked template id for provenance', () => {
    const directive = renderSetupDirective('agent-research', 'Mycology')!;
    expect(directive).toContain('templateId: agent-research');
  });

  test('forbids creating a group, in any role', () => {
    const directive = renderSetupDirective('agent-daily-digest', 'News')!;
    expect(directive).toContain('Never create a group');
    expect(directive).toContain('create one in this group first');
  });

  test('leaves the output channel to the first run, not setup', () => {
    const directive = renderSetupDirective('agent-daily-digest', 'News')!;
    expect(directive).toContain("Don't create the output channel during setup");
    expect(directive).toContain('"outputNest" empty');
  });

  test('null for a purpose without a template', () => {
    expect(renderSetupDirective('agent-nonexistent', 'x')).toBeNull();
  });

  test('digest and research confirm with a real first run and sources', () => {
    for (const id of ['agent-daily-digest', 'agent-research']) {
      const directive = renderSetupDirective(id, 'News')!;
      expect(directive).toContain('Run the job once right now');
      expect(directive).toContain('enumerating the sources');
    }
  });

  test('tracking confirms by asking for the first entry, not a run', () => {
    const directive = renderSetupDirective('agent-tracking', 'Sleep, Mood')!;
    expect(directive).toContain("don't run the job");
    expect(directive).toContain('first entry');
    expect(directive).toContain('anything else they want to track');
    // The follow-up names what they already track.
    expect(directive).toContain('alongside: Sleep, Mood');
  });
});
