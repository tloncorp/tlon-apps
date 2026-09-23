/**
 * Mirror the OpenClaw agent workspace into %steward's prompts projection.
 *
 * The workspace is authoritative. %steward sends owner edits to this harness;
 * after a successful local write, we publish the complete workspace snapshot
 * and then finalize that edit. This makes the ship a projection of what the
 * gateway is actually running rather than a second source of prompt state.
 */
import { randomUUID } from 'node:crypto';
import nodeFs, { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_ACCOUNT_ID,
  type OpenClawConfig,
} from 'openclaw/plugin-sdk/core';

import { normalizeShip } from './targets.js';
import { resolveTlonAccount } from './types.js';
import { UrbitHttpError } from './urbit/errors.js';

export const PROMPT_FILE_NAMES = [
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'BOOTSTRAP.md',
] as const;

export type PromptFileName = (typeof PROMPT_FILE_NAMES)[number];

/** Must match %steward's per-file cap. */
export const MAX_PROMPT_BYTES = 65_536;
/** The bot's HTTP finalize route; its reply confirms steward consumed it. */
export const STEWARD_PROMPTS_FINALIZE_PATH = '/steward/~/v1/prompts/finalize';
const MAX_COMPLETED_REQUESTS = 1_000;
/** Coalesce an editor's write/rename event burst into one projection. */
export const PROMPT_WATCH_DEBOUNCE_MS = 150;
/**
 * A failed poke does not necessarily drop the SSE stream, so nothing else
 * would re-run a lost owner configuration or projection: with the stream
 * still up and no local edit, a ship that missed its startup poke would stay
 * unconfigured or stale for the life of the process. So retries are not
 * capped by a count — only `close()` ends them. Retries run inside the serial
 * queue, which keeps ordering but means a permanently failing operation holds
 * the queue until close; that is the intended trade, since the alternative is
 * silently serving a stale projection.
 */
export const PROMPT_RETRY_BASE_MS = 500;
export const PROMPT_RETRY_MAX_MS = 30_000;

type Logger = {
  log: (message: string) => void;
  warn: (message: string) => void;
};

type Poke = (params: {
  app: string;
  mark: string;
  json: unknown;
}) => Promise<unknown>;

type RequestJson = (
  path: string,
  method: 'POST',
  body: unknown
) => Promise<unknown>;

type WorkspaceWatcher = {
  close: () => void;
  on: (event: 'error', listener: (error: Error) => void) => unknown;
};

type WatchWorkspace = (
  workspaceDir: string,
  listener: (eventType: string, filename: string | Buffer | null) => void
) => WorkspaceWatcher;

type PromptDispatch = {
  requestId: string;
  requester: string;
  action: { set: { name: PromptFileName; text: string } };
};

type PromptOutcome =
  | { type: 'updated'; name: PromptFileName }
  | {
      type: 'error';
      errorType: 'harness-error' | 'not-authorized';
      message: string[];
    };

export type PromptSync = {
  /** Configure the owner and publish the initial workspace projection. */
  start: () => Promise<void>;
  /** Publish the current workspace projection, for reconnect recovery. */
  project: (reason: string) => Promise<void>;
  /** Apply one typed dispatch from /v1/prompts/harness. */
  handleDispatch: (fact: unknown) => Promise<void>;
  /** Stop observing the workspace and settle already queued operations. */
  close: () => Promise<void>;
  /** Resolves once all queued filesystem and Gall operations have settled. */
  flush: () => Promise<void>;
};

export function isAllowedPromptName(name: unknown): name is PromptFileName {
  return (
    typeof name === 'string' &&
    (PROMPT_FILE_NAMES as readonly string[]).includes(name)
  );
}

function isWithinSizeLimit(text: string): boolean {
  return Buffer.byteLength(text, 'utf8') <= MAX_PROMPT_BYTES;
}

/**
 * Only one account may project prompts. Accounts usually resolve to the same
 * agent workspace, and two monitors writing one workspace would race each
 * other's edits. Routing can in principle give two accounts different
 * workspaces; this gate stays conservative rather than trying to detect that,
 * so the cost of the exotic case is a missing projection, never a corrupt one.
 */
export function shouldRunPromptSync(
  config: OpenClawConfig,
  accountId: string
): boolean {
  if (accountId === DEFAULT_ACCOUNT_ID) {
    return true;
  }
  const accounts = (
    config.channels?.tlon as { accounts?: Record<string, unknown> } | undefined
  )?.accounts;
  const runnable = [DEFAULT_ACCOUNT_ID, ...Object.keys(accounts ?? {})].filter(
    (id) => {
      const account = resolveTlonAccount(config, id);
      return account.configured && account.enabled;
    }
  );
  return runnable.length === 1 && runnable[0] === accountId;
}

function parseDispatch(fact: unknown): PromptDispatch | null {
  if (!fact || typeof fact !== 'object') {
    return null;
  }
  const candidate = fact as {
    requestId?: unknown;
    requester?: unknown;
    action?: { set?: { name?: unknown; text?: unknown } };
  };
  const requestId = candidate.requestId;
  const requester = candidate.requester;
  const set = candidate.action?.set;
  if (
    typeof requestId !== 'string' ||
    requestId.length === 0 ||
    typeof requester !== 'string' ||
    requester.length === 0 ||
    !set ||
    !isAllowedPromptName(set.name) ||
    typeof set.text !== 'string'
  ) {
    return null;
  }
  return {
    requestId,
    requester: normalizeShip(requester),
    action: { set: { name: set.name, text: set.text } },
  };
}

/**
 * Read a file from its descriptor, never following a final-component link or
 * blocking on a FIFO. A prepared workspace must not be able to project an
 * arbitrary readable host file to the owner ship.
 */
async function readPromptFile(filePath: string): Promise<string | null> {
  const handle = await fs.open(
    filePath,
    nodeFs.constants.O_RDONLY |
      nodeFs.constants.O_NOFOLLOW |
      nodeFs.constants.O_NONBLOCK
  );
  try {
    const info = await handle.stat();
    if (!info.isFile()) {
      throw new Error('not a regular file');
    }
    if (info.size > MAX_PROMPT_BYTES) {
      throw new Error(`exceeds ${MAX_PROMPT_BYTES} byte limit`);
    }
    const text = await handle.readFile('utf8');
    if (!isWithinSizeLimit(text)) {
      throw new Error(`exceeds ${MAX_PROMPT_BYTES} byte limit`);
    }
    return text;
  } finally {
    await handle.close().catch(() => {});
  }
}

export async function readWorkspacePrompts(
  workspaceDir: string
): Promise<Record<string, string>> {
  const prompts: Record<string, string> = {};
  for (const name of PROMPT_FILE_NAMES) {
    try {
      const text = await readPromptFile(path.join(workspaceDir, name));
      if (text !== null) {
        prompts[name] = text;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue;
      }
      throw new Error(`cannot read ${name}: ${String(error)}`);
    }
  }
  return prompts;
}

/** Atomically replace an allowlisted workspace file. */
export async function writeWorkspacePrompt(params: {
  workspaceDir: string;
  name: PromptFileName;
  text: string;
}): Promise<void> {
  if (!isWithinSizeLimit(params.text)) {
    throw new Error(`${params.name} exceeds ${MAX_PROMPT_BYTES} byte limit`);
  }
  await fs.mkdir(params.workspaceDir, { recursive: true });
  const target = path.join(params.workspaceDir, params.name);
  const temporary = `${target}.${randomUUID()}.tmp`;
  // Replacing through a temporary file would otherwise reset the target to
  // Node's default 0666 filtered by the umask, so an owner edit of a 0600
  // prompt would publish it to every other local user. lstat, so a symlinked
  // name reports the link rather than whatever it points at; only a regular
  // file's mode is worth carrying over. A file we create keeps the process
  // default, as any other new workspace file would.
  let mode: number | null = null;
  try {
    const existing = await fs.lstat(target);
    if (existing.isFile()) {
      mode = existing.mode & 0o777;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  try {
    await fs.writeFile(temporary, params.text, {
      encoding: 'utf8',
      flag: 'wx',
      ...(mode === null ? {} : { mode }),
    });
    // writeFile's mode is still masked by the umask; chmod is not.
    if (mode !== null) {
      await fs.chmod(temporary, mode);
    }
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.unlink(temporary).catch(() => {});
    throw error;
  }
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1_000);
}

/**
 * Create the local harness relay. Operations are serialized so two owner
 * edits cannot project an intermediate workspace or race their finalization.
 */
export function createPromptSync(opts: {
  owner: string;
  workspaceDir: string;
  poke: Poke;
  requestJson: RequestJson;
  logger: Logger;
  /** Injectable so the watcher behavior can be tested without open handles. */
  watchWorkspace?: WatchWorkspace;
  /**
   * Injectable so retry behavior can be tested without real backoff waits.
   * `attempts` exists only so a test can force the give-up path; production
   * retries until the operation lands or `close()` aborts it.
   */
  retry?: { attempts?: number; baseMs?: number; maxMs?: number };
  /**
   * Refresh the ship session. A stale cookie fails a request identically on
   * every attempt, and the only other thing that refreshes it is an SSE
   * reconnect, which a healthy stream never triggers.
   */
  reauthenticate?: () => Promise<void>;
}): PromptSync {
  const retryAttempts = opts.retry?.attempts ?? Number.POSITIVE_INFINITY;
  const retryBaseMs = opts.retry?.baseMs ?? PROMPT_RETRY_BASE_MS;
  const retryMaxMs = opts.retry?.maxMs ?? PROMPT_RETRY_MAX_MS;
  let configured = false;
  let closed = false;
  let watcher: WorkspaceWatcher | null = null;
  let watchTimer: ReturnType<typeof setTimeout> | null = null;
  let queue: Promise<void> = Promise.resolve();
  // Woken by close() so a backoff sleep never outlives the monitor.
  let retryWaiters = new Set<() => void>();
  // Steward suppresses completed commands itself. This cache also makes a
  // duplicate fact on one live SSE channel a terminal-result retry rather
  // than a second workspace write. The dispatch rides along because an id
  // alone is not identity: a client may reuse one after %steward has aged
  // its record out, and that is a new edit.
  const completed = new Map<
    string,
    {
      outcome: PromptOutcome;
      requester: string;
      action: PromptDispatch['action'];
    }
  >();
  const sameDispatch = (
    prior: { requester: string; action: PromptDispatch['action'] },
    next: PromptDispatch
  ) =>
    prior.requester === next.requester &&
    prior.action.set.name === next.action.set.name &&
    prior.action.set.text === next.action.set.text;

  const isUnauthorized = (error: unknown) =>
    error instanceof UrbitHttpError && error.status === 401;

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      if (closed) {
        resolve();
        return;
      }
      const wake = () => {
        clearTimeout(timer);
        retryWaiters.delete(wake);
        resolve();
      };
      const timer = setTimeout(wake, ms);
      retryWaiters.add(wake);
    });

  /** Retry a ship-side operation until it lands or this sync closes. */
  const withRetry = async (label: string, work: () => Promise<void>) => {
    for (let attempt = 1; ; attempt += 1) {
      if (closed) {
        throw new Error(`${label} abandoned: prompt sync closed`);
      }
      try {
        await work();
        return;
      } catch (error) {
        if (closed || attempt >= retryAttempts) {
          throw error;
        }
        if (isUnauthorized(error) && opts.reauthenticate) {
          opts.logger.warn(
            `[tlon] ${label} was refused (401); refreshing the session before retrying`
          );
          try {
            await opts.reauthenticate();
          } catch (reauthError) {
            opts.logger.warn(
              `[tlon] Session refresh failed: ${errorMessage(reauthError)}`
            );
          }
        }
        const wait = Math.min(retryBaseMs * 2 ** (attempt - 1), retryMaxMs);
        opts.logger.warn(
          `[tlon] ${label} failed (attempt ${attempt}), retrying in ${wait}ms: ${errorMessage(error)}`
        );
        await sleep(wait);
      }
    }
  };

  /**
   * `force` re-asserts ownership after a reconnect: %steward may have been
   * reset or re-pointed while this process stayed up, in which case a cached
   * flag would leave the owner unauthorized to watch or edit until restart.
   */
  const configure = async (force = false) => {
    if (configured && !force) {
      return;
    }
    await withRetry('Steward owner configure', async () => {
      await opts.poke({
        app: 'steward',
        mark: 'steward-action-1',
        json: { configure: { owner: opts.owner } },
      });
    });
    configured = true;
  };

  const publish = async (reason: string) => {
    // The read stays outside the retry on purpose. An oversized or symlinked
    // file fails the same way every time, and looping on it would hold
    // startup and every later owner edit behind one bad file. Only the poke
    // is a network step worth retrying.
    const prompts = await readWorkspacePrompts(opts.workspaceDir);
    await withRetry(`Prompt projection (${reason})`, async () => {
      await opts.poke({
        app: 'steward',
        mark: 'steward-prompts-action-1',
        json: { project: prompts },
      });
    });
    opts.logger.log(
      `[tlon] Projected ${Object.keys(prompts).length} prompt file(s) (${reason})`
    );
  };

  const finalize = async (requestId: string, body: PromptOutcome) => {
    await withRetry(`Prompt finalize ${requestId}`, async () => {
      await opts.requestJson(STEWARD_PROMPTS_FINALIZE_PATH, 'POST', {
        requestId,
        body,
      });
    });
  };

  const rememberCompleted = (
    dispatch: PromptDispatch,
    outcome: PromptOutcome
  ) => {
    const { requestId, requester, action } = dispatch;
    completed.delete(requestId);
    completed.set(requestId, { outcome, requester, action });
    while (completed.size > MAX_COMPLETED_REQUESTS) {
      const oldest = completed.keys().next().value;
      if (oldest === undefined) {
        return;
      }
      completed.delete(oldest);
    }
  };

  const enqueue = (work: () => Promise<void>) => {
    // A dispatch can still arrive between close() and the SSE client
    // shutting down. Refuse it rather than let a torn-down monitor write
    // the workspace its replacement already owns.
    if (closed) {
      opts.logger.warn('[tlon] Prompt sync is closed; dropped queued work');
      return queue;
    }
    queue = queue.then(work).catch((error) => {
      opts.logger.warn(`[tlon] Prompt sync failed: ${errorMessage(error)}`);
    });
    return queue;
  };

  const scheduleWorkspaceProjection = () => {
    if (closed) {
      return;
    }
    if (watchTimer) {
      clearTimeout(watchTimer);
    }
    watchTimer = setTimeout(() => {
      watchTimer = null;
      void enqueue(async () => {
        await configure();
        await publish('workspace change');
      });
    }, PROMPT_WATCH_DEBOUNCE_MS);
  };

  const startWatcher = async () => {
    if (closed || watcher) {
      return;
    }
    await fs.mkdir(opts.workspaceDir, { recursive: true });
    if (closed || watcher) {
      return;
    }
    const watchWorkspace =
      opts.watchWorkspace ??
      ((directory, listener) => nodeFs.watch(directory, listener));
    watcher = watchWorkspace(opts.workspaceDir, (_eventType, filename) => {
      // Writing through a temporary file emits events for both that file and
      // the final rename. Only the final allowlisted name can change the
      // projection. A missing filename is documented on some platforms, so
      // conservatively re-read the complete allowlist in that case.
      if (
        filename === null ||
        isAllowedPromptName(path.basename(filename.toString()))
      ) {
        scheduleWorkspaceProjection();
      }
    });
    watcher.on('error', (error) => {
      if (!closed) {
        opts.logger.warn(
          `[tlon] Prompt workspace watcher failed: ${errorMessage(error)}`
        );
      }
    });
  };

  return {
    start: () =>
      enqueue(async () => {
        // Install the watcher first. A local edit made during the initial
        // owner configuration is then queued after this startup projection.
        // It is optional, though: if it cannot open (inotify exhausted, a
        // filesystem that cannot be watched), only local-edit detection is
        // lost, and that must not take the owner configuration and the
        // initial projection down with it.
        try {
          await startWatcher();
        } catch (error) {
          opts.logger.warn(
            `[tlon] Prompt workspace watcher unavailable; local edits will not be projected until restart: ${errorMessage(error)}`
          );
        }
        await configure();
        await publish('startup');
      }),
    project: (reason) =>
      enqueue(async () => {
        await configure(true);
        await publish(reason);
      }),
    handleDispatch: (fact) =>
      enqueue(async () => {
        const dispatch = parseDispatch(fact);
        if (!dispatch) {
          opts.logger.warn('[tlon] Ignored malformed steward prompt dispatch');
          return;
        }
        const { requestId, requester, action } = dispatch;
        const prior = completed.get(requestId);
        if (prior && sameDispatch(prior, dispatch)) {
          await finalize(requestId, prior.outcome);
          return;
        }
        if (prior) {
          // %steward has aged its own record out and admitted this as a new
          // command, so reporting the old outcome would skip the write it
          // actually asked for.
          opts.logger.warn(
            `[tlon] Prompt dispatch ${requestId} reuses a completed id with different content; treating it as new`
          );
          completed.delete(requestId);
        }
        // %steward authorizes a command against the owner it held when the
        // command arrived, and replays it to whichever harness subscribes.
        // After an ownerShip change this watch goes live before our
        // %configure lands, so the replay can carry the previous owner's
        // edit; applying it would write text the current owner never asked
        // for.
        if (requester !== opts.owner) {
          const outcome: PromptOutcome = {
            type: 'error',
            errorType: 'not-authorized',
            message: [`requester ${requester} is not the configured owner`],
          };
          rememberCompleted(dispatch, outcome);
          opts.logger.warn(
            `[tlon] Refused prompt edit ${requestId}: ${requester} is not the configured owner ${opts.owner}`
          );
          await finalize(requestId, outcome);
          return;
        }
        // Facts can arrive as soon as the subscription becomes live. Ensure
        // an early replay cannot run ahead of the startup projection's
        // owner configuration.
        await configure();
        let outcome: PromptOutcome;
        try {
          await writeWorkspacePrompt({
            workspaceDir: opts.workspaceDir,
            name: action.set.name,
            text: action.set.text,
          });
          outcome = { type: 'updated', name: action.set.name };
        } catch (error) {
          outcome = {
            type: 'error',
            errorType: 'harness-error',
            message: [errorMessage(error)],
          };
          opts.logger.warn(
            `[tlon] Prompt edit ${requestId} failed: ${errorMessage(error)}`
          );
        }
        // Cache before the ship steps. The write has already either happened
        // or not, so a replay after a failed projection or finalize must
        // retry only the terminal response — repeating the write would put
        // this text back over whatever edit landed in between.
        rememberCompleted(dispatch, outcome);
        if (outcome.type === 'updated') {
          // The projection lands before %finalize, so every terminal owner
          // response corresponds to the workspace snapshot it requested. A
          // projection that fails anyway must not turn a completed write
          // into an error: the write stands, the watcher this write already
          // woke re-projects it, and a reconnect re-projects it again.
          try {
            await publish(`edit ${action.set.name}`);
          } catch (error) {
            opts.logger.warn(
              `[tlon] Prompt edit ${requestId} was written but not projected: ${errorMessage(error)}`
            );
          }
        }
        await finalize(requestId, outcome);
      }),
    close: async () => {
      closed = true;
      // Wake every backoff sleep so an unreachable ship cannot hold the
      // queue — and therefore this close — open for its full retry budget.
      const waiters = retryWaiters;
      retryWaiters = new Set();
      for (const wake of waiters) {
        wake();
      }
      if (watchTimer) {
        clearTimeout(watchTimer);
        watchTimer = null;
      }
      if (watcher) {
        try {
          watcher.close();
        } catch (error) {
          opts.logger.warn(
            `[tlon] Prompt workspace watcher cleanup failed: ${errorMessage(error)}`
          );
        }
        watcher = null;
      }
      await queue;
    },
    flush: () => queue,
  };
}
