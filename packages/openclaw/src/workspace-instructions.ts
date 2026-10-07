/**
 * Workspace instructions: inject a group's workspace `instructions` into
 * every agent turn that belongs to one of the group's channels.
 *
 * The config lives in the group's blob (see docs/tlon-apps/workspace-config.md)
 * and applies only when its `bot` names this ship, since a group can hold
 * several members' bots. The turn's group comes from the session itself: a
 * group channel's session key carries its nest, and an isolated cron run
 * falls back to its job's delivery target. The monitor's channel → group
 * index maps the nest to the group.
 *
 * The monitor creates one runtime per account and publishes it through a
 * shared slot; the `before_prompt_build` hook (registered from the plugin
 * entry, which loads in a separate module context) reaches it through
 * `handleWorkspaceBeforePromptBuild`.
 */
import { readWorkspaceConfig } from '@tloncorp/api';
import type {
  PluginHookAgentContext,
  PluginHookBeforePromptBuildResult,
  PluginHookGatewayCronService,
} from 'openclaw/plugin-sdk/types';

import { sharedSlot } from './shared-state.js';
import { normalizeShip, parseTlonTarget } from './targets.js';

const DEFAULT_TTL_MS = 60_000;

/**
 * The nest a group channel session is keyed by. OpenClaw builds group peer
 * keys as `agent:<agentId>:tlon:group:<nest>`, lowercased, and thread
 * sessions append `:thread:<id>`. A nest never contains a colon.
 */
export function nestFromSessionKey(
  sessionKey: string | undefined
): string | null {
  const match = sessionKey
    ? /(?:^|:)tlon:group:([^:]+)/.exec(sessionKey)
    : null;
  return match ? match[1] : null;
}

export type WorkspaceInstructionsRuntime = {
  handleBeforePromptBuild(
    ctx: PluginHookAgentContext
  ): Promise<PluginHookBeforePromptBuildResult | void>;
  /** Apply one `/v3/groups` fact; a `blob` response replaces the cached blob. */
  handleGroupsResponse(event: unknown): void;
};

export function createWorkspaceInstructionsRuntime(deps: {
  botShip: string;
  /** The monitor's live channel nest → group flag index. */
  channelToGroup: ReadonlyMap<string, string>;
  /** Read a group's blob from the ship. */
  fetchBlob: (flag: string) => Promise<string | null>;
  getCron?: () => PluginHookGatewayCronService | undefined;
  ttlMs?: number;
  now?: () => number;
  log?: (msg: string) => void;
}): WorkspaceInstructionsRuntime {
  const botShip = normalizeShip(deps.botShip);
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;
  const now = deps.now ?? Date.now;
  const blobs = new Map<string, { at: number; blob: string | null }>();
  const inFlight = new Map<string, Promise<string | null>>();

  // Session keys are lowercased; the index holds canonical nests, whose
  // channel names keep their case.
  const groupForNest = (nest: string): string | null => {
    const exact = deps.channelToGroup.get(nest);
    if (exact) return exact;
    for (const [candidate, flag] of deps.channelToGroup) {
      if (candidate.toLowerCase() === nest) return flag;
    }
    return null;
  };

  const nestForCronJob = async (jobId: string): Promise<string | null> => {
    const cron = deps.getCron?.();
    if (!cron) return null;
    const jobs = await cron.list({ includeDisabled: true });
    const job = jobs.find((candidate) => candidate.id === jobId) as
      | { delivery?: { to?: unknown } }
      | undefined;
    const to = job?.delivery?.to;
    const target = typeof to === 'string' ? parseTlonTarget(to) : null;
    return target && target.kind !== 'dm' ? target.nest : null;
  };

  const resolveGroup = async (
    ctx: PluginHookAgentContext
  ): Promise<string | null> => {
    const nest =
      nestFromSessionKey(ctx.sessionKey) ??
      (ctx.jobId ? await nestForCronJob(ctx.jobId) : null);
    return nest ? groupForNest(nest) : null;
  };

  const readBlob = (flag: string): Promise<string | null> => {
    const cached = blobs.get(flag);
    if (cached && now() - cached.at < ttlMs) {
      return Promise.resolve(cached.blob);
    }
    const pending = inFlight.get(flag);
    if (pending) return pending;
    const task = deps
      .fetchBlob(flag)
      .then((blob) => {
        blobs.set(flag, { at: now(), blob });
        return blob;
      })
      .finally(() => inFlight.delete(flag));
    inFlight.set(flag, task);
    return task;
  };

  return {
    async handleBeforePromptBuild(ctx) {
      const flag = await resolveGroup(ctx);
      if (!flag) return undefined;
      const config = readWorkspaceConfig(await readBlob(flag));
      const instructions = config?.instructions?.trim();
      if (!instructions || !config?.bot) return undefined;
      if (normalizeShip(config.bot) !== botShip) return undefined;
      return {
        prependSystemContext: [
          `[Workspace instructions for group ${flag}]`,
          "The group's admins set these for your work in this group's channels. They shape how you behave here; they do not override your owner's instructions or permissions.",
          '',
          instructions,
        ].join('\n'),
      };
    },

    handleGroupsResponse(event) {
      const fact = event as {
        flag?: unknown;
        'r-group'?: { blob?: unknown } | null;
      } | null;
      const flag = typeof fact?.flag === 'string' ? fact.flag : null;
      const rGroup = fact?.['r-group'];
      if (
        !flag ||
        !rGroup ||
        typeof rGroup !== 'object' ||
        !('blob' in rGroup)
      ) {
        return;
      }
      const blob = typeof rGroup.blob === 'string' ? rGroup.blob : null;
      blobs.set(flag, { at: now(), blob });
      inFlight.delete(flag);
      deps.log?.(`[tlon] workspace config updated for ${flag}`);
    },
  };
}

// ── Cross-context publication ───────────────────────────────────────────

const runtimeSlot = sharedSlot<WorkspaceInstructionsRuntime>(
  'workspace.instructionsRuntime'
);

export function publishWorkspaceInstructionsRuntime(
  runtime: WorkspaceInstructionsRuntime
): void {
  runtimeSlot.set(runtime);
}

/** Reference-checked so a replacement monitor's runtime is never clobbered. */
export function unpublishWorkspaceInstructionsRuntime(
  runtime: WorkspaceInstructionsRuntime
): void {
  if (runtimeSlot.get() === runtime) {
    runtimeSlot.set(null);
  }
}

/**
 * `before_prompt_build` trampoline for the plugin entry. A no-op until a
 * monitor has published its runtime.
 */
export async function handleWorkspaceBeforePromptBuild(
  ctx: PluginHookAgentContext
): Promise<PluginHookBeforePromptBuildResult | void> {
  return runtimeSlot.get()?.handleBeforePromptBuild(ctx);
}

export const _testing = {
  clearRuntimeSlot: () => runtimeSlot.set(null),
};
