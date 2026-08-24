import * as api from '@tloncorp/api';
import { desig } from '@tloncorp/api/lib/urbit';
import { BotHomeGroupSlugs } from '@tloncorp/api/types/wayfinding';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as logic from '../logic';
import { createChannel } from './channelActions';
import { createDefaultGroup, updateGroupMeta } from './groupActions';
import { finalizeAndSendPost } from './postActions';

const logger = createDevLogger('agentGroupOnboarding', false);
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const DEFAULT_AGENT_GROUP_TITLE = 'My agent group';
const MAX_GENERATED_GROUP_TITLE_LENGTH = 48;
const notesChannelFlights = new Map<string, Promise<db.Channel>>();
const agentStandingFlights = new Map<string, Promise<void>>();

export type AgentGroupFurnishing = {
  group: db.Group;
  chatChannelId: string;
  notebookNest: string;
  agentShipId: string;
  /** Seating and admin verification deliberately overlap the intro wait. */
  tail: Promise<void>;
};

export type AgentGroupFurnishingStart = {
  group: db.Group;
  chatChannel: db.Channel;
  agentShipId: string;
  /** Notebook setup and the durable intro request continue after chat opens. */
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
};

/**
 * Establish the owner-authenticated half of agent onboarding. The group,
 * chat, and exactly-one notes channel are blocking; seating/admin repair is
 * returned as a concurrent tail.
 */
export async function ensureAgentGroupFurnished(
  params: FurnishParams = {}
): Promise<AgentGroupFurnishing> {
  const started = await startAgentGroupFurnishing(params);
  return started.complete;
}

/**
 * Establish enough of an agent group to open its chat, then finish the
 * notebook and intro request without keeping later group creation blocked.
 */
export async function startAgentGroupFurnishing(
  params: FurnishParams = {}
): Promise<AgentGroupFurnishingStart> {
  const resolved = await resolveAgent(params.agentShipId);
  if (!resolved.agentShipId) {
    throw new Error('Your agent is not available right now.');
  }

  const group = params.groupId
    ? await adoptGroup(params.groupId)
    : await createDefaultGroup({
        memberIds: [resolved.agentShipId],
        title: params.title ?? DEFAULT_AGENT_GROUP_TITLE,
      });
  const chatChannel = await ensureChatChannel(group);
  const initialGroupTitle = group.title ?? null;
  const canRenameGroup = params.groupId
    ? group.id.endsWith(`/${BotHomeGroupSlugs.slug}`) &&
      logic.botHomeGroupHasDefaultTitle(group)
    : params.title == null || params.title === DEFAULT_AGENT_GROUP_TITLE;

  await Promise.all([
    db.agentGroupAgents.setValue((current) => ({
      ...current,
      [group.id]: resolved.agentShipId!,
    })),
    db.agentGroupOnboardingLocks.setValue((current) => ({
      ...current,
      [group.id]: {
        ...current[group.id],
        createdAt: current[group.id]?.createdAt ?? Date.now(),
        navigationLocked:
          current[group.id]?.navigationLocked ?? params.isFirstGroup ?? false,
        initialGroupTitle:
          current[group.id]?.initialGroupTitle ?? initialGroupTitle,
        canRenameGroup: current[group.id]?.canRenameGroup ?? canRenameGroup,
      },
    })),
  ]);

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
  const notebook = await ensureSingleNotesChannel(initialGroup.id);
  const group = (await db.getGroup({ id: initialGroup.id })) ?? {
    ...initialGroup,
    channels: [...(initialGroup.channels ?? []), notebook],
  };

  await ensureIntroRequest(group.id, chatChannel.id, isFirstGroup);

  logger.trackEvent('Agent Group Furnish Core Completed', {
    groupId: group.id,
    chatChannelId: chatChannel.id,
    notebookNest: notebook.id,
  });

  const tail = reconcileAgentStandingUntilReady({
    groupId: group.id,
    agentShipId,
    hostedShipId,
  }).catch((error) => {
    logger.trackError('Agent Group Furnish Tail Failed', {
      error,
      groupId: group.id,
    });
    throw error;
  });

  return {
    group,
    chatChannelId: chatChannel.id,
    notebookNest: notebook.id,
    agentShipId,
    tail,
  };
}

async function retryAgentGroupFurnishCore<T>(
  operation: () => Promise<T>,
  { groupId, delayMs = 1_000 }: { groupId: string; delayMs?: number }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.trackError('Agent Group Furnish Core Failed; Retrying', {
      error,
      groupId,
    });
  }

  if (delayMs) await wait(delayMs);
  return operation();
}

export function buildAgentGroupTitle({
  purposeId,
  topics,
}: {
  purposeId: string;
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
export async function renameAgentGroupFromOnboarding({
  groupId,
  purposeId,
  topics,
}: {
  groupId: string;
  purposeId: string;
  topics: readonly string[];
}) {
  try {
    const lock = (await db.agentGroupOnboardingLocks.getValue())[groupId];
    if (!lock?.canRenameGroup) return;
    const group = await db.getGroup({ id: groupId });
    if (!group || (group.title ?? null) !== lock.initialGroupTitle) return;

    const title = buildAgentGroupTitle({ purposeId, topics });
    if (title === group.title) return;
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
      throw new Error(
        'This group has multiple notebooks. Remove the extra notebook and try again.'
      );
    }
    if (notebooks.length === 1) {
      return adoptNotebook(remote, notebooks[0]!);
    }
  }

  try {
    return await createChannel({
      groupId,
      title: 'Updates',
      channelType: 'notes',
    });
  } catch (error) {
    // A timeout can hide a successful create. Adopt only an unambiguous result.
    const remote = await api.getGroup(groupId);
    const notebooks =
      remote.channels?.filter((channel) => channel.type === 'notes') ?? [];
    if (notebooks.length === 1) {
      return adoptNotebook(remote, notebooks[0]!);
    }
    throw error;
  }
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
      post.blob &&
      logic
        .parsePostBlob(post.blob)
        .some(
          (entry) =>
            entry.type === 'tlon-agent-intro-request' &&
            entry.groupId === groupId
        )
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
    { throwOnFailure: true }
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
}: {
  groupId: string;
  agentShipId: string;
  hostedShipId: string | null;
}) {
  let lastError: unknown;
  for (const delay of [0, 1_000, 2_000, 5_000, 10_000]) {
    if (delay) await wait(delay);
    try {
      let group = await api.getGroup(groupId);
      if (agentHasAdmin(group, agentShipId)) {
        logger.trackEvent('Agent Group Furnish Tail Verified', { groupId });
        return;
      }
      if (hostedShipId && !agentHasJoined(group, agentShipId)) {
        const moon = desig(agentShipId);
        await addCordonThenJoin(hostedShipId, groupId, moon);
        group = await api.getGroup(groupId);
      }
      if (agentHasJoined(group, agentShipId)) {
        await api.addMembersToRole({
          groupId,
          roleId: 'admin',
          ships: [agentShipId],
        });
      }
      group = await api.getGroup(groupId);
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
  const flight = retryAgentStanding(
    () => reconcileAgentStanding(params),
    params.groupId
  ).finally(() => agentStandingFlights.delete(params.groupId));
  agentStandingFlights.set(params.groupId, flight);
  return flight;
}

async function retryAgentStanding(
  operation: () => Promise<void>,
  groupId: string,
  sleep: (ms: number) => Promise<void> = wait
) {
  let delayMs = 1_000;
  for (;;) {
    try {
      await operation();
      return;
    } catch (error) {
      logger.trackError('Agent Group Standing Repair Failed; Retrying', {
        error,
        groupId,
        delayMs,
      });
    }
    await sleep(delayMs);
    delayMs = Math.min(delayMs * 2, 30_000);
  }
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
  agentHasAdmin,
  retryAgentGroupFurnishCore,
  agentHasJoined,
  ensureSingleNotesChannel,
  retryAgentStanding,
};
