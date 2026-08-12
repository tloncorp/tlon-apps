import { A2UI } from '@tloncorp/api';

import {
  TLON_A2UI_CATALOG_V2,
  type TlonA2UIBlob,
  makeA2UIBlob,
} from '../urbit/blob.js';
import {
  CUSTOM_PURPOSE_ID,
  INVITE_CARD_BUTTON_LABEL,
  INVITE_CARD_FALLBACK,
  INVITE_CARD_PROMPT,
  PURPOSE_OPTIONS,
  PURPOSE_PICKER_FOOTER,
  PURPOSE_PICKER_PROMPT,
  PURPOSE_TOPICS,
  SERVICES_CARD_BUTTON_LABEL,
  SERVICES_CARD_FALLBACK,
  SERVICES_CARD_PROMPT,
  TIMEZONE_PICKER_BUTTON_LABEL,
  TIMEZONE_PICKER_FALLBACK,
  TIMEZONE_PICKER_PROMPT,
  TOPICS_FREE_TEXT_PLACEHOLDER,
  TOPICS_PICKER_FOOTER,
  TOPICS_PICKER_PROMPT,
  TOPICS_PICKER_SUBMIT_LABEL,
} from './agent-onboarding-config.js';
import {
  ONBOARDING_TIMEZONE_PREFIX,
  deterministicSetupFromDescription,
} from './agent-onboarding-coordinator.js';

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

/** Ask the client to resolve its own IANA timezone instead of asking a model. */
export function buildTimezonePickerBlob(
  surfaceSuffix: string
): TlonA2UIBlob | null {
  return blobOrNull(`agent-onboarding-timezone-${surfaceSuffix}`, [
    {
      id: 'root',
      component: 'Column',
      children: ['prompt', 'useTimezone'],
    },
    { id: 'prompt', component: 'Text', text: TIMEZONE_PICKER_PROMPT },
    {
      id: 'useTimezone',
      component: 'Button',
      variant: 'primary',
      child: 'useTimezoneLabel',
      action: {
        event: {
          name: A2UI.action.sendMessage,
          // New clients replace the token locally before posting. Older
          // clients post it literally; the fallback text tells their owner
          // how to type an IANA timezone instead.
          context: {
            text: `${ONBOARDING_TIMEZONE_PREFIX} {{tlon.timezone}}`,
          },
        },
      },
    },
    {
      id: 'useTimezoneLabel',
      component: 'Text',
      text: TIMEZONE_PICKER_BUTTON_LABEL,
    },
  ] as A2UI.Component[]);
}

export function timezonePickerFallbackText(): string {
  return TIMEZONE_PICKER_FALLBACK;
}

/** The purpose whose card title this message matches, if any. */
function purposeIdForChoice(text: string): string | undefined {
  const trimmed = text.trim().toLowerCase();
  return PURPOSE_OPTIONS.find(
    (option) => option.title.toLowerCase() === trimmed
  )?.id;
}

export type OnboardingPurposeSelection = {
  purposeId: string;
  purpose?: string;
};

function purposeSelectionForReply(
  text: string
): OnboardingPurposeSelection | undefined {
  const purposeId = purposeIdForChoice(text);
  if (purposeId) {
    return { purposeId };
  }
  const purpose = text.trim().slice(0, 500);
  return purpose ? { purposeId: CUSTOM_PURPOSE_ID, purpose } : undefined;
}

/**
 * The post's story text, which doubles as the fallback. Names the suggestions
 * so a client that can't render the pills still gets an answerable question.
 */
export function topicsPickerFallbackText(purposeId: string): string {
  const topics = PURPOSE_TOPICS[purposeId] ?? [];
  if (!topics.length) {
    return `${TOPICS_PICKER_PROMPT} ${TOPICS_PICKER_FOOTER}`;
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

/** Mirrors BotHomeGroupSlugs.chatSlug — the home group's chat channel. */
const HOME_GROUP_CHAT_SLUG = 'home-group-chat';

/** The owner's hosted home group flag — deterministic (see below). */
export function homeGroupFlagFor(ownerShip: string): string {
  return `${ownerShip}/${HOME_GROUP_SLUG}`;
}

/** The home group's chat channel nest, equally deterministic. */
export function homeGroupChatNestFor(ownerShip: string): string {
  return `chat/${ownerShip}/${HOME_GROUP_CHAT_SLUG}`;
}

/**
 * Whether the home group's chat still counts as unopened despite carrying
 * posts.
 *
 * Everywhere else, "has posts" means "is a conversation" and the opening
 * stays out. The home group is different: hosting provisioning historically
 * posted a legacy welcome *as the bot* into it, and a message can't be
 * unsent — holding the empty-channel line would permanently block the
 * conversational opening for every already-provisioned account. Posts
 * authored by the bot alone don't make the group a conversation, so the
 * opening may still go out over them. The moment anyone else has spoken —
 * or the opening picker itself is already in the transcript — the channel
 * is live and this returns false.
 */
export function homeGroupAwaitingOpening(
  history: Array<{ author: string; content: string }>,
  botShipName: string
): boolean {
  return (
    history.every((entry) => entry.author === botShipName) &&
    !history.some((entry) => entry.content.startsWith(PURPOSE_PICKER_PROMPT))
  );
}

/**
 * A newly created agent group may already contain owner-authored bootstrap
 * posts by the time the agent joins. Those posts must not permanently block
 * the opening; only a third-party participant or an already-posted picker
 * proves that the conversation has moved on.
 */
export function agentGroupAwaitingOpening(
  history: Array<{ author: string; content: string }>,
  botShipName: string,
  ownerShip: string
): boolean {
  return (
    history.every(
      (entry) => entry.author === botShipName || entry.author === ownerShip
    ) &&
    !history.some((entry) => entry.content.startsWith(PURPOSE_PICKER_PROMPT))
  );
}

/**
 * Whether `flag` names the owner's hosted home group — the venue hosting
 * provisioning uses for the account's initial onboarding. Deterministic
 * because provisioning creates it with a fixed slug on the owner's own ship;
 * user-created agent groups get random slugs and never match.
 *
 * Not sufficient on its own for "is this the initial onboarding": accounts
 * without hosting have no home group at all, so see
 * {@link isFirstConfiguredSetup}.
 */
export function isHomeGroupFlag(
  flag: string,
  ownerShip: string | null
): boolean {
  return Boolean(ownerShip) && flag === homeGroupFlagFor(ownerShip!);
}

/**
 * Whether the setup that just finished in `flag` is the first this agent has
 * ever completed — the account's initial onboarding, whichever group it
 * happened in.
 *
 * Asks the question directly rather than by venue: does any *other* group
 * of this owner's already carry a configured job? A self-hosted account has
 * no home group, so keying only on that flag would mean its genuine first
 * run never counted as one. A configured job elsewhere means this owner has
 * been through a setup before, whether or not hosting gave them a home
 * group. Scoped to groups the same host owns: the bot can sit in *someone
 * else's* configured agent group, and that group's job says nothing about
 * whether this owner has seen the tour.
 *
 * Null when the groups scry fails, so the caller can stay quiet rather than
 * guess — repeating the tour for an experienced owner reads as broken.
 */
export async function isFirstConfiguredSetup(
  api: ScryApi,
  runtime: Runtime,
  flag: string
): Promise<boolean | null> {
  const groups = await scryGroups(api, runtime, 'configured agent groups');
  if (!groups) {
    return null;
  }
  // The host filter is the point, and it was missing: without it any
  // configured agent group the bot happens to sit in — someone else's,
  // hosted by another ship — counted as this owner's prior setup, so their
  // real first setup skipped the services card and settled early.
  const host = hostOf(flag);
  return !Object.entries(groups).some(
    ([otherFlag, group]) =>
      otherFlag !== flag &&
      hostOf(otherFlag) === host &&
      descriptionHasConfiguredJob(descriptionOf(group))
  );
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

/**
 * Owner-hosted groups whose config *declares* an agent but shows no setup —
 * the exact state a client-created agent group is in from the moment of
 * creation (the client writes the bare `agents` marker) until the guided
 * setup writes a purpose or job.
 *
 * This is the startup-sweep candidate list for openings lost in flight
 * (crash between the join-accept and the opening post). Deliberately keyed
 * on the marker, not on group *shape*: "empty single-channel owner group"
 * also describes plenty of ordinary groups — muted channels, fixtures,
 * dormant spaces — and opening those unprompted at every restart would be
 * the bot barging in. A group without the marker that lost its opening
 * still recovers through the message path the moment the owner types.
 */
export async function findAgentGroupsAwaitingOpening(
  api: ScryApi,
  runtime: Runtime,
  ownerShip: string | null
): Promise<string[]> {
  if (!ownerShip) {
    return [];
  }
  const groups = await scryGroups(
    api,
    runtime,
    'agent groups awaiting opening'
  );
  return Object.entries(groups ?? {})
    .filter(([flag, group]) => {
      if (hostOf(flag) !== ownerShip) {
        return false;
      }
      const description = descriptionOf(group);
      const awaitingPicker = agentConfigEntries(description).some(
        (entry) =>
          entry.onboarding?.state === 'awaiting-topics' ||
          entry.onboarding?.state === 'awaiting-timezone'
      );
      if (awaitingPicker) {
        return true;
      }
      // The hosted home group never carries the marker (provisioning
      // writes none) but its flag is deterministic, so an existing,
      // not-yet-set-up home group is always a candidate — its moon is
      // force-joined, and this sweep plus groups-ui discovery are the only
      // triggers it has.
      if (flag === homeGroupFlagFor(ownerShip)) {
        return !descriptionHasAgentSetup(description);
      }
      return (
        agentConfigEntries(description).length > 0 &&
        !descriptionHasAgentSetup(description)
      );
    })
    .map(([flag]) => flag);
}

/**
 * The owner's groups whose setup already wrote a configured job.
 *
 * The mirror image of the list above, and the sweep needs both: that one
 * finds setups that have not started, this one finds setups that may have
 * finished without their closing. The debt is otherwise recorded only in
 * memory, so a gateway restart between the config write and the cards lost
 * it — and the closing check is transcript-idempotent precisely so it can
 * be re-run from a list like this and settle on its own.
 */
export async function findConfiguredAgentGroupRoutes(
  api: ScryApi,
  runtime: Runtime,
  ownerShip: string | null
): Promise<
  Array<{
    flag: string;
    chatNest: string;
    notebookNest: string | null;
    description: string;
  }>
> {
  if (!ownerShip) {
    return [];
  }
  const groups = await scryGroups(api, runtime, 'configured agent groups');
  return Object.entries(groups ?? {}).flatMap(([flag, group]) => {
    const description = descriptionOf(group);
    if (
      hostOf(flag) !== ownerShip ||
      !descriptionHasConfiguredJob(description)
    ) {
      return [];
    }
    const nests = nestsOf(group);
    const chatNest = nests.find((key) => key.startsWith('chat/'));
    if (!chatNest) {
      return [];
    }
    const liveNotebookNests = nests.filter((key) => key.startsWith('notes/'));
    const configuredNotebookNest =
      deterministicSetupFromDescription(description)?.record.notebookNest;
    const notebookNest =
      configuredNotebookNest &&
      liveNotebookNests.includes(configuredNotebookNest)
        ? configuredNotebookNest
        : liveNotebookNests[0] ?? null;
    return [
      {
        flag,
        chatNest,
        notebookNest,
        description,
      },
    ];
  });
}

/**
 * The owner-hosted notes channel for a group, or null until the client has
 * created it from the configured job.
 *
 * Throws when groups state can't be read so a transient failure is distinct
 * from the normal "the client has not created it yet" null result.
 */
export async function setupOutputNotebookNest(
  api: ScryApi,
  flag: string,
  runtime: Runtime
): Promise<string | null> {
  const groups = await scryGroups(api, runtime, `notes channel for ${flag}`);
  if (!groups) {
    throw new Error(
      `Could not read groups while resolving a notebook: ${flag}`
    );
  }
  const group = groups[flag];
  const nests = group ? nestsOf(group) : [];
  return nests.find((key) => key.startsWith('notes/')) ?? null;
}

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
 * The purpose reply still waiting for the topic prompt: the owner's newest
 * substantive message answers the opening picker, and no topics prompt ever
 * picker exists in the transcript, and no topics prompt ever followed.
 * This is the shape a missed message leaves behind — the tap landed while
 * the gateway was restarting (or the pills post failed), so no live
 * handler will ever answer it and the owner is stuck staring at their own
 * tap. The sweep uses this to post the pills the tap already earned.
 */
export function pendingTopicsOfferFromHistory(
  history: Array<{ author: string; content: string; timestamp?: number }>,
  botShip: string,
  ownerShip: string
): OnboardingPurposeSelection | undefined {
  const newestFirst = [...history].sort(
    (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
  );
  let tappedPurpose: OnboardingPurposeSelection | undefined;
  for (const entry of newestFirst) {
    const content = entry.content.trim();
    if (entry.author === botShip) {
      if (content.startsWith(TOPICS_PICKER_PROMPT)) {
        // Pills were posted — answered or not, the other recovery paths
        // own that shape.
        return undefined;
      }
      if (content.startsWith(PURPOSE_PICKER_PROMPT)) {
        // Only owner messages encountered before this point are newer than
        // the picker. Anything below it is bootstrap/history, not an answer.
        return tappedPurpose;
      }
      continue;
    }
    if (entry.author === ownerShip && content) {
      if (tappedPurpose === undefined) {
        tappedPurpose = purposeSelectionForReply(content);
      }
      // Keep the newest owner answer while scanning back to its picker.
    }
  }
  return undefined;
}

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
): OnboardingPurposeSelection | undefined {
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
      const purpose = purposeSelectionForReply(entry.content);
      if (purpose && sawTopicsPicker) {
        return purpose;
      }
      if (purposeIdForChoice(entry.content)) {
        // A card title newer than any pills seen so far is a duplicate tap
        // (dropped live, but it survives in the transcript). Keep walking —
        // the pills and the tap that earned them are further down.
        continue;
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
function agentConfigEntries(description: string | null | undefined): {
  purpose?: unknown;
  templateId?: unknown;
  jobs?: unknown;
  onboarding?: { state?: unknown };
}[] {
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
 * Whether to follow a purpose reply with the topic prompt. Card titles map to
 * their template; freeform replies use the generic deterministic template and
 * preserve the owner's exact purpose text.
 */
export function shouldOfferTopicsPicker(opts: {
  senderIsOwner: boolean;
  groupHostIsOwner: boolean;
  groupDescription: string | null | undefined;
  messageText: string;
  alreadyOffered: boolean;
}): OnboardingPurposeSelection | undefined {
  if (
    opts.alreadyOffered ||
    !opts.senderIsOwner ||
    !opts.groupHostIsOwner ||
    descriptionHasAgentSetup(opts.groupDescription)
  ) {
    return undefined;
  }
  return purposeSelectionForReply(opts.messageText);
}
