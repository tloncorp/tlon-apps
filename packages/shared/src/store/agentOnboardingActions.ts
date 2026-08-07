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
import { createChannel } from './channelActions';
import { createDefaultGroup } from './groupActions';

const logger = createDevLogger('agentOnboardingActions', false);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * How long the agent-marker write may take to look up the group before it
 * stops being safe to write. See `writeAgentMarker`.
 */
const MARKER_WRITE_DEADLINE_MS = 5_000;

/**
 * Create a group whose resident is the user's agent: a default group with
 * the bot on the guest list. The agent opens the conversation itself once
 * it joins — it posts the purpose picker into the empty channel — so the
 * caller just navigates there. The invite is what the agent's auto-accept
 * reacts to; the hosting join below is belt-and-braces for hosted moons.
 * Either failing only means the group starts without the bot, which the
 * user can see and fix by inviting it.
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

  // Remember who the agent is from the client's own side. The config in the
  // description says so too, but the agent writes that itself — when it writes
  // it wrong, this is what keeps its cards rendering.
  await db.agentGroupAgents
    .setValue((current) => ({ ...current, [group.id]: botShipId }))
    .catch((error) => {
      logger.trackError('Failed to record group agent', {
        error,
        groupId: group.id,
      });
    });

  // Stamp when the opening began, so the empty-channel notice can stop
  // waiting on an agent that never arrives. Only here, not in
  // `recordHomeGroupAgent`: this is the moment an opening is actually
  // imminent, and a device adopting an existing group later should not
  // restart the clock on a conversation that opened long ago.
  await db.agentGroupOpenedAt
    .setValue((current) => ({ ...current, [group.id]: Date.now() }))
    .catch((error) => {
      logger.trackError('Failed to record agent opening time', {
        error,
        groupId: group.id,
      });
    });

  // Declare the agent on the group so other clients (and a re-installed one,
  // whose local record above is gone) recognize its cards too — see
  // `isOwnAgentShip`. A bare declaration — who acts, not what the group does
  // — so the agent still treats the group as awaiting setup. Best effort:
  // without it the cards degrade to text.
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
async function writeAgentMarker(group: db.Group, botShipId: string) {
  // Fire-and-forget, so it can land after the agent has already written the
  // real config. Re-read from the *ship*, not the local DB: the agent's
  // write reaches the local row only via sync, so a stale local read could
  // pass the guard while the ship already carries a finished setup — and
  // this bare marker would replace its purpose and jobs, leaving the group
  // looking unconfigured with its scheduled job orphaned. Skip on any
  // existing config entry (whoever wrote it), and skip when the ship can't
  // be read at all — writing blind risks the same clobber, and the marker
  // is best-effort belt-and-braces (`agentGroupAgents` is the primary
  // signal).
  // The guard below is a check, not a compare-and-set: `updateGroupMeta`
  // replaces the whole meta, so a config written between the read and the
  // poke landing is simply lost — and losing it is worse than losing the
  // marker, because the group then looks unconfigured while its scheduled
  // job keeps running unowned. Nothing makes the pair atomic, so bound the
  // race instead: the group is milliseconds old here and the agent cannot
  // configure it until the user has tapped through the picker, so we are
  // comfortably first unless this write is already slow. If it is, give up
  // — a missing marker only degrades the agent's cards to text.
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
  // Meta comes from the ship's current group, not the creation-time
  // snapshot: this poke replaces the whole meta object, and by the time a
  // slow marker lands the agent may already have renamed and iconed the
  // group mid-setup.
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

/**
 * Create the setup's output notebook as the owner, the moment the group's
 * config gains a job. The notebook is the owner's channel, hosted on the
 * owner's ship — the agent only ever posts *into* it. Reactive to the
 * config write because that is the first moment the client knows the setup
 * produced a job (and what to call it), and the owner is being held in the
 * guided channel right then, so the app is foregrounded and the channel
 * exists before the agent's first run goes looking for it. Best effort and
 * idempotent: an existing notes channel means nothing to do, and the agent
 * falls back to chat output when no notebook ever appears.
 */
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
  // Retry here rather than leaving the debt to the caller. Clearing the
  // in-flight guard was never a retry: the effect that calls this is keyed
  // on the group's description and channel count, and a failed create
  // changes neither — so one transient error left the configured job with
  // no notebook until a remount or some unrelated group change, and the
  // agent's day-one entry had nowhere to go.
  const delays = [0, 2_000, 5_000, 15_000];
  for (const delay of delays) {
    if (delay) {
      await sleep(delay);
      // Ask the ship, not the local DB. `createChannel` can throw after the
      // channel is already made — its own verification reads the groups
      // listing, which may be unreadable for a moment — and the local row
      // only appears once sync catches up. A local check would therefore
      // still say "no notebook" for a notebook that exists, and every
      // retry would mint another one. Duplicates are permanent and the
      // owner sees them; a missing notebook is recoverable.
      let remote;
      try {
        remote = await api.getGroup(group.id);
      } catch {
        // Can't tell whether the create landed, so stop guessing. The
        // guard is released below and a later pass starts over.
        break;
      }
      if (remote.channels?.some((channel) => channel.type === 'notes')) {
        return;
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

/**
 * Give the agent the admin role, so it can build the group it was invited
 * into — renaming it and adding the output channel are admin writes, and a
 * plain member's pokes are silently dropped by the host. The role lands on
 * the agent's seat, which only exists once it accepts the invite, so retry
 * across that window; the poke is idempotent.
 */
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
    // The hosting API returns either the bare moon prefix ("molten") or the
    // full moon name, sigged or not — the bot-settings helper tolerates both
    // shapes, so this must too, or the guest list invites a ship that
    // doesn't exist.
    const host = desig(hostedShipId.trim());
    const prefix = desig(moon.trim());
    const full = prefix.endsWith(`-${host}`) ? prefix : `${prefix}-${host}`;
    return { botShipId: api.preSig(full), hostedShipId, moon };
  } catch (error) {
    logger.trackError('Failed to resolve Tlonbot for agent group', { error });
    return { botShipId: null, hostedShipId: null, moon: null };
  }
}

/**
 * Record the home group's agent from the hosting config, so the client
 * recognizes the bot's posts as its own agent's (see `isOwnAgentShip`) from
 * the very first picker card — before the group carries any config naming
 * it. The client never seated this agent itself (provisioning did), so this
 * is where its first-hand record comes from: the hosting API's node + moon,
 * not the shape of the author's ship name. Best effort — without it the
 * opening cards degrade to their text fallbacks until the setup writes the
 * config's `agents` list.
 */
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

/**
 * Make sure the home group's agent is recorded on *this* device. The splash
 * sequence records it during first-run signup, but that runs once per
 * account, not per device — a re-login or second device would otherwise have
 * no first-hand agent record, and the bot's onboarding cards would degrade
 * to text until setup writes the config's `agents` list (which the cards
 * themselves are the path to). Cheap and idempotent: skipped outright for
 * accounts without a hosted bot or with the record already present.
 */
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
