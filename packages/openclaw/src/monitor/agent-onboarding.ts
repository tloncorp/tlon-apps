import {
  A2UI,
  type PostBlobDataEntryAgentIntroRequest,
  type PostBlobDataEntryAgentProvision,
  appendToPostBlob,
  notes,
  parsePostBlob,
} from '@tloncorp/api';
import type {
  PluginHookCronChangedEvent,
  PluginHookMessageSentEvent,
} from 'openclaw/plugin-sdk/types';

import { type TlonCronService, getTlonCronService } from '../cron-telemetry.js';
import { sharedMap } from '../shared-state.js';
import { makeA2UIBlob } from '../urbit/blob.js';
import { type BotProfile, sendChannelPost } from '../urbit/send.js';
import { markdownToStory } from '../urbit/story.js';
import { type TlonHistoryEntry, fetchChannelHistory } from './history.js';

type AgentRequest =
  | PostBlobDataEntryAgentIntroRequest
  | PostBlobDataEntryAgentProvision;

type AgentOnboardingContext = {
  api: { scry: (path: string) => Promise<unknown> };
  botShip: string;
  botProfile?: BotProfile;
  channelNest: string;
  groupId: string | undefined;
  ownerShip: string | null;
  senderShip: string;
  rawText?: string;
  blob: string | null | undefined;
  log?: (message: string) => void;
  presentation?: {
    startThinking: () => void | Promise<void>;
    stopThinking: () => void | Promise<void>;
    minResponseDelayMs?: number;
    minInterMessageDelayMs?: number;
  };
};

type AgentOnboardingDeps = {
  fetchHistory?: typeof fetchChannelHistory;
  getCron?: typeof getTlonCronService;
  getGroup?: (groupId: string) => Promise<OnboardingGroup>;
  now?: () => number;
  /** Injectable so pacing jitter is deterministic under test. */
  random?: () => number;
  sendPost?: typeof sendChannelPost;
  sleep?: (ms: number) => Promise<void>;
};

type AgentOnboardingCronDeps = {
  fetchHistory?: typeof fetchChannelHistory;
  listNotes?: typeof notes.listNotes;
  sendPost?: typeof sendChannelPost;
};

type OnboardingGroup = {
  hostUserId: string;
  channels?: Array<{ id: string; type: string; title?: string }>;
  members?: Array<{
    contactId: string;
    status: string;
    roles?: unknown[];
  }>;
};

type AgentOnboardingScanContext = Omit<
  AgentOnboardingContext,
  'senderShip' | 'blob'
>;

const postOnceFlights = new Map<string, Promise<void>>();
const DEFAULT_MIN_RESPONSE_DELAY_MS = 1_250;
const DEFAULT_MIN_INTER_MESSAGE_DELAY_MS = 1_000;
const COMPOSE_MS_PER_CHARACTER = 14;
const MIN_COMPOSE_DELAY_MS = 800;
const MAX_COMPOSE_DELAY_MS = 3_500;
const READ_BASE_MS = 500;
const READ_MS_PER_CHARACTER = 10;
const READ_DELAY_CAP_MS = 1_500;
const JITTER_RATIO = 0.2;
const LEGACY_GROUP_INTRO_PREFIX = "I'm your Tlonbot.";
const GROUP_INTRO_MESSAGE =
  "I'm your Tlonbot. I can research things, track changes, and write " +
  'updates for you.';
const PURPOSE_PICKER_PROMPT = 'What should this group do?';
// The services line moved out into its own beat after the first entry lands,
// so this is now only the "you can steer me" tip.
const HANDOFF_MESSAGE =
  'From here, just ask me in this chat to change what I cover, when I post, ' +
  'or what I’m called.';
const TOPICS_PICKER_FALLBACK_INSTRUCTION =
  'You can also just tell me here in the chat.';
const TIMEZONE_PICKER_QUESTION =
  'One last detail: which timezone should I use for the schedule?';
const PURPOSE_OPTIONS = [
  {
    id: 'agent-daily-digest',
    label: 'A daily digest',
    description:
      'A short summary of anything you care about, posted every morning.',
    icon: 'ChannelNotebooks',
    accent: 'blue',
    scheduleHour: 8,
    topicsPrompt:
      'Good. I’ll set this group up to post one concise morning digest about ' +
      'whatever you choose. What should it cover? Pick any that fit.',
    topics: [
      'Nootropics',
      'Longevity',
      'Psychedelics',
      'Open hardware',
      'Gene editing',
      'Space weather',
      'Fusion',
      'Homesteading',
    ],
  },
  {
    id: 'agent-learning',
    label: 'Learn something',
    description: 'A short daily idea that builds your understanding over time.',
    icon: 'Clock',
    accent: 'green',
    scheduleHour: 9,
    topicsPrompt:
      'Good. I’ll set this group up to share one useful idea at a time and ' +
      'build on it. What are you curious about? Pick any that fit.',
    topics: [
      'Music theory',
      'Genetics',
      'Astronomy',
      'Philosophy',
      'Architecture',
      'Economics',
      'Cryptography',
      'How computers work',
    ],
  },
  {
    id: 'agent-research',
    label: 'Research',
    description: 'A source-backed briefing that follows meaningful new work.',
    icon: 'Search',
    accent: 'indigo',
    scheduleHour: 9,
    topicsPrompt:
      'Good. I’ll set this group up to track a focused question with sources ' +
      'and note what changes. What should it investigate? Pick any that fit.',
    topics: [
      'Peptides',
      'Installation art',
      'Electronic music',
      'Mycology',
      'Longevity',
      'Synthesizers',
      'Fermentation',
      'Homelabs',
    ],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  description: string;
  icon: A2UI.ChoiceIcon;
  accent: A2UI.ChoiceAccent;
  scheduleHour: number;
  topicsPrompt: string;
  topics: readonly string[];
}[];

const firstRunCorrelations = sharedMap<
  string,
  {
    context: AgentOnboardingScanContext;
    notebookNest: string;
    notebookName: string;
    provisionId: string;
    purposeId: string;
    /**
     * Bound in the module context that provisioned the run.
     *
     * The completion hooks (`message_sent`, `cron_changed`) fire from the
     * extension entry, while provisioning runs in the lazy runtime module —
     * separate module-loader contexts, per `shared-state.ts`. The correlation
     * itself survives that split because it lives in a `sharedMap`, but
     * `@tloncorp/api`'s `client` is a module-level proxy, so the entry side
     * holds a second, unconfigured copy: calling `notes.listNotes` or
     * `sendChannelPost` from there threw "Client not initialized" and the
     * first-entry reveal was never posted. Capturing the functions here keeps
     * the completion on the configured client.
     */
    bound: {
      fetchHistory: typeof fetchChannelHistory;
      listNotes: typeof notes.listNotes;
      sendPost: typeof sendChannelPost;
    };
  }
>('agentOnboarding.firstRunCorrelations');
const SLOT_PREFIX = 'tlon-agent-primary:';

export function parseAgentOnboardingRequest(
  blob: string | null | undefined
): AgentRequest | null {
  if (!blob) return null;
  const entry = parsePostBlob(blob).find(
    (candidate) =>
      candidate.type === 'tlon-agent-intro-request' ||
      candidate.type === 'tlon-agent-provision'
  );
  return entry?.type === 'tlon-agent-intro-request' ||
    entry?.type === 'tlon-agent-provision'
    ? entry
    : null;
}

export async function handleAgentOnboardingRequest(
  context: AgentOnboardingContext,
  deps: AgentOnboardingDeps = {}
): Promise<boolean> {
  const presentation = createOnboardingPresentation(context, deps);
  try {
    return await handleAgentOnboardingRequestInternal(
      context,
      deps,
      presentation
    );
  } finally {
    await presentation.finish();
  }
}

async function handleAgentOnboardingRequestInternal(
  context: AgentOnboardingContext,
  deps: AgentOnboardingDeps,
  presentation: OnboardingPresentation
): Promise<boolean> {
  const request = parseAgentOnboardingRequest(context.blob);
  if (!request) {
    if (
      !context.rawText?.trim() ||
      !context.ownerShip ||
      context.senderShip !== context.ownerShip ||
      !context.groupId
    ) {
      return false;
    }
    const history = await (deps.fetchHistory ?? fetchChannelHistory)(
      context.api,
      context.channelNest,
      50
    );
    return advanceDurableConversation(context, history, deps, presentation);
  }
  if (
    !context.ownerShip ||
    context.senderShip !== context.ownerShip ||
    !context.groupId ||
    request.groupId !== context.groupId
  ) {
    context.log?.(
      '[tlon] rejected agent onboarding request: owner/group mismatch'
    );
    return true;
  }

  const history = await (deps.fetchHistory ?? fetchChannelHistory)(
    context.api,
    context.channelNest,
    50
  );
  if (request.type === 'tlon-agent-intro-request') {
    await postIntro(context, history, deps, presentation);
    return true;
  }
  await provision(context, history, request, deps, presentation);
  return true;
}

/**
 * Reconcile typed onboarding requests that may have landed before a newly
 * joined channel was being watched. Intro is replay-safe, and only the newest
 * provision is state-bearing so an old setup cannot overwrite a newer one.
 */
export async function scanAgentOnboardingChannel(
  context: AgentOnboardingScanContext,
  deps: AgentOnboardingDeps = {}
): Promise<boolean> {
  if (!context.ownerShip || !context.groupId) return false;
  const history = await (deps.fetchHistory ?? fetchChannelHistory)(
    context.api,
    context.channelNest,
    50
  );
  const ownerRequests = history
    .filter((entry) => entry.author === context.ownerShip && entry.blob)
    .map((entry) => ({
      entry,
      request: parseAgentOnboardingRequest(entry.blob),
    }))
    .filter(
      (
        candidate
      ): candidate is {
        entry: TlonHistoryEntry & { blob: string };
        request: AgentRequest;
      } =>
        Boolean(
          candidate.request && candidate.request.groupId === context.groupId
        )
    );
  if (ownerRequests.length === 0) return false;

  const newest = (type: AgentRequest['type']) =>
    ownerRequests
      .filter((candidate) => candidate.request.type === type)
      .sort((a, b) => b.entry.timestamp - a.entry.timestamp)[0];
  const requests = [
    newest('tlon-agent-intro-request'),
    newest('tlon-agent-provision'),
  ].filter((candidate): candidate is (typeof ownerRequests)[number] =>
    Boolean(candidate)
  );

  for (const candidate of requests) {
    await handleAgentOnboardingRequest(
      {
        ...context,
        senderShip: context.ownerShip,
        blob: candidate.entry.blob,
      },
      { ...deps, fetchHistory: async () => history }
    );
  }
  const pendingReply = pendingDurableReply(
    history,
    context.botShip,
    context.ownerShip
  );
  if (pendingReply) {
    await handleAgentOnboardingRequest(
      {
        ...context,
        senderShip: context.ownerShip,
        rawText: pendingReply.content,
        blob: pendingReply.blob,
      },
      { ...deps, fetchHistory: async () => history }
    );
  }
  context.log?.(
    `[tlon] reconciled ${requests.length} agent onboarding request(s)` +
      `${pendingReply ? ' and one picker reply' : ''} in ${context.channelNest}`
  );
  return requests.length > 0 || Boolean(pendingReply);
}

function pendingDurableReply(
  history: TlonHistoryEntry[],
  botShip: string,
  ownerShip: string
) {
  if (hasProvisionAck(history, botShip)) return null;
  if (hasPostMarker(history, botShip, 'timezone-picker')) return null;
  const active = hasPostMarker(history, botShip, 'topics-picker')
    ? markerPost(history, botShip, 'topics-picker')
    : markerPost(history, botShip, 'purpose-picker');
  if (!active) return null;
  return (
    history
      .filter(
        (entry) =>
          entry.author === ownerShip &&
          entry.timestamp > active.timestamp &&
          entry.content.trim()
      )
      .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null
  );
}

async function postIntro(
  context: AgentOnboardingContext,
  history: TlonHistoryEntry[],
  deps: AgentOnboardingDeps,
  presentation: OnboardingPresentation
) {
  await postOnce(
    context,
    history,
    'intro',
    async () => ({
      text: GROUP_INTRO_MESSAGE,
    }),
    deps,
    presentation
  );
  await postOnce(
    context,
    history,
    'purpose-picker',
    async () => ({
      text: purposePickerFallbackText(),
      blob: appendToPostBlob(
        undefined,
        buildPurposePickerSurface(context.groupId!)
      ),
    }),
    deps,
    presentation
  );
}

async function advanceDurableConversation(
  context: AgentOnboardingContext,
  history: TlonHistoryEntry[],
  deps: AgentOnboardingDeps,
  presentation: OnboardingPresentation
): Promise<boolean> {
  const text = context.rawText!.trim();
  if (!hasPostMarker(history, context.botShip, 'purpose-picker')) {
    return false;
  }

  // Setup is over the moment a provision is acknowledged, and chat after that
  // point belongs to the ordinary conversation. Without this the topics branch
  // below stayed armed forever on the picker-submit path, which never posts a
  // timezone picker: an owner who read "You're all set" and typed back
  // "That's it?" had that question parsed as their topic list, re-asked for a
  // timezone, and got a researched notebook entry about the phrase itself.
  if (hasProvisionAck(history, context.botShip)) {
    return false;
  }

  if (!hasPostMarker(history, context.botShip, 'topics-picker')) {
    const purpose = purposeForReply(text);
    await postOnce(
      context,
      history,
      'topics-picker',
      async () => {
        const surface = buildTopicsPickerSurface(
          context.groupId!,
          purpose,
          purpose.topics
        );
        return {
          text: topicsPickerFallbackText(purpose, purpose.topics),
          ...(surface ? { blob: appendToPostBlob(undefined, surface) } : {}),
        };
      },
      deps,
      presentation
    );
    return true;
  }

  if (hasPostMarker(history, context.botShip, 'timezone-picker')) {
    return false;
  }

  const purpose = findPurposeReply(history, context);
  if (!purpose) return false;
  const topics = text
    .split(',')
    .map((topic) => topic.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (!topics.length) return false;

  await postOnce(
    context,
    history,
    'timezone-picker',
    async () => ({
      text:
        `${timezonePickerPrompt(topics)} Reply with an IANA timezone such as ` +
        '`America/New_York`.',
      blob: appendToPostBlob(
        undefined,
        buildTimezonePickerSurface(context.groupId!, {
          purposeId: purpose.id,
          purpose: purpose.label,
          topics,
          scheduleHour: purpose.scheduleHour,
          scheduleMinute: 0,
        })
      ),
    }),
    deps,
    presentation
  );
  return true;
}

type Purpose = {
  id: string;
  label: string;
  scheduleHour: number;
  topicsPrompt: string;
  topics: readonly string[];
};

function purposeForReply(text: string): Purpose {
  const selected = PURPOSE_OPTIONS.find(
    (option) => option.label.toLowerCase() === text.trim().toLowerCase()
  );
  return (
    selected ?? {
      id: 'agent-custom',
      label: text.slice(0, 200),
      scheduleHour: 9,
      topicsPrompt:
        'Good. I’ll set this group up for that. What should it focus on?',
      topics: [],
    }
  );
}

function findPurposeReply(
  history: TlonHistoryEntry[],
  context: AgentOnboardingContext
): Purpose | null {
  const purposePrompt = markerPost(history, context.botShip, 'purpose-picker');
  const topicsPrompt = markerPost(history, context.botShip, 'topics-picker');
  if (!purposePrompt || !topicsPrompt || !context.ownerShip) return null;
  const reply = history
    .filter(
      (entry) =>
        entry.author === context.ownerShip &&
        entry.timestamp >= purposePrompt.timestamp &&
        entry.timestamp <= topicsPrompt.timestamp &&
        entry.content.trim()
    )
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  return reply ? purposeForReply(reply.content) : null;
}

function markerPost(history: TlonHistoryEntry[], botShip: string, key: string) {
  return history.find(
    (post) =>
      post.author === botShip &&
      post.blob &&
      parsePostBlob(post.blob).some(
        (entry) => entry.type === 'tlon-agent-post-marker' && entry.key === key
      )
  );
}

async function provision(
  context: AgentOnboardingContext,
  history: TlonHistoryEntry[],
  request: PostBlobDataEntryAgentProvision,
  deps: AgentOnboardingDeps,
  presentation: OnboardingPresentation
) {
  // Provisioning can do real work before its acknowledgement is ready. Start
  // presence immediately so group verification and cron setup both count
  // toward the response floor instead of adding an artificial delay later.
  await presentation.start();
  const group = await (
    deps.getGroup ?? ((groupId) => fetchOnboardingGroup(context.api, groupId))
  )(request.groupId);
  if (
    group.hostUserId !== context.senderShip ||
    !group.channels?.some(
      (channel) =>
        channel.id === request.notebookNest && channel.type === 'notes'
    )
  ) {
    context.log?.('[tlon] rejected agent provision: invalid owner or notebook');
    return;
  }
  const botMember = group.members?.find(
    (member) =>
      member.contactId === context.botShip && member.status !== 'invited'
  );
  const isAdmin = botMember?.roles?.some((role: unknown) => {
    if (role === 'admin') return true;
    if (!role || typeof role !== 'object') return false;
    const value = role as { id?: unknown; roleId?: unknown };
    return value.id === 'admin' || value.roleId === 'admin';
  });
  if (!isAdmin) {
    context.log?.('[tlon] rejected agent provision: agent is not an admin');
    return;
  }

  const ackKey = `ack:${request.provisionId}`;
  const existingAck = hasPostMarker(history, context.botShip, ackKey);
  let jobId: string | null = existingAck
    ? findAckJobId(history, context.botShip, request.provisionId)
    : null;
  const cron = (deps.getCron ?? getTlonCronService)();
  const notebookName = notebookDisplayName(
    request.notebookNest,
    group.channels?.find((channel) => channel.id === request.notebookNest)
      ?.title
  );
  if (!existingAck) {
    if (!cron) throw new Error('cron service is not available');
    jobId = await upsertPrimaryJob(cron, request, context.channelNest);
    // Two beats, one idea each. These used to arrive as a single block that
    // acknowledged the topics, named the schedule, said "you're all set",
    // listed two tips and pitched connected services — five asks stacked
    // before any value had landed.
    const acknowledgement =
      `${formatTopicList(request.topics)}—got it. ` +
      `${provisionCadence(request.purposeId, notebookName)} ` +
      `${scheduleConfirmation(request)}`;
    await postOnce(
      context,
      history,
      ackKey,
      async () => ({
        text: acknowledgement,
        entries: [
          {
            type: 'tlon-agent-provision-ack',
            version: 1,
            provisionId: request.provisionId,
            cronJobId: jobId!,
          },
        ],
      }),
      deps,
      presentation
    );
    // Deliberately does not tell them to leave: the first entry is the
    // activation moment and it lands within a minute or two, so pushing them
    // out of the channel here is pushing them away from the payoff.
    await postOnce(
      context,
      history,
      'first-entry-pending',
      async () => ({
        text: `Writing your first entry now — give me a minute.`,
      }),
      deps,
      presentation
    );
  }

  if (!existingAck) {
    if (!cron?.enqueueRun) {
      throw new Error(
        'OpenClaw does not expose enqueueRun through the plugin cron service'
      );
    }
    const disposition = await cron.enqueueRun(jobId!, 'force');
    rememberFirstRun(disposition, context, request, notebookName);
  }
}

/** Best-effort bookend for the one forced run created by provisioning. */
export async function handleAgentOnboardingCronChanged(
  event: PluginHookCronChangedEvent,
  deps: AgentOnboardingCronDeps = {}
): Promise<void> {
  if (event.action !== 'finished' || !event.runId) return;
  if (event.status !== 'ok' || event.delivered !== true) {
    firstRunCorrelations.delete(event.runId);
    return;
  }
  await completeFirstRun(event.runId, undefined, deps);
}

/**
 * Delivery is a fallback completion signal for hosts that replace the global
 * cron hook registry while an isolated run is active. It is still correlated
 * to the one forced onboarding run, first by run id and then by its exact
 * notebook destination.
 */
export async function handleAgentOnboardingMessageSent(
  event: PluginHookMessageSentEvent,
  deps: AgentOnboardingCronDeps = {}
): Promise<void> {
  if (event.success !== true) return;
  await completeFirstRun(event.runId, event.to, deps);
}

async function completeFirstRun(
  runId: string | undefined,
  notebookNest: string | undefined,
  deps: AgentOnboardingCronDeps
) {
  const match = findFirstRunCorrelation(runId, notebookNest);
  if (!match) return;
  const [correlationRunId, correlation] = match;
  // Claim the correlation before awaiting so cron_changed and message_sent
  // cannot race each other into duplicate chat posts.
  firstRunCorrelations.delete(correlationRunId);

  // Explicit deps win (tests), then the implementations bound in the context
  // that provisioned this run, and only then this module's own — which, on the
  // extension-entry side, are backed by an unconfigured client.
  const bound = correlation.bound;
  const runDeps: AgentOnboardingCronDeps = {
    fetchHistory:
      deps.fetchHistory ?? bound?.fetchHistory ?? fetchChannelHistory,
    listNotes: deps.listNotes ?? bound?.listNotes ?? notes.listNotes,
    sendPost: deps.sendPost ?? bound?.sendPost ?? sendChannelPost,
  };

  try {
    const history = await runDeps.fetchHistory!(
      correlation.context.api,
      correlation.context.channelNest,
      50
    );
    const notebookName = correlation.notebookName;
    // Keyed on the channel, not the provision. Re-provisioning mints a new
    // provisionId, and the old per-provision key let the same reveal post
    // three times in one setup.
    await postOnce(
      correlation.context,
      history,
      'first-entry-ping',
      async () => {
        const listed = await runDeps.listNotes!(correlation.notebookNest).catch(
          () => []
        );
        const newest = [...listed].sort(
          (a, b) => (b.createdAt ?? b.noteId) - (a.createdAt ?? a.noteId)
        )[0];
        // The cite renders as "Content not available" whenever the client
        // hasn't synced the notes channel yet, so the sentence has to carry
        // the entry on its own: name the note and where it lives, and let the
        // card be a bonus rather than the whole message.
        const title = newest?.title?.trim();
        const message = title
          ? `Your first entry is ready — “${title}”, in ${notebookName}. ` +
            'That notebook is where everything I write for you lands; this ' +
            'chat is for talking to me.'
          : `Your first entry is ready, in ${notebookName}. That notebook is ` +
            'where everything I write for you lands; this chat is for ' +
            'talking to me.';
        const story = markdownToStory(message);
        if (newest) {
          story.push({
            block: {
              cite: {
                chan: {
                  nest: correlation.notebookNest,
                  where: `/note/${newest.noteId}`,
                },
              },
            },
          } as never);
        }
        return {
          text: message,
          story,
        };
      },
      runDeps
    );
    // Expansion asks wait until after the payoff. An owner who never reaches
    // a first entry should never be pitched connected services.
    await postOnce(
      correlation.context,
      history,
      'handoff',
      async () => ({ text: HANDOFF_MESSAGE }),
      runDeps
    );
    await postOnce(
      correlation.context,
      history,
      'services-card',
      async () => ({
        text: servicesPitch(correlation.purposeId),
        blob: appendToPostBlob(
          undefined,
          buildServicesSurface(servicesPitch(correlation.purposeId))
        ),
      }),
      runDeps
    );
  } catch (error) {
    firstRunCorrelations.set(correlationRunId, correlation);
    throw error;
  }
}

function findFirstRunCorrelation(
  runId: string | undefined,
  notebookNest: string | undefined
) {
  if (runId) {
    const exact = firstRunCorrelations.get(runId);
    if (exact) return [runId, exact] as const;
  }
  if (!notebookNest) return null;
  for (const entry of firstRunCorrelations) {
    if (entry[1].notebookNest === notebookNest) return entry;
  }
  return null;
}

function rememberFirstRun(
  disposition: unknown,
  context: AgentOnboardingScanContext,
  request: PostBlobDataEntryAgentProvision,
  notebookName?: string
) {
  if (!disposition || typeof disposition !== 'object') return;
  const result = disposition as { enqueued?: unknown; runId?: unknown };
  if (result.enqueued !== true || typeof result.runId !== 'string') return;
  for (const [pendingRunId, pending] of firstRunCorrelations) {
    if (pending.notebookNest === request.notebookNest) {
      firstRunCorrelations.delete(pendingRunId);
    }
  }
  firstRunCorrelations.set(result.runId, {
    context,
    notebookNest: request.notebookNest,
    notebookName: notebookName ?? notebookDisplayName(request.notebookNest),
    provisionId: request.provisionId,
    purposeId: request.purposeId,
    bound: {
      fetchHistory: fetchChannelHistory,
      listNotes: notes.listNotes,
      sendPost: sendChannelPost,
    },
  });
}

async function fetchOnboardingGroup(
  api: AgentOnboardingContext['api'],
  groupId: string
): Promise<OnboardingGroup> {
  const init = (await api.scry('/groups-ui/v7/init.json')) as {
    groups?: Record<
      string,
      {
        channels?: Record<string, { meta?: { title?: unknown } }>;
        seats?: Record<string, { roles?: unknown[] }>;
      }
    >;
  };
  const group = init.groups?.[groupId];
  if (!group) throw new Error(`onboarding group not found: ${groupId}`);
  return {
    hostUserId: groupId.split('/')[0] ?? '',
    channels: Object.entries(group.channels ?? {}).map(([id, channel]) => ({
      id,
      type: id.split('/')[0] ?? '',
      title:
        typeof channel?.meta?.title === 'string'
          ? channel.meta.title
          : undefined,
    })),
    members: Object.entries(group.seats ?? {}).map(([contactId, seat]) => ({
      contactId,
      status: 'joined',
      roles: seat.roles,
    })),
  };
}

type PostOnceContent = {
  text: string;
  story?: Parameters<typeof sendChannelPost>[0]['story'];
  blob?: string;
  entries?: Parameters<typeof appendToPostBlob>[1][];
};

type OnboardingPresentation = {
  start: () => Promise<void>;
  beforePost: (text?: string) => Promise<void>;
  afterPost: () => void;
  finish: () => Promise<void>;
};

/**
 * How long the bot appears to spend composing a message.
 *
 * A single flat floor for every post reads as a machine on a timer: the same
 * beat before a two-word acknowledgement and before three paragraphs. Scaling
 * with the length of what is about to be said, and jittering it, is what makes
 * the rhythm feel like someone typing.
 */
function composeDelayMs(text: string | undefined, floorMs: number) {
  const characters = text?.length ?? 0;
  return clampDelay(floorMs + characters * COMPOSE_MS_PER_CHARACTER);
}

/**
 * Time to "read" what the owner just sent, added before the first reply of a
 * turn. Replying to a typed sentence as fast as to a button tap is one of the
 * tells that nothing is listening.
 */
function readDelayMs(text: string | undefined) {
  const characters = text?.trim().length ?? 0;
  if (!characters) return 0;
  return Math.min(
    READ_DELAY_CAP_MS,
    READ_BASE_MS + characters * READ_MS_PER_CHARACTER
  );
}

function clampDelay(ms: number) {
  return Math.min(MAX_COMPOSE_DELAY_MS, Math.max(MIN_COMPOSE_DELAY_MS, ms));
}

/** ±20%, so no two consecutive pauses are identical. */
function jitter(ms: number, random: () => number) {
  return Math.round(ms * (1 + (random() * 2 - 1) * JITTER_RATIO));
}

function createOnboardingPresentation(
  context: AgentOnboardingContext,
  deps: AgentOnboardingDeps
): OnboardingPresentation {
  const config = context.presentation;
  if (!config) {
    return {
      start: async () => {},
      beforePost: async () => {},
      afterPost: () => {},
      finish: async () => {},
    };
  }

  const now = deps.now ?? Date.now;
  const sleep =
    deps.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const minResponseDelayMs = Math.max(
    0,
    config.minResponseDelayMs ?? DEFAULT_MIN_RESPONSE_DELAY_MS
  );
  const minInterMessageDelayMs = Math.max(
    0,
    config.minInterMessageDelayMs ?? DEFAULT_MIN_INTER_MESSAGE_DELAY_MS
  );
  const random = deps.random ?? Math.random;
  let startedAt: number | null = null;
  let lastPostAt: number | null = null;
  let active = false;

  const start = async () => {
    if (active) return;
    active = true;
    startedAt = now();
    try {
      await config.startThinking();
    } catch (error) {
      context.log?.(
        `[tlon] failed to start onboarding thinking presence: ${String(error)}`
      );
    }
  };

  return {
    start,
    beforePost: async (text?: string) => {
      // start() first, always: the indicator has to be up for the whole pause,
      // or the wait reads as the app hanging rather than the bot thinking.
      await start();
      const composeMs = composeDelayMs(
        text,
        lastPostAt === null ? minResponseDelayMs : minInterMessageDelayMs
      );
      const withRead =
        lastPostAt === null
          ? composeMs + readDelayMs(context.rawText)
          : composeMs;
      const earliestPostAt =
        (lastPostAt === null ? startedAt ?? now() : lastPostAt) +
        jitter(withRead, random);
      const remainingMs = earliestPostAt - now();
      if (remainingMs > 0) {
        await sleep(remainingMs);
      }
    },
    afterPost: () => {
      lastPostAt = now();
    },
    finish: async () => {
      if (!active) return;
      active = false;
      try {
        await config.stopThinking();
      } catch (error) {
        context.log?.(
          `[tlon] failed to stop onboarding thinking presence: ${String(error)}`
        );
      }
    },
  };
}

async function postOnce(
  context: AgentOnboardingScanContext,
  history: TlonHistoryEntry[],
  key: string,
  build: () => Promise<PostOnceContent>,
  deps: AgentOnboardingDeps,
  presentation?: OnboardingPresentation
) {
  if (hasPostMarker(history, context.botShip, key)) return;
  const flightKey = `${context.channelNest}:${key}`;
  const existing = postOnceFlights.get(flightKey);
  if (existing) return existing;
  const flight = (async () => {
    const content = await build();
    let blob = content.blob;
    for (const entry of content.entries ?? []) {
      blob = appendToPostBlob(blob, entry);
    }
    blob = appendToPostBlob(blob, {
      type: 'tlon-agent-post-marker',
      version: 1,
      key,
    });
    await presentation?.beforePost(content.text);
    try {
      await (deps.sendPost ?? sendChannelPost)({
        fromShip: context.botShip,
        nest: context.channelNest,
        story: content.story ?? markdownToStory(content.text),
        blob,
        botProfile: context.botProfile,
      });
    } catch (error) {
      const reread = await (deps.fetchHistory ?? fetchChannelHistory)(
        context.api,
        context.channelNest,
        50
      );
      if (!hasPostMarker(reread, context.botShip, key)) throw error;
    }
    presentation?.afterPost();
  })().finally(() => postOnceFlights.delete(flightKey));
  postOnceFlights.set(flightKey, flight);
  return flight;
}

function hasPostMarker(
  history: TlonHistoryEntry[],
  botShip: string,
  key: string
) {
  return history.some((post) => {
    if (post.author !== botShip) return false;
    // The original onboarding plugin deduped its intro by visible copy and did
    // not attach a post marker. Preserve that one-way migration path so a
    // gateway restart does not greet existing hosted groups a second time.
    if (
      key === 'intro' &&
      post.content.trimStart().startsWith(LEGACY_GROUP_INTRO_PREFIX)
    ) {
      return true;
    }
    return Boolean(
      post.blob &&
        parsePostBlob(post.blob).some(
          (entry) =>
            entry.type === 'tlon-agent-post-marker' && entry.key === key
        )
    );
  });
}

/** True once any provision has been acknowledged in this channel. */
function hasProvisionAck(history: TlonHistoryEntry[], botShip: string) {
  return history.some(
    (post) =>
      post.author === botShip &&
      post.blob &&
      parsePostBlob(post.blob).some(
        (entry) => entry.type === 'tlon-agent-provision-ack'
      )
  );
}

function findAckJobId(
  history: TlonHistoryEntry[],
  botShip: string,
  provisionId: string
) {
  for (const post of history) {
    if (post.author !== botShip || !post.blob) continue;
    const ack = parsePostBlob(post.blob).find(
      (entry) =>
        entry.type === 'tlon-agent-provision-ack' &&
        entry.provisionId === provisionId
    );
    if (ack?.type === 'tlon-agent-provision-ack') return ack.cronJobId;
  }
  return null;
}

async function upsertPrimaryJob(
  cron: TlonCronService,
  request: PostBlobDataEntryAgentProvision,
  failureChatNest: string
) {
  const description = `${SLOT_PREFIX}${request.groupId}`;
  const desired = {
    name: `${request.purpose}: ${request.topics.join(', ')}`,
    description,
    enabled: true,
    schedule: {
      kind: 'cron',
      expr: `${request.scheduleMinute} ${request.scheduleHour} * * *`,
      tz: request.timezone,
    },
    sessionTarget: 'isolated',
    wakeMode: 'now',
    // The host's current agentTurn schema calls this field `message`; the
    // plugin hook projection still exposes the older `text` shape.
    payload: { kind: 'agentTurn', message: buildRecurringPrompt(request) },
    delivery: {
      mode: 'announce',
      channel: 'tlon',
      to: request.notebookNest,
      failureDestination: {
        mode: 'announce',
        channel: 'tlon',
        to: failureChatNest,
      },
    },
  };
  let jobs = await cron.list({ includeDisabled: true });
  let job = jobs.find((candidate) => candidate.description === description);
  if (!job) {
    await cron.add(desired as never);
  } else if (!jobMatches(job, desired)) {
    await cron.update(job.id, desired as never);
  }
  jobs = await cron.list({ includeDisabled: true });
  job = jobs.find((candidate) => candidate.description === description);
  if (!job || !jobMatches(job, desired)) {
    throw new Error('primary onboarding cron slot failed verification');
  }
  return job.id;
}

function jobMatches(
  job: Awaited<ReturnType<TlonCronService['list']>>[number],
  desired: {
    name: string;
    description: string;
    enabled: boolean;
    schedule: { kind: string; expr: string; tz: string };
    sessionTarget: string;
    wakeMode: string;
    payload: { kind: string; message: string };
    delivery: {
      mode: string;
      channel: string;
      to: string;
      failureDestination: { mode: string; channel: string; to: string };
    };
  }
) {
  const runtimeJob = job as typeof job & {
    payload?: { kind?: string; message?: string; text?: string };
    delivery?: {
      mode?: string;
      channel?: string;
      to?: string;
      failureDestination?: { mode?: string; channel?: string; to?: string };
    };
  };
  return (
    job.name === desired.name &&
    job.description === desired.description &&
    job.enabled !== false &&
    job.schedule?.kind === 'cron' &&
    job.schedule.expr === desired.schedule.expr &&
    job.schedule.tz === desired.schedule.tz &&
    job.sessionTarget === desired.sessionTarget &&
    job.wakeMode === desired.wakeMode &&
    runtimeJob.payload?.kind === desired.payload.kind &&
    runtimeJob.payload.message === desired.payload.message &&
    runtimeJob.delivery?.mode === desired.delivery.mode &&
    runtimeJob.delivery?.channel === desired.delivery.channel &&
    runtimeJob.delivery?.to === desired.delivery.to &&
    runtimeJob.delivery?.failureDestination?.mode ===
      desired.delivery.failureDestination.mode &&
    runtimeJob.delivery?.failureDestination?.channel ===
      desired.delivery.failureDestination.channel &&
    runtimeJob.delivery?.failureDestination?.to ===
      desired.delivery.failureDestination.to
  );
}

function buildRecurringPrompt(request: PostBlobDataEntryAgentProvision) {
  if (request.purposeId === 'agent-learning') {
    return `Build the next entry in a progressive learning series. The topics, in rotation order, are: ${request.topics.join(', ')}. First inspect the existing entries with \`tlon notes notes ${request.notebookNest}\`. Cover exactly one topic per entry; never combine or force connections between topics. If the notebook is empty, use the first topic. Otherwise, identify the topic covered most recently and use the next topic in the list, wrapping back to the beginning. Put that topic in the note title so the rotation remains clear on later runs. Explain the next useful idea for that topic, building on its earlier entries without repeating them. Keep it concise, use concrete examples, search the web for reliable information, and cite useful sources. Produce one self-contained Markdown note with a concise title as its first heading. Return only the finished note; do not post it or call a messaging tool. The coordinator will publish your final response exactly once.`;
  }

  const firstRun =
    request.purposeId === 'agent-research'
      ? 'If the notebook is empty, write an introductory survey of the field. Otherwise, focus on meaningful work published since its newest entry.'
      : 'If the notebook is empty, make this a self-contained first entry. Otherwise, write the next current update without repeating the newest entry.';
  const purposeGuidance =
    request.purposeId === 'agent-research'
      ? 'Prioritize primary sources and direct links. Distinguish publication dates from event dates, label uncertainty or conflicting evidence, and stay tightly within the requested scope. If nothing meaningful changed, say that plainly instead of padding the entry.'
      : 'Lead with the items most likely to matter today. Distinguish new information from background, order items by urgency, and keep the result concise and scannable.';
  return `Write ${request.purpose.toLowerCase()} about ${request.topics.join(', ')}. First inspect the existing entries with \`tlon notes notes ${request.notebookNest}\`. ${firstRun} ${purposeGuidance} Search the web for current information and cite useful sources. Produce one self-contained Markdown note with a concise title as its first heading. Return only the finished note; do not post it or call a messaging tool. The coordinator will publish your final response exactly once.`;
}

function choiceAction(text: string): A2UI.SendMessageAction {
  return {
    event: { name: A2UI.action.sendMessage, context: { text } },
  };
}

function withFallbackStory(blob: A2UI.BlobEntry): A2UI.BlobEntry {
  return { ...blob, storyMode: 'fallback' };
}

function purposePickerFallbackText() {
  const labels = PURPOSE_OPTIONS.map((option) => `“${option.label}”`).join(
    ', '
  );
  return `${PURPOSE_PICKER_PROMPT} Reply ${labels} — or just tell me.`;
}

function buildPurposePickerSurface(groupId: string): A2UI.BlobEntry {
  return withFallbackStory(
    makeA2UIBlob(`agent-onboarding-purpose:${groupId}`, 'root', [
      {
        id: 'root',
        component: 'Column',
        children: ['prompt', 'choices'],
      },
      { id: 'prompt', component: 'Text', text: PURPOSE_PICKER_PROMPT },
      {
        id: 'choices',
        component: 'Choice',
        options: PURPOSE_OPTIONS.map((option) => ({
          id: option.id,
          label: option.label,
          description: option.description,
          icon: option.icon,
          accent: option.accent,
          action: choiceAction(option.label),
        })),
      },
    ])
  );
}

function topicsPickerFallbackText(
  purpose: Pick<Purpose, 'topicsPrompt'>,
  topics: readonly string[]
) {
  if (!topics.length) {
    return `${purpose.topicsPrompt} ${TOPICS_PICKER_FALLBACK_INSTRUCTION}`;
  }
  return `${purpose.topicsPrompt} ${topics.join(', ')} — ${TOPICS_PICKER_FALLBACK_INSTRUCTION}`;
}

function formatTopicList(topics: readonly string[]): string {
  if (topics.length <= 1) return topics[0] ?? '';
  if (topics.length === 2) return `${topics[0]} and ${topics[1]}`;
  return `${topics.slice(0, -1).join(', ')}, and ${topics[topics.length - 1]}`;
}

/**
 * The name the sidebar shows for the notebook, so chat copy and the channel
 * list agree.
 *
 * Prefer the channel's real title. Deriving it from the nest slug is only a
 * fallback and is not always right: the ship dedupes slugs, so a second
 * notebook lands at `…/updates-1` while its title stays "Updates" — copy built
 * from the slug then points at a channel name that appears nowhere on screen.
 */
function notebookDisplayName(
  notebookNest: string,
  title?: string | null
): string {
  const named = title?.trim();
  if (named) return named;
  const slug = notebookNest.split('/').pop() ?? '';
  const words = slug.split('-').filter(Boolean);
  if (!words.length) return 'the notebook';
  const [first, ...rest] = words;
  return [first![0]!.toUpperCase() + first!.slice(1), ...rest].join(' ');
}

/**
 * What the schedule does and — the part the old copy left out — where the
 * result lands. "Publish" on its own, or worse "publish here", read as chat:
 * an owner watched a notebook appear in the sidebar without ever being told
 * it existed or what it was for.
 */
function provisionCadence(purposeId: string, notebookName: string) {
  switch (purposeId) {
    case 'agent-learning':
      return (
        `Every morning I’ll write a new entry in ${notebookName}, this ` +
        'group’s notebook — one useful idea at a time, rotating through your list.'
      );
    case 'agent-research':
      return (
        `Every morning I’ll check for new work and write a source-backed ` +
        `update in ${notebookName}, this group’s notebook.`
      );
    default:
      return (
        `Every morning I’ll write a fresh digest in ${notebookName}, this ` +
        'group’s notebook.'
      );
  }
}

/**
 * Say the schedule back in words.
 *
 * The timezone arrives from a tap on "Use my current timezone", which fires a
 * client-side event and writes nothing to the channel. With no trace in chat
 * an owner had no way to know the tap registered — they typed "I clicked the
 * current time zone button" to ask, and the conversational model, which also
 * cannot see A2UI state, replied that it couldn't see the selection either.
 * Naming the resolved time and zone here is the receipt for that tap.
 */
function scheduleConfirmation(request: PostBlobDataEntryAgentProvision) {
  const hour = request.scheduleHour % 12 === 0 ? 12 : request.scheduleHour % 12;
  const meridiem = request.scheduleHour < 12 ? 'AM' : 'PM';
  const minute = String(request.scheduleMinute).padStart(2, '0');
  return `First one lands at ${hour}:${minute} ${meridiem} in ${request.timezone}.`;
}

/**
 * The services pitch, in terms of what the owner just built. The old copy
 * ("Connect calendars, docs, or notes to give me more to work with") named
 * the mechanism and no benefit, and read identically whichever purpose was
 * chosen.
 */
function servicesPitch(purposeId: string) {
  switch (purposeId) {
    case 'agent-learning':
      return (
        'Connect your calendar or your notes and I can time lessons around ' +
        'your day and build on what you’re already reading.'
      );
    case 'agent-research':
      return (
        'Connect your docs or notes and I can tell what’s genuinely new to ' +
        'you, instead of repeating what you’ve already filed.'
      );
    default:
      return (
        'Connect your calendar and docs and your morning digest can cover ' +
        'your own day — meetings, deadlines, notes — not just the news.'
      );
  }
}

function timezonePickerPrompt(topics: readonly string[]): string {
  return `${formatTopicList(topics)}—got it. ${TIMEZONE_PICKER_QUESTION}`;
}

function buildTopicsPickerSurface(
  groupId: string,
  purpose: Pick<Purpose, 'id' | 'label' | 'scheduleHour' | 'topicsPrompt'>,
  topics: readonly string[]
): A2UI.BlobEntry | null {
  if (!topics.length) return null;
  return withFallbackStory(
    makeA2UIBlob(`agent-onboarding-topics:${groupId}`, 'root', [
      {
        id: 'root',
        component: 'Column',
        children: ['prompt', 'topics'],
      },
      { id: 'prompt', component: 'Text', text: purpose.topicsPrompt },
      {
        id: 'topics',
        component: 'SmallChoice',
        options: topics.map((label) => ({ id: label.toLowerCase(), label })),
        submitLabel: 'That’s it',
        freeTextPlaceholder: 'Add your own…',
        action: {
          event: {
            name: A2UI.action.provisionAgent,
            context: {
              groupId,
              purposeId: purpose.id,
              purpose: purpose.label,
              // The client replaces these representative topics with the
              // user's actual selection before posting the provision event.
              topics: [...topics],
              scheduleHour: purpose.scheduleHour,
              scheduleMinute: 0,
            },
          },
        },
      },
    ])
  );
}

function buildTimezonePickerSurface(
  groupId: string,
  plan: Omit<A2UI.AgentOnboardingPlan, 'timezone'>
): A2UI.BlobEntry {
  return withFallbackStory(
    makeA2UIBlob(`agent-onboarding-timezone:${groupId}`, 'root', [
      {
        id: 'root',
        component: 'Column',
        children: ['prompt', 'use-timezone'],
      },
      {
        id: 'prompt',
        component: 'Text',
        text: timezonePickerPrompt(plan.topics),
      },
      {
        id: 'use-timezone',
        component: 'Button',
        variant: 'primary',
        child: 'use-timezone-label',
        action: {
          event: {
            name: A2UI.action.provisionAgent,
            context: { groupId, ...plan },
          },
        },
      },
      {
        id: 'use-timezone-label',
        component: 'Text',
        text: 'Use my current timezone',
      },
    ])
  );
}

/*
 * Kept as a small compatibility surface for fixture and migration tests. New
 * onboarding posts each step separately so prior choices remain in history.
 */
function buildOnboardingSurface(groupId: string): A2UI.BlobEntry {
  return makeA2UIBlob(`agent-onboarding:${groupId}`, 'root', [
    {
      id: 'root',
      component: 'AgentOnboarding',
      purposes: PURPOSE_OPTIONS.map((purpose) => ({
        ...purpose,
        topics: purpose.topics.map((label) => ({
          id: label.toLowerCase(),
          label,
        })),
      })),
      customTopicPlaceholder: 'Add your own…',
      topicsSubmitLabel: 'That’s it',
      confirmLabel: 'Set it up',
    },
  ]);
}

function buildInviteSurface(groupId: string) {
  return makeA2UIBlob(`agent-invite:${groupId}`, 'root', [
    { id: 'root', component: 'Column', children: ['invite'] },
    {
      id: 'invite',
      component: 'Button',
      child: 'invite-label',
      action: {
        event: { name: A2UI.action.inviteLink, context: { groupId } },
      },
    },
    { id: 'invite-label', component: 'Text', text: 'Invite' },
  ]);
}

/**
 * The services card.
 *
 * A `Choice` rather than a `Button`: the same tappable card treatment the
 * purpose picker uses, which carries an icon, a title and a description
 * instead of a bare text label. The old bare button also had no `variant`, so
 * it rendered with the default `fill: 'outline', intent: 'secondary'` — a grey
 * outline on a near-black card, effectively invisible in a recorded run.
 */
function buildServicesSurface(pitch: string) {
  const build = (icon?: 'Link') =>
    withFallbackStory(
      makeA2UIBlob('agent-services', 'root', [
        { id: 'root', component: 'Column', children: ['pitch', 'cta'] },
        { id: 'pitch', component: 'Text', text: pitch },
        {
          id: 'cta',
          component: 'Choice',
          options: [
            {
              id: 'connect-services',
              label: 'Connect External Services',
              description: 'Bring your tools into Tlonbot’s context',
              // Spelled literally for the same reason the purpose options are:
              // this plugin can build against a published @tloncorp/api that
              // predates the icon.
              ...(icon ? { icon: icon as A2UI.ChoiceIcon } : {}),
              accent: 'blue',
              action: {
                event: {
                  name: A2UI.action.navigate,
                  context: {
                    target: { type: 'screen', screen: 'botMcpSettings' },
                  },
                },
              },
            },
          ],
        },
      ])
    );

  // `makeA2UIBlob` validates against the *running* @tloncorp/api, whose
  // CHOICE_ICONS allowlist is fixed at publish time. Rather than hold the card
  // hostage to an api release, fall back to the same card without the icon and
  // pick the icon up automatically once a build ships that knows it.
  try {
    return build('Link');
  } catch {
    return build();
  }
}

function buildProvisionHandoffSurface(acknowledgement: string) {
  return withFallbackStory(
    makeA2UIBlob('agent-provision-handoff', 'root', [
      {
        id: 'root',
        component: 'Column',
        children: ['acknowledgement', 'heading', 'details', 'services'],
      },
      {
        id: 'acknowledgement',
        component: 'Text',
        text: acknowledgement,
      },
      {
        id: 'heading',
        component: 'Text',
        text: 'A few things to know:',
      },
      {
        id: 'details',
        component: 'Text',
        text:
          '- Ask me here to change what I cover, when I post, or my name.\n' +
          '- Connect calendars, docs, or notes to give me more to work with:',
      },
      {
        id: 'services',
        component: 'Button',
        child: 'services-label',
        action: {
          event: {
            name: A2UI.action.navigate,
            context: { target: { type: 'screen', screen: 'botMcpSettings' } },
          },
        },
      },
      {
        id: 'services-label',
        component: 'Text',
        text: 'Connect services',
      },
    ])
  );
}

export const agentOnboardingTesting = {
  buildInviteSurface,
  buildOnboardingSurface,
  buildRecurringPrompt,
  buildServicesSurface,
  findAckJobId,
  hasPostMarker,
  hasProvisionAck,
  jobMatches,
  notebookDisplayName,
  purposeForReply,
  provisionCadence,
  rememberFirstRun,
  scheduleConfirmation,
  servicesPitch,
  upsertPrimaryJob,
};
