import * as api from '@tloncorp/api';
import {
  GROUP_AGENT_CONFIG_ENTRY_TYPE,
  GroupAgentConfigEntry,
  GroupJobSpec,
  encodeGroupAgentConfig,
  parseGroupAgentConfig,
} from '@tloncorp/api/types/groupAgentConfig';
import {
  GroupTemplate,
  GroupTemplateId,
  deriveAgentGroupTitle,
  groupTemplatesById,
} from '@tloncorp/api/types/groupTemplates';
import { BotHomeGroupSlugs } from '@tloncorp/api/types/wayfinding';
import { getChannelKindFromType } from '@tloncorp/api/urbit';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as logic from '../logic';
import { getRandomId, withRetry } from '../logic';
import { pinGroup } from './channelActions';
import { createGroup } from './groupActions';
import { finalizeAndSendPost } from './postActions';

const logger = createDevLogger('agentOnboardingActions', false);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The real steps behind the onboarding "the group builds itself" card. The
 * UI staggers its checklist lines; these are the underlying units of work.
 */
export type AgentGroupBuildStep =
  | 'create-group'
  | 'write-config'
  | 'invite-agent';

export type AgentGroupBuildStepStatus = 'done' | 'failed' | 'skipped';

export interface CreateAgentGroupResult {
  group: db.Group;
  /** channel ids in template order */
  channelIds: string[];
  chatChannelId: string;
  config: GroupAgentConfigEntry;
  botShipId: string | null;
  botInvited: boolean;
}

/**
 * Create the onboarding agent group: group + channels from an agent template,
 * agent config written into the group meta description (stopgap for the
 * group blob field), the tlawn bot invited and asked to join, and the group
 * pinned. Only the group creation itself is fatal; config write retries and
 * the bot steps degrade to a `failed`/`skipped` report so the flow can land
 * the user regardless.
 */
export async function createAgentGroup(params: {
  templateId: GroupTemplateId;
  subject: string;
  onStep?: (
    step: AgentGroupBuildStep,
    status: AgentGroupBuildStepStatus
  ) => void;
}): Promise<CreateAgentGroupResult> {
  const template = groupTemplatesById[params.templateId];
  const agent = template?.agent;
  if (!template || !agent) {
    throw new Error(`Template ${params.templateId} has no agent config`);
  }

  const subject = params.subject.trim();
  const currentUserId = api.getCurrentUserId();
  const groupSlug = getRandomId();
  const groupId = `${currentUserId}/${groupSlug}`;
  const groupIconUrl = logic.getRandomDefaultPersonalGroupIcon();
  const title = deriveAgentGroupTitle(subject, template);

  // Resolve the bot before creating the group so it can ride the guest list.
  const { botShipId, hostedShipId, moon } = await resolveTlawnBot();

  const channels: db.Channel[] = template.channels.map((channelTemplate) => {
    const channelKind = getChannelKindFromType(channelTemplate.type);
    const channelId = `${channelKind}/${currentUserId}/${getRandomId()}`;
    return {
      id: channelId,
      groupId,
      type: channelTemplate.type,
      title: channelTemplate.title,
      description: channelTemplate.description,
      lastPostSequenceNum: 0,
      currentUserIsMember: true,
    };
  });

  const newGroup: db.Group = {
    id: groupId,
    title,
    iconImage: groupIconUrl,
    currentUserIsMember: true,
    isPersonalGroup: false,
    hostUserId: currentUserId,
    currentUserIsHost: true,
    privacy: 'secret',
    channels,
  };

  const group = await createGroup({
    group: newGroup,
    memberIds: botShipId ? [botShipId] : [],
    templateId: params.templateId,
  });
  params.onStep?.('create-group', 'done');

  pinGroup(group).catch((error) => {
    logger.trackError('Failed to pin agent onboarding group', { error });
  });

  const channelIds = channels.map((channel) => channel.id);
  const chatChannelIndex = Math.max(
    template.channels.findIndex((channel) => channel.type === 'chat'),
    0
  );
  const chatChannelId = channelIds[chatChannelIndex];

  const config = buildAgentGroupConfig({
    template,
    templateId: params.templateId,
    subject,
    channelIds,
    chatChannelId,
    botShipId,
  });

  try {
    await withRetry(() => writeAgentGroupConfig(group, config), {
      numOfAttempts: 3,
      startingDelay: 750,
      maxDelay: 4000,
    });
    params.onStep?.('write-config', 'done');
  } catch (error) {
    // `updateGroupMeta` resolves on a matching `/v2/groups` fact, which does
    // not always arrive for a group created moments earlier — the poke itself
    // still lands. Read the group back before telling the user we failed, so
    // the receipt reflects what actually persisted.
    const persisted = await configDidPersist(groupId);
    logger.trackError('Agent group config write unacknowledged', {
      error,
      groupId,
      persisted,
    });
    params.onStep?.('write-config', persisted ? 'done' : 'failed');
  }

  let botInvited = false;
  if (botShipId && hostedShipId && moon) {
    try {
      try {
        await api.addTlawnToCordon(hostedShipId, groupId, moon);
      } catch (error) {
        // Cordon add is best-effort: it fails when the moon is already
        // allowed. The join below is what must succeed.
        logger.trackError('Failed to add Tlonbot moon to cordon', { error });
      }
      await sleep(1500);
      await api.joinTlawnGroup(hostedShipId, groupId, moon);
      botInvited = true;
      params.onStep?.('invite-agent', 'done');
    } catch (error) {
      logger.trackError('Failed to join Tlonbot to agent group', {
        error,
        groupId,
      });
      params.onStep?.('invite-agent', 'failed');
    }
  } else {
    params.onStep?.('invite-agent', 'skipped');
  }

  logger.trackEvent('Agent Onboarding Group Created', {
    templateId: params.templateId,
    jobCount: config.jobs.length,
    botInvited,
    ...logic.getModelAnalytics({ group }),
  });

  return {
    group,
    channelIds,
    chatChannelId,
    config,
    botShipId,
    botInvited,
  };
}

/**
 * The hosted home group's chat channel: the venue for in-channel onboarding
 * (the live bot is already a member there). Prefers the locally-synced rows;
 * on a fresh signup the splash shows before sync runs, so for bot-enabled
 * accounts this falls back to the deterministic provisioning ids and lets
 * the landing consumer wait for the channel to sync in.
 */
export async function getHomeGroupOnboardingTarget(): Promise<{
  groupId: string;
  channelId: string;
} | null> {
  try {
    const currentUserId = api.getCurrentUserId();
    const groupId = `${currentUserId}/${BotHomeGroupSlugs.slug}`;
    const group = await db.getGroup({ id: groupId });
    if (group?.currentUserIsMember) {
      const chatChannel =
        group.channels?.find((channel) =>
          channel.id.endsWith(`/${BotHomeGroupSlugs.chatSlug}`)
        ) ?? group.channels?.find((channel) => channel.type === 'chat');
      if (chatChannel) {
        return { groupId, channelId: chatChannel.id };
      }
    }
    const hostingBotEnabled = await db.hostingBotEnabled.getValue();
    if (hostingBotEnabled) {
      return {
        groupId,
        channelId: `chat/${currentUserId}/${BotHomeGroupSlugs.chatSlug}`,
      };
    }
    return null;
  } catch (error) {
    logger.trackError('Failed to resolve home group onboarding target', {
      error,
    });
    return null;
  }
}

/**
 * The user's opening line, posted for real into the home group chat on first
 * run. The agent never opens a conversation on its own — it only reacts — so
 * without this the group sits on its canned welcome and nothing happens. The
 * agent conducts the setup from here (it engages without a mention because
 * the sender is the owner and the group is owner-hosted; see
 * `shouldEngageInGroup` in the openclaw plugin).
 */
export const AGENT_ONBOARDING_OPENING_MESSAGE =
  "Let's set this group up to do something useful. What can you do?";

/**
 * Post the opening move once per group. Idempotent via a persisted marker so
 * a relaunch mid-onboarding can't double-post; also skips when the user has
 * already said something themselves.
 */
export async function sendAgentOnboardingOpeningMessage(params: {
  groupId: string;
  channelId: string;
}): Promise<boolean> {
  try {
    const alreadySent = await db.agentOnboardingOpenedGroups.getValue();
    if (alreadySent.includes(params.groupId)) {
      return false;
    }
    // Claim the slot before sending so a crash mid-send can't cause a repeat.
    await db.agentOnboardingOpenedGroups.setValue((current) =>
      current.includes(params.groupId) ? current : [...current, params.groupId]
    );

    const currentUserId = api.getCurrentUserId();
    const existing = await db.getChanPosts({ channelId: params.channelId });
    if (existing.some((post) => post.authorId === currentUserId)) {
      // The user got there first — their message is the opening move.
      return false;
    }

    await finalizeAndSendPost({
      channelId: params.channelId,
      content: [AGENT_ONBOARDING_OPENING_MESSAGE],
      attachments: [],
      channelType: 'chat',
      replyToPostId: null,
    });
    logger.trackEvent('Agent Onboarding Opening Message Sent', {
      groupId: params.groupId,
    });
    return true;
  } catch (error) {
    logger.trackError('Failed to send agent onboarding opening message', {
      error,
      groupId: params.groupId,
    });
    return false;
  }
}

/**
 * Instantiate a template's agent block into a concrete config: substitute
 * the subject, resolve channel indexes to real channel ids, and pin cron
 * schedules to the local timezone.
 */
function buildAgentGroupConfig({
  template,
  templateId,
  subject,
  channelIds,
  chatChannelId,
  botShipId,
}: {
  template: GroupTemplate;
  templateId: GroupTemplateId;
  subject: string;
  channelIds: string[];
  chatChannelId: string;
  botShipId: string | null;
}): GroupAgentConfigEntry {
  const agent = template.agent;
  if (!agent) {
    throw new Error(`Template ${templateId} has no agent config`);
  }
  const timeZone = resolveLocalTimeZone();
  const substituteSubject = (value: string) =>
    value.replaceAll('{subject}', subject);

  const jobs: GroupJobSpec[] = agent.jobs.map((job) => ({
    id: job.id,
    title: substituteSubject(job.titleTemplate),
    schedule:
      job.scheduleDefault.kind === 'cron'
        ? {
            ...job.scheduleDefault,
            tz:
              job.scheduleDefault.tz === 'local'
                ? timeZone
                : job.scheduleDefault.tz,
          }
        : job.scheduleDefault,
    prompt: substituteSubject(job.promptTemplate),
    outputNest: channelIds[job.outputChannelIndex] ?? chatChannelId,
    announceNest:
      job.announceChannelIndex !== undefined
        ? channelIds[job.announceChannelIndex]
        : undefined,
    checkIn: job.checkIn,
    enabled: true,
  }));

  return {
    type: GROUP_AGENT_CONFIG_ENTRY_TYPE,
    version: 1,
    templateId,
    purpose: substituteSubject(agent.purposeTemplate),
    instructions: substituteSubject(agent.instructionsTemplate),
    agents: botShipId ? [botShipId] : [],
    jobs,
    updatedAt: Date.now(),
  };
}

/**
 * Write the encoded config into the group's meta description. Mirrors
 * `updateGroupMeta` but throws so callers can retry, and skips the analytics
 * meant for user-driven customization.
 */
async function writeAgentGroupConfig(
  group: db.Group,
  config: GroupAgentConfigEntry
) {
  const description = encodeGroupAgentConfig(config);
  await db.updateGroup({ id: group.id, description });
  await api.updateGroupMeta({
    groupId: group.id,
    meta: {
      title: group.title ?? '',
      description,
      cover: group.coverImage ?? group.coverImageColor ?? '',
      image: group.iconImage ?? group.iconImageColor ?? '',
    },
  });
}

/** Read the group back from the host to see whether the config landed. */
async function configDidPersist(groupId: string): Promise<boolean> {
  try {
    const group = await api.getGroup(groupId);
    return parseGroupAgentConfig(group.description) !== undefined;
  } catch (error) {
    logger.trackError('Failed to verify agent group config', {
      error,
      groupId,
    });
    return false;
  }
}

async function resolveTlawnBot(): Promise<{
  botShipId: string | null;
  hostedShipId: string | null;
  moon: string | null;
}> {
  try {
    const [hostingBotEnabled, hostedShipId] = await Promise.all([
      db.hostingBotEnabled.getValue(),
      db.hostedUserNodeId.getValue(),
    ]);
    if (!hostingBotEnabled || !hostedShipId) {
      return { botShipId: null, hostedShipId: null, moon: null };
    }
    const moon = await api.getTlawnMoon(hostedShipId);
    if (!moon) {
      return { botShipId: null, hostedShipId, moon: null };
    }
    return { botShipId: `~${moon}-${hostedShipId}`, hostedShipId, moon };
  } catch (error) {
    logger.trackError('Failed to resolve Tlonbot for agent onboarding', {
      error,
    });
    return { botShipId: null, hostedShipId: null, moon: null };
  }
}

function resolveLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}
