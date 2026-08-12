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

  const marker = {
    type: GROUP_AGENT_CONFIG_ENTRY_TYPE,
    version: 1,
    purpose: '',
    instructions: '',
    agents: [botShipId],
    jobs: [],
    updatedAt: Date.now(),
  } satisfies GroupAgentConfigEntry;
  const group = await createDefaultGroup({
    memberIds: [botShipId],
    description: JSON.stringify([marker]),
  });
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
      } catch (error) {
        // Never create while an earlier result is unknowable, but retain the
        // retry debt: a later scry may prove whether creation is still needed.
        logger.trackError('Failed to verify agent notebook retry', {
          error,
          groupId: group.id,
        });
        continue;
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

type GrantAgentAdminDeps = {
  delays?: number[];
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<unknown>;
  getGroup?: typeof api.getGroup;
  addMembersToRole?: typeof api.addMembersToRole;
};

function agentHasAdminRole(
  group: Awaited<ReturnType<typeof api.getGroup>>,
  botShipId: string
) {
  const agent = group.members?.find(
    (member) => member.contactId === botShipId && member.status !== 'invited'
  );
  return Boolean(
    agent?.roles?.some((role: unknown) => {
      if (typeof role === 'string') {
        return role === 'admin';
      }
      if (!role || typeof role !== 'object') {
        return false;
      }
      const candidate = role as { roleId?: unknown; id?: unknown };
      return candidate.roleId === 'admin' || candidate.id === 'admin';
    })
  );
}

function agentHasJoined(
  group: Awaited<ReturnType<typeof api.getGroup>>,
  botShipId: string
) {
  return Boolean(
    group.members?.some(
      (member) => member.contactId === botShipId && member.status !== 'invited'
    )
  );
}

async function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/** Retry the admin grant across the agent's invite-accept window. */
async function grantAgentAdmin(
  groupId: string,
  botShipId: string,
  deps: GrantAgentAdminDeps = {}
) {
  const delays = deps.delays ?? [0, 1_000, 2_000, 3_000, 5_000, 8_000, 13_000];
  const timeoutMs = deps.timeoutMs ?? 5_000;
  const wait = deps.sleep ?? sleep;
  const getGroup = deps.getGroup ?? api.getGroup;
  const addMembersToRole = deps.addMembersToRole ?? api.addMembersToRole;
  let lastError: unknown;

  for (const delay of delays) {
    if (delay) {
      await wait(delay);
    }
    let group: Awaited<ReturnType<typeof api.getGroup>>;
    try {
      group = await withTimeout(() => getGroup(groupId), timeoutMs);
    } catch (error) {
      lastError = error;
      logger.trackError('Agent admin seat check failed', {
        error,
        groupId,
      });
      continue;
    }
    if (agentHasAdminRole(group, botShipId)) {
      return;
    }
    if (!agentHasJoined(group, botShipId)) {
      continue;
    }

    try {
      await withTimeout(
        () =>
          addMembersToRole({
            groupId,
            roleId: 'admin',
            ships: [botShipId],
          }),
        timeoutMs
      );
    } catch (error) {
      // A lost ack is ambiguous: the role may already have landed. Verify
      // remotely below before deciding whether another poke is necessary.
      lastError = error;
      logger.trackError('Agent admin grant attempt failed', {
        error,
        groupId,
      });
    }

    try {
      group = await withTimeout(() => getGroup(groupId), timeoutMs);
      if (agentHasAdminRole(group, botShipId)) {
        return;
      }
    } catch (error) {
      lastError = error;
      logger.trackError('Agent admin grant verification failed', {
        error,
        groupId,
      });
    }
  }
  throw new Error(
    `Could not grant ${botShipId} admin in ${groupId}: ${String(lastError ?? 'agent seat unavailable')}`
  );
}

export const _testing = { grantAgentAdmin };

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

/** Resolve only after the provisioned home-group channel is actually visible. */
export async function getHomeGroupOnboardingTarget(): Promise<{
  groupId: string;
  channelId: string;
} | null> {
  try {
    const currentUserId = api.getCurrentUserId();
    const groupId = `${currentUserId}/${BotHomeGroupSlugs.slug}`;
    const targetFor = (
      group: {
        currentUserIsMember?: boolean | null;
        channels?: { id: string; type?: string | null }[] | null;
      } | null
    ) => {
      if (!group?.currentUserIsMember) {
        return null;
      }
      const chatChannel =
        group.channels?.find((channel) =>
          channel.id.endsWith(`/${BotHomeGroupSlugs.chatSlug}`)
        ) ?? group.channels?.find((channel) => channel.type === 'chat');
      return chatChannel ? { groupId, channelId: chatChannel.id } : null;
    };
    const localTarget = targetFor(await db.getGroup({ id: groupId }));
    if (localTarget) {
      return localTarget;
    }
    const hostingBotEnabled = await db.hostingBotEnabled.getValue();
    if (!hostingBotEnabled) {
      return null;
    }
    // Sync may trail provisioning, but a ship scry can prove the target exists.
    // If it cannot, keep the splash fallback instead of arming an endless
    // landing poll for a synthetic channel that may never be created.
    return targetFor(await api.getGroup(groupId));
  } catch (error) {
    logger.trackError('Failed to resolve home group onboarding target', {
      error,
    });
    return null;
  }
}
