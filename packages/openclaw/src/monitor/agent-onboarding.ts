import { A2UI } from '@tloncorp/api';

import {
  TLON_A2UI_CATALOG_V2,
  type TlonA2UIBlob,
  makeA2UIBlob,
} from '../urbit/blob.js';
import {
  GROUP_ICON_RULE,
  INVITE_CARD_BUTTON_LABEL,
  INVITE_CARD_FALLBACK,
  INVITE_CARD_PROMPT,
  INVITE_CLOSING,
  PURPOSE_JOBS,
  PURPOSE_OPTIONS,
  PURPOSE_PICKER_FOOTER,
  PURPOSE_PICKER_PROMPT,
  PURPOSE_TOPICS,
  SERVICES_CARD_BUTTON_LABEL,
  SERVICES_CARD_FALLBACK,
  SERVICES_CARD_PROMPT,
  TOPICS_FREE_TEXT_PLACEHOLDER,
  TOPICS_PICKER_FOOTER,
  TOPICS_PICKER_PROMPT,
  TOPICS_PICKER_SUBMIT_LABEL,
} from './agent-onboarding-config.js';

/**
 * Agent onboarding, bot side: the pickers the agent posts into a group that
 * has no agent setup yet. The conversation content lives in
 * `agent-onboarding-config.ts`; this module turns it into A2UI blobs and
 * decides when to offer it.
 *
 * Every tappable option carries a `tlon.sendMessage` action, so tapping posts
 * the choice as the user's own reply and the conversation continues normally.
 * Tlon code owns the layout and the actions; the agent never composes
 * components.
 */

/** Mirrors GROUP_AGENT_CONFIG_ENTRY_TYPE in @tloncorp/api. */
const AGENT_CONFIG_ENTRY_TYPE = 'tlon-group-agent-config';

/**
 * The post's story text, which doubles as the fallback. One short line: the
 * quoted titles are exactly what the buttons post, so a client that can't
 * render A2UI (or a notification preview) still tells the user what to reply.
 */
export function purposePickerFallbackText(): string {
  const titles = PURPOSE_OPTIONS.map((t) => `“${t.title}”`).join(', ');
  return `${PURPOSE_PICKER_PROMPT} Reply ${titles} — or just tell me.`;
}

/**
 * Build a v2-catalog blob, or null when the resolved @tloncorp/api rejects
 * the layout — `makeA2UIBlob` validates with whichever version this plugin
 * was built against, so an older one refuses the newer primitives.
 */
function blobOrNull(
  surfaceId: string,
  components: A2UI.Component[]
): TlonA2UIBlob | null {
  try {
    return makeA2UIBlob(surfaceId, 'root', components, TLON_A2UI_CATALOG_V2);
  } catch {
    return null;
  }
}

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
 * Build the purpose-picker card. Prefers the design's `Choice` layout and
 * falls back to the v1 Card+Button layout when the resolved @tloncorp/api
 * doesn't know `Choice` yet (this plugin is built outside the workspace
 * against a published version). The fallback disappears on its own once a
 * release carries the primitive.
 */
export function buildPurposePickerBlob(surfaceSuffix: string): TlonA2UIBlob {
  const surfaceId = `agent-onboarding-${surfaceSuffix}`;
  return (
    blobOrNull(surfaceId, buildChoiceComponents()) ??
    makeA2UIBlob(surfaceId, 'root', buildButtonComponents())
  );
}

/** The purpose whose card title this message matches, if any. */
function purposeIdForChoice(text: string): string | undefined {
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
  return `${TOPICS_PICKER_PROMPT} ${topics.join(', ')} — ${TOPICS_PICKER_FOOTER}`;
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
      children: ['prompt', 'topics', 'footer'],
    },
    { id: 'prompt', component: 'Text', text: TOPICS_PICKER_PROMPT },
    {
      id: 'footer',
      component: 'Text',
      variant: 'caption',
      text: TOPICS_PICKER_FOOTER,
    },
    {
      // Cast for the same registry-version reason as the Choice layout.
      id: 'topics',
      component: 'SmallChoice',
      options: topics.map((topic) => ({
        id: topic.toLowerCase(),
        label: topic,
      })),
      submitLabel: TOPICS_PICKER_SUBMIT_LABEL,
      freeTextPlaceholder: TOPICS_FREE_TEXT_PLACEHOLDER,
      action: choiceAction(''),
    } as unknown as A2UI.Component,
  ];
  return blobOrNull(`agent-onboarding-topics-${surfaceSuffix}`, components);
}

/**
 * The invite card that closes a setup: a line of prose and the client's own
 * invite control, which resolves the group's current lure when the owner
 * uses it. Returns null when the resolved @tloncorp/api predates the
 * `tlon.inviteLink` action, in which case the setup simply ends without a
 * card — the agent has still made the ask in words.
 */
export function buildInviteCardBlob(
  surfaceSuffix: string,
  groupId: string
): TlonA2UIBlob | null {
  const components: A2UI.Component[] = [
    { id: 'root', component: 'Column', children: ['prompt', 'invite'] },
    { id: 'prompt', component: 'Text', text: INVITE_CARD_PROMPT },
    {
      id: 'invite',
      component: 'Button',
      variant: 'primary',
      child: 'inviteLabel',
      action: {
        event: { name: 'tlon.inviteLink', context: { groupId } },
      },
    } as unknown as A2UI.Component,
    { id: 'inviteLabel', component: 'Text', text: INVITE_CARD_BUTTON_LABEL },
  ];
  return blobOrNull(`agent-onboarding-invite-${surfaceSuffix}`, components);
}

/** The story text for the invite card, for clients that can't render it. */
export function inviteCardFallbackText(): string {
  return INVITE_CARD_FALLBACK;
}

/** Mirrors BotHomeGroupSlugs.slug in @tloncorp/api/types/wayfinding. */
const HOME_GROUP_SLUG = 'home-group';

/**
 * Whether `flag` names the owner's hosted home group — the venue of the
 * account's *initial* onboarding. Provisioning creates it with a fixed slug
 * on the owner's own ship, so the flag is deterministic; user-created agent
 * groups get random slugs and never match.
 */
export function isHomeGroupFlag(
  flag: string,
  ownerShip: string | null
): boolean {
  return Boolean(ownerShip) && flag === `${ownerShip}/${HOME_GROUP_SLUG}`;
}

/**
 * The connected-services card that follows the invite card in the home
 * group's initial onboarding: a line of prose and a button that opens the
 * client's bot-settings services screen. Returns null when the resolved
 * @tloncorp/api predates screen navigation, in which case only the fallback
 * text (which names the path in words) is posted.
 */
export function buildServicesCardBlob(
  surfaceSuffix: string
): TlonA2UIBlob | null {
  const components: A2UI.Component[] = [
    { id: 'root', component: 'Column', children: ['prompt', 'connect'] },
    { id: 'prompt', component: 'Text', text: SERVICES_CARD_PROMPT },
    {
      id: 'connect',
      component: 'Button',
      variant: 'primary',
      child: 'connectLabel',
      action: {
        event: {
          name: 'tlon.navigate',
          context: { target: { type: 'screen', screen: 'botMcpSettings' } },
        },
      },
    } as unknown as A2UI.Component,
    {
      id: 'connectLabel',
      component: 'Text',
      text: SERVICES_CARD_BUTTON_LABEL,
    },
  ];
  return blobOrNull(`agent-onboarding-services-${surfaceSuffix}`, components);
}

/** The story text for the services card, for clients that can't render it. */
export function servicesCardFallbackText(): string {
  return SERVICES_CARD_FALLBACK;
}

/**
 * The build instructions attached to the model turn that follows the owner's
 * topic reply. The cron payload is the config template rendered here —
 * deterministically — and the directive tells the agent to use it verbatim,
 * so what the job does every run is authored in `agent-onboarding-config.ts`,
 * not composed by the model. Null for purposes without a job template (a
 * freeform purpose gets a freeform build).
 */
export function renderSetupDirective(
  purposeId: string,
  topicsReply: string
): string | null {
  const job = PURPOSE_JOBS[purposeId];
  if (!job) {
    return null;
  }
  const topics = topicsReply.trim();
  const fill = (template: string) => template.replaceAll('{{topics}}', topics);
  return [
    '[Tlon setup directive — not written by the owner]',
    'Build everything inside the group this channel belongs to; rename this',
    'group from the topics if it still has a placeholder name.',
    GROUP_ICON_RULE,
    'Never create a group — not as the output home, not as a workspace,',
    'not as a fallback.',
    "Don't create the output channel during setup unless the confirmation",
    'step below explicitly has you do it. Otherwise the first run makes it,',
    'so it arrives with something already in it, and "outputNest" stays',
    'empty in the config until then.',
    'When you create the scheduled job for this setup, use these values',
    'exactly as given. Do not rewrite, extend, or paraphrase the payload',
    'message; it is configuration, not a draft.',
    'Set only the fields named here. Leave every other cron parameter out',
    'entirely rather than sending it empty — in particular "toolsAllow": an',
    'empty allow-list means the run gets NO tools, so the job wakes up unable',
    'to search, write, or post, and can only report that it is blocked. Omit',
    'it so the run inherits the full toolset. Same for "lightContext": leave',
    'it unset.',
    `job title: ${fill(job.title)}`,
    `schedule: ${job.schedule} in the owner's timezone — ask for it if you`,
    "don't know it; never silently use UTC.",
    `payload message, verbatim: ${fill(job.prompt)}`,
    'The group description is the config JSON array and nothing else — the',
    'payload message goes inside it, as the job entry\'s "prompt" field.',
    'Never put the payload, or any prose, in the description itself.',
    'The whole description is exactly this array — one config entry with the',
    'job nested inside its "jobs". Do not write the job on its own, and do',
    'not drop "type", "version" or "agents": the app identifies the entry by',
    'type and learns which ship is its agent from "agents", so an entry',
    "missing them makes the app stop treating you as this group's agent —",
    'your cards stop rendering and the group shows this JSON as its',
    'description. Fill the placeholders; keep every other field as shown:',
    `[{"type":"tlon-group-agent-config","version":1,"templateId":` +
      `${JSON.stringify(purposeId)},"purpose":"<one sentence, plain prose>",` +
      '"instructions":"","agents":["<your own ship, e.g. ~zod>"],"jobs":[' +
      `{"id":${JSON.stringify(purposeId)},"title":${JSON.stringify(fill(job.title))},` +
      `"schedule":{"kind":"cron","expr":${JSON.stringify(job.schedule)},` +
      '"tz":"<owner timezone>"},"prompt":"<payload message, verbatim>",' +
      '"outputNest":"","enabled":true}],"updatedAt":<epoch ms>}]',
    `templateId: ${purposeId} — copy it exactly; it records which setup the`,
    'owner picked, so a different id makes the group misreport itself.',
    `Once the job and config are in place: ${fill(job.confirmation)}`,
    INVITE_CLOSING,
  ].join('\n');
}

type ScryApi = { scry: (path: string) => Promise<unknown> } | null;
type Runtime = { error?: (message: string) => void };
type RawGroup = {
  meta?: { description?: unknown };
  channels?: Record<string, unknown>;
  'active-channels'?: unknown;
  seats?: unknown;
};

/**
 * One groups scry, shared by the resolvers below. Deliberately not the
 * monitor's channel→group map: that is built from init data at startup, so a
 * group created after the bot connected — the fresh-account case this feature
 * exists for — isn't in it yet. Null on failure, so callers stay quiet
 * rather than guessing.
 */
async function scryGroups(
  api: ScryApi,
  runtime: Runtime,
  what: string
): Promise<Record<string, RawGroup> | null> {
  if (!api) {
    return null;
  }
  try {
    return (await api.scry('/groups/v2/groups.json')) as Record<
      string,
      RawGroup
    > | null;
  } catch (error) {
    runtime.error?.(`[tlon] Failed to resolve ${what}: ${String(error)}`);
    return null;
  }
}

const nestsOf = (group: RawGroup): string[] => [
  ...(Array.isArray(group['active-channels'])
    ? (group['active-channels'] as unknown[]).filter(
        (key): key is string => typeof key === 'string'
      )
    : []),
  ...Object.keys(group.channels ?? {}),
];

const descriptionOf = (group: RawGroup): string =>
  typeof group.meta?.description === 'string' ? group.meta.description : '';

const hostOf = (flag: string): string => flag.split('/')[0] ?? '';

/** Find the group that owns `nest`, with its host and description. */
export async function findGroupForChannel(
  api: ScryApi,
  nest: string,
  runtime: Runtime
): Promise<{ flag: string; host: string; description: string } | null> {
  const groups = await scryGroups(api, runtime, `group for ${nest}`);
  for (const [flag, group] of Object.entries(groups ?? {})) {
    if (nestsOf(group).includes(nest)) {
      return { flag, host: hostOf(flag), description: descriptionOf(group) };
    }
  }
  return null;
}

/**
 * Find a group's chat channel (plus host and description). Null when the
 * group or its chat channel can't be resolved — for a group the bot was just
 * invited to, the channels land moments after the join ack, so callers poll
 * rather than treating null as final.
 */
export async function findChatNestForGroup(
  api: ScryApi,
  flag: string,
  runtime: Runtime
): Promise<{
  nest: string;
  host: string;
  description: string;
  channelCount: number;
} | null> {
  const groups = await scryGroups(api, runtime, `chat channel for ${flag}`);
  const group = groups?.[flag];
  const nests = group ? nestsOf(group) : [];
  const nest = nests.find((key) => key.startsWith('chat/'));
  if (!group || !nest) {
    return null;
  }
  return {
    nest,
    host: hostOf(flag),
    description: descriptionOf(group),
    channelCount: new Set(nests).size,
  };
}

/**
 * Recover a pending topics-picker purpose from channel history.
 *
 * The in-memory pending map is the primary record that the topic pills are
 * awaiting an owner reply, but it dies with the process — a restart between
 * the pills and the reply would otherwise swallow the setup directive and
 * the templated job silently. The transcript survives restarts: the picker
 * conversation is bot-posts-pills preceded by owner-taps-card, so walk
 * recent history newest-first and rebuild the purpose from it.
 *
 * Undefined when history doesn't show an unanswered picker — including when
 * the owner already replied to it (any owner message after the pills means
 * the directive turn already ran, or is running).
 */
export function derivePendingPurposeFromHistory(
  history: Array<{ author: string; content: string; timestamp?: number }>,
  botShip: string,
  ownerShip: string,
  /**
   * The message being handled right now. History fetched mid-turn can already
   * include it, and without skipping it the reply we are about to treat as the
   * topics answer reads as "some other owner message" — abandoning recovery
   * and re-offering the picker over an answered one.
   */
  currentMessageText?: string
): string | undefined {
  // Walk newest-first regardless of fetch order.
  const newestFirst = [...history].sort(
    (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
  );
  const current = currentMessageText?.trim();
  let skippedCurrent = false;
  // Only pills that were actually posted can be awaiting an answer. Requiring
  // them means a crash *before* the picker went out doesn't arm a setup the
  // owner never saw — they get the picker offered again instead, which is the
  // honest outcome.
  let sawTopicsPicker = false;
  for (const entry of newestFirst) {
    if (entry.author === ownerShip) {
      const content = entry.content.trim();
      if (!skippedCurrent && current && content === current) {
        skippedCurrent = true;
        continue;
      }
      const purposeId = purposeIdForChoice(entry.content);
      if (purposeId) {
        return sawTopicsPicker ? purposeId : undefined;
      }
      // Some other owner message is newer than any picker: the picker was
      // answered (or abandoned) already.
      if (content) {
        return undefined;
      }
    }
    if (
      entry.author === botShip &&
      entry.content.startsWith(TOPICS_PICKER_PROMPT)
    ) {
      // Pills with no owner reply after them: the purpose is the owner's
      // card tap just before. Keep scanning for it.
      sawTopicsPicker = true;
      continue;
    }
  }
  return undefined;
}

/**
 * Whether `ship` holds the admin role in `flag`.
 *
 * The client grants the agent admin right after creating the group, but the
 * grant races the agent's own join — and a setup turn that starts before the
 * role lands does its renames and channel-creates as a plain member, whose
 * pokes the host silently drops. Callers poll this before building. Null
 * when the seat can't be read, which callers should treat as "not yet".
 */
export async function agentHasAdminSeat(
  api: ScryApi,
  flag: string,
  ship: string,
  runtime: Runtime
): Promise<boolean | null> {
  const groups = await scryGroups(api, runtime, `admin seat in ${flag}`);
  const seats = groups?.[flag]?.seats;
  if (!seats || typeof seats !== 'object') {
    return null;
  }
  const seat = (seats as Record<string, { roles?: unknown }>)[ship];
  if (!seat) {
    return null;
  }
  return Array.isArray(seat.roles) && seat.roles.includes('admin');
}

/**
 * Whether a channel has no posts yet — the test for "this group was just
 * created" at invite-accept time.
 *
 * Fails closed: returns null when the scry fails or the shape is
 * unrecognizable, so an unreadable channel is never mistaken for a new one.
 * (`fetchChannelHistory` is not used here because it returns `[]` on error.)
 */
export async function channelHasNoPosts(
  api: ScryApi,
  nest: string,
  runtime: Runtime
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
  /**
   * A newly created group has exactly one channel. An established group can
   * have an *empty chat* (all its life in a notebook or another chat), and
   * an empty-channel probe alone would open that group with setup copy.
   */
  groupHasSingleChannel: boolean;
  alreadyOffered: boolean;
}): boolean {
  return (
    !opts.alreadyOffered &&
    opts.groupHostIsOwner &&
    opts.channelHasNoPosts === true &&
    opts.groupHasSingleChannel &&
    !descriptionHasAgentSetup(opts.groupDescription)
  );
}

/**
 * True when a group's agent setup has actually happened: its config entry
 * carries a purpose or at least one job.
 *
 * A config entry that only names `agents` is a declaration of who may act,
 * not of what the group does — that's the state a group is in *before*
 * onboarding (the client marks the resident agent so its cards render), and
 * suppressing the pickers because of it would kill the very setup they exist
 * to run. Parses the typed-entry array rather than substring-matching;
 * anything unparseable counts as "no setup", matching `parseGroupAgentConfig`
 * in @tloncorp/api.
 */
export function descriptionHasAgentSetup(
  description: string | null | undefined
): boolean {
  return agentConfigEntries(description).some((entry) => {
    const { purpose, jobs } = entry;
    return (
      (typeof purpose === 'string' && purpose.trim().length > 0) ||
      (Array.isArray(jobs) && jobs.length > 0)
    );
  });
}

/**
 * True once a group's config records a job — the build's final artifact, and
 * so the signal that a setup has finished rather than merely started. Stricter
 * than {@link descriptionHasAgentSetup} on purpose: a config carrying only a
 * purpose is a build that wrote its intent and then stopped.
 */
export function descriptionHasConfiguredJob(
  description: string | null | undefined
): boolean {
  return agentConfigEntries(description).some(
    (entry) => Array.isArray(entry.jobs) && entry.jobs.length > 0
  );
}

/**
 * The config entries in a group description, or none if it holds prose or
 * malformed JSON — anything unparseable reads as "no config", matching
 * `parseGroupAgentConfig` in @tloncorp/api.
 */
function agentConfigEntries(
  description: string | null | undefined
): { purpose?: unknown; jobs?: unknown }[] {
  const trimmed = description?.trim();
  if (!trimmed?.startsWith('[')) {
    return [];
  }
  try {
    const entries = JSON.parse(trimmed);
    return Array.isArray(entries)
      ? entries.filter(
          (entry) =>
            entry?.type === AGENT_CONFIG_ENTRY_TYPE && entry?.version === 1
        )
      : [];
  } catch {
    return [];
  }
}

/** True when `text` is one of the picker's card titles. */
export function isPurposePickerChoice(text: string): boolean {
  return purposeIdForChoice(text) !== undefined;
}

/**
 * Whether to offer the picker in response to this message: once per channel,
 * only for the owner's own message in a group the owner hosts with no agent
 * config yet — and never in response to a tap on the picker itself (that
 * reply continues the conversation instead).
 */
export function shouldOfferPurposePicker(opts: {
  senderIsOwner: boolean;
  groupHostIsOwner: boolean;
  groupDescription: string | null | undefined;
  messageText: string;
  alreadyOffered: boolean;
}): boolean {
  return (
    !opts.alreadyOffered &&
    opts.senderIsOwner &&
    opts.groupHostIsOwner &&
    !descriptionHasAgentSetup(opts.groupDescription) &&
    !isPurposePickerChoice(opts.messageText)
  );
}

/**
 * Whether to follow a purpose pick with the topic pills: once per channel,
 * only when the owner's message is exactly one of the purpose titles — i.e.
 * they tapped a card — in a group they host that has no agent config yet.
 */
export function shouldOfferTopicsPicker(opts: {
  senderIsOwner: boolean;
  groupHostIsOwner: boolean;
  groupDescription: string | null | undefined;
  messageText: string;
  alreadyOffered: boolean;
}): string | undefined {
  if (
    opts.alreadyOffered ||
    !opts.senderIsOwner ||
    !opts.groupHostIsOwner ||
    descriptionHasAgentSetup(opts.groupDescription)
  ) {
    return undefined;
  }
  return purposeIdForChoice(opts.messageText);
}
