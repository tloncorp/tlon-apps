import * as api from '@tloncorp/api';
import { desig } from '@tloncorp/api/lib/urbit';
import { BotHomeGroupSlugs } from '@tloncorp/api/types/wayfinding';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as logic from '../logic';
import { createChannel, deleteChannel } from './channelActions';
import { createDefaultGroup, updateGroupMeta } from './groupActions';
import { finalizeAndSendPost } from './postActions';

const logger = createDevLogger('agentGroupOnboarding', false);
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const DEFAULT_AGENT_GROUP_TITLE = 'My agent group';
const MAX_GENERATED_GROUP_TITLE_LENGTH = 48;
const PENDING_GROUP_ADOPTION_ATTEMPTS = 8;
const PENDING_GROUP_ADOPTION_DELAY_MS = 500;
const notesChannelFlights = new Map<string, Promise<db.Channel>>();
type AgentStandingFlight = {
  readyToReveal: Promise<void>;
  complete: Promise<void>;
};

const agentStandingFlights = new Map<string, AgentStandingFlight>();
const agentGroupFurnishingFlights = new Map<
  string,
  Promise<AgentGroupFurnishingStart>
>();

export type AgentGroupFurnishing = {
  group: db.Group;
  chatChannelId: string;
  agentShipId: string;
  /** Membership is visible and the admin grant request has been accepted. */
  readyToReveal: Promise<void>;
  /** Seating and admin verification deliberately overlap the intro wait. */
  tail: Promise<void>;
};

export type AgentGroupFurnishingStart = {
  group: db.Group;
  chatChannel: db.Channel;
  agentShipId: string;
  /** First-run setup, or the later group's greeting, continues after chat opens. */
  complete: Promise<AgentGroupFurnishing>;
};

type FurnishParams = {
  /** Omit to create a new group; provide to adopt a provisioned home group. */
  groupId?: string;
  title?: string;
  /** Local/sandbox escape hatch when there is no hosting account. */
  agentShipId?: string;
  /** Lets the bot introduce the provisioned home group as the user's first. */
  isFirstGroup?: boolean;
  /** Distinguishes explicit later creations while preserving remount retries. */
  requestId?: string;
};

/**
 * Establish an agent group. First-run onboarding also gets exactly one notes
 * channel; later groups open directly into ordinary chat.
 */
export async function ensureAgentGroupFurnished(
  params: FurnishParams = {}
): Promise<AgentGroupFurnishing> {
  const started = await startAgentGroupFurnishing(params);
  return started.complete;
}

/**
 * Establish enough of an agent group to open its chat, then finish its
 * first-run setup or later-group greeting without blocking navigation.
 */
export async function startAgentGroupFurnishing(
  params: FurnishParams = {}
): Promise<AgentGroupFurnishingStart> {
  const flightKey = agentGroupFurnishingFlightKey(
    params,
    api.getCurrentUserId()
  );
  return startAgentGroupFurnishingFlight(flightKey, () =>
    startAgentGroupFurnishingOnce(params)
  );
}

function agentGroupFurnishingFlightKey(
  params: Pick<FurnishParams, 'groupId' | 'requestId'>,
  currentUserId: string
) {
  return params.groupId ?? params.requestId ?? `new:${currentUserId}`;
}

function startAgentGroupFurnishingFlight(
  flightKey: string,
  start: () => Promise<AgentGroupFurnishingStart>
): Promise<AgentGroupFurnishingStart> {
  const existingFlight = agentGroupFurnishingFlights.get(flightKey);
  if (existingFlight) return existingFlight;

  const clearFlight = () => {
    if (agentGroupFurnishingFlights.get(flightKey) === flight) {
      agentGroupFurnishingFlights.delete(flightKey);
    }
  };
  const flight = start().then(
    (started) => ({
      ...started,
      // Remounts must share the completion pass too; clearing after only the
      // quick start phase can race duplicate intro posts into the same chat.
      complete: started.complete.finally(clearFlight),
    }),
    (error) => {
      clearFlight();
      throw error;
    }
  );
  agentGroupFurnishingFlights.set(flightKey, flight);
  return flight;
}

async function startAgentGroupFurnishingOnce(
  params: FurnishParams
): Promise<AgentGroupFurnishingStart> {
  const resolved = await resolveAgent(params.agentShipId);
  if (!resolved.agentShipId) {
    throw new Error('Your agent is not available right now.');
  }

  const group = params.groupId
    ? await adoptGroup(params.groupId)
    : await createOrResumeAgentGroup({
        agentShipId: resolved.agentShipId,
        title: params.title ?? DEFAULT_AGENT_GROUP_TITLE,
      });
  const chatChannel = await ensureChatChannel(group);
  await db.agentGroupAgents.setValue((current) => ({
    ...current,
    [group.id]: resolved.agentShipId!,
  }));
  if (params.isFirstGroup) {
    const initialGroupTitle = group.title ?? null;
    const currentUserContact = await db.getContact({
      id: api.getCurrentUserId(),
    });
    const canRenameGroup = params.groupId
      ? group.id.endsWith(`/${BotHomeGroupSlugs.slug}`) &&
        logic.botHomeGroupHasDefaultTitle(
          group,
          currentUserContact?.peerNickname
        )
      : params.title == null || params.title === DEFAULT_AGENT_GROUP_TITLE;

    await db.agentGroupOnboardingLocks.setValue((current) => ({
      ...current,
      [group.id]: {
        ...current[group.id],
        chatChannelId: chatChannel.id,
        createdAt: current[group.id]?.createdAt ?? Date.now(),
        navigationLockExpiresAt:
          current[group.id]?.navigationLockExpiresAt ??
          Date.now() + db.AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS,
        initialGroupTitle:
          current[group.id]?.initialGroupTitle ?? initialGroupTitle,
        canRenameGroup: current[group.id]?.canRenameGroup ?? canRenameGroup,
      },
    }));
  }
  const complete = finishAgentGroupFurnishing({
    group,
    chatChannel,
    agentShipId: resolved.agentShipId,
    hostedShipId: resolved.hostedShipId,
    isFirstGroup: params.isFirstGroup ?? false,
  });

  return {
    group,
    chatChannel,
    agentShipId: resolved.agentShipId,
    complete,
  };
}

async function createOrResumeAgentGroup({
  agentShipId,
  title,
}: {
  agentShipId: string;
  title: string;
}) {
  const currentUserId = api.getCurrentUserId();
  const pending = await db.pendingAgentGroupCreation.getValue();
  const pendingGroupId =
    typeof pending === 'string' ? pending : pending?.groupId;
  const groupId = pendingGroupId ?? `${currentUserId}/${logic.getRandomId()}`;
  const defaultChannelId =
    typeof pending === 'object' && pending
      ? pending.defaultChannelId
      : `chat/${currentUserId}/${logic.getRandomId()}`;

  if (pendingGroupId) {
    try {
      return await waitForPendingGroupWithChat(() => adoptGroup(groupId));
    } catch {
      // Retrying the exact group/channel payload is safe even if an ambiguous
      // earlier request finishes late, and recovers definitive pre-send
      // failures without stranding the persisted pending marker.
      if (typeof pending === 'string') {
        await db.pendingAgentGroupCreation.setValue({
          groupId,
          defaultChannelId,
        });
      }
      try {
        return await createDefaultGroup({
          groupId,
          defaultChannelId,
          memberIds: [agentShipId],
          title,
        });
      } catch (createError) {
        try {
          return await waitForPendingGroupWithChat(() => adoptGroup(groupId), {
            attempts: 2,
          });
        } catch {
          throw createError;
        }
      }
    }
  }

  await db.pendingAgentGroupCreation.setValue({ groupId, defaultChannelId });

  const local = await db.getGroup({ id: groupId });
  if (local) {
    try {
      return await adoptGroup(groupId);
    } catch {
      // The prior create may have failed before the ship persisted it. Retry
      // with the same id so a late success cannot leave a second group behind.
      if (local) await db.deleteGroup(groupId);
    }
  }
  return createDefaultGroup({
    groupId,
    defaultChannelId,
    memberIds: [agentShipId],
    title,
  });
}

async function waitForPendingGroupWithChat(
  loadGroup: () => Promise<db.Group>,
  {
    attempts = PENDING_GROUP_ADOPTION_ATTEMPTS,
    delayMs = PENDING_GROUP_ADOPTION_DELAY_MS,
  }: { attempts?: number; delayMs?: number } = {}
): Promise<db.Group> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const group = await loadGroup();
      if (group.channels?.some((channel) => channel.type === 'chat')) {
        return group;
      }
      lastError = new Error('The pending group is still creating its chat.');
    } catch (error) {
      lastError = error;
    }
    if (attempt + 1 < attempts && delayMs > 0) await wait(delayMs);
  }
  throw lastError ?? new Error('The pending group is not ready yet.');
}

async function finishAgentGroupFurnishing({
  group: initialGroup,
  chatChannel,
  agentShipId,
  hostedShipId,
  isFirstGroup,
}: {
  group: db.Group;
  chatChannel: db.Channel;
  agentShipId: string;
  hostedShipId: string | null;
  isFirstGroup: boolean;
}): Promise<AgentGroupFurnishing> {
  return retryAgentGroupFurnishCore(
    () =>
      finishAgentGroupFurnishingOnce({
        initialGroup,
        chatChannel,
        agentShipId,
        hostedShipId,
        isFirstGroup,
      }),
    { groupId: initialGroup.id }
  );
}

async function finishAgentGroupFurnishingOnce({
  initialGroup,
  chatChannel,
  agentShipId,
  hostedShipId,
  isFirstGroup,
}: {
  initialGroup: db.Group;
  chatChannel: db.Channel;
  agentShipId: string;
  hostedShipId: string | null;
  isFirstGroup: boolean;
}): Promise<AgentGroupFurnishing> {
  const notebook = isFirstGroup
    ? await ensureSingleNotesChannel(initialGroup.id)
    : null;
  const group = notebook
    ? ((await db.getGroup({ id: initialGroup.id })) ?? {
        ...initialGroup,
        channels: [...(initialGroup.channels ?? []), notebook],
      })
    : initialGroup;

  await ensureIntroRequest(group.id, chatChannel.id, isFirstGroup);
  await db.pendingAgentGroupCreation.setValue((current) =>
    (typeof current === 'string' ? current : current?.groupId) === group.id
      ? null
      : current
  );

  logger.trackEvent('Agent Group Furnish Core Completed', {
    groupId: group.id,
    chatChannelId: chatChannel.id,
    notebookNest: notebook?.id ?? null,
  });

  const standing = reconcileAgentStandingUntilReady({
    groupId: group.id,
    agentShipId,
    hostedShipId,
  });
  const tail = standing.complete.catch((error) => {
    logger.trackError('Agent Group Furnish Tail Failed', {
      error,
      groupId: group.id,
    });
    throw error;
  });

  return {
    group,
    chatChannelId: chatChannel.id,
    agentShipId,
    readyToReveal: standing.readyToReveal,
    tail,
  };
}

async function retryAgentGroupFurnishCore<T>(
  operation: () => Promise<T>,
  { groupId, delayMs = 1_000 }: { groupId: string; delayMs?: number }
): Promise<T> {
  return logic.withRetry(operation, {
    numOfAttempts: 2,
    startingDelay: delayMs,
    retry: (error) => {
      logger.trackError('Agent Group Furnish Core Failed; Retrying', {
        error,
        groupId,
      });
      return true;
    },
  });
}

export function buildAgentGroupTitle({
  purposeId,
  topics,
}: {
  purposeId: api.AgentOnboardingPurposeId;
  topics: readonly string[];
}) {
  const cleanTopics = topics.map((topic) => topic.trim()).filter(Boolean);
  const fallbackTopic =
    purposeId === 'agent-learning' ? 'Something new' : 'New';
  const primaryTopic = cleanTopics[0] || fallbackTopic;
  const countSuffix =
    cleanTopics.length > 1 ? ` + ${cleanTopics.length - 1} more` : '';
  const prefix = purposeId === 'agent-learning' ? 'Learning ' : '';
  const suffix =
    purposeId === 'agent-learning'
      ? ''
      : purposeId === 'agent-daily-digest'
        ? ' Digest'
        : ' Research';
  const maxPrimaryLength = Math.max(
    1,
    MAX_GENERATED_GROUP_TITLE_LENGTH -
      prefix.length -
      countSuffix.length -
      suffix.length
  );
  const clippedPrimary =
    primaryTopic.length > maxPrimaryLength
      ? `${primaryTopic.slice(0, maxPrimaryLength - 1).trimEnd()}…`
      : primaryTopic;

  return `${prefix}${clippedPrimary}${countSuffix}${suffix}`;
}

/** Rename only the untouched placeholder created or adopted for onboarding. */
function isAgentGroupTitleRenameEligible(
  lock: db.AgentGroupOnboardingLock,
  title: string | null
) {
  return (
    lock.canRenameGroup === true &&
    (title === lock.initialGroupTitle || title === lock.generatedGroupTitle)
  );
}

export async function renameAgentGroupFromOnboarding({
  groupId,
  purposeId,
  topics,
}: {
  groupId: string;
  purposeId: api.AgentOnboardingPurposeId;
  topics: readonly string[];
}) {
  try {
    const lock = (await db.agentGroupOnboardingLocks.getValue())[groupId];
    if (!lock) return;
    const group = await db.getGroup({ id: groupId });
    if (!group || !isAgentGroupTitleRenameEligible(lock, group.title ?? null))
      return;

    const title = buildAgentGroupTitle({ purposeId, topics });
    if (title === group.title) return;
    let renameStillAllowed = false;
    await db.agentGroupOnboardingLocks.setValue((current) => {
      const currentLock = current[groupId];
      if (
        !currentLock ||
        !isAgentGroupTitleRenameEligible(currentLock, group.title ?? null)
      )
        return current;
      renameStillAllowed = true;
      return {
        ...current,
        [groupId]: { ...currentLock, generatedGroupTitle: title },
      };
    });
    if (!renameStillAllowed) return;
    await updateGroupMeta({ ...group, title });
  } catch (error) {
    // Naming is cosmetic and must never prevent the provision request.
    logger.trackError('Failed to name agent onboarding group', {
      error,
      groupId,
    });
  }
}

async function adoptGroup(groupId: string): Promise<db.Group> {
  const group = await api.getGroup(groupId);
  if (!group.currentUserIsMember || !group.currentUserIsHost) {
    throw new Error('Only the group owner can set up an agent group.');
  }
  await db.insertGroups({ groups: [group] });
  return group;
}

async function ensureChatChannel(group: db.Group): Promise<db.Channel> {
  const existing = group.channels?.find((channel) => channel.type === 'chat');
  if (existing) {
    await db.insertGroups({ groups: [group] });
    if (existing.currentUserIsMember) {
      await db.updateChannel({ id: existing.id, currentUserIsMember: true });
    }
    return existing;
  }

  // Older hosts can omit channels from the create response. Preserve the
  // remote check in that case so a slow response never creates a duplicate.
  const remote = await api.getGroup(group.id);
  const remoteExisting = remote.channels?.find(
    (channel) => channel.type === 'chat'
  );
  if (remoteExisting) {
    await db.insertGroups({ groups: [remote] });
    if (remoteExisting.currentUserIsMember) {
      await db.updateChannel({
        id: remoteExisting.id,
        currentUserIsMember: true,
      });
    }
    return remoteExisting;
  }
  return createChannel({
    groupId: group.id,
    title: 'General',
    channelType: 'chat',
  });
}

/**
 * Adopt a notebook the ship already lists.
 *
 * `insertGroups` (like `insertChannels`) leaves `currentUserIsMember` out of
 * its conflict-update set, so a row an earlier sync created as a non-member
 * stays that way no matter how often the group is re-inserted. For a notebook
 * the owner hosts and the ship reports as readable, that is simply wrong — it
 * puts their own notebook under "Available Channels" behind a Join button. A
 * direct update is the only write that clears it.
 */
async function adoptNotebook(
  remote: db.Group,
  notebook: db.Channel
): Promise<db.Channel> {
  await db.insertGroups({ groups: [remote] });
  if (notebook.currentUserIsMember) {
    await db.updateChannel({ id: notebook.id, currentUserIsMember: true });
  }
  return notebook;
}

async function ensureSingleNotesChannel(groupId: string): Promise<db.Channel> {
  const existingFlight = notesChannelFlights.get(groupId);
  if (existingFlight) return existingFlight;

  const flight = ensureSingleNotesChannelOnce(groupId).finally(() => {
    if (notesChannelFlights.get(groupId) === flight) {
      notesChannelFlights.delete(groupId);
    }
  });
  notesChannelFlights.set(groupId, flight);
  return flight;
}

async function ensureSingleNotesChannelOnce(
  groupId: string
): Promise<db.Channel> {
  for (const delay of [0, 300, 800]) {
    if (delay) await wait(delay);
    const remote = await api.getGroup(groupId);
    const notebooks =
      remote.channels?.filter((channel) => channel.type === 'notes') ?? [];
    if (notebooks.length > 1) {
      throw ambiguousNotebooksError();
    }
    if (notebooks.length === 1) {
      return adoptNotebook(remote, notebooks[0]!);
    }
  }

  let createdNotebookId: string | undefined;
  try {
    const created = await createChannel({
      groupId,
      title: 'Updates',
      channelType: 'notes',
    });
    createdNotebookId = created.id;
    // The notes API assigns flags, so two devices cannot submit the same
    // creation id. Re-read and deterministically reconcile the duplicate
    // default notebooks instead of relying on this process-local flight.
    const remote = await api.getGroup(groupId);
    const notebooks =
      remote.channels?.filter((channel) => channel.type === 'notes') ?? [];
    if (notebooks.length === 0) {
      throw new Error('The onboarding notebook was not listed after creation.');
    }
    return notebooks.length === 1
      ? adoptNotebook(remote, notebooks[0]!)
      : reconcileCreatedOnboardingNotebook(
          groupId,
          notebooks,
          createdNotebookId
        );
  } catch (error) {
    // A timeout can hide a successful create. Adopt only an unambiguous result.
    const remote = await api.getGroup(groupId);
    const notebooks =
      remote.channels?.filter((channel) => channel.type === 'notes') ?? [];
    if (notebooks.length === 1) {
      return adoptNotebook(remote, notebooks[0]!);
    }
    if (notebooks.length > 1) {
      return createdNotebookId
        ? reconcileCreatedOnboardingNotebook(
            groupId,
            notebooks,
            createdNotebookId
          )
        : Promise.reject(ambiguousNotebooksError());
    }
    throw error;
  }
}

function ambiguousNotebooksError() {
  return new Error(
    'This group has multiple notebooks. Remove the extra notebook and try again.'
  );
}

function chooseCreatedNotebookResolution(
  notebooks: db.Channel[],
  createdNotebookId: string
) {
  const created = notebooks.find(
    (notebook) => notebook.id === createdNotebookId
  );
  const others = notebooks.filter(
    (notebook) => notebook.id !== createdNotebookId
  );
  if (!created || others.length !== 1) throw ambiguousNotebooksError();
  const [other] = others;
  // We can prove only this client's freshly returned notebook is disposable.
  // Use ID ordering solely to ensure two racing clients do not both delete
  // their own notebook. Never delete an existing channel based on its title.
  if (created.id.localeCompare(other!.id) < 0) throw ambiguousNotebooksError();
  return { created, keeper: other! };
}

async function reconcileCreatedOnboardingNotebook(
  groupId: string,
  notebooks: db.Channel[],
  createdNotebookId: string
) {
  const { created, keeper } = chooseCreatedNotebookResolution(
    notebooks,
    createdNotebookId
  );
  await deleteChannel({ channelId: created.id, groupId });
  for (const delay of [0, 300, 800]) {
    if (delay) await wait(delay);
    const reconciled = await api.getGroup(groupId);
    const remaining =
      reconciled.channels?.filter((channel) => channel.type === 'notes') ?? [];
    if (remaining.length === 1 && remaining[0]!.id === keeper.id) {
      return adoptNotebook(reconciled, remaining[0]!);
    }
  }
  throw new Error('Could not reconcile concurrent onboarding notebooks.');
}

async function ensureIntroRequest(
  groupId: string,
  channelId: string,
  isFirstGroup: boolean
) {
  const currentUserId = api.getCurrentUserId();
  const history = await api.getChannelPosts({
    channelId,
    mode: 'newest',
    count: 50,
  });
  const alreadyPosted = history.posts.some(
    (post) =>
      post.authorId === currentUserId &&
      logic.findPostBlobEntry(post.blob, 'tlon-agent-intro-request')
        ?.groupId === groupId
  );
  if (alreadyPosted) return;

  const blob = logic.appendToPostBlob(undefined, {
    type: 'tlon-agent-intro-request',
    version: 1,
    groupId,
    ...(isFirstGroup ? { isFirstGroup: true } : {}),
  });
  await finalizeAndSendPost(
    {
      channelId,
      channelType: 'chat',
      content: ["Let's get set up."],
      attachments: [],
      blob,
      replyToPostId: null,
      isEdit: false,
    },
    { rejectOnDefinitiveFailure: true }
  );
}

async function resolveAgent(explicit?: string): Promise<{
  agentShipId: string | null;
  hostedShipId: string | null;
}> {
  if (explicit) {
    return { agentShipId: api.preSig(explicit), hostedShipId: null };
  }
  const [enabled, hostedShipId] = await Promise.all([
    db.hostingBotEnabled.getValue(),
    db.hostedUserNodeId.getValue(),
  ]);
  if (!enabled || !hostedShipId) {
    return { agentShipId: null, hostedShipId: null };
  }
  const moon = await api.getTlawnMoon(hostedShipId);
  if (!moon) return { agentShipId: null, hostedShipId };
  const host = desig(hostedShipId.trim());
  const prefix = desig(moon.trim());
  return {
    agentShipId: api.preSig(
      prefix.endsWith(`-${host}`) ? prefix : `${prefix}-${host}`
    ),
    hostedShipId,
  };
}

async function reconcileAgentStanding({
  groupId,
  agentShipId,
  hostedShipId,
  onReadyToReveal,
  deps = {},
}: {
  groupId: string;
  agentShipId: string;
  hostedShipId: string | null;
  onReadyToReveal: () => void;
  deps?: {
    getGroup?: typeof api.getGroup;
    addMembersToRole?: typeof api.addMembersToRole;
    addCordonThenJoin?: typeof addCordonThenJoin;
  };
}) {
  const getGroup = deps.getGroup ?? api.getGroup;
  const addMembersToRole = deps.addMembersToRole ?? api.addMembersToRole;
  const cordonThenJoin = deps.addCordonThenJoin ?? addCordonThenJoin;
  let lastError: unknown;
  for (const delay of [0, 1_000, 2_000, 5_000, 10_000]) {
    if (delay) await wait(delay);
    try {
      let group = await getGroup(groupId);
      if (agentHasAdmin(group, agentShipId)) {
        onReadyToReveal();
        logger.trackEvent('Agent Group Furnish Tail Verified', { groupId });
        return;
      }
      if (hostedShipId && !agentHasJoined(group, agentShipId)) {
        const moon = desig(agentShipId);
        await cordonThenJoin(hostedShipId, groupId, moon);
        group = await getGroup(groupId);
      }
      if (agentHasJoined(group, agentShipId)) {
        await addMembersToRole({
          groupId,
          roleId: 'admin',
          ships: [agentShipId],
        });
        // The bot can consume the intro request as soon as it is joined. Keep
        // verifying the admin grant in the background, but do not hide the
        // already-mounted conversation while that read-back propagates.
        onReadyToReveal();
      }
      group = await getGroup(groupId);
      if (agentHasAdmin(group, agentShipId)) {
        logger.trackEvent('Agent Group Furnish Tail Verified', { groupId });
        return;
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Could not verify the agent seat: ${String(lastError ?? '')}`
  );
}

function reconcileAgentStandingUntilReady(params: {
  groupId: string;
  agentShipId: string;
  hostedShipId: string | null;
}) {
  const existing = agentStandingFlights.get(params.groupId);
  if (existing) return existing;
  let resolveReadyToReveal!: () => void;
  let rejectReadyToReveal!: (error: unknown) => void;
  let revealSettled = false;
  const readyToReveal = new Promise<void>((resolve, reject) => {
    resolveReadyToReveal = () => {
      if (revealSettled) return;
      revealSettled = true;
      resolve();
    };
    rejectReadyToReveal = (error) => {
      if (revealSettled) return;
      revealSettled = true;
      reject(error);
    };
  });
  // Some furnishing callers only need the completion tail. Keep a rejected
  // reveal milestone from becoming an unhandled promise in those paths.
  void readyToReveal.catch(() => undefined);

  const complete = retryAgentStanding(
    () =>
      reconcileAgentStanding({
        ...params,
        onReadyToReveal: resolveReadyToReveal,
      }),
    params.groupId
  )
    .then(() => resolveReadyToReveal())
    .catch((error) => {
      rejectReadyToReveal(error);
      throw error;
    })
    .finally(() => agentStandingFlights.delete(params.groupId));
  const flight = { readyToReveal, complete };
  agentStandingFlights.set(params.groupId, flight);
  return flight;
}

async function retryAgentStanding(
  operation: () => Promise<void>,
  groupId: string,
  {
    startingDelay = 1_000,
    maxAttempts = 3,
  }: { startingDelay?: number; maxAttempts?: number } = {}
) {
  return logic.withRetry(operation, {
    numOfAttempts: maxAttempts,
    startingDelay,
    maxDelay: 30_000,
    timeMultiple: 2,
    retry: (error, attempt) => {
      logger.trackError('Agent Group Standing Repair Failed; Retrying', {
        error,
        groupId,
        attempt,
      });
      return true;
    },
  });
}

async function addCordonThenJoin(
  hostedShipId: string,
  groupId: string,
  moon: string,
  deps: {
    add?: typeof api.addTlawnToCordon;
    join?: typeof api.joinTlawnGroup;
  } = {}
) {
  // A previous attempt may have added the moon before its join failed.
  // Hosting reports that duplicate add as an error, but the required join is
  // still safe and must continue.
  try {
    await (deps.add ?? api.addTlawnToCordon)(hostedShipId, groupId, moon);
  } catch (error) {
    logger.trackError('Agent already cordoned or cordon add failed', {
      error,
      groupId,
    });
  }
  await (deps.join ?? api.joinTlawnGroup)(hostedShipId, groupId, moon);
}

function agentHasJoined(group: db.Group, agentShipId: string) {
  return Boolean(
    group.members?.some(
      (member) =>
        member.contactId === agentShipId && member.status !== 'invited'
    )
  );
}

function agentHasAdmin(group: db.Group, agentShipId: string) {
  const member = group.members?.find(
    (candidate) =>
      candidate.contactId === agentShipId && candidate.status !== 'invited'
  );
  return Boolean(
    member?.roles?.some((role: unknown) => {
      if (role === 'admin') return true;
      if (!role || typeof role !== 'object') return false;
      const value = role as { id?: unknown; roleId?: unknown };
      return value.id === 'admin' || value.roleId === 'admin';
    })
  );
}

export const agentGroupOnboardingTesting = {
  addCordonThenJoin,
  agentGroupFurnishingFlightKey,
  agentHasAdmin,
  retryAgentGroupFurnishCore,
  agentHasJoined,
  ensureSingleNotesChannel,
  isAgentGroupTitleRenameEligible,
  chooseCreatedNotebookResolution,
  retryAgentStanding,
  reconcileAgentStanding,
  startAgentGroupFurnishingFlight,
  waitForPendingGroupWithChat,
};
