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
const MAX_GENERATED_GROUP_TITLE_LENGTH = 80;

export type AgentGroupFurnishing = {
  group: db.Group;
  chatChannelId: string;
  notebookNest: string;
  agentShipId: string;
  /** Seating and admin verification deliberately overlap the intro wait. */
  tail: Promise<void>;
};

type FurnishParams = {
  /** Omit to create a new group; provide to adopt a provisioned home group. */
  groupId?: string;
  title?: string;
  /** Local/sandbox escape hatch when there is no hosting account. */
  agentShipId?: string;
};

/**
 * Establish the owner-authenticated half of agent onboarding. The group,
 * chat, and exactly-one notes channel are blocking; seating/admin repair is
 * returned as a concurrent tail.
 */
export async function ensureAgentGroupFurnished(
  params: FurnishParams = {}
): Promise<AgentGroupFurnishing> {
  const resolved = await resolveAgent(params.agentShipId);
  if (!resolved.agentShipId) {
    throw new Error('Your agent is not available right now.');
  }

  let group = params.groupId
    ? await adoptGroup(params.groupId)
    : await createDefaultGroup({
        memberIds: [resolved.agentShipId],
        title: params.title ?? DEFAULT_AGENT_GROUP_TITLE,
      });
  const chatChannel = await ensureChatChannel(group);
  const notebook = await ensureSingleNotesChannel(group.id);
  group = (await db.getGroup({ id: group.id })) ?? {
    ...group,
    channels: [...(group.channels ?? []), notebook],
  };
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
        initialGroupTitle:
          current[group.id]?.initialGroupTitle ?? initialGroupTitle,
        canRenameGroup: current[group.id]?.canRenameGroup ?? canRenameGroup,
      },
    })),
  ]);

  await ensureIntroRequest(group.id, chatChannel.id);

  logger.trackEvent('Agent Group Furnish Core Completed', {
    groupId: group.id,
    chatChannelId: chatChannel.id,
    notebookNest: notebook.id,
  });

  const tail = reconcileAgentStanding({
    groupId: group.id,
    agentShipId: resolved.agentShipId,
    hostedShipId: resolved.hostedShipId,
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
    agentShipId: resolved.agentShipId,
    tail,
  };
}

export function buildAgentGroupTitle({
  purposeId,
  topics,
}: {
  purposeId: string;
  topics: readonly string[];
}) {
  const suffix =
    purposeId === 'agent-daily-digest'
      ? 'Digest'
      : purposeId === 'agent-tracking'
        ? 'Tracker'
        : 'Research';
  const cleanTopics = topics.map((topic) => topic.trim()).filter(Boolean);
  const topicSummary =
    cleanTopics.length <= 1
      ? cleanTopics[0] || 'New'
      : cleanTopics.length === 2
        ? `${cleanTopics[0]} + ${cleanTopics[1]}`
        : `${cleanTopics[0]} + ${cleanTopics.length - 1} more`;
  const maxTopicLength = MAX_GENERATED_GROUP_TITLE_LENGTH - suffix.length - 1;
  const clippedTopic =
    topicSummary.length > maxTopicLength
      ? `${topicSummary.slice(0, maxTopicLength - 1).trimEnd()}…`
      : topicSummary;
  return `${clippedTopic} ${suffix}`;
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
  const remote = await api.getGroup(group.id);
  const existing = remote.channels?.find((channel) => channel.type === 'chat');
  if (existing) {
    await db.insertGroups({ groups: [remote] });
    return existing;
  }
  return createChannel({
    groupId: group.id,
    title: 'General',
    channelType: 'chat',
  });
}

async function ensureSingleNotesChannel(groupId: string): Promise<db.Channel> {
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
      await db.insertGroups({ groups: [remote] });
      return notebooks[0];
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
      await db.insertGroups({ groups: [remote] });
      return notebooks[0];
    }
    throw error;
  }
}

async function ensureIntroRequest(groupId: string, channelId: string) {
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
  });
  await finalizeAndSendPost({
    channelId,
    channelType: 'chat',
    content: ["Let's get set up."],
    attachments: [],
    blob,
    replyToPostId: null,
    isEdit: false,
  });
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
        await api.addTlawnToCordon(hostedShipId, groupId, moon);
        await api.joinTlawnGroup(hostedShipId, groupId, moon);
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
  agentHasAdmin,
  agentHasJoined,
  ensureSingleNotesChannel,
};
