import * as api from '@tloncorp/api';
import { desig } from '@tloncorp/api/lib/urbit';
import {
  GROUP_AGENT_CONFIG_ENTRY_TYPE,
  GroupAgentConfigEntry,
  parseGroupAgentConfig,
} from '@tloncorp/api/types/groupAgentConfig';
import { BotHomeGroupSlugs } from '@tloncorp/api/types/wayfinding';

import * as db from '../db';
import { createDevLogger } from '../debug';
import { createChannel, hydrateExistingNotesChannel } from './channelActions';
import { createDefaultGroup } from './groupActions';
import { syncNotesNotebook } from './notesActions';

const logger = createDevLogger('agentOnboardingActions', false);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const MARKER_WRITE_DEADLINE_MS = 5_000;

/** Create a default group with the user's agent seated. */
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
  const { botShipId, hostedShipId } = params?.agentShipId
    ? {
        botShipId: api.preSig(params.agentShipId),
        hostedShipId: null,
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

  // First-hand identity keeps cards trusted before config exists.
  await db.agentGroupAgents
    .setValue((current) => ({ ...current, [group.id]: botShipId }))
    .catch((error) => {
      logger.trackError('Failed to record group agent', {
        error,
        groupId: group.id,
      });
    });

  // Bounds how long the empty-channel UI waits for the agent to open.
  await db.agentGroupOpenedAt
    .setValue((current) => ({ ...current, [group.id]: Date.now() }))
    .catch((error) => {
      logger.trackError('Failed to record agent opening time', {
        error,
        groupId: group.id,
      });
    });

  // Best-effort durable identity for other devices.
  writeAgentMarker(group, botShipId).catch((error) => {
    logger.trackError('Failed to write agent marker', {
      error,
      groupId: group.id,
    });
  });

  grantAgentAdmin(group.id, botShipId).catch((error) => {
    logger.trackError('Failed to grant agent admin', {
      error,
      groupId: group.id,
    });
  });

  if (hostedShipId) {
    // The same resolved moon the invite went to — see `resolveTlawnBot`.
    const moon = desig(botShipId);
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

async function writeAgentMarker(group: db.Group, botShipId: string) {
  // Re-read from the ship and abandon slow writes rather than overwrite a
  // newer config; the meta update is not a compare-and-set.
  const deadline = Date.now() + MARKER_WRITE_DEADLINE_MS;
  const current = await api.getGroup(group.id).catch(() => null);
  if (!current || parseGroupAgentConfig(current.description) !== undefined) {
    return;
  }
  if (Date.now() > deadline) {
    logger.trackEvent('Agent Marker Skipped', {
      groupId: group.id,
      reason: 'stale read',
    });
    return;
  }
  const entry = {
    type: GROUP_AGENT_CONFIG_ENTRY_TYPE,
    version: 1,
    purpose: '',
    instructions: '',
    agents: [botShipId],
    jobs: [],
    updatedAt: Date.now(),
  } satisfies GroupAgentConfigEntry;
  // Carry every current meta field because the poke replaces the whole meta.
  const meta = current;
  return api.updateGroupMeta({
    groupId: group.id,
    meta: {
      title: meta.title ?? '',
      description: JSON.stringify([entry]),
      image: meta.iconImage ?? meta.iconImageColor ?? '',
      cover: meta.coverImage ?? meta.coverImageColor ?? '',
    },
  });
}

const agentNotebookEnsuring = new Set<string>();

/** Ensure the configured job has one owner-hosted notes channel. */
export async function ensureAgentNotebookForGroup(group: {
  id: string;
  description?: string | null;
  channels?: { type?: string | null }[] | null;
}): Promise<void> {
  const currentUserId = api.getCurrentUserId();
  if (group.id.split('/')[0] !== currentUserId) {
    return;
  }
  const config = parseGroupAgentConfig(group.description);
  const job = config?.jobs?.[0] as { title?: unknown } | undefined;
  if (!job) {
    return;
  }
  if (group.channels?.some((channel) => channel.type === 'notes')) {
    return;
  }
  if (agentNotebookEnsuring.has(group.id)) {
    return;
  }
  agentNotebookEnsuring.add(group.id);
  // "Daily digest: Nootropics, Coffee" names the notebook "Daily digest".
  const jobTitle = typeof job.title === 'string' ? job.title : '';
  const title = jobTitle.split(':')[0]?.trim() || 'Notebook';
  // The calling effect will not rerun after a failure, so retry here.
  const delays = [0, 2_000, 5_000, 15_000];
  for (const delay of delays) {
    if (delay) {
      await sleep(delay);
      // Remote read-back prevents duplicates after an ambiguous create.
      let remote;
      try {
        remote = await api.getGroup(group.id);
      } catch {
        // Never create again while an earlier result is unknowable.
        break;
      }
      const remoteNotebook = remote.channels?.find(
        (channel) => channel.type === 'notes'
      );
      if (remoteNotebook) {
        try {
          const adopted = await hydrateExistingNotesChannel(remote);
          const flag = api.parseNotesChannelId(adopted?.id);
          if (flag) {
            syncNotesNotebook(flag).catch((error) => {
              logger.trackError('Failed to sync adopted agent notebook', {
                error,
                groupId: group.id,
                channelId: adopted?.id,
              });
            });
          }
          logger.trackEvent('Agent Notebook Adopted', {
            groupId: group.id,
            channelId: adopted?.id,
          });
          return;
        } catch (error) {
          // The remote notebook is real, so never call create again here.
          // Retry only the local adoption on the next delay.
          logger.trackError('Failed to adopt existing agent notebook', {
            error,
            groupId: group.id,
            channelId: remoteNotebook.id,
          });
          continue;
        }
      }
    }
    try {
      await createChannel({
        groupId: group.id,
        title,
        channelType: 'notes',
      });
      logger.trackEvent('Agent Notebook Created', { groupId: group.id });
      // Guard stays set: from here the notes-channel check above is the
      // durable one.
      return;
    } catch (error) {
      logger.trackError('Failed to create agent notebook', {
        error,
        groupId: group.id,
        willRetry: delay !== delays[delays.length - 1],
      });
    }
  }
  // Every attempt failed. Release the guard so a later config sync — or the
  // owner reopening the group — can start over.
  agentNotebookEnsuring.delete(group.id);
}

/** Retry the admin grant across the agent's invite-accept window. */
async function grantAgentAdmin(groupId: string, botShipId: string) {
  const delays = [0, 3_000, 5_000, 10_000, 20_000, 30_000];
  for (const delay of delays) {
    if (delay) {
      await sleep(delay);
    }
    try {
      await api.addMembersToRole({
        groupId,
        roleId: 'admin',
        ships: [botShipId],
      });
      const synced = await db.getGroup({ id: groupId });
      const agent = synced?.members?.find(
        (member) => member.contactId === botShipId
      );
      if (agent?.roles?.some((role) => role.roleId === 'admin')) {
        return;
      }
    } catch (error) {
      logger.trackError('Agent admin grant attempt failed', {
        error,
        groupId,
      });
    }
  }
}

/** Resolve the hosting API's moon prefix to one unambiguous full ship. */
async function resolveTlawnBot(): Promise<{
  botShipId: string | null;
  hostedShipId: string | null;
}> {
  try {
    const [hostingBotEnabled, hostedShipId] = await Promise.all([
      db.hostingBotEnabled.getValue(),
      db.hostedUserNodeId.getValue(),
    ]);
    if (!hostingBotEnabled || !hostedShipId) {
      return { botShipId: null, hostedShipId: null };
    }
    const moon = await api.getTlawnMoon(hostedShipId);
    if (!moon) {
      return { botShipId: null, hostedShipId };
    }
    const host = desig(hostedShipId.trim());
    const prefix = desig(moon.trim());
    const full = prefix.endsWith(`-${host}`) ? prefix : `${prefix}-${host}`;
    return { botShipId: api.preSig(full), hostedShipId };
  } catch (error) {
    logger.trackError('Failed to resolve Tlonbot for agent group', { error });
    return { botShipId: null, hostedShipId: null };
  }
}

/** Record first-hand home-group agent identity before config exists. */
export async function recordHomeGroupAgent(groupId: string): Promise<void> {
  try {
    const { botShipId } = await resolveTlawnBot();
    if (!botShipId) {
      return;
    }
    await db.agentGroupAgents.setValue((current) => ({
      ...current,
      [groupId]: botShipId,
    }));
  } catch (error) {
    logger.trackError('Failed to record home group agent', {
      error,
      groupId,
    });
  }
}

/** Restore the same identity record after a login on another device. */
export async function ensureHomeGroupAgentRecorded(): Promise<void> {
  try {
    const botEnabled = await db.hostingBotEnabled.getValue();
    if (!botEnabled) {
      return;
    }
    const currentUserId = api.getCurrentUserId();
    const groupId = `${currentUserId}/${BotHomeGroupSlugs.slug}`;
    const recorded = await db.agentGroupAgents.getValue();
    if (recorded[groupId]) {
      return;
    }
    await recordHomeGroupAgent(groupId);
  } catch (error) {
    logger.trackError('Failed to ensure home group agent record', { error });
  }
}

/** Resolve locally, falling back to deterministic provisioning IDs. */
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
