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

  ensureAgentAdminForGroup(group.id, botShipId).catch((error) => {
    logger.trackError('Failed to grant agent admin', {
      error,
      groupId: group.id,
    });
  });

  if (hostedShipId) {
    // The same resolved moon the invite went to — see `resolveTlawnBot`.
    const moon = desig(botShipId);
    // Fire-and-forget: the group already exists and the invite is out. The
    // reconciler retains retry debt and verifies the remote seat after joins.
    ensureHostedAgentJoined({
      hostedShipId,
      groupId: group.id,
      moon,
      botShipId,
    }).catch((error) => {
      logger.trackError('Failed to join agent to group', {
        error,
        groupId: group.id,
      });
    });
  }

  return { group, channelId };
}

type HostedAgentJoin = {
  hostedShipId: string;
  groupId: string;
  moon: string;
  botShipId: string;
};

type HostedAgentJoinDeps = {
  delays?: number[];
  sleep?: (ms: number) => Promise<unknown>;
  addToCordon?: typeof api.addTlawnToCordon;
  joinGroup?: typeof api.joinTlawnGroup;
  getGroup?: typeof api.getGroup;
  getLocalGroup?: typeof db.getGroup;
  getCurrentUserId?: typeof api.getCurrentUserId;
};

const hostedAgentJoinEnsuring = new Map<string, Promise<void>>();
const hostedAgentJoinRetryTimers = new Map<
  string,
  ReturnType<typeof setTimeout>
>();
const HOSTED_AGENT_JOIN_RETRY_DELAY_MS = 60_000;

function scheduleHostedAgentJoinRetry(params: HostedAgentJoin): void {
  if (hostedAgentJoinRetryTimers.has(params.groupId)) {
    return;
  }
  const timer = setTimeout(() => {
    hostedAgentJoinRetryTimers.delete(params.groupId);
    ensureHostedAgentJoined(params).catch((error) => {
      logger.trackError('Failed to reconcile hosted agent join', {
        error,
        groupId: params.groupId,
      });
    });
  }, HOSTED_AGENT_JOIN_RETRY_DELAY_MS);
  (timer as unknown as { unref?: () => void }).unref?.();
  hostedAgentJoinRetryTimers.set(params.groupId, timer);
}

async function reconcileHostedAgentJoin(
  params: HostedAgentJoin,
  deps: HostedAgentJoinDeps = {}
): Promise<void> {
  const delays = deps.delays ?? [1_500, 2_000, 5_000, 15_000];
  const wait = deps.sleep ?? sleep;
  const addToCordon = deps.addToCordon ?? api.addTlawnToCordon;
  const joinGroup = deps.joinGroup ?? api.joinTlawnGroup;
  const getGroup = deps.getGroup ?? api.getGroup;
  const getLocalGroup = deps.getLocalGroup ?? db.getGroup;
  const getCurrentUserId = deps.getCurrentUserId ?? api.getCurrentUserId;
  let lastError: unknown;

  const localGroupOwner = params.groupId.split('/')[0];
  if (localGroupOwner !== getCurrentUserId()) {
    return;
  }
  try {
    if (!(await getLocalGroup({ id: params.groupId }))) {
      return;
    }
  } catch (error) {
    logger.trackError('Failed to verify active hosted agent group', {
      error,
      groupId: params.groupId,
    });
    return;
  }

  for (const delay of delays) {
    if (delay) {
      await wait(delay);
    }
    try {
      const group = await getGroup(params.groupId);
      if (agentHasJoined(group, params.botShipId)) {
        return;
      }
    } catch (error) {
      lastError = error;
      logger.trackError('Failed to verify hosted agent seat', {
        error,
        groupId: params.groupId,
      });
    }

    try {
      await addToCordon(params.hostedShipId, params.groupId, params.moon);
    } catch (error) {
      // The moon may already be allowed; the verified join below decides.
      lastError = error;
      logger.trackError('Failed to add agent moon to cordon', { error });
    }
    try {
      await joinGroup(params.hostedShipId, params.groupId, params.moon);
    } catch (error) {
      lastError = error;
      logger.trackError('Hosted agent join attempt failed', {
        error,
        groupId: params.groupId,
      });
    }

    try {
      const group = await getGroup(params.groupId);
      if (agentHasJoined(group, params.botShipId)) {
        return;
      }
    } catch (error) {
      lastError = error;
      logger.trackError('Hosted agent join verification failed', {
        error,
        groupId: params.groupId,
      });
    }
  }

  scheduleHostedAgentJoinRetry(params);
  throw new Error(
    `Could not verify ${params.botShipId} joined ${params.groupId}: ${String(lastError ?? 'seat unavailable')}`
  );
}

function ensureHostedAgentJoined(params: HostedAgentJoin): Promise<void> {
  const existing = hostedAgentJoinEnsuring.get(params.groupId);
  if (existing) {
    return existing;
  }
  const run = reconcileHostedAgentJoin(params).finally(() => {
    hostedAgentJoinEnsuring.delete(params.groupId);
  });
  hostedAgentJoinEnsuring.set(params.groupId, run);
  return run;
}

const agentNotebookEnsuring = new Set<string>();
const agentNotebookRetryTimers = new Map<
  string,
  ReturnType<typeof setTimeout>
>();
const AGENT_NOTEBOOK_RETRY_DELAY_MS = 60_000;

function scheduleAgentNotebookRetry(groupId: string): void {
  if (agentNotebookRetryTimers.has(groupId)) {
    return;
  }
  const timer = setTimeout(() => {
    agentNotebookRetryTimers.delete(groupId);
    void (async () => {
      if (groupId.split('/')[0] !== api.getCurrentUserId()) {
        return;
      }
      let remote;
      try {
        remote = await api.getGroup(groupId);
      } catch (error) {
        logger.trackError('Failed to read agent notebook retry state', {
          error,
          groupId,
        });
        try {
          const localGroup = await db.getGroup({ id: groupId });
          if (localGroup) {
            scheduleAgentNotebookRetry(groupId);
          }
        } catch (localError) {
          // An unreadable local database cannot prove deletion. Preserve the
          // debt until a later retry can make the ownership decision.
          logger.trackError('Failed to verify local agent group retry state', {
            error: localError,
            groupId,
          });
          scheduleAgentNotebookRetry(groupId);
        }
        return;
      }
      const config = parseGroupAgentConfig(remote.description);
      const needsNotebook =
        Boolean(config?.jobs?.[0]) &&
        (config?.onboarding?.state === 'awaiting-notebook' ||
          config?.onboarding?.state === 'complete') &&
        !remote.channels?.some((channel) => channel.type === 'notes');
      if (!needsNotebook) {
        return;
      }
      await ensureAgentNotebookForGroup(remote);
    })().catch((error) => {
      logger.trackError('Failed to retry agent notebook reconciliation', {
        error,
        groupId,
      });
      scheduleAgentNotebookRetry(groupId);
    });
  }, AGENT_NOTEBOOK_RETRY_DELAY_MS);
  (timer as unknown as { unref?: () => void }).unref?.();
  agentNotebookRetryTimers.set(groupId, timer);
}

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
  if (!config?.onboarding) {
    return;
  }
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
  try {
    // "Daily digest: Nootropics, Coffee" names the notebook "Daily digest".
    const jobTitle = typeof job.title === 'string' ? job.title : '';
    const title = jobTitle.split(':')[0]?.trim() || 'Notebook';
    // The calling effect will not rerun after a failure, so retry here.
    const delays = [0, 2_000, 5_000, 15_000];
    for (const delay of delays) {
      if (delay) {
        await sleep(delay);
      }
      // Check the ship before every create, including the first attempt. A
      // previous process or device may already have created the notebook even
      // though this local store has never observed it.
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
      try {
        await createChannel({
          groupId: group.id,
          title,
          channelType: 'notes',
        });
        logger.trackEvent('Agent Notebook Created', { groupId: group.id });
        return;
      } catch (error) {
        logger.trackError('Failed to create agent notebook', {
          error,
          groupId: group.id,
          willRetry: delay !== delays[delays.length - 1],
        });
      }
    }
    if (
      config.onboarding.state === 'awaiting-notebook' ||
      config.onboarding.state === 'complete'
    ) {
      scheduleAgentNotebookRetry(group.id);
    }
  } finally {
    // The durable remote/local channel checks prevent duplicates. This guard
    // only serializes one reconciliation run; retaining it after success
    // would prevent repair if the notebook is later deleted or replaced.
    agentNotebookEnsuring.delete(group.id);
  }
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

const agentAdminEnsuring = new Map<string, Promise<void>>();

/**
 * Reconcile the agent's admin seat, sharing concurrent runs. The app-level
 * group observer calls this again when membership sync changes, so an agent
 * that joins after the initial bounded retry still receives the role.
 */
export function ensureAgentAdminForGroup(
  groupId: string,
  botShipId: string
): Promise<void> {
  const existing = agentAdminEnsuring.get(groupId);
  if (existing) {
    return existing;
  }
  const run = grantAgentAdmin(groupId, botShipId).finally(() => {
    agentAdminEnsuring.delete(groupId);
  });
  agentAdminEnsuring.set(groupId, run);
  return run;
}

export const _testing = {
  grantAgentAdmin,
  reconcileHostedAgentJoin,
  clearAgentNotebookRetries: () => {
    for (const timer of agentNotebookRetryTimers.values()) {
      clearTimeout(timer);
    }
    agentNotebookRetryTimers.clear();
  },
  clearHostedAgentJoinRetries: () => {
    for (const timer of hostedAgentJoinRetryTimers.values()) {
      clearTimeout(timer);
    }
    hostedAgentJoinRetryTimers.clear();
  },
};

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
    await Promise.all([
      db.agentGroupAgents.setValue((current) => ({
        ...current,
        [groupId]: botShipId,
      })),
      db.agentGroupOpenedAt.setValue((current) => ({
        ...current,
        [groupId]: Date.now(),
      })),
    ]);
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

type HomeGroupOnboardingTarget = {
  groupId: string;
  channelId: string;
};

export type HomeGroupOnboardingResolution =
  | { status: 'pending' }
  | { status: 'fallback' }
  | { status: 'target'; target: HomeGroupOnboardingTarget };

/** Distinguish asynchronous provisioning from a home group already in use. */
export async function resolveHomeGroupOnboarding(): Promise<HomeGroupOnboardingResolution> {
  try {
    const currentUserId = api.getCurrentUserId();
    const groupId = `${currentUserId}/${BotHomeGroupSlugs.slug}`;
    const targetFor = (
      group: {
        currentUserIsMember?: boolean | null;
        description?: string | null;
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
    const hostingBotEnabled = await db.hostingBotEnabled.getValue();
    if (!hostingBotEnabled) {
      return { status: 'fallback' };
    }
    // Sync may trail provisioning, but a ship scry can prove the target exists.
    // If it cannot, keep the splash fallback instead of arming an endless
    // landing poll for a synthetic channel that may never be created.
    const remoteGroup = await api.getGroup(groupId);
    const target = targetFor(remoteGroup);
    if (!target) {
      return { status: 'pending' };
    }
    const config = parseGroupAgentConfig(remoteGroup.description);
    if (config) {
      return config.onboarding && config.onboarding.state !== 'complete'
        ? { status: 'target', target }
        : { status: 'fallback' };
    }
    const history = await api.getChannelPosts({
      channelId: target.channelId,
      mode: 'newest',
      count: 20,
    });
    return history.posts.some((post) => post.authorId === currentUserId)
      ? { status: 'fallback' }
      : { status: 'target', target };
  } catch (error) {
    logger.trackError('Failed to resolve home group onboarding target', {
      error,
    });
    return { status: 'pending' };
  }
}

/** Resolve only after the provisioned home-group channel is actually visible. */
export async function getHomeGroupOnboardingTarget(): Promise<HomeGroupOnboardingTarget | null> {
  const resolution = await resolveHomeGroupOnboarding();
  return resolution.status === 'target' ? resolution.target : null;
}
