import { A2UI } from '@tloncorp/api';

import {
  TLON_A2UI_CATALOG_V2,
  type TlonA2UIBlob,
  makeA2UIBlob,
} from '../urbit/blob.js';

/**
 * Agent onboarding, bot side: the purpose picker the agent posts into a group
 * that has no agent config yet.
 *
 * The design's choice cards are tappable and land inline in the transcript —
 * that is what A2UI is for. Each card's Button carries a `tlon.sendMessage`
 * action, so tapping one posts the choice as the user's own reply and the
 * conversation continues normally from there. Tlon code owns the layout and
 * the actions (same shape as the approval cards); the agent never composes
 * components.
 */

/**
 * The picker's options, and the marker that says a group is already
 * configured.
 *
 * Deliberately local rather than imported from `@tloncorp/api`: this plugin is
 * built outside the monorepo workspace (CI and the dev sandbox resolve
 * `@tloncorp/api` to a published registry version), so it cannot depend on api
 * exports until they ship. The authoritative templates live in
 * `packages/api/src/types/groupTemplates.ts` — keep `id`/`title` in step with
 * the `PURPOSE_OPTIONS` entries there, and switch to importing them once a
 * release carries them.
 */
export const PURPOSE_OPTIONS = [
  {
    id: 'agent-daily-digest',
    title: 'A daily digest',
    description:
      'A short summary of anything you care about, posted every morning.',
    icon: 'ChannelNotebooks',
    accent: 'blue',
  },
  {
    id: 'agent-tracking',
    title: 'Tracking',
    description:
      'You log a thing as it happens. I keep the running picture over time.',
    icon: 'Clock',
    accent: 'green',
  },
  {
    id: 'agent-research',
    title: 'Research',
    description: 'A standing deep-dive I keep updated as new work comes out.',
    icon: 'Search',
    accent: 'indigo',
  },
] as const satisfies readonly {
  id: string;
  title: string;
  description: string;
  // Mirrors A2UI.ChoiceIcon / ChoiceAccent, spelled literally for the same
  // registry-version reason as the options themselves.
  icon: 'ChannelNotebooks' | 'Clock' | 'Search';
  accent: 'blue' | 'green' | 'indigo';
}[];

/** Mirrors GROUP_AGENT_CONFIG_ENTRY_TYPE in @tloncorp/api. */
const AGENT_CONFIG_ENTRY_TYPE = 'tlon-group-agent-config';

export const PURPOSE_PICKER_PROMPT =
  "Let's make you a group that does something useful. What should it do?";

export const PURPOSE_PICKER_FOOTER =
  'Or just tell me — the cards are only starts.';

/**
 * The post's story text, which doubles as the fallback.
 *
 * Deliberately one short line: clients that render the card show this too, so
 * repeating the full option list there reads as duplicated content. Kept
 * actionable on its own — the quoted titles are exactly what the buttons post,
 * so a client that can't render A2UI (or a notification preview) still tells
 * the user what to reply.
 */
export function purposePickerFallbackText(): string {
  const titles = PURPOSE_OPTIONS.map((t) => `“${t.title}”`).join(', ');
  return `${PURPOSE_PICKER_PROMPT} Reply ${titles} — or just tell me.`;
}

/**
 * Tapping posts the choice as the user's own reply, exactly as if they had
 * typed it — the agent then reads it as a normal message.
 */
function choiceAction(text: string) {
  return { event: { name: A2UI.action.sendMessage, context: { text } } };
}

/**
 * The design's layout: one tappable card per option, each with an accented
 * icon tile, title and description. Needs the `Choice` primitive.
 */
function buildChoiceComponents(): A2UI.Component[] {
  return [
    {
      id: 'root',
      component: 'Column',
      children: ['prompt', 'choices', 'footer'],
    },
    { id: 'prompt', component: 'Text', text: PURPOSE_PICKER_PROMPT },
    {
      // Cast: this plugin type-checks against whichever @tloncorp/api version
      // the build resolved, which may predate `Choice`. Emitting it is still
      // safe — `makeA2UIBlob` validates with that same version, so an older
      // one rejects this layout and the caller falls back.
      id: 'choices',
      component: 'Choice',
      options: PURPOSE_OPTIONS.map((option) => ({
        id: option.id,
        label: option.title,
        description: option.description,
        icon: option.icon,
        accent: option.accent,
        action: choiceAction(option.title),
      })),
    } as unknown as A2UI.Component,
    {
      id: 'footer',
      component: 'Text',
      variant: 'caption',
      text: PURPOSE_PICKER_FOOTER,
    },
  ];
}

/**
 * The v1 layout: a Card per option with a labelled Button, because a v1 Button
 * can only carry text. Visually plainer than the design, but tappable and
 * built from primitives every client understands.
 */
function buildButtonComponents(): A2UI.Component[] {
  const components: A2UI.Component[] = [
    {
      id: 'root',
      component: 'Column',
      children: [
        'prompt',
        ...PURPOSE_OPTIONS.map((option) => `card-${option.id}`),
        'footer',
      ],
    },
    { id: 'prompt', component: 'Text', text: PURPOSE_PICKER_PROMPT },
  ];

  for (const option of PURPOSE_OPTIONS) {
    const { id, title, description } = option;
    components.push(
      { id: `card-${id}`, component: 'Card', child: `body-${id}` },
      {
        id: `body-${id}`,
        component: 'Column',
        children: [`title-${id}`, `desc-${id}`, `pick-${id}`],
      },
      { id: `title-${id}`, component: 'Text', variant: 'h4', text: title },
      {
        id: `desc-${id}`,
        component: 'Text',
        variant: 'caption',
        text: description,
      },
      {
        id: `pick-${id}`,
        component: 'Button',
        variant: 'primary',
        child: `pickLabel-${id}`,
        action: choiceAction(title),
      },
      { id: `pickLabel-${id}`, component: 'Text', text: title }
    );
  }

  components.push({
    id: 'footer',
    component: 'Text',
    variant: 'caption',
    text: PURPOSE_PICKER_FOOTER,
  });

  return components;
}

/**
 * Build the purpose-picker card. Component ids and ordering are fixed here so
 * the rendered result is deterministic.
 *
 * Prefers the design's `Choice` layout and falls back to the v1 Card+Button
 * layout when the resolved @tloncorp/api doesn't know `Choice` yet (this
 * plugin is built outside the workspace against a published version). The
 * fallback disappears on its own once a release carries the primitive.
 */
export function buildPurposePickerBlob(surfaceSuffix: string): TlonA2UIBlob {
  const surfaceId = `agent-onboarding-${surfaceSuffix}`;
  try {
    return makeA2UIBlob(
      surfaceId,
      'root',
      buildChoiceComponents(),
      TLON_A2UI_CATALOG_V2
    );
  } catch {
    return makeA2UIBlob(surfaceId, 'root', buildButtonComponents());
  }
}

/**
 * Starting points for the topic step, per purpose.
 *
 * Suggestions, never a menu: the picker always carries "or just tell me", and
 * the agent reads a typed answer the same way it reads a submitted selection.
 * Kept to single words so they fit a pill.
 */
export const PURPOSE_TOPICS: Record<string, readonly string[]> = {
  'agent-daily-digest': [
    'Weather',
    'News',
    'Stocks',
    'Sports',
    'Tech',
    'Local',
  ],
  'agent-tracking': [
    'Workouts',
    'Meals',
    'Sleep',
    'Mood',
    'Spending',
    'Reading',
  ],
  'agent-research': [
    'AI',
    'Markets',
    'Health',
    'Policy',
    'Science',
    'Competitors',
  ],
};

export const TOPICS_PICKER_PROMPT =
  'Good. What should I keep up with for you? Pick any that fit.';

export const TOPICS_PICKER_SUBMIT_LABEL = 'That’s it';

/** The purpose whose card title this message matches, if any. */
export function purposeIdForChoice(text: string): string | undefined {
  const trimmed = text.trim().toLowerCase();
  return PURPOSE_OPTIONS.find(
    (option) => option.title.toLowerCase() === trimmed
  )?.id;
}

/**
 * The post's story text, which doubles as the fallback. Names the suggestions
 * so a client that can't render the pills still gets an answerable question.
 */
export function topicsPickerFallbackText(purposeId: string): string {
  const topics = PURPOSE_TOPICS[purposeId] ?? [];
  if (!topics.length) {
    return TOPICS_PICKER_PROMPT;
  }
  return `${TOPICS_PICKER_PROMPT} ${topics.join(', ')} — or just tell me.`;
}

/**
 * The topic pills. Returns null when the resolved @tloncorp/api predates
 * `SmallChoice`, in which case the caller posts the question as plain text —
 * which is the free-text step the design started from, so nothing is lost.
 */
export function buildTopicsPickerBlob(
  surfaceSuffix: string,
  purposeId: string
): TlonA2UIBlob | null {
  const topics = PURPOSE_TOPICS[purposeId] ?? [];
  if (!topics.length) {
    return null;
  }
  const components: A2UI.Component[] = [
    {
      id: 'root',
      component: 'Column',
      children: ['prompt', 'topics'],
    },
    { id: 'prompt', component: 'Text', text: TOPICS_PICKER_PROMPT },
    {
      // Cast for the same registry-version reason as the Choice layout: this
      // may typecheck against an api that predates SmallChoice. makeA2UIBlob
      // validates with that same version, so an older one throws and we
      // return null.
      id: 'topics',
      component: 'SmallChoice',
      options: topics.map((topic) => ({
        id: topic.toLowerCase(),
        label: topic,
      })),
      submitLabel: TOPICS_PICKER_SUBMIT_LABEL,
      action: {
        event: { name: A2UI.action.sendMessage, context: { text: '' } },
      },
    } as unknown as A2UI.Component,
  ];
  try {
    return makeA2UIBlob(
      `agent-onboarding-topics-${surfaceSuffix}`,
      'root',
      components,
      TLON_A2UI_CATALOG_V2
    );
  } catch {
    return null;
  }
}

/**
 * Whether to follow a purpose pick with the topic pills.
 *
 * Offered once per channel, only when the owner's message is exactly one of the
 * purpose titles — i.e. they tapped a card — in a group they host that has no
 * agent config yet.
 */
export function shouldOfferTopicsPicker(opts: {
  senderIsOwner: boolean;
  groupHostIsOwner: boolean;
  groupDescription: string | null | undefined;
  messageText: string;
  alreadyOffered: boolean;
}): string | undefined {
  if (opts.alreadyOffered) {
    return undefined;
  }
  if (!opts.senderIsOwner || !opts.groupHostIsOwner) {
    return undefined;
  }
  if (descriptionHasAgentConfig(opts.groupDescription)) {
    return undefined;
  }
  return purposeIdForChoice(opts.messageText);
}

export interface ChannelGroupInfo {
  flag: string;
  /** the group's host ship, in `~ship` form */
  host: string;
  /** `meta.description`, '' when unset */
  description: string;
}

/**
 * Find the group that owns `nest`, with its host and description, in a single
 * scry.
 *
 * Deliberately not using the monitor's channel→group map: that is built from
 * init data at startup, so a group created after the bot connected — the fresh
 * account case this feature exists for — isn't in it yet. Returns null when
 * the group can't be resolved (including scry failure), so callers stay quiet
 * rather than guessing.
 */
export async function findGroupForChannel(
  api: { scry: (path: string) => Promise<unknown> } | null,
  nest: string,
  runtime: { error?: (message: string) => void }
): Promise<ChannelGroupInfo | null> {
  if (!api) {
    return null;
  }
  try {
    const groups = (await api.scry('/groups/v2/groups.json')) as Record<
      string,
      {
        meta?: { description?: unknown };
        channels?: Record<string, unknown>;
        'active-channels'?: unknown;
      }
    > | null;
    if (!groups) {
      return null;
    }
    for (const [flag, group] of Object.entries(groups)) {
      const active = Array.isArray(group?.['active-channels'])
        ? (group['active-channels'] as unknown[])
        : [];
      const inGroup =
        active.includes(nest) ||
        Object.prototype.hasOwnProperty.call(group?.channels ?? {}, nest);
      if (!inGroup) {
        continue;
      }
      const host = flag.split('/')[0] ?? '';
      const description = group?.meta?.description;
      return {
        flag,
        host,
        description: typeof description === 'string' ? description : '',
      };
    }
    return null;
  } catch (error) {
    runtime.error?.(
      `[tlon] Failed to resolve group for ${nest}: ${String(error)}`
    );
    return null;
  }
}

/**
 * True when a group description already carries an agent config entry.
 *
 * Parses the typed-entry array rather than substring-matching, so a group whose
 * human description merely mentions the type name isn't mistaken for a
 * configured one. Tolerant by design: anything unparseable counts as "no
 * config", matching `parseGroupAgentConfig` in @tloncorp/api.
 */
export function descriptionHasAgentConfig(
  description: string | null | undefined
): boolean {
  if (!description) {
    return false;
  }
  const trimmed = description.trim();
  if (!trimmed.startsWith('[')) {
    return false;
  }
  try {
    const entries = JSON.parse(trimmed);
    return (
      Array.isArray(entries) &&
      entries.some(
        (entry) =>
          typeof entry === 'object' &&
          entry !== null &&
          (entry as { type?: unknown }).type === AGENT_CONFIG_ENTRY_TYPE
      )
    );
  } catch {
    return false;
  }
}

/** True when `text` is one of the picker's card titles. */
export function isPurposePickerChoice(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return PURPOSE_OPTIONS.some((t) => t.title.toLowerCase() === trimmed);
}

/**
 * Whether to offer the picker in response to this message.
 *
 * Offered once per channel, only for the owner's own message in a group the
 * owner hosts that has no agent config yet — and never in response to a tap
 * on the picker itself (that reply continues the conversation instead).
 */
export function shouldOfferPurposePicker(opts: {
  senderIsOwner: boolean;
  groupHostIsOwner: boolean;
  groupDescription: string | null | undefined;
  messageText: string;
  alreadyOffered: boolean;
}): boolean {
  if (opts.alreadyOffered) {
    return false;
  }
  if (!opts.senderIsOwner || !opts.groupHostIsOwner) {
    return false;
  }
  if (descriptionHasAgentConfig(opts.groupDescription)) {
    // Group is already configured — nothing to set up.
    return false;
  }
  if (isPurposePickerChoice(opts.messageText)) {
    return false;
  }
  return true;
}
