import { A2UI } from '@tloncorp/api';

import {
  TLON_A2UI_CATALOG_V2,
  type TlonA2UIBlob,
  makeA2UIBlob,
} from '../urbit/blob.js';
import {
  GROUP_LOOK_RULE,
  GROUP_LOOK_RULE_NO_ENTRY,
  INVITE_CARD_BUTTON_LABEL,
  INVITE_CARD_FALLBACK,
  INVITE_CARD_PROMPT,
  INVITE_CLOSING,
  NOTEBOOK_ENTRY_WRITE_RULE,
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
    'Every message you send during this setup lands in the group chat the',
    'owner is watching. Do not narrate progress — no "renaming the group",',
    'no "notebook exists", no retry or verification commentary. Do the work',
    'through tool calls in silence. You may send exactly two things: a',
    'question you truly cannot proceed without (like the timezone below),',
    'and the single confirmation message described at the end — sent once,',
    'never repeated, even when a step is retried or re-verified after it.',
    'Tlon itself posts short progress lines as your build reaches each',
    'step, so the owner is never watching a silent channel — you never',
    'need to.',
    'Build everything inside the group this channel belongs to.',
    'Work in this order, and do not run ahead of it.',
    'FIRST: write the group config described below.',
    "That write is what makes the owner's app create the notebook, so",
    'everything downstream waits on it and nothing is gained by doing',
    'anything else first. Then schedule the job. Then do the research this',
    'setup needs and keep it ready.',
    'Stop there. Do NOT write the notebook entry, do NOT rename the group,',
    'and do NOT generate an icon in this turn. Tlon watches for the',
    "owner's notebook and sends you a second directive — naming the exact",
    'nest — that carries the entry and those finishing touches in the right',
    'order. Renaming and icon-making are the slowest, least reliable steps',
    'in the build, and doing them now spends this turn before the config,',
    'the notebook and the entry exist.',
    'Never create a group — not as the output home, not as a workspace,',
    'not as a fallback. Never create a channel either: the output notebook',
    "is the OWNER's channel, created by their app on their ship the moment",
    'the group config lands — you post *into* it, per the payload rules',
    'below, and "outputNest" stays empty in the config until the first',
    'entry lands there.',
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
    'That payload describes what the job does when it fires on its',
    'schedule, not what you do now. Its output rules govern those runs;',
    'this turn is still governed by the order above — store it as written',
    'and write nothing to a notebook yet.',
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
    'To write the description: build the config as an object in code,',
    'JSON.stringify it into /tmp/tlon-group-config.json (that exact kind',
    'of path — a flat .json file in /tmp — is the only one the tool will',
    'read), and parse the file back to prove it is valid JSON — never',
    'hand-write or hand-escape it. Then run `tlon groups update <flag>',
    '--description "$(cat /tmp/tlon-group-config.json)"`: the quoted',
    'substitution passes the file contents through exactly. Inline',
    'hand-escaped JSON has repeatedly lost its quotes to the shell and',
    'stored a truncated description, which the app reads as "no config at',
    'all" — it stops treating you as this group\'s agent and the setup',
    'never finishes. If the update command reports a timeout, the write',
    'usually landed anyway: re-run the identical command once (it is',
    'idempotent) and move on — never rebuild the JSON by hand over a',
    'timeout, and never mention the retry in chat.',
    `Once the job and config are in place: ${fill(job.confirmation)}`,
    INVITE_CLOSING,
  ].join('\n');
}

/**
 * Why a stored description is a broken config write, or null when it is
 * prose, empty, or parses cleanly. Two signatures, both observed live on
 * the pool, both from the same root — the model writes the config through
 * a command string that no shell ever interprets:
 *
 * - Config-shaped but unparseable: hand-escaped quoting ate part of the
 *   JSON mid-string, so the description *looks* like config while parsing
 *   as nothing.
 * - A literal, unexpanded command substitution — the description is the
 *   text `$(cat /tmp/config.json)` itself.
 *
 * Either way the app un-recognizes the group's agent, the setup chrome
 * never unlocks, and every "is the setup finished?" check silently
 * answers no, forever. Callers use this to turn that dead end into a
 * repair.
 */
export function brokenConfigDescriptionError(
  description: string | null | undefined
): string | null {
  const trimmed = (description ?? '').trim();
  if (trimmed.startsWith('$(')) {
    return (
      'the stored description is a literal, unexpanded command ' +
      'substitution — the config JSON never reached the group'
    );
  }
  if (!trimmed.startsWith('[')) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  // Parsing isn't enough: a bare job array without the typed wrapper (a
  // shape models have written before) is valid JSON the app recognizes as
  // nothing — the same silent stall as a parse failure. The client's own
  // bare marker (typed entry, no jobs yet) is the normal mid-setup state
  // and must pass.
  const entries = Array.isArray(parsed) ? parsed : [];
  const hasRecognizedEntry = entries.some(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      (entry as { type?: unknown }).type === AGENT_CONFIG_ENTRY_TYPE &&
      (entry as { version?: unknown }).version === 1
  );
  if (!hasRecognizedEntry) {
    return (
      'the description parses as JSON but contains no recognized config ' +
      `entry — every entry needs "type":"${AGENT_CONFIG_ENTRY_TYPE}" and ` +
      '"version":1, or the app reads the group as having no config'
    );
  }
  return null;
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
export async function findConfiguredAgentGroups(
  api: ScryApi,
  runtime: Runtime,
  ownerShip: string | null
): Promise<string[]> {
  if (!ownerShip) {
    return [];
  }
  const groups = await scryGroups(api, runtime, 'configured agent groups');
  return Object.entries(groups ?? {})
    .filter(
      ([flag, group]) =>
        hostOf(flag) === ownerShip &&
        descriptionHasConfiguredJob(descriptionOf(group))
    )
    .map(([flag]) => flag);
}

/**
 * The setup's output notebook, or null when the setup has none — the
 * 404-fallback path records a *chat* nest as outputNest, and a freeform
 * build may skip the notebook entirely. Prefers the nest the config
 * records; falls back to the group's notes channel, since the owner's app
 * creates the channel before anything records it.
 *
 * Throws when the groups state can't be read, rather than reporting "no
 * notebook": callers use null to mean *this setup has none* and stop
 * waiting on it, so a transient scry failure would otherwise release the
 * closing cards on a setup whose notebook was merely unreadable for a
 * moment. Every caller already treats a throw as "come back next sweep".
 */
export async function setupOutputNotebookNest(
  api: ScryApi,
  flag: string,
  description: string | null | undefined,
  runtime: Runtime
): Promise<string | null> {
  // A recorded outputNest is a decision, whether or not it names a
  // notebook. Only an *unrecorded* one falls through to the group scan
  // below, which exists for the window before anything has written the
  // nest down. Reading past a recorded `chat/...` used to hand back some
  // unrelated notes channel — one the owner's app had just made, or one the
  // group already had — and the closing would then wait for, and ask for, a
  // day-one entry in a notebook this job never writes to.
  let recordedNonNotes = false;
  for (const entry of agentConfigEntries(description)) {
    const jobs = Array.isArray(entry.jobs) ? entry.jobs : [];
    for (const job of jobs) {
      const out = (job as { outputNest?: unknown })?.outputNest;
      if (typeof out !== 'string' || out.trim() === '') {
        continue;
      }
      if (out.startsWith('notes/')) {
        return out;
      }
      recordedNonNotes = true;
    }
  }
  if (recordedNonNotes) {
    return null;
  }
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
/**
 * Whether the transcript shows the topic pills already answered: the bot's
 * topics picker with a substantive owner message *after* it. Paired with a
 * config that has no job yet, that means a setup directive turn ran (or is
 * running) — a build in flight, which a restart must not orphan behind the
 * owner-listen gate: the bot may be waiting on an answer it asked for.
 *
 * `currentMessageText` is excluded for the same reason as in
 * {@link derivePendingPurposeFromHistory}: the message being handled must
 * not count as its own evidence.
 */
export function topicsPickerAnswered(
  history: Array<{ author: string; content: string; timestamp?: number }>,
  botShip: string,
  ownerShip: string,
  currentMessageText?: string
): boolean {
  const newestFirst = [...history].sort(
    (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
  );
  const pickerAt = newestFirst.findIndex(
    (entry) =>
      entry.author === botShip && entry.content.startsWith(TOPICS_PICKER_PROMPT)
  );
  if (pickerAt < 0) {
    return false;
  }
  const current = currentMessageText?.trim();
  let skippedCurrent = false;
  for (const entry of newestFirst.slice(0, pickerAt)) {
    if (entry.author !== ownerShip) {
      continue;
    }
    const content = entry.content.trim();
    if (!skippedCurrent && current && content === current) {
      skippedCurrent = true;
      continue;
    }
    // A purpose-card title newer than the pills is a duplicate tap (the
    // live handler drops those, but they stay in the transcript), not a
    // topics answer.
    if (purposeIdForChoice(content)) {
      continue;
    }
    if (content) {
      return true;
    }
  }
  return false;
}

/**
 * The purpose whose card tap is still waiting for the topic pills: the
 * owner's newest substantive message is a purpose-card title, the opening
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
): string | undefined {
  const newestFirst = [...history].sort(
    (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
  );
  let tappedPurpose: string | undefined;
  let sawOpening = false;
  for (const entry of newestFirst) {
    const content = entry.content.trim();
    if (entry.author === botShip) {
      if (content.startsWith(TOPICS_PICKER_PROMPT)) {
        // Pills were posted — answered or not, the other recovery paths
        // own that shape.
        return undefined;
      }
      if (content.startsWith(PURPOSE_PICKER_PROMPT)) {
        sawOpening = true;
      }
      continue;
    }
    if (entry.author === ownerShip && content) {
      if (tappedPurpose === undefined) {
        const purposeId = purposeIdForChoice(content);
        if (!purposeId) {
          // The owner's newest message is ordinary text — the model owns
          // that conversation; re-offering pills over it would be noise.
          return undefined;
        }
        tappedPurpose = purposeId;
      }
      // Older owner messages don't change the answer; keep scanning for
      // the opening below.
    }
  }
  return sawOpening ? tappedPurpose : undefined;
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
        if (sawTopicsPicker) {
          return purposeId;
        }
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
 * The directive that actually gets the day-one entry written, sent by the
 * sweep once it has watched the owner's notebook into existence.
 *
 * The build turn is told not to write the entry and not to go looking for a
 * nest, because both went wrong live: the model wrote into a nest it picked
 * before the owner's channel existed, the poke was accepted, and the entry
 * vanished — reported as a success, with an empty notebook to show for it.
 * Discovery and timing therefore live here, where the plugin can *see* the
 * channel, and the model is handed one unambiguous instruction with the nest
 * already filled in.
 */
export function renderNotebookEntryDirective(
  notesNest: string,
  job: { title?: unknown; prompt?: unknown } | null,
  description?: string | null
): string {
  const title = typeof job?.title === 'string' ? job.title.trim() : '';
  const prompt = dayOneEntryDescription(description, job);
  return [
    '[Tlon notebook directive — not written by the owner]',
    `The owner's notebook now exists at \`${notesNest}\` and is empty.`,
    'Write the day-one entry into that exact nest — not a nest you look',
    'up, not one you create, not the chat channel.',
    title ? `Title it for: ${title}.` : '',
    prompt ? `What it should contain: ${prompt}` : '',
    NOTEBOOK_ENTRY_WRITE_RULE,
    `Then record "${notesNest}" as this job's "outputNest" in the group`,
    'config so later runs append to the same channel, writing the config',
    'through /tmp/tlon-group-config.json exactly as the setup directive',
    'specified.',
    GROUP_LOOK_RULE,
    'Do all of this silently: post nothing about it in chat, and do not',
    'repeat any announcement you already sent.',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * The finishing touches on their own, for a setup whose notebook never
 * arrived.
 *
 * Moving the rename and the icon to the end means a build that stalls
 * earlier now costs them, where before they were the first thing done. That
 * is the right trade while the notebook is coming — but a group whose owner
 * closed the app before their client made the channel would otherwise be
 * left permanently unnamed, which is worse than the ordering problem this
 * solves. So when the wait for the notebook is finally given up, the look
 * is asked for anyway.
 */
export function renderFinishingDirective(): string {
  return [
    '[Tlon setup directive — not written by the owner]',
    'Your notebook never appeared, so there is no entry to write and',
    'nothing more to wait for — do not create a channel, and do not keep',
    'looking for one.',
    GROUP_LOOK_RULE_NO_ENTRY,
    'Do this silently: post nothing about it in chat, and do not repeat',
    'any announcement you already sent.',
  ].join(' ');
}

/**
 * The first configured job in a group description, for the entry directive's
 * title and prompt. Null when the config carries no job yet — the build is
 * still running and there is nothing to write about.
 */
export function firstConfiguredJob(
  description: string | null | undefined
): { title?: unknown; prompt?: unknown; outputNest?: unknown } | null {
  for (const entry of agentConfigEntries(description)) {
    const jobs = Array.isArray(entry.jobs) ? entry.jobs : [];
    if (jobs.length > 0 && jobs[0] && typeof jobs[0] === 'object') {
      return jobs[0] as {
        title?: unknown;
        prompt?: unknown;
        outputNest?: unknown;
      };
    }
  }
  return null;
}

/**
 * Whether the config records the notebook this setup writes to.
 *
 * The entry landing is only half the job. Every later run resolves its
 * output through `outputNest`, and the payload rule says to post in chat
 * when nothing is recorded — so a setup that wrote the day-one entry and
 * then failed the config rewrite leaves a notebook holding exactly one
 * note while every scheduled run after it talks to the chat channel.
 */
export function jobRecordsOutputNest(
  job: { outputNest?: unknown } | null
): boolean {
  const out = job?.outputNest;
  return typeof out === 'string' && out.startsWith('notes/');
}

/**
 * Ask for the one thing left: the nest written down.
 *
 * Sent when the entry is in the notebook but the config still has an empty
 * `outputNest`. Deliberately not a re-send of the entry directive — that
 * would invite a second copy of a note that already landed.
 */
export function renderOutputNestRecordDirective(notesNest: string): string {
  return [
    '[Tlon notebook directive — not written by the owner]',
    `The day-one entry landed in \`${notesNest}\`. One thing is left:`,
    `record "${notesNest}" as this job's "outputNest" in the group config,`,
    'so every later run appends to that same notebook instead of falling',
    'back to chat. Write the config through /tmp/tlon-group-config.json',
    'exactly as the setup directive specified, changing only that field.',
    'Do NOT write another notebook entry — the note is already there.',
    'Do this silently: post nothing about it in chat.',
  ].join(' ');
}

/**
 * What the day-one notebook entry should say, for a group whose config
 * records which setup built it.
 *
 * The stored job `prompt` describes the *recurring* run and is wrong for
 * this: a Tracking prompt reviews what was logged "since the last
 * check-in" and stops in chat when nothing was, which on day one is
 * always — so it told the model to write nothing while the closing waited
 * for an entry. `templateId` is written into the config precisely so this
 * lookup can happen later. Falls back to the prompt when the id is missing
 * or unknown, which is all a freeform setup ever has.
 */
function dayOneEntryDescription(
  description: string | null | undefined,
  job: { title?: unknown; prompt?: unknown } | null
): string {
  for (const entry of agentConfigEntries(description)) {
    const templateId =
      typeof entry.templateId === 'string' ? entry.templateId : '';
    const purpose = templateId ? PURPOSE_JOBS[templateId] : undefined;
    if (purpose) {
      // The stored title is the filled template ("Tracking check-in:
      // Sleep, Coffee"), so the topics are whatever follows the colon —
      // the only place the config keeps them once setup is over.
      const title = typeof job?.title === 'string' ? job.title : '';
      const topics = title.slice(title.indexOf(':') + 1).trim();
      return topics
        ? purpose.entry.replaceAll('{{topics}}', topics)
        : purpose.entry.replaceAll('{{topics}}', 'your');
    }
  }
  return typeof job?.prompt === 'string' ? job.prompt.trim() : '';
}

/**
 * The config entries in a group description, or none if it holds prose or
 * malformed JSON — anything unparseable reads as "no config", matching
 * `parseGroupAgentConfig` in @tloncorp/api.
 */
function agentConfigEntries(
  description: string | null | undefined
): { purpose?: unknown; templateId?: unknown; jobs?: unknown }[] {
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
