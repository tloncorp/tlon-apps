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
};

type AgentOnboardingDeps = {
  fetchHistory?: typeof fetchChannelHistory;
  getCron?: typeof getTlonCronService;
  getGroup?: (groupId: string) => Promise<OnboardingGroup>;
  sendPost?: typeof sendChannelPost;
};

type AgentOnboardingCronDeps = {
  fetchHistory?: typeof fetchChannelHistory;
  listNotes?: typeof notes.listNotes;
  sendPost?: typeof sendChannelPost;
};

type OnboardingGroup = {
  hostUserId: string;
  channels?: Array<{ id: string; type: string }>;
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
const LEGACY_GROUP_INTRO_PREFIX = "I'm your Tlonbot.";
const GROUP_INTRO_MESSAGE =
  "I'm your Tlonbot. I can research things, track changes, and write " +
  'updates for you.';
const PURPOSE_PICKER_PROMPT = 'What should this group do?';
const HANDOFF_MESSAGE =
  'A few things to know:\n\n' +
  '- This conversation stays with you if you switch models or move Tlon ' +
  'to your own server.\n' +
  '- You can rename me whenever you like.\n' +
  '- Ask me about anything I find, or tell me what to do next.\n\n' +
  'I can draw on more than the web. Connect your other services — ' +
  'calendars, docs, notes — and what they know can inform what I make ' +
  'for you too:';
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
      'Good. I’ll create a group that posts a fresh morning digest about ' +
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
    description: 'Build your understanding with a short daily explainer.',
    icon: 'Clock',
    accent: 'green',
    scheduleHour: 9,
    topicsPrompt:
      'Good. I’ll create a group that builds your understanding over time. ' +
      'What should we explore? Pick any that fit.',
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
    description: 'A standing deep-dive I keep updated as new work comes out.',
    icon: 'Search',
    accent: 'indigo',
    scheduleHour: 9,
    topicsPrompt:
      'Good. I’ll create a standing research notebook that begins with an ' +
      'overview, then follows meaningful new work. What do you want to learn ' +
      'about? Pick any that fit.',
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
    provisionId: string;
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
    return advanceDurableConversation(context, history, deps);
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
    await postIntro(context, history, deps);
    return true;
  }
  await provision(context, history, request, deps);
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
  deps: AgentOnboardingDeps
) {
  await postOnce(
    context,
    history,
    'intro',
    async () => ({
      text: GROUP_INTRO_MESSAGE,
    }),
    deps
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
    deps
  );
}

async function advanceDurableConversation(
  context: AgentOnboardingContext,
  history: TlonHistoryEntry[],
  deps: AgentOnboardingDeps
): Promise<boolean> {
  const text = context.rawText!.trim();
  if (!hasPostMarker(history, context.botShip, 'purpose-picker')) {
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
      deps
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
    deps
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
        'Good. I’ll create a group for that. What should it focus on?',
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
  deps: AgentOnboardingDeps
) {
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
  if (!existingAck) {
    if (!cron) throw new Error('cron service is not available');
    jobId = await upsertPrimaryJob(cron, request, context.channelNest);
    await postOnce(
      context,
      history,
      ackKey,
      async () => ({
        text:
          `${formatTopicList(request.topics)}—got it. ` +
          `${provisionCadence(request.purposeId)} ` +
          'Your first entry is coming shortly.',
        entries: [
          {
            type: 'tlon-agent-provision-ack',
            version: 1,
            provisionId: request.provisionId,
            cronJobId: jobId!,
          },
        ],
      }),
      deps
    );
  }

  await postOnce(
    context,
    history,
    'handoff',
    async () => ({
      text: HANDOFF_MESSAGE,
    }),
    deps
  );
  await postOnce(
    context,
    history,
    'services-card',
    async () => ({
      text: 'Connect services in Settings.',
      blob: appendToPostBlob(undefined, buildServicesSurface()),
    }),
    deps
  );

  if (!existingAck) {
    if (!cron?.enqueueRun) {
      throw new Error(
        'OpenClaw does not expose enqueueRun through the plugin cron service'
      );
    }
    const disposition = await cron.enqueueRun(jobId!, 'force');
    rememberFirstRun(disposition, context, request);
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

  try {
    const history = await (deps.fetchHistory ?? fetchChannelHistory)(
      correlation.context.api,
      correlation.context.channelNest,
      50
    );
    await postOnce(
      correlation.context,
      history,
      `first-entry-ping:${correlation.provisionId}`,
      async () => {
        const listed = await (deps.listNotes ?? notes.listNotes)(
          correlation.notebookNest
        ).catch(() => []);
        const newest = [...listed].sort(
          (a, b) => (b.createdAt ?? b.noteId) - (a.createdAt ?? a.noteId)
        )[0];
        const message = "Your group's first entry is ready:";
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
      deps
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
  request: PostBlobDataEntryAgentProvision
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
    provisionId: request.provisionId,
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
        channels?: Record<string, unknown>;
        seats?: Record<string, { roles?: unknown[] }>;
      }
    >;
  };
  const group = init.groups?.[groupId];
  if (!group) throw new Error(`onboarding group not found: ${groupId}`);
  return {
    hostUserId: groupId.split('/')[0] ?? '',
    channels: Object.keys(group.channels ?? {}).map((id) => ({
      id,
      type: id.split('/')[0] ?? '',
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

async function postOnce(
  context: AgentOnboardingScanContext,
  history: TlonHistoryEntry[],
  key: string,
  build: () => Promise<PostOnceContent>,
  deps: AgentOnboardingDeps
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
  return `Write ${request.purpose.toLowerCase()} about ${request.topics.join(', ')}. First inspect the existing entries with \`tlon notes notes ${request.notebookNest}\`. ${firstRun} Search the web for current information and cite useful sources. Produce one self-contained Markdown note with a concise title as its first heading. Return only the finished note; do not post it or call a messaging tool. The coordinator will publish your final response exactly once.`;
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

function provisionCadence(purposeId: string) {
  switch (purposeId) {
    case 'agent-learning':
      return 'I’ll publish a short explainer on one topic each day, rotating through your list.';
    case 'agent-research':
      return 'I’ll publish a fresh research update here each day.';
    default:
      return 'I’ll publish a fresh digest here each day.';
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

function buildServicesSurface() {
  return withFallbackStory(
    makeA2UIBlob('agent-services', 'root', [
      {
        id: 'root',
        component: 'Button',
        child: 'label',
        action: {
          event: {
            name: A2UI.action.navigate,
            context: { target: { type: 'screen', screen: 'botMcpSettings' } },
          },
        },
      },
      { id: 'label', component: 'Text', text: 'Connect services' },
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
  jobMatches,
  purposeForReply,
  provisionCadence,
  rememberFirstRun,
  upsertPrimaryJob,
};
