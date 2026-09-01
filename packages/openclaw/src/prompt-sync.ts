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
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_ACCOUNT_ID,
  type OpenClawConfig,
  type PluginRuntime,
} from 'openclaw/plugin-sdk/core';

import { normalizeShip } from './targets.js';
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

/** Backoff schedule for transiently failed startup requests. */
const STARTUP_RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

/**
 * True for the error our scry helpers throw on a 404 — a ship without the
 * prompts module. Permanent for this boot, so not worth retrying (and
 * legacy desks would pay the full backoff on every boot).
 */
export function isScryNotFound(error: unknown): boolean {
  return /Scry failed: 404 /.test(String(error));
}

/** Abort-aware sleep: teardown must not sit out a multi-second backoff. */
function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Boot-time requests run once per gateway boot, so a transiently failed
 * request would otherwise leave prompts unsynced until the next restart.
 * Bounded retries; an error `isPermanent` recognizes rethrows immediately,
 * and an abort stops retrying with the last error.
 */
export async function withStartupRetries<T>(retryOpts: {
  label: string;
  run: () => Promise<T>;
  logger: PromptSyncLogger;
  isPermanent?: (error: unknown) => boolean;
  retryDelaysMs?: number[];
  abortSignal?: AbortSignal;
}): Promise<T> {
  const delays = retryOpts.retryDelaysMs ?? STARTUP_RETRY_DELAYS_MS;
  const aborted = () => retryOpts.abortSignal?.aborted === true;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await retryOpts.run();
    } catch (error) {
      if (
        retryOpts.isPermanent?.(error) ||
        attempt >= delays.length ||
        aborted()
      ) {
        throw error;
      }
      retryOpts.logger.warn(
        `[tlon] ${retryOpts.label} failed, retrying in ${delays[attempt]}ms: ${error}`
      );
      await abortableSleep(delays[attempt], retryOpts.abortSignal);
      if (aborted()) {
        throw error;
      }
    }
  }
}

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

/**
 * True when some account holding prompt-syncing authority
 * (shouldRunPromptSync) targets this bot ship. A gated-off monitor must not
 * %clear a ship that a syncing alias account is actively seeding — the two
 * monitors run independently, so a clear landing after the authority's
 * seed would wipe the canonical set and owner mirror until the next
 * reconcile.
 */
export function shipHasPromptSyncAuthority(
  cfg: OpenClawConfig,
  botShip: string
): boolean {
  const ship = normalizeShip(botShip);
  const accounts = (
    cfg.channels?.tlon as { accounts?: Record<string, unknown> } | undefined
  )?.accounts;
  const ids = [DEFAULT_ACCOUNT_ID, ...Object.keys(accounts ?? {})];
  return ids.some((id) => {
    const account = resolveTlonAccount(cfg, id);
    // An authority must actually RUN: shouldRunPromptSync returns true for
    // the default slot unconditionally, but a disabled or unconfigured
    // default has no monitor — treating it as an authority would leave the
    // ship's stale canonical set uncleared forever.
    if (!account.configured || !account.enabled) {
      return false;
    }
    if (!shouldRunPromptSync(cfg, id)) {
      return false;
    }
    return Boolean(account.ship) && normalizeShip(account.ship!) === ship;
  });
}

/**
 * Prompt texts belonging to every ship OTHER than this account's bot,
 * name -> texts. All accounts share one default-agent workspace, so when
 * the prompt-syncing authority changes (a default account joins a formerly
 * sole named account, an account is deleted, or a slot is repointed at a
 * different bot ship), the workspace can still hold a previous bot's
 * owner-edited text on disk; seeding it would hand that owner's private
 * prompts (USER.md etc.) to a different ship and owner. Sources: every
 * other account's cache (including disabled/de-configured leftovers), any
 * cache stamped for a different ship than its account now names, and the
 * ship-keyed shadow ledger — which survives account deletion and
 * repointing (see writePromptsIntoConfigDraft).
 */
export function collectForeignPromptCaches(
  cfg: OpenClawConfig,
  accountId: string
): Record<string, string[]> {
  const tlon = cfg.channels?.tlon as
    | {
        accounts?: Record<string, unknown>;
        promptSync?: {
          ships?: Record<string, Record<string, unknown>>;
          applied?: Record<string, Record<string, unknown>>;
        };
      }
    | undefined;
  const myId = accountId || DEFAULT_ACCOUNT_ID;
  const myShipRaw = resolveTlonAccount(cfg, myId).ship;
  const myShip = myShipRaw ? normalizeShip(myShipRaw) : null;
  const out: Record<string, string[]> = {};
  const add = (name: string, text: unknown) => {
    if (typeof text === 'string' && !(out[name] ?? []).includes(text)) {
      (out[name] ??= []).push(text);
    }
  };
  const ids = new Set<string>([
    DEFAULT_ACCOUNT_ID,
    ...Object.keys(tlon?.accounts ?? {}),
  ]);
  for (const id of ids) {
    const account = resolveTlonAccount(cfg, id);
    // Another slot pointing at OUR ship isn't foreign; our own slot's
    // cache isn't either (and its raw cache is already ship-gated by
    // resolveTlonAccount, so a repointed slot resolves it as empty —
    // the old text is picked up from the ledger below instead).
    if (id === myId) {
      continue;
    }
    if (account.ship && myShip && normalizeShip(account.ship) === myShip) {
      continue;
    }
    for (const [name, text] of Object.entries(account.prompts)) {
      add(name, text);
    }
  }
  for (const [ship, prompts] of Object.entries(tlon?.promptSync?.ships ?? {})) {
    if (myShip && normalizeShip(ship) === myShip) {
      continue;
    }
    for (const [name, texts] of Object.entries(prompts ?? {})) {
      if (Array.isArray(texts)) {
        for (const text of texts) {
          add(name, text);
        }
      } else {
        add(name, texts);
      }
    }
  }
  // The applied marker survives history eviction: it records the text that
  // actually reached the shared workspace files.
  for (const [ship, prompts] of Object.entries(
    tlon?.promptSync?.applied ?? {}
  )) {
    if (myShip && normalizeShip(ship) === myShip) {
      continue;
    }
    for (const [name, text] of Object.entries(prompts ?? {})) {
      add(name, text);
    }
  }
  return out;
}

/** Per-file ownership stamps (name -> ship) from the config ledger. */
export function collectPromptFileStamps(
  cfg: OpenClawConfig
): Record<string, string> {
  const files = (
    cfg.channels?.tlon as
      | { promptSync?: { files?: Record<string, unknown> } }
      | undefined
  )?.promptSync?.files;
  const out: Record<string, string> = {};
  for (const [name, ship] of Object.entries(files ?? {})) {
    if (typeof ship === 'string') {
      out[name] = ship;
    }
  }
  return out;
}

/** This ship's applied-text marker (name -> text) from the config ledger. */
export function collectAppliedPromptMarker(
  cfg: OpenClawConfig,
  botShip: string
): Record<string, string> {
  const applied = (
    cfg.channels?.tlon as
      | { promptSync?: { applied?: Record<string, Record<string, unknown>> } }
      | undefined
  )?.promptSync?.applied?.[normalizeShip(botShip)];
  const out: Record<string, string> = {};
  for (const [name, text] of Object.entries(applied ?? {})) {
    if (typeof text === 'string') {
      out[name] = text;
    }
  }
  return out;
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

/**
 * Read one prompt file's contents, or null when it is absent, unreadable,
 * or not a regular file (a symlink is never followed — see
 * readEffectivePrompts).
 */
async function readPromptFileIfRegular(
  workspaceDir: string,
  name: string,
  logger?: PromptSyncLogger
): Promise<string | null> {
  const filePath = path.join(workspaceDir, name);
  try {
    const info = await fs.lstat(filePath);
    if (!info.isFile()) {
      return null;
    }
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      logger?.warn(`[tlon] Failed to read prompt file ${name}: ${error}`);
    }
    return null;
  }
}

/**
 * Read the effective contents of every allowlisted prompt file. ok=false
 * when any file failed to read for a reason other than not existing —
 * seeding such a partial set would make %steward drop the unreadable
 * file's un-edited entry (and the owner's view of it) even though the
 * gateway still runs it.
 */
export async function readEffectivePrompts(
  workspaceDir: string,
  logger?: PromptSyncLogger
): Promise<{ prompts: Record<string, string>; ok: boolean }> {
  const out: Record<string, string> = {};
  let ok = true;
  for (const name of PROMPT_FILE_NAMES) {
    const filePath = path.join(workspaceDir, name);
    try {
      // Never follow a symlinked prompt source: a prepared workspace could
      // point USER.md at any process-readable file, and its contents would
      // be seeded to %steward and mirrored to the owner. openclaw writes
      // these as regular files, so a link here is not legitimate content —
      // remove it and let the bootstrap default be regenerated.
      const info = await fs.lstat(filePath).catch((error) => {
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
          return null;
        }
        throw error;
      });
      if (info === null) {
        continue;
      }
      if (info.isSymbolicLink()) {
        logger?.warn(
          `[tlon] Prompt file ${name} is a symlink; removing it instead of reading through it`
        );
        try {
          await fs.unlink(filePath);
        } catch (error) {
          ok = false;
          logger?.warn(
            `[tlon] Failed to remove symlinked prompt ${name}: ${error}`
          );
        }
        continue;
      }
      if (!info.isFile()) {
        // A FIFO or device node would hang (or endlessly feed) this read.
        // Unlike a symlink it is not removed — a directory can't be, and
        // deleting an unexpected node is worse than refusing to read it —
        // so fail closed and skip the seed rather than dropping the name.
        ok = false;
        logger?.warn(
          `[tlon] Prompt file ${name} is not a regular file; skipping the seed`
        );
        continue;
      }
      const text = await fs.readFile(filePath, 'utf8');
      if (!isPromptTextWithinCap(text)) {
        // Same policy as a failed read: an omitted-but-running file must
        // not be dropped from the ship's canonical set by a partial seed.
        ok = false;
        logger?.warn(
          `[tlon] Prompt file ${name} exceeds ${MAX_PROMPT_BYTES} bytes; skipping the seed`
        );
        continue;
      }
      out[name] = text;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        ok = false;
        logger?.warn(`[tlon] Failed to read prompt file ${name}: ${error}`);
      }
    }
  }
  return { prompts: out, ok };
}

/**
 * Write each stored prompt whose text differs from the file on disk.
 * Returns ok=false when any write failed — callers must then skip seeding,
 * or the failed entry's stale file content would overwrite the stored edit
 * on the ship.
 *
 * `aborted` stops the pass on teardown, and is checked between the temp
 * write and the rename as well as per file: the workspace is SHARED, so a
 * replacement monitor for a different bot can clean and repopulate it while
 * we sit in writeFile. Renaming after that publishes our text under its
 * ownership stamp, which no later cleanup can recognize as foreign.
 */
export async function applyPromptsToWorkspace(opts: {
  workspaceDir: string;
  prompts: Record<string, string>;
  logger?: PromptSyncLogger;
  aborted?: () => boolean;
}): Promise<{ applied: PromptFileName[]; ok: boolean }> {
  const applied: PromptFileName[] = [];
  let ok = true;
  for (const [name, text] of Object.entries(opts.prompts)) {
    if (opts.aborted?.()) {
      // Not ok: the desired set was not fully applied, so no caller may
      // treat the workspace as matching the ship's stored state.
      return { applied, ok: false };
    }
    if (!isAllowedPromptName(name) || !isPromptTextWithinCap(text)) {
      continue;
    }
    const filePath = path.join(opts.workspaceDir, name);
    try {
      let current: string | null = null;
      try {
        // lstat before reading: a prepared workspace can plant an
        // allowlisted name as a symlink or a FIFO, and reading one would
        // either compare against an arbitrary file or (a FIFO, /dev/zero)
        // block or balloon this reconcile forever. Anything but a regular
        // file goes uncompared — the rename below replaces the node
        // itself, since rename does not follow the final component.
        const info = await fs.lstat(filePath);
        if (info.isFile()) {
          current = await fs.readFile(filePath, 'utf8');
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          throw error;
        }
      }
      if (current === text) {
        continue;
      }
      await fs.mkdir(opts.workspaceDir, { recursive: true });
      // Write-then-rename: a direct write that fails partway (ENOSPC, I/O
      // error) can leave the target truncated or half-written, and since
      // `applied` only records full successes that corrupted file would be
      // left unstamped while the agent kept reading it every turn. rename
      // is atomic within the directory, so the target is either the old
      // content or the complete new content.
      //
      // The temp name is randomized and created with 'wx' (O_CREAT|O_EXCL,
      // which also refuses to follow a symlink): a predictable name that a
      // prepared workspace archive could plant as a symlink would otherwise
      // turn an owner's prompt edit into an arbitrary-file overwrite.
      const tmpPath = `${filePath}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(tmpPath, text, { encoding: 'utf8', flag: 'wx' });
        if (opts.aborted?.()) {
          // The rename is the publish step; dropping the temp file leaves
          // the workspace exactly as the replacement left it.
          await fs.unlink(tmpPath).catch(() => {});
          return { applied, ok: false };
        }
        await fs.rename(tmpPath, filePath);
      } catch (error) {
        await fs.unlink(tmpPath).catch(() => {});
        throw error;
      }
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
 * account uses the top-level `channels.tlon.prompts`. The cache is stamped
 * with the bot ship it was generated for (`promptsShip`) so repointing the
 * account slot at a different ship invalidates it (resolveTlonAccount),
 * and every write is shadowed into `channels.tlon.promptSync.ships[ship]`,
 * which lives OUTSIDE the account blocks and is keyed by SHIP: deleting or
 * repointing an account keeps a record of the prompt text its owner edited
 * onto the shared workspace, letting the next syncing authority recognize
 * that text as foreign (collectForeignPromptCaches).
 */
export function writePromptsIntoConfigDraft(
  draft: Record<string, unknown>,
  accountId: string | null | undefined,
  botShip: string,
  prompts: Record<string, string>,
  writeOpts?: {
    /**
     * These texts were successfully APPLIED to the workspace files. Kept in
     * a separate per-ship marker (promptSync.applied) that the bounded
     * history can never evict — the applied text is by definition what may
     * still sit on disk, so the foreign filter must always recognize it.
     * Also stamps promptSync.files[name] = ship: per-file ownership, which
     * the startup cleanup trusts over text inference (entrypoints rewrite
     * prompt files, so foreign content can stop matching any recorded
     * text).
     */
    markApplied?: boolean;
    /** Workspace files just removed by the foreign cleanup: drop their
     * ownership stamps so the regenerated defaults aren't re-removed. */
    clearFileStamps?: string[];
  }
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
  const ship = normalizeShip(botShip);
  const stale =
    target.promptsShip !== undefined
      ? normalizeShip(String(target.promptsShip)) !== ship
      : false;
  const existing = stale
    ? {}
    : ((target.prompts as Record<string, string>) ?? {});
  target.prompts = { ...existing, ...prompts };
  target.promptsShip = ship;
  const ledger = ((tlon.promptSync as Record<string, unknown>) ??= {});
  const ledgerShips = ((ledger.ships as Record<string, unknown>) ??= {});
  const entry = (ledgerShips[ship] as Record<string, unknown>) ?? {};
  // The ledger keeps per-name HISTORY (bounded), not just the latest text:
  // an earlier edit may still sit on the shared workspace if its apply
  // failed, and replacing it here would blind the foreign filter to it.
  const nextEntry: Record<string, string[]> = {};
  for (const [name, value] of Object.entries(entry)) {
    nextEntry[name] = Array.isArray(value)
      ? (value as string[])
      : typeof value === 'string'
        ? [value]
        : [];
  }
  for (const [name, text] of Object.entries(prompts)) {
    const history = nextEntry[name] ?? [];
    if (!history.includes(text)) {
      nextEntry[name] = [...history, text].slice(-8);
    }
  }
  ledgerShips[ship] = nextEntry;
  if (writeOpts?.markApplied) {
    const appliedLedger = ((ledger.applied as Record<string, unknown>) ??= {});
    const appliedEntry = (appliedLedger[ship] as Record<string, string>) ?? {};
    appliedLedger[ship] = { ...appliedEntry, ...prompts };
    const files = ((ledger.files as Record<string, unknown>) ??= {});
    for (const name of Object.keys(prompts)) {
      files[name] = ship;
    }
  }
  if (writeOpts?.clearFileStamps?.length) {
    const files = (ledger.files as Record<string, unknown>) ?? {};
    for (const name of writeOpts.clearFileStamps) {
      delete files[name];
    }
    ledger.files = files;
  }
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
  /** Normalized @p of the bot ship this monitor serves; cache writes are
   * stamped with it so a repointed account slot invalidates them. */
  botShip: string;
  workspaceDir: string;
  configPrompts: Record<string, string>;
  /**
   * The ship whose mirror receives the fan-out and whose %set edits the bot
   * accepts (normalized @p, null when no owner is configured). %steward's
   * core owner gates both, so startup configures it here — the other two
   * configure paths don't cover every prompt-syncing monitor: gateway-status
   * activation only runs with exactly one Tlon account, and the context-lens
   * sync only configures when the lens is enabled (and then lazily, before
   * its first run poke). null clears a previously configured owner
   * (%unconfigure), which also revokes that ship's mirror.
   */
  owner: string | null;
  scry: (path: string) => Promise<unknown>;
  poke: (params: {
    app: string;
    mark: string;
    json: unknown;
  }) => Promise<unknown>;
  logger: PromptSyncLogger;
  /**
   * Other accounts' cached prompt edits (see collectForeignPromptCaches).
   * Workspace files whose text matches one are excluded from the seed —
   * they are another owner's private prompt text left on the shared
   * workspace by a previous syncing authority.
   */
  foreignPrompts?: Record<string, string[]>;
  /**
   * Per-file ownership stamps (see collectPromptFileStamps). A file
   * stamped for a different ship is foreign REGARDLESS of its current
   * text — entrypoints rewrite prompt files, so foreign content can stop
   * matching any recorded text.
   */
  fileStamps?: Record<string, string>;
  /**
   * This ship's current applied-text marker (see
   * collectAppliedPromptMarker), used to repair a marker/stamp write that
   * failed or crashed on an earlier boot even when today's apply changes
   * no files.
   */
  currentApplied?: Record<string, string>;
  /**
   * Monitor teardown signal (config reload / shutdown). Aborting stops
   * retry backoff promptly and keeps a stale monitor from applying or
   * persisting prompts from an obsolete account configuration.
   */
  abortSignal?: AbortSignal;
  /** Test hook: startup retry backoff schedule. */
  retryDelaysMs?: number[];
}): PromptSync {
  const { core, accountId, botShip, workspaceDir, owner, scry, poke, logger } =
    opts;

  const aborted = () => opts.abortSignal?.aborted === true;

  // Live copies of the creation-time ledger snapshots: subscription and
  // channel-recovery reconciliations reuse this instance, so they must
  // observe the stamp clears and marker writes earlier reconciles
  // persisted — or a regenerated default file would be re-removed under a
  // stamp that was already cleared on disk.
  const fileStamps: Record<string, string> = { ...(opts.fileStamps ?? {}) };
  const currentApplied: Record<string, string> = {
    ...(opts.currentApplied ?? {}),
  };

  const retry = <T>(
    label: string,
    run: () => Promise<T>,
    isPermanent?: (error: unknown) => boolean
  ) =>
    withStartupRetries({
      label,
      run,
      logger,
      ...(isPermanent ? { isPermanent } : {}),
      ...(opts.retryDelaysMs ? { retryDelaysMs: opts.retryDelaysMs } : {}),
      ...(opts.abortSignal ? { abortSignal: opts.abortSignal } : {}),
    });

  const persistToConfig = async (
    prompts: Record<string, string>,
    afterWrite:
      | { mode: 'none'; reason: string }
      | { mode: 'restart'; reason: string },
    writeOpts?: { markApplied?: boolean; clearFileStamps?: string[] }
  ) => {
    try {
      await core.config.mutateConfigFile({
        afterWrite,
        mutate: (draft) => {
          if (aborted()) {
            // The teardown can land after persistToConfig's callers checked
            // the signal but while this (uncancellable) mutation is still
            // queued. Writing then would resurrect state for an obsolete
            // account snapshot — e.g. recreating a deleted accounts[id]
            // block, which inherited top-level credentials could make
            // runnable again.
            throw new Error('monitor torn down before config write');
          }
          writePromptsIntoConfigDraft(
            draft as unknown as Record<string, unknown>,
            accountId,
            botShip,
            prompts,
            writeOpts
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

  /**
   * Drop the removed files' ownership stamps, or the regenerated bootstrap
   * defaults would be re-removed on every boot. A failed write is safe:
   * the next boot unlinks again (ENOENT-tolerant) and retries the clear.
   * The in-memory copy only advances with the persisted state, so later
   * reconciles on this instance stay consistent with disk.
   */
  const clearRemovedStamps = async (names: string[]): Promise<void> => {
    const cleared = await persistToConfig(
      {},
      { mode: 'none', reason: 'tlon prompt sync stamp clear' },
      { clearFileStamps: names }
    );
    if (cleared) {
      for (const name of names) {
        delete fileStamps[name];
      }
    }
  };

  const startup = async () => {
    if (aborted()) {
      return;
    }
    // Configure the core owner before touching prompts so the %seed below
    // fans the canonical set to the owner's mirror (and owner %sets pass
    // the ship's auth gate) — and clear it when the config no longer names
    // an owner, or the former owner would keep receiving syncs and stay
    // authorized to edit indefinitely. Idempotent both ways: %steward
    // no-ops a same-owner reconfigure and an already-clear %unconfigure.
    try {
      await retry('%steward owner configure', () =>
        poke({
          app: 'steward',
          mark: 'steward-action-1',
          json: owner ? { configure: { owner } } : { unconfigure: null },
        })
      );
    } catch (error) {
      // Stop here: seeding under an unconfirmed ownership state could fan
      // the prompt set to a FORMER owner (a replace/remove that never
      // landed leaves the old owner.state authorized). The next boot or
      // resubscribe-triggered reconcile retries the whole sequence.
      logger.warn(
        `[tlon] Aborting prompt reconcile: %steward owner configure failed: ${error}`
      );
      return;
    }
    let stored: Record<string, string>;
    try {
      stored = parseStoredPromptsScry(
        await retry(
          'Prompt scry',
          () => scry('/steward/v1/prompts.json'),
          isScryNotFound
        )
      );
    } catch (error) {
      // Older ships without the prompts module 404 here (never retried);
      // transient failures already got the bounded retries above. Prompt
      // sync is unavailable until the next gateway restart.
      logger.log(`[tlon] Prompt sync unavailable (scry failed): ${error}`);
      return;
    }
    if (aborted()) {
      // Torn down mid-startup (config reload): this monitor's account
      // snapshot is obsolete, so stop before writing anything.
      return;
    }
    // Record provenance in the ship-keyed ledger BEFORE touching the
    // shared workspace: if teardown or a crash lands between the file
    // writes and the config write, a later syncing authority must still be
    // able to recognize the leftover text as this ship's.
    let recorded = true;
    if (promptsDiffer(opts.configPrompts, stored)) {
      // Cache write only — the file applies below take effect without a
      // restart (bootstrap files are re-read every turn).
      recorded = await persistToConfig(stored, {
        mode: 'none',
        reason: 'tlon prompt sync boot reconcile',
      });
    }
    if (aborted()) {
      return;
    }
    if (!recorded) {
      // A refused config write (e.g. an untrusted-plugin deployment) means
      // provenance can't be recorded — applying the ship-stored edits would
      // leave private text on the shared workspace that a later authority
      // couldn't recognize as foreign. Defer them; the previously recorded
      // cache below is still safe to apply.
      logger.warn(
        '[tlon] Provenance write refused; deferring ship-stored prompt edits this boot'
      );
    }
    // Ship-stored prompts win over the config cache: the config is only a
    // local mirror written by this sync, but a hosted entrypoint can
    // regenerate openclaw.json and drop it.
    const desired = recorded
      ? { ...opts.configPrompts, ...stored }
      : { ...opts.configPrompts };
    const myShipNorm = normalizeShip(botShip);
    const removedStamps: string[] = [];
    // Stamp-based cleanup runs BEFORE any write or read, and needs no file
    // content:
    // an entrypoint rewrite can push a former owner's file past the byte
    // cap (or make it unreadable), and a write failure for an unrelated
    // file aborts the pass — gating removal behind either would leave that
    // private prompt on disk, loaded by the agent every turn, with every
    // later reconcile bailing at the same place.
    for (const name of PROMPT_FILE_NAMES) {
      if (aborted()) {
        // Torn down partway through the pass. Every check below reads a
        // snapshot taken before the reload, so a replacement's freshly
        // written file could look foreign to us and be deleted. Anything
        // already removed is re-detected (and its stamp cleared) by the
        // replacement's own reconcile, since a missing file reads as
        // already-removed.
        return;
      }
      const stamp = fileStamps[name];
      const stampForeign =
        stamp !== undefined && normalizeShip(stamp) !== myShipNorm;
      let reason = stampForeign ? `file is stamped for ${stamp}` : '';
      if (!stampForeign) {
        // Files predating ownership stamps are identifiable only by their
        // contents. This has to happen here too, not after the apply: an
        // unstamped foreign file plus a failed write for some other name
        // would otherwise never be cleaned, and every reconcile would
        // repeat the same failure while the agent kept loading it.
        const candidates = opts.foreignPrompts?.[name];
        if (!candidates || candidates.length === 0) {
          continue;
        }
        const current = await readPromptFileIfRegular(
          workspaceDir,
          name,
          logger
        );
        if (current === null || current === desired[name]) {
          // Unreadable/absent, or verifiably our own content — identical
          // boilerplate cached for another ship must not out-claim it.
          continue;
        }
        if (!candidates.includes(current)) {
          continue;
        }
        reason = "text matches another ship's stored edit";
      }
      if (aborted()) {
        // The content read above awaits, so the teardown can land after the
        // loop-top check. Deleting now would take a replacement monitor's
        // freshly published file at the same pathname — and if its apply
        // and stamp pass has already finished, nothing restores it and the
        // new bot runs without that prompt.
        return;
      }
      // A foreign stamp cannot coexist with our own content: applying an
      // edit stamps the file for us, and handleFact refuses to write over
      // a file stamped for another ship.
      try {
        await fs.unlink(path.join(workspaceDir, name));
        logger.warn(
          `[tlon] Removed foreign prompt ${name} from the workspace (${reason})`
        );
        removedStamps.push(name);
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
          // Already gone (e.g. a previous boot removed it but crashed
          // before clearing the stamp) — clearing the stamp is all that
          // is left to do.
          removedStamps.push(name);
        } else {
          logger.warn(
            `[tlon] Aborting prompt reconcile: failed to remove foreign prompt ${name}: ${error}`
          );
          return;
        }
      }
    }
    if (removedStamps.length > 0) {
      // Clear the removed files' stamps HERE, before the apply below can
      // recreate and restamp any of these names for this ship. Deferring
      // to the end would delete that fresh stamp and leave our own
      // owner-edited content unowned.
      await clearRemovedStamps(removedStamps);
      removedStamps.length = 0;
    }
    if (aborted()) {
      // The cleanup and stamp-clear above both await, so the teardown can
      // land between the last check and here. A replacement monitor may
      // already have written the workspace for a different bot; renaming
      // our cached prompts over those files would leave it running our
      // text, and the stamping config write below would be refused.
      return;
    }
    const { applied, ok } = await applyPromptsToWorkspace({
      workspaceDir,
      prompts: desired,
      logger,
      aborted,
    });
    if (aborted()) {
      // Bail before the bookkeeping below: its config writes are refused
      // for a torn-down monitor anyway, and `applied` is a partial list.
      return;
    }
    if (applied.length > 0) {
      logger.log(
        `[tlon] Applied ship-stored prompts to workspace: ${applied.join(', ')}`
      );
    }
    if (!ok) {
      // A failed write means the file content does not match the stored
      // edit; seeding now would overwrite the stored edit with stale file
      // content. Leave the ship untouched and retry next boot.
      //
      // But the loop is not atomic: files written before the failure are
      // already on the shared workspace, so stamp that subset before
      // bailing. Without this they sit unattributed, and an entrypoint
      // rewrite plus a repoint would leave the next authority unable to
      // recognize them as this ship's (exact-text history alone no longer
      // matches once the file is rewritten).
      if (applied.length > 0) {
        const partial: Record<string, string> = {};
        for (const name of applied) {
          const text = desired[name];
          if (text !== undefined) {
            partial[name] = text;
          }
        }
        const stamped = await persistToConfig(
          partial,
          { mode: 'none', reason: 'tlon prompt sync partial apply stamps' },
          { markApplied: true }
        );
        if (stamped) {
          for (const [name, text] of Object.entries(partial)) {
            fileStamps[name] = normalizeShip(botShip);
            currentApplied[name] = text;
          }
        } else {
          logger.warn(
            `[tlon] Applied ${applied.join(', ')} but could not stamp ownership; next boot retries`
          );
        }
      }
      logger.warn('[tlon] Skipping prompt seed: workspace apply failed');
      return;
    }
    // Record what actually reached the files: after a clean apply, every
    // desired name matches disk. The applied marker is what the foreign
    // filter falls back to once the bounded edit history evicts a text
    // that never got re-applied, and the file stamps are what the cleanup
    // below trusts over text inference. Written not only when files
    // changed this boot: an earlier marker write may have failed or
    // crashed after the apply, so repair whenever the recorded marker or
    // a stamp disagrees with what is now verifiably on disk.
    const markerStale = Object.entries(desired).some(([name, text]) => {
      const stamp = fileStamps[name];
      return (
        currentApplied[name] !== text ||
        stamp === undefined ||
        normalizeShip(stamp) !== myShipNorm
      );
    });
    if (
      (applied.length > 0 || markerStale) &&
      Object.keys(desired).length > 0
    ) {
      const marked = await persistToConfig(
        desired,
        { mode: 'none', reason: 'tlon prompt sync applied marker' },
        { markApplied: true }
      );
      if (!marked) {
        // Owner-edited text is on the shared workspace with no persisted
        // ownership stamp. If this authority is repointed before a
        // successful retry — and the entrypoint rewrites the file so its
        // text matches nothing recorded — the replacement couldn't
        // recognize it as foreign. Fail closed; the next boot retries the
        // whole reconcile.
        logger.warn(
          '[tlon] Aborting prompt reconcile: ownership stamp write failed'
        );
        return;
      }
      for (const [name, text] of Object.entries(desired)) {
        fileStamps[name] = myShipNorm;
        currentApplied[name] = text;
      }
    }
    if (aborted()) {
      // Torn down while the apply was in flight — stop before seeding on
      // behalf of an obsolete account snapshot.
      return;
    }
    const { prompts: effective, ok: readOk } = await readEffectivePrompts(
      workspaceDir,
      logger
    );
    if (!readOk) {
      // A partial read would seed an incomplete set, and %steward would
      // drop the unreadable file's un-edited entry even though the gateway
      // still runs it. Retry next boot — but persist any stamp clears from
      // the cleanup above first, so the removals are not repeated forever.
      if (removedStamps.length > 0) {
        await clearRemovedStamps(removedStamps);
      }
      logger.warn('[tlon] Skipping prompt seed: workspace read failed');
      return;
    }
    if (aborted()) {
      return;
    }
    if (Object.keys(effective).length === 0) {
      // Deliberately NOT seeding an empty set. openclaw bootstraps these
      // files, so a workspace with none of them means the workspace is
      // broken or misresolved, not that an operator removed every prompt —
      // and an empty seed would drop the ship's un-edited canonical entries
      // and empty the owner mirror that data-gates the owner's editor UI.
      logger.warn(
        '[tlon] No prompt files found in workspace; skipping prompt seed'
      );
      return;
    }
    try {
      // Same bounded retry as the configure and scry above — a transient
      // failure here would leave a fresh ship's canonical set (and the
      // owner mirror) empty until the next gateway restart.
      await retry('%steward prompt seed', () =>
        poke({
          app: 'steward',
          mark: 'steward-prompts-action-1',
          json: { seed: effective },
        })
      );
      logger.log(
        `[tlon] Seeded ${Object.keys(effective).length} system prompts to %steward`
      );
    } catch (error) {
      logger.warn(`[tlon] Failed to seed prompts to %steward: ${error}`);
    }
  };

  const handleFact = async (data: unknown) => {
    if (aborted()) {
      return;
    }
    const edit = parsePromptSetFact(data);
    if (!edit) {
      return;
    }
    const myShip = normalizeShip(botShip);
    const existingStamp = fileStamps[edit.name];
    if (
      existingStamp !== undefined &&
      normalizeShip(existingStamp) !== myShip
    ) {
      // The workspace copy belongs to another ship's owner and has not been
      // cleaned up yet (a reconcile whose removal failed). Applying over it
      // would claim their file as ours; leave it for the boot/recovery
      // reconcile, which removes foreign files before applying anything.
      logger.warn(
        `[tlon] Not applying prompt edit ${edit.name}: workspace file is stamped for ${existingStamp}`
      );
      return;
    }
    // Record provenance AND the per-file ownership stamp in the ship-keyed
    // ledger BEFORE touching the shared workspace. The file write is
    // uncancellable while the config write can fail, so this is the only
    // ordering under which an owner-edited file can never exist on the
    // shared workspace unattributed — text history alone is not enough,
    // since entrypoints rewrite these files (see the startup cleanup).
    // The cache mirrors the SHIP's stored edits (which already include this
    // one), so writing it ahead of the file is consistent even if the apply
    // then fails. A refused write (untrusted deployment) means the edit
    // can't be applied safely at all — the ship keeps it durably, and a
    // future boot with working config writes applies it.
    const recorded = await persistToConfig(
      { [edit.name]: edit.text },
      { mode: 'none', reason: `tlon system prompt ${edit.name} provenance` },
      { markApplied: true }
    );
    if (!recorded) {
      logger.warn(
        `[tlon] Provenance write refused; not applying prompt edit ${edit.name}`
      );
      return;
    }
    fileStamps[edit.name] = myShip;
    currentApplied[edit.name] = edit.text;
    if (aborted()) {
      return;
    }
    const { ok } = await applyPromptsToWorkspace({
      workspaceDir,
      prompts: { [edit.name]: edit.text },
      logger,
      aborted,
    });
    if (!ok) {
      // Nothing applied; the stored edit remains on the ship and the next
      // gateway boot retries.
      return;
    }
    if (aborted()) {
      // Torn down while the apply was in flight: the file write is safe
      // (its provenance is already in the ledger, and ship state wins on
      // the next boot's reconcile), but a restart on behalf of an obsolete
      // monitor is not.
      return;
    }
    logger.log(
      `[tlon] Applied prompt edit to ${edit.name}; restarting gateway to pick it up`
    );
    // This write exists only to trigger the restart; provenance and the
    // ownership stamp already landed before the file was touched, so a
    // refusal here is not a correctness problem — the file edit still takes
    // effect on the next turn (bootstrap files are re-read per turn).
    await persistToConfig(
      { [edit.name]: edit.text },
      { mode: 'restart', reason: `tlon system prompt ${edit.name} updated` },
      { markApplied: true }
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
