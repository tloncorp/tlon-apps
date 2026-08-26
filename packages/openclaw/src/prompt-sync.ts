/**
 * Ship-durable system prompts: sync between the bot ship's %steward
 * (prompts module) and the gateway's agent workspace.
 *
 * The ship is the store of record — the gateway container is ephemeral and
 * its workspace is rebuilt from archives on every boot. The sync has two
 * halves:
 *
 * - startup: scry the ship's stored prompt set, re-apply the owner-edited
 *   entries to the workspace files (and cache them in
 *   `channels.tlon.prompts`), then %seed the ship with the full effective
 *   file contents so clients always show what the gateway is actually
 *   running. Un-edited entries only mirror the files, so upstream
 *   prompt-set updates keep flowing through them.
 * - live: `%set` facts on /v1/prompts (an owner edit relayed to the bot's
 *   steward) are applied to the workspace file and persisted to the
 *   openclaw config with an explicit gateway restart, so the edit takes
 *   effect everywhere immediately.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_ACCOUNT_ID,
  type OpenClawConfig,
  type PluginRuntime,
} from 'openclaw/plugin-sdk/core';

import { resolveTlonAccount } from './types.js';

/**
 * The workspace bootstrap files exposed as editable system prompts —
 * the files openclaw injects into the agent's system prompt. MEMORY.md is
 * deliberately excluded: the agent writes it at runtime, so a ship-stored
 * copy would immediately go stale and clobber real memory on re-apply.
 */
export const PROMPT_FILE_NAMES = [
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'BOOTSTRAP.md',
] as const;

export type PromptFileName = (typeof PROMPT_FILE_NAMES)[number];

/** Matches the per-prompt byte cap enforced by %steward's pr-core. */
export const MAX_PROMPT_BYTES = 65_536;

export type PromptSyncLogger = {
  log: (message: string) => void;
  warn: (message: string) => void;
};

/**
 * Whether this account's monitor should run prompt sync. Every account
 * resolves the same default-agent workspace, so two syncing accounts would
 * overwrite each other's files and cross-seed their ships: the default
 * account always syncs, and a named account syncs only when it is the sole
 * runnable account (e.g. a config with just `accounts.hosted`). With
 * multiple named accounts and no default, nobody syncs — safe, if inert.
 */
export function shouldRunPromptSync(
  cfg: OpenClawConfig,
  accountId: string
): boolean {
  if (accountId === DEFAULT_ACCOUNT_ID) {
    return true;
  }
  const accounts = (
    cfg.channels?.tlon as { accounts?: Record<string, unknown> } | undefined
  )?.accounts;
  const runnable = [DEFAULT_ACCOUNT_ID, ...Object.keys(accounts ?? {})].filter(
    (id) => {
      const account = resolveTlonAccount(cfg, id);
      return account.configured && account.enabled;
    }
  );
  return runnable.length === 1 && runnable[0] === accountId;
}

export function isAllowedPromptName(name: unknown): name is PromptFileName {
  return (
    typeof name === 'string' &&
    (PROMPT_FILE_NAMES as readonly string[]).includes(name)
  );
}

function isPromptTextWithinCap(text: string): boolean {
  return Buffer.byteLength(text, 'utf8') <= MAX_PROMPT_BYTES;
}

/**
 * Parse the /x/v1/prompts scry result ({ prompts: { bot, prompts: { name:
 * { text, updated, edited } } } }) into name -> text, keeping only
 * owner-edited entries — those are pinned intent the gateway must re-apply;
 * un-edited entries just mirror our own files back at us. Unknown names and
 * oversized texts are dropped — the ship enforces its own caps, but the
 * scry payload is still remote input to this process.
 */
export function parseStoredPromptsScry(data: unknown): Record<string, string> {
  const prompts = (
    data as {
      prompts?: {
        prompts?: Record<string, { text?: unknown; edited?: unknown }>;
      };
    } | null
  )?.prompts?.prompts;
  if (!prompts || typeof prompts !== 'object') {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [name, entry] of Object.entries(prompts)) {
    const text = entry?.text;
    if (
      isAllowedPromptName(name) &&
      entry?.edited === true &&
      typeof text === 'string' &&
      isPromptTextWithinCap(text)
    ) {
      out[name] = text;
    }
  }
  return out;
}

/**
 * Parse a /v1/prompts fact. Only `%set` facts are actionable here —
 * `%prompts` facts are echoes of our own %seed (or owner-side mirror
 * updates, which never reach the bot ship's gateway).
 */
export function parsePromptSetFact(
  data: unknown
): { name: PromptFileName; text: string } | null {
  const set = (
    data as {
      set?: { name?: unknown; prompt?: { text?: unknown } };
    } | null
  )?.set;
  if (!set) {
    return null;
  }
  const { name } = set;
  const text = set.prompt?.text;
  if (
    !isAllowedPromptName(name) ||
    typeof text !== 'string' ||
    !isPromptTextWithinCap(text)
  ) {
    return null;
  }
  return { name, text };
}

/** Read the effective contents of every allowlisted prompt file. */
export async function readEffectivePrompts(
  workspaceDir: string,
  logger?: PromptSyncLogger
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const name of PROMPT_FILE_NAMES) {
    try {
      const text = await fs.readFile(path.join(workspaceDir, name), 'utf8');
      if (!isPromptTextWithinCap(text)) {
        logger?.warn(
          `[tlon] Prompt file ${name} exceeds ${MAX_PROMPT_BYTES} bytes; not seeding it`
        );
        continue;
      }
      out[name] = text;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        logger?.warn(`[tlon] Failed to read prompt file ${name}: ${error}`);
      }
    }
  }
  return out;
}

/**
 * Write each stored prompt whose text differs from the file on disk.
 * Returns ok=false when any write failed — callers must then skip seeding,
 * or the failed entry's stale file content would overwrite the stored edit
 * on the ship.
 */
export async function applyPromptsToWorkspace(opts: {
  workspaceDir: string;
  prompts: Record<string, string>;
  logger?: PromptSyncLogger;
}): Promise<{ applied: PromptFileName[]; ok: boolean }> {
  const applied: PromptFileName[] = [];
  let ok = true;
  for (const [name, text] of Object.entries(opts.prompts)) {
    if (!isAllowedPromptName(name) || !isPromptTextWithinCap(text)) {
      continue;
    }
    const filePath = path.join(opts.workspaceDir, name);
    try {
      let current: string | null = null;
      try {
        current = await fs.readFile(filePath, 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          throw error;
        }
      }
      if (current === text) {
        continue;
      }
      await fs.mkdir(opts.workspaceDir, { recursive: true });
      await fs.writeFile(filePath, text, 'utf8');
      applied.push(name);
    } catch (error) {
      ok = false;
      opts.logger?.warn(
        `[tlon] Failed to apply stored prompt ${name}: ${error}`
      );
    }
  }
  return { applied, ok };
}

/**
 * Merge prompt entries into the tlon channel section of a config draft.
 * Non-default accounts get their own `accounts[id].prompts`; the default
 * account uses the top-level `channels.tlon.prompts`.
 */
export function writePromptsIntoConfigDraft(
  draft: Record<string, unknown>,
  accountId: string | null | undefined,
  prompts: Record<string, string>
): void {
  const channels = ((draft.channels as Record<string, unknown>) ??= {});
  const tlon = ((channels.tlon as Record<string, unknown>) ??= {});
  const useDefault = !accountId || accountId === 'default';
  const target = useDefault
    ? tlon
    : (((
        ((tlon.accounts as Record<string, unknown>) ??= {}) as Record<
          string,
          unknown
        >
      )[accountId] as Record<string, unknown>) ??= {});
  const existing = (target.prompts as Record<string, string>) ?? {};
  target.prompts = { ...existing, ...prompts };
}

/** True when `next` adds or changes any entry relative to `current`. */
export function promptsDiffer(
  current: Record<string, string>,
  next: Record<string, string>
): boolean {
  return Object.entries(next).some(([name, text]) => current[name] !== text);
}

export type PromptSync = {
  /**
   * Reconcile at gateway boot: apply the ship's stored prompts to the
   * workspace, cache them in config, and seed the ship with the effective
   * file contents.
   */
  startup: () => Promise<void>;
  /** Handle a /v1/prompts fact (applies %set edits, then restarts). */
  handleFact: (data: unknown) => Promise<void>;
};

export function createPromptSync(opts: {
  core: Pick<PluginRuntime, 'config'>;
  accountId?: string | null;
  workspaceDir: string;
  configPrompts: Record<string, string>;
  /**
   * The ship whose mirror receives the fan-out and whose %set edits the bot
   * accepts (normalized @p, null when no owner is configured). %steward's
   * core owner gates both, so startup configures it here — the other two
   * configure paths don't cover every prompt-syncing monitor: gateway-status
   * activation only runs with exactly one Tlon account, and the context-lens
   * sync only configures when the lens is enabled (and then lazily, before
   * its first run poke).
   */
  owner: string | null;
  scry: (path: string) => Promise<unknown>;
  poke: (params: {
    app: string;
    mark: string;
    json: unknown;
  }) => Promise<unknown>;
  logger: PromptSyncLogger;
}): PromptSync {
  const { core, accountId, workspaceDir, owner, scry, poke, logger } = opts;

  const persistToConfig = async (
    prompts: Record<string, string>,
    afterWrite:
      | { mode: 'none'; reason: string }
      | { mode: 'restart'; reason: string }
  ) => {
    try {
      await core.config.mutateConfigFile({
        afterWrite,
        mutate: (draft) => {
          writePromptsIntoConfigDraft(
            draft as unknown as Record<string, unknown>,
            accountId,
            prompts
          );
        },
      });
      return true;
    } catch (error) {
      logger.warn(
        `[tlon] Failed to persist prompts to openclaw config: ${error}`
      );
      return false;
    }
  };

  const startup = async () => {
    // Configure the core owner before touching prompts so the %seed below
    // fans the canonical set to the owner's mirror (and owner %sets pass
    // the ship's auth gate). Idempotent: %steward no-ops a same-owner
    // reconfigure, so overlapping with gateway-status / lens configures of
    // the same resolved owner is harmless.
    if (owner) {
      try {
        await poke({
          app: 'steward',
          mark: 'steward-action-1',
          json: { configure: { owner } },
        });
      } catch (error) {
        // Keep reconciling: the seed still stores the canonical set on the
        // ship, and the fan-out happens once a later configure succeeds.
        logger.warn(
          `[tlon] Failed to configure %steward owner for prompt sync: ${error}`
        );
      }
    }
    let stored: Record<string, string>;
    try {
      stored = parseStoredPromptsScry(await scry('/steward/v1/prompts.json'));
    } catch (error) {
      // Older ships without the prompts module 404 here; prompt sync is
      // simply unavailable until the desk updates.
      logger.log(`[tlon] Prompt sync unavailable (scry failed): ${error}`);
      return;
    }
    // Ship-stored prompts win over the config cache: the config is only a
    // local mirror written by this sync, but a hosted entrypoint can
    // regenerate openclaw.json and drop it.
    const desired = { ...opts.configPrompts, ...stored };
    const { applied, ok } = await applyPromptsToWorkspace({
      workspaceDir,
      prompts: desired,
      logger,
    });
    if (applied.length > 0) {
      logger.log(
        `[tlon] Applied ship-stored prompts to workspace: ${applied.join(', ')}`
      );
    }
    if (!ok) {
      // A failed write means the file content does not match the stored
      // edit; seeding now would overwrite the stored edit with stale file
      // content. Leave the ship untouched and retry next boot.
      logger.warn('[tlon] Skipping prompt seed: workspace apply failed');
      return;
    }
    if (promptsDiffer(opts.configPrompts, stored)) {
      // Catch-up cache write only; the files above are already effective
      // (bootstrap files are re-read every turn), so no restart at boot.
      await persistToConfig(stored, {
        mode: 'none',
        reason: 'tlon prompt sync boot reconcile',
      });
    }
    const effective = await readEffectivePrompts(workspaceDir, logger);
    if (Object.keys(effective).length === 0) {
      return;
    }
    try {
      await poke({
        app: 'steward',
        mark: 'steward-prompts-action-1',
        json: { seed: effective },
      });
      logger.log(
        `[tlon] Seeded ${Object.keys(effective).length} system prompts to %steward`
      );
    } catch (error) {
      logger.warn(`[tlon] Failed to seed prompts to %steward: ${error}`);
    }
  };

  const handleFact = async (data: unknown) => {
    const edit = parsePromptSetFact(data);
    if (!edit) {
      return;
    }
    const { ok } = await applyPromptsToWorkspace({
      workspaceDir,
      prompts: { [edit.name]: edit.text },
      logger,
    });
    if (!ok) {
      // Nothing applied; the stored edit remains on the ship and the next
      // gateway boot retries.
      return;
    }
    logger.log(
      `[tlon] Applied prompt edit to ${edit.name}; restarting gateway to pick it up`
    );
    // The restart rides the config write. If the write is refused (e.g. an
    // untrusted-plugin deployment), the file edit above still takes effect
    // on the next turn — bootstrap files are re-read per turn.
    await persistToConfig(
      { [edit.name]: edit.text },
      { mode: 'restart', reason: `tlon system prompt ${edit.name} updated` }
    );
  };

  // Serialize reconciliation and fact handling on one chain: a fact that
  // arrives mid-startup (or a burst of facts) must not interleave its file
  // and config writes with the reconcile's, or an older scry result could
  // overwrite a newer accepted edit.
  let chain: Promise<void> = Promise.resolve();
  const enqueue = (task: () => Promise<void>) => {
    chain = chain.then(task, task);
    return chain;
  };

  return {
    startup: () => enqueue(startup),
    handleFact: (data) => enqueue(() => handleFact(data)),
  };
}
