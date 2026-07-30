import * as api from '@tloncorp/api';
import { BotHomeGroupSlugs } from '@tloncorp/api/types/wayfinding';

import * as db from '../db';
import { createDevLogger } from '../debug';
import { finalizeAndSendPost } from './postActions';

const logger = createDevLogger('agentOnboardingActions', false);

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
const AGENT_ONBOARDING_OPENING_MESSAGE =
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
