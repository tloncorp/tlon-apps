import * as api from '@tloncorp/api';
import { BotHomeGroupSlugs } from '@tloncorp/api/types/wayfinding';

import * as db from '../db';
import { createDevLogger } from '../debug';
import { createDefaultGroup } from './groupActions';

const logger = createDevLogger('agentOnboardingActions', false);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create a group whose resident is the user's agent: a default group (one
 * chat channel) with the bot on the guest list. The agent opens the
 * conversation itself once it joins — it posts the purpose picker into the
 * empty channel — so there is nothing else to set up client-side; the caller
 * just navigates to the channel.
 *
 * The invite on the guest list is what the agent's own auto-accept reacts
 * to. The hosting join call below is belt-and-braces for hosted moons whose
 * agent isn't watching invites at that moment; both failing only means the
 * group starts without the bot, which the user can see and fix by inviting
 * it, so neither is fatal.
 */
export async function createAgentGroup(params?: {
  /**
   * Agent ship named directly instead of resolved through hosting — for
   * environments without a hosted node (dev sandbox, self-hosted bot).
   */
  agentShipId?: string;
}): Promise<{
  group: db.Group;
  channelId: string | null;
}> {
  const { botShipId, hostedShipId, moon } = params?.agentShipId
    ? {
        botShipId: api.preSig(params.agentShipId),
        hostedShipId: null,
        moon: null,
      }
    : await resolveTlawnBot();
  if (!botShipId) {
    throw new Error(
      'Your agent isn’t available right now — try again in a moment.'
    );
  }

  const group = await createDefaultGroup({ memberIds: [botShipId] });
  const channelId = group.channels?.[0]?.id ?? null;

  logger.trackEvent('Agent Group Created', {
    groupId: group.id,
    botShipId,
  });

  // Declare the agent on the group so its interactive cards render for the
  // owner even when the agent isn't a moon of their ship (see
  // `isOwnAgentShip`). A bare declaration — who acts, not what the group
  // does — so the agent still treats the group as awaiting setup. Best
  // effort: without it the cards degrade to their text fallback.
  writeAgentMarker(group, botShipId).catch((error) => {
    logger.trackError('Failed to write agent marker', {
      error,
      groupId: group.id,
    });
  });

  if (hostedShipId && moon) {
    // Fire-and-forget: the group already exists and the invite is out.
    (async () => {
      try {
        await api.addTlawnToCordon(hostedShipId, group.id, moon);
      } catch (error) {
        // Fails when the moon is already allowed; the join is what matters.
        logger.trackError('Failed to add agent moon to cordon', { error });
      }
      try {
        await sleep(1500);
        await api.joinTlawnGroup(hostedShipId, group.id, moon);
      } catch (error) {
        logger.trackError('Failed to join agent to group', {
          error,
          groupId: group.id,
        });
      }
    })();
  }

  return { group, channelId };
}

/**
 * The group-agent-config stopgap entry naming the group's agent, written into
 * `meta.description` (matching `parseGroupAgentConfig` in @tloncorp/api). The
 * agent itself fills in purpose and jobs during onboarding.
 */
function writeAgentMarker(group: db.Group, botShipId: string) {
  const entry = {
    type: 'tlon-group-agent-config',
    version: 1,
    purpose: '',
    instructions: '',
    agents: [botShipId],
    jobs: [],
    updatedAt: Date.now(),
  };
  return api.updateGroupMeta({
    groupId: group.id,
    meta: {
      title: group.title ?? '',
      description: JSON.stringify([entry]),
      image: group.iconImage ?? group.iconImageColor ?? '',
      cover: group.coverImage ?? group.coverImageColor ?? '',
    },
  });
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
    logger.trackError('Failed to resolve Tlonbot for agent group', { error });
    return { botShipId: null, hostedShipId: null, moon: null };
  }
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
