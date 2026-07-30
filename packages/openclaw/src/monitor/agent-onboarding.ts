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
 * The picker's options. This plugin owns them: the bot composes and posts
 * the picker, so nothing on the app side needs its own copy — the client
 * renders whatever arrives as generic A2UI components.
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
  if (descriptionHasAgentSetup(opts.groupDescription)) {
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

export interface GroupChatChannelInfo {
  nest: string;
  /** the group's host ship, in `~ship` form */
  host: string;
  /** `meta.description`, '' when unset */
  description: string;
}

/**
 * Find a group's chat channel (plus host and description) in a single scry.
 *
 * Returns null when the group or its chat channel can't be resolved — for a
 * group the bot was just invited to, the channels land moments after the join
 * ack, so callers poll rather than treating null as final.
 */
export async function findChatNestForGroup(
  api: { scry: (path: string) => Promise<unknown> } | null,
  flag: string,
  runtime: { error?: (message: string) => void }
): Promise<GroupChatChannelInfo | null> {
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
    const group = groups?.[flag];
    if (!group) {
      return null;
    }
    const active = Array.isArray(group['active-channels'])
      ? (group['active-channels'] as unknown[])
      : [];
    const nest = [...active, ...Object.keys(group.channels ?? {})].find(
      (key): key is string => typeof key === 'string' && key.startsWith('chat/')
    );
    if (!nest) {
      return null;
    }
    const host = flag.split('/')[0] ?? '';
    const description = group.meta?.description;
    return {
      nest,
      host,
      description: typeof description === 'string' ? description : '',
    };
  } catch (error) {
    runtime.error?.(
      `[tlon] Failed to resolve chat channel for ${flag}: ${String(error)}`
    );
    return null;
  }
}

/**
 * Whether a channel has no posts yet — the test for "this group was just
 * created" at invite-accept time, and exactly the condition under which the
 * agent opening the conversation makes sense.
 *
 * Fails closed: returns null when the scry fails or the shape is
 * unrecognizable, so an unreadable channel is never mistaken for a new one.
 * (`fetchChannelHistory` is not used here because it returns `[]` on error.)
 */
export async function channelHasNoPosts(
  api: { scry: (path: string) => Promise<unknown> } | null,
  nest: string,
  runtime: { error?: (message: string) => void }
): Promise<boolean | null> {
  if (!api) {
    return null;
  }
  try {
    const data = (await api.scry(
      `/channels/v4/${nest}/posts/newest/1/outline.json`
    )) as unknown;
    if (data === null || data === undefined) {
      return null;
    }
    if (Array.isArray(data)) {
      return data.length === 0;
    }
    if (typeof data === 'object') {
      const posts = (data as { posts?: unknown }).posts;
      if (posts && typeof posts === 'object') {
        return Object.keys(posts).length === 0;
      }
      return Object.keys(data).length === 0;
    }
    return null;
  } catch (error) {
    runtime.error?.(
      `[tlon] Failed to read posts for ${nest}: ${String(error)}`
    );
    return null;
  }
}

/**
 * Whether to open a just-joined group with the purpose picker.
 *
 * The agent speaks first only in a **newly created** group the owner hosts:
 * empty chat channel, no agent config, not already offered. An owner adding
 * the bot to an established group gets silence until they say something (the
 * message-driven offer handles that). `channelHasNoPosts === null` — couldn't
 * inspect — counts as not-new.
 */
export function shouldOfferPickerOnJoin(opts: {
  groupHostIsOwner: boolean;
  groupDescription: string | null | undefined;
  channelHasNoPosts: boolean | null;
  alreadyOffered: boolean;
}): boolean {
  if (opts.alreadyOffered) {
    return false;
  }
  if (!opts.groupHostIsOwner) {
    return false;
  }
  if (opts.channelHasNoPosts !== true) {
    return false;
  }
  if (descriptionHasAgentSetup(opts.groupDescription)) {
    return false;
  }
  return true;
}

/**
 * True when a group's agent setup has actually happened: its config entry
 * carries a purpose or at least one job.
 *
 * A config entry that only names `agents` is a declaration of who may act,
 * not of what the group does — that's the state a group is in *before*
 * onboarding (e.g. the client marks the resident agent so its cards render),
 * and suppressing the pickers because of it would kill the very setup they
 * exist to run. Purpose and jobs are what onboarding produces, so they are
 * what "configured" means.
 *
 * Parses the typed-entry array rather than substring-matching, so a group
 * whose human description merely mentions the type name isn't mistaken for a
 * configured one. Tolerant by design: anything unparseable counts as "no
 * setup", matching `parseGroupAgentConfig` in @tloncorp/api.
 */
export function descriptionHasAgentSetup(
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
    if (!Array.isArray(entries)) {
      return false;
    }
    return entries.some((entry) => {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        (entry as { type?: unknown }).type !== AGENT_CONFIG_ENTRY_TYPE
      ) {
        return false;
      }
      const { purpose, jobs } = entry as {
        purpose?: unknown;
        jobs?: unknown;
      };
      return (
        (typeof purpose === 'string' && purpose.trim().length > 0) ||
        (Array.isArray(jobs) && jobs.length > 0)
      );
    });
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
  if (descriptionHasAgentSetup(opts.groupDescription)) {
    // Group is already configured — nothing to set up.
    return false;
  }
  if (isPurposePickerChoice(opts.messageText)) {
    return false;
  }
  return true;
}
