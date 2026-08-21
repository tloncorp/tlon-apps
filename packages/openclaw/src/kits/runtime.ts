/**
 * Kits harness runtime: binds group install configs (read from group blobs)
 * to live behavior — ambient prompt injection, schedule reconciliation, the
 * setup conversation, and scaffold materialization.
 *
 * The monitor creates one runtime per account and publishes it through a
 * shared slot; the `before_prompt_build` hook (registered from the plugin
 * entry, which loads in a separate module context) reaches it via
 * `handleKitsBeforePromptBuild`. All cross-module state lives in
 * `shared-state.ts` maps/slots.
 */
import type { Kit } from '@tloncorp/api';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import type {
  PluginHookAgentContext,
  PluginHookBeforePromptBuildResult,
  PluginHookGatewayCronService,
} from 'openclaw/plugin-sdk/types';

import { sharedMap, sharedSlot } from '../shared-state.js';
import { buildKitAmbientContext } from './ambient.js';
import {
  type GroupConfigReader,
  type InstalledKitConfig,
  createGroupConfigReader,
} from './group-config.js';
import {
  type KitPackageStore,
  createKitPackageStore,
} from './package-store.js';
import {
  type DesiredKitCronJob,
  buildDesiredKitCronJobs,
  reconcileKitCronJobs,
} from './schedules.js';
import { type SetupDeps, maybeFireSetup } from './setup.js';

/**
 * Feature gate: `channels.tlon.kits.enabled` (account overlay wins),
 * defaulting to true.
 */
export function isKitsEnabled(
  cfg: OpenClawConfig,
  accountId?: string | null
): boolean {
  const base = cfg.channels?.tlon as
    | {
        kits?: { enabled?: boolean };
        accounts?: Record<string, { kits?: { enabled?: boolean } }>;
      }
    | undefined;
  const useDefault = !accountId || accountId === 'default';
  const account = useDefault ? undefined : base?.accounts?.[accountId];
  return (account?.kits?.enabled ?? base?.kits?.enabled ?? true) !== false;
}

// ── Session → group binding ─────────────────────────────────────────────
// processMessage binds each inbound group turn's session key to its group
// flag so the before_prompt_build hook (which sees sessionKey but not the
// group) can find the kit config. TTL-pruned like session-roles.

type SessionGroupEntry = { groupFlag: string; timestamp: number };

const sessionGroups = sharedMap<string, SessionGroupEntry>(
  'kits.sessionGroups'
);
const SESSION_GROUP_TTL_MS = 60 * 60 * 1000;

export function bindKitSessionGroup(
  sessionKey: string | undefined,
  groupFlag: string
): void {
  if (!sessionKey) {
    return;
  }
  const now = Date.now();
  for (const [key, entry] of sessionGroups) {
    if (now - entry.timestamp > SESSION_GROUP_TTL_MS) {
      sessionGroups.delete(key);
    }
  }
  sessionGroups.set(sessionKey, { groupFlag, timestamp: now });
}

export function lookupKitSessionGroup(
  sessionKey: string | undefined
): string | null {
  if (!sessionKey) {
    return null;
  }
  const direct = sessionGroups.get(sessionKey);
  if (direct && Date.now() - direct.timestamp <= SESSION_GROUP_TTL_MS) {
    return direct.groupFlag;
  }
  // Thread sessions append `:thread:<id>` to the parent key.
  const threadIndex = sessionKey.indexOf(':thread:');
  if (threadIndex > 0) {
    return lookupKitSessionGroup(sessionKey.slice(0, threadIndex));
  }
  return null;
}

// ── Scaffold materialization ────────────────────────────────────────────

const scaffoldsWritten = sharedMap<string, number>('kits.scaffoldsWritten');

function isPathInside(target: string, root: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative.length > 0 &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  );
}

/**
 * Copy the kit's scaffold files into the agent workspace. Create-only
 * (`wx`): an existing file is never overwritten. Guarded once per install via
 * sharedMap, so this is a no-op after the first successful pass.
 */
export async function writeKitScaffolds(params: {
  groupFlag: string;
  entry: InstalledKitConfig;
  kit: Kit;
  workspaceDir: string;
  log?: (msg: string) => void;
  error?: (msg: string) => void;
}): Promise<void> {
  const { groupFlag, entry, kit, workspaceDir } = params;
  if (kit.manifest.scaffolds.length === 0) {
    return;
  }
  const guardKey = `${groupFlag}:${entry.installId}`;
  if (scaffoldsWritten.has(guardKey)) {
    return;
  }
  scaffoldsWritten.set(guardKey, Date.now());
  for (const scaffold of kit.manifest.scaffolds) {
    const content = kit.files[scaffold.file];
    if (typeof content !== 'string') {
      params.log?.(
        `[tlon] kits: scaffold source ${scaffold.file} missing from package ${entry.kit.id}`
      );
      continue;
    }
    const target = path.resolve(workspaceDir, scaffold.workspace);
    if (!isPathInside(target, path.resolve(workspaceDir))) {
      params.error?.(
        `[tlon] kits: scaffold path ${scaffold.workspace} escapes the workspace; skipping`
      );
      continue;
    }
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, { flag: 'wx' });
      params.log?.(`[tlon] kits: wrote scaffold ${scaffold.workspace}`);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EEXIST') {
        continue; // Never overwrite user state.
      }
      params.error?.(
        `[tlon] kits: failed writing scaffold ${scaffold.workspace}: ${String(err)}`
      );
    }
  }
}

// ── Runtime controller ──────────────────────────────────────────────────

export type KitsRuntimeDeps = {
  botShip: string;
  scry: (path: string) => Promise<unknown>;
  poke: (params: {
    app: string;
    mark: string;
    json: unknown;
  }) => Promise<unknown>;
  resolveGroupSessionRoute: (
    nest: string
  ) => { sessionKey: string; accountId?: string } | null;
  getCronService: () => PluginHookGatewayCronService | undefined;
  log?: (msg: string) => void;
  error?: (msg: string) => void;
  /** Test seams. */
  configReader?: GroupConfigReader;
  packageStore?: KitPackageStore;
  cronRetryDelayMs?: number;
};

export type KitsRuntime = {
  /** Initial reconcile over the groups the bot participates in. */
  start(groupFlags: string[]): Promise<void>;
  reconcileGroups(groupFlags: string[]): Promise<void>;
  /** %groups /groups/ui fact; invalidates config cache on blob updates. */
  handleGroupsUiEvent(event: unknown): void;
  /** %kits /v1/updates fact. */
  handleKitsUpdate(update: unknown): void;
  handleBeforePromptBuild(
    ctx: PluginHookAgentContext
  ): Promise<PluginHookBeforePromptBuildResult | void>;
  stop(): void;
};

const CRON_RETRY_DELAY_MS = 20_000;
const CRON_RETRY_ATTEMPTS = 3;

export function createKitsRuntime(deps: KitsRuntimeDeps): KitsRuntime {
  const log = deps.log;
  const error = deps.error ?? deps.log;
  const reader =
    deps.configReader ?? createGroupConfigReader({ scry: deps.scry, log });
  const store =
    deps.packageStore ??
    createKitPackageStore({ scry: deps.scry, poke: deps.poke, log });
  const cronRetryDelayMs = deps.cronRetryDelayMs ?? CRON_RETRY_DELAY_MS;

  /** Groups ever seen with (potential) kit config; cron reconcile is global
   * over this set so uninstalled kits' jobs get removed. */
  const knownGroups = new Set<string>();
  let stopped = false;
  let cronRetryTimer: ReturnType<typeof setTimeout> | null = null;

  const setupDeps: SetupDeps = {
    botShip: deps.botShip,
    resolveGroupSessionRoute: deps.resolveGroupSessionRoute,
    // Lazy: the gateway's job service appears after startup. Firing before
    // it exists throws, which rolls the fire-once guard back so the next
    // reconcile retries rather than losing the setup turn.
    cron: {
      add: async (input) => {
        const svc = deps.getCronService();
        if (!svc) {
          throw new Error('cron service unavailable');
        }
        return svc.add(input as Parameters<typeof svc.add>[0]);
      },
    },
    poke: deps.poke,
    log,
    error,
  };

  const collectGroupEntries = async (
    groupFlag: string
  ): Promise<Array<{ entry: InstalledKitConfig; kit: Kit }>> => {
    const config = await reader.get(groupFlag);
    const entries =
      config?.kits.filter((entry) => entry.agents.includes(deps.botShip)) ?? [];
    const out: Array<{ entry: InstalledKitConfig; kit: Kit }> = [];
    for (const entry of entries) {
      const kit = await store.get({
        id: entry.kit.id,
        publisher: entry.kit.publisher,
        version: entry.kit.version,
      });
      if (kit) {
        out.push({ entry, kit });
      } else {
        error?.(
          `[tlon] kits: package ${entry.kit.id} unavailable for ${groupFlag}`
        );
      }
    }
    return out;
  };

  const resolveSessionKey = (nest: string): string | null =>
    deps.resolveGroupSessionRoute(nest)?.sessionKey ?? null;

  // A cron-fired turn (kit setup, weekly schedules) reaches the prompt-build
  // hook without ever passing the monitor's inbound-message path, so no
  // session→group binding exists — and bindings expire after an hour anyway,
  // which no weekly schedule survives. The session key embeds the channel
  // nest and every installed kit names its places, so derive the group from
  // what reconcile already knows, then cache the binding for later turns.
  const resolveGroupBySessionNest = async (
    sessionKey: string | undefined
  ): Promise<string | null> => {
    if (!sessionKey) {
      return null;
    }
    const marker = ':group:';
    const at = sessionKey.indexOf(marker);
    if (at < 0) {
      return null;
    }
    let nest = sessionKey.slice(at + marker.length);
    const thread = nest.indexOf(':thread:');
    if (thread > 0) {
      nest = nest.slice(0, thread);
    }
    if (!nest) {
      return null;
    }
    for (const flag of knownGroups) {
      // One unreadable group (deleted, or its host unreachable) must not
      // abort the whole scan — the hook that calls this injects the kit
      // instructions for the *current* turn's group, and losing them makes
      // the agent improvise its output formats.
      let pairs: Array<{ entry: InstalledKitConfig; kit: Kit }>;
      try {
        pairs = await collectGroupEntries(flag);
      } catch (err) {
        error?.(
          `[tlon] kits: failed reading config for ${flag}: ${String(err)}`
        );
        continue;
      }
      for (const { entry } of pairs) {
        if (Object.values(entry.places).includes(nest)) {
          bindKitSessionGroup(sessionKey, flag);
          return flag;
        }
      }
    }
    return null;
  };

  const scheduleCronRetry = (attemptsLeft: number): void => {
    if (stopped || attemptsLeft <= 0 || cronRetryTimer) {
      return;
    }
    cronRetryTimer = setTimeout(() => {
      cronRetryTimer = null;
      void reconcileAllKnown(attemptsLeft - 1).catch((err) =>
        error?.(`[tlon] kits: cron retry reconcile failed: ${String(err)}`)
      );
    }, cronRetryDelayMs);
    cronRetryTimer.unref?.();
  };

  const reconcileAllKnown = async (
    cronAttemptsLeft = CRON_RETRY_ATTEMPTS
  ): Promise<void> => {
    if (stopped) {
      return;
    }
    const desired: DesiredKitCronJob[] = [];
    for (const groupFlag of knownGroups) {
      let pairs: Array<{ entry: InstalledKitConfig; kit: Kit }>;
      try {
        pairs = await collectGroupEntries(groupFlag);
      } catch (err) {
        error?.(
          `[tlon] kits: failed reading config for ${groupFlag}: ${String(err)}`
        );
        continue;
      }
      for (const pair of pairs) {
        try {
          await maybeFireSetup({
            groupFlag,
            entry: pair.entry,
            kit: pair.kit,
            deps: setupDeps,
          });
        } catch (err) {
          error?.(
            `[tlon] kits: setup for ${pair.entry.installId} failed: ${String(err)}`
          );
        }
      }
      desired.push(
        ...buildDesiredKitCronJobs({
          groupFlag,
          entries: pairs,
          resolveSessionKey,
          log,
        })
      );
    }

    const cron = deps.getCronService();
    if (!cron) {
      // The cron service accessor is published by the gateway_start hook,
      // which can race monitor startup; retry a few times.
      log?.('[tlon] kits: cron service not available yet; will retry');
      scheduleCronRetry(cronAttemptsLeft);
      return;
    }
    try {
      const result = await reconcileKitCronJobs({ cron, desired, log });
      if (result.added || result.updated || result.removed) {
        log?.(
          `[tlon] kits: cron reconcile added=${result.added} updated=${result.updated} ` +
            `removed=${result.removed} kept=${result.kept}`
        );
      }
    } catch (err) {
      error?.(`[tlon] kits: cron reconcile failed: ${String(err)}`);
    }
  };

  const reconcileGroups = async (groupFlags: string[]): Promise<void> => {
    for (const flag of groupFlags) {
      if (flag) {
        knownGroups.add(flag);
      }
    }
    await reconcileAllKnown();
  };

  return {
    async start(groupFlags: string[]): Promise<void> {
      await reconcileGroups(groupFlags);
    },

    reconcileGroups,

    handleGroupsUiEvent(event: unknown): void {
      const fact = event as {
        flag?: unknown;
        update?: Record<string, unknown> | null;
      } | null;
      const flag = typeof fact?.flag === 'string' ? fact.flag : null;
      if (!flag || !fact?.update || typeof fact.update !== 'object') {
        return;
      }
      if (!('blob' in fact.update)) {
        return;
      }
      reader.invalidate(flag);
      void reconcileGroups([flag]).catch((err) =>
        error?.(
          `[tlon] kits: blob-update reconcile for ${flag} failed: ${String(err)}`
        )
      );
    },

    handleKitsUpdate(update: unknown): void {
      const fact = update as
        | {
            installed?: { flag?: unknown };
            uninstalled?: unknown;
            kit?: { manifest?: { id?: unknown } };
          }
        | null
        | undefined;
      if (!fact || typeof fact !== 'object') {
        return;
      }
      const kitId = fact.kit?.manifest?.id;
      if (typeof kitId === 'string' && kitId) {
        // The library copy changed (fetch completed / re-added).
        store.invalidate(kitId);
        return;
      }
      const flag =
        typeof fact.installed?.flag === 'string'
          ? fact.installed.flag
          : typeof fact.uninstalled === 'string'
            ? fact.uninstalled
            : null;
      if (!flag) {
        return;
      }
      reader.invalidate(flag);
      void reconcileGroups([flag]).catch((err) =>
        error?.(
          `[tlon] kits: install-update reconcile for ${flag} failed: ${String(err)}`
        )
      );
    },

    async handleBeforePromptBuild(
      ctx: PluginHookAgentContext
    ): Promise<PluginHookBeforePromptBuildResult | void> {
      const groupFlag =
        lookupKitSessionGroup(ctx.sessionKey) ??
        (await resolveGroupBySessionNest(ctx.sessionKey));
      if (!groupFlag) {
        return undefined;
      }
      knownGroups.add(groupFlag);
      const pairs = await collectGroupEntries(groupFlag);
      if (pairs.length === 0) {
        return undefined;
      }
      const sections: string[] = [];
      for (const { entry, kit } of pairs) {
        if (ctx.workspaceDir) {
          await writeKitScaffolds({
            groupFlag,
            entry,
            kit,
            workspaceDir: ctx.workspaceDir,
            log,
            error,
          });
        }
        const ambient = buildKitAmbientContext({ groupFlag, entry, kit });
        if (ambient) {
          sections.push(ambient);
        }
      }
      if (sections.length === 0) {
        return undefined;
      }
      return { prependSystemContext: sections.join('\n\n') };
    },

    stop(): void {
      stopped = true;
      if (cronRetryTimer) {
        clearTimeout(cronRetryTimer);
        cronRetryTimer = null;
      }
    },
  };
}

// ── Cross-context publication ───────────────────────────────────────────

const kitsRuntimeSlot = sharedSlot<KitsRuntime>('kits.runtime');

export function publishKitsRuntime(runtime: KitsRuntime): void {
  kitsRuntimeSlot.set(runtime);
}

/** Reference-checked so a replacement monitor's runtime is never clobbered. */
export function unpublishKitsRuntime(runtime: KitsRuntime): void {
  if (kitsRuntimeSlot.get() === runtime) {
    kitsRuntimeSlot.set(null);
  }
}

/**
 * `before_prompt_build` trampoline for the plugin entry. No-op until a
 * monitor with kits enabled has published its runtime.
 */
export async function handleKitsBeforePromptBuild(
  ctx: PluginHookAgentContext
): Promise<PluginHookBeforePromptBuildResult | void> {
  const runtime = kitsRuntimeSlot.get();
  if (!runtime) {
    return undefined;
  }
  return runtime.handleBeforePromptBuild(ctx);
}

export const _testing = {
  clearSessionGroups: () => sessionGroups.clear(),
  clearScaffoldsWritten: () => scaffoldsWritten.clear(),
  clearRuntimeSlot: () => kitsRuntimeSlot.set(null),
};
