import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_PROMPT_BYTES,
  PROMPT_WATCH_DEBOUNCE_MS,
  createPromptSync,
  isAllowedPromptName,
  readWorkspacePrompts,
  shouldRunPromptSync,
} from './prompt-sync.js';
import { UrbitHttpError } from './urbit/errors.js';

/** Matches the injected retry budget below, so tests can exhaust it. */
const RETRY_ATTEMPTS = 3;

let workspaceDir: string;

beforeEach(() => {
  workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlon-prompts-'));
});

afterEach(() => {
  fs.rmSync(workspaceDir, { recursive: true, force: true });
});

/** A dispatch as %steward sends it, authorized by the configured owner. */
function dispatchFrom(
  requestId: string,
  name: 'SOUL.md' | 'USER.md' | 'AGENTS.md',
  text: string,
  requester = '~zod'
) {
  return { requestId, requester, action: { set: { name, text } } };
}

function makeSync(
  opts: {
    /** Fail the first `n` pokes carrying this json key, then succeed. */
    failPokes?: { key: string; times: number };
    /** Make opening the workspace watcher throw. */
    watchThrows?: boolean;
    /** Fail the first `n` finalize requests, then succeed. */
    failFinalize?: number;
    /** Attempt cap; pass undefined for the production (uncapped) behavior. */
    retryAttempts?: number;
    retryBaseMs?: number;
    /** What a failing finalize throws; defaults to a plain Error. */
    finalizeError?: Error;
    /** What a failing poke throws; defaults to a plain Error. */
    pokeError?: Error;
    reauthenticate?: () => Promise<void>;
  } = {}
) {
  const pokes: Array<{ app: string; mark: string; json: unknown }> = [];
  const requests: Array<{ path: string; method: string; body: unknown }> = [];
  const logger = { log: vi.fn(), warn: vi.fn() };
  const watchListeners: Array<
    (eventType: string, filename: string | Buffer | null) => void
  > = [];
  const watcherClose = vi.fn();
  const watcher = {
    close: watcherClose,
    on(_event: 'error', _listener: (error: Error) => void) {
      return watcher;
    },
  };
  let pokeFailuresLeft = opts.failPokes?.times ?? 0;
  let finalizeFailuresLeft = opts.failFinalize ?? 0;
  const sync = createPromptSync({
    owner: '~zod',
    workspaceDir,
    poke: async (poke) => {
      if (
        opts.failPokes &&
        pokeFailuresLeft > 0 &&
        Object.hasOwn(poke.json as object, opts.failPokes.key)
      ) {
        pokeFailuresLeft -= 1;
        throw opts.pokeError ?? new Error(`poke ${opts.failPokes.key} refused`);
      }
      pokes.push(poke);
    },
    requestJson: async (path, method, body) => {
      if (finalizeFailuresLeft > 0) {
        finalizeFailuresLeft -= 1;
        throw opts.finalizeError ?? new Error('finalize refused');
      }
      requests.push({ path, method, body });
    },
    logger,
    watchWorkspace: (_directory, listener) => {
      if (opts.watchThrows) {
        throw Object.assign(new Error('ENOSPC: inotify watch limit reached'), {
          code: 'ENOSPC',
        });
      }
      watchListeners.push(listener);
      return watcher;
    },
    // Exercise the retry loop without waiting out the real backoff.
    retry: {
      attempts: 'retryAttempts' in opts ? opts.retryAttempts : RETRY_ATTEMPTS,
      baseMs: opts.retryBaseMs ?? 0,
      maxMs: opts.retryBaseMs ?? 0,
    },
    ...(opts.reauthenticate ? { reauthenticate: opts.reauthenticate } : {}),
  });
  return { sync, pokes, requests, logger, watchListeners, watcherClose };
}

describe('prompt workspace projection', () => {
  it('only exposes the allowlisted regular workspace files', async () => {
    fs.writeFileSync(path.join(workspaceDir, 'AGENTS.md'), 'follow the map');
    fs.writeFileSync(path.join(workspaceDir, 'MEMORY.md'), 'private memory');

    await expect(readWorkspacePrompts(workspaceDir)).resolves.toEqual({
      'AGENTS.md': 'follow the map',
    });
  });

  it('refuses to project symlinked or oversized files', async () => {
    fs.symlinkSync('/etc/hosts', path.join(workspaceDir, 'SOUL.md'));
    await expect(readWorkspacePrompts(workspaceDir)).rejects.toThrow(
      'cannot read SOUL.md'
    );

    fs.unlinkSync(path.join(workspaceDir, 'SOUL.md'));
    fs.writeFileSync(
      path.join(workspaceDir, 'SOUL.md'),
      'x'.repeat(MAX_PROMPT_BYTES + 1)
    );
    await expect(readWorkspacePrompts(workspaceDir)).rejects.toThrow('exceeds');
  });

  it('configures its owner and projects the complete workspace on startup', async () => {
    fs.writeFileSync(path.join(workspaceDir, 'SOUL.md'), 'be concise');
    const { sync, pokes } = makeSync();

    await sync.start();

    expect(pokes).toEqual([
      {
        app: 'steward',
        mark: 'steward-action-1',
        json: { configure: { owner: '~zod' } },
      },
      {
        app: 'steward',
        mark: 'steward-prompts-action-1',
        json: { project: { 'SOUL.md': 'be concise' } },
      },
    ]);
  });

  it('projects a local allowlisted write after its atomic rename event', async () => {
    vi.useFakeTimers();
    try {
      const { sync, pokes, watchListeners } = makeSync();
      await sync.start();
      fs.writeFileSync(path.join(workspaceDir, 'AGENTS.md'), 'local change');

      watchListeners[0]('rename', 'AGENTS.md');
      await vi.advanceTimersByTimeAsync(PROMPT_WATCH_DEBOUNCE_MS);
      await sync.flush();

      expect(pokes.map((poke) => poke.json)).toEqual([
        { configure: { owner: '~zod' } },
        { project: {} },
        { project: { 'AGENTS.md': 'local change' } },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still configures and projects when the watcher cannot open', async () => {
    fs.writeFileSync(path.join(workspaceDir, 'SOUL.md'), 'unwatched');
    const { sync, pokes, logger } = makeSync({ watchThrows: true });

    await sync.start();

    expect(pokes.map((poke) => poke.json)).toEqual([
      { configure: { owner: '~zod' } },
      { project: { 'SOUL.md': 'unwatched' } },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('watcher unavailable')
    );
  });

  it('ignores workspace changes outside the prompt allowlist', async () => {
    vi.useFakeTimers();
    try {
      const { sync, pokes, watchListeners } = makeSync();
      await sync.start();

      watchListeners[0]('change', 'MEMORY.md');
      await vi.advanceTimersByTimeAsync(PROMPT_WATCH_DEBOUNCE_MS);
      await sync.flush();

      expect(pokes).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes its workspace watcher and ignores later events', async () => {
    vi.useFakeTimers();
    try {
      const { sync, pokes, watchListeners, watcherClose } = makeSync();
      await sync.start();
      await sync.close();

      watchListeners[0]('change', 'AGENTS.md');
      await vi.advanceTimersByTimeAsync(PROMPT_WATCH_DEBOUNCE_MS);
      await sync.flush();

      expect(watcherClose).toHaveBeenCalledOnce();
      expect(pokes).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('writes an owner edit, projects it, and then finalizes it', async () => {
    const { sync, pokes, requests } = makeSync();

    await sync.handleDispatch(dispatchFrom('0v1', 'SOUL.md', 'be exact'));

    expect(fs.readFileSync(path.join(workspaceDir, 'SOUL.md'), 'utf8')).toBe(
      'be exact'
    );
    expect(pokes).toEqual([
      {
        app: 'steward',
        mark: 'steward-action-1',
        json: { configure: { owner: '~zod' } },
      },
      {
        app: 'steward',
        mark: 'steward-prompts-action-1',
        json: { project: { 'SOUL.md': 'be exact' } },
      },
    ]);
    expect(requests).toEqual([
      {
        path: '/steward/~/v1/prompts/finalize',
        method: 'POST',
        body: {
          requestId: '0v1',
          body: { type: 'updated', name: 'SOUL.md' },
        },
      },
    ]);
  });

  it('finalizes a failed edit without replacing the last projection', async () => {
    fs.mkdirSync(path.join(workspaceDir, 'SOUL.md'));
    const { sync, pokes, requests } = makeSync();

    await sync.handleDispatch(
      dispatchFrom('0v2', 'SOUL.md', 'cannot write a directory')
    );

    expect(pokes).toEqual([
      {
        app: 'steward',
        mark: 'steward-action-1',
        json: { configure: { owner: '~zod' } },
      },
    ]);
    expect(requests).toEqual([
      {
        path: '/steward/~/v1/prompts/finalize',
        method: 'POST',
        body: {
          requestId: '0v2',
          body: {
            type: 'error',
            errorType: 'harness-error',
            message: [expect.any(String)],
          },
        },
      },
    ]);
  });

  it('serializes dispatches so each finalize follows its projection', async () => {
    const { sync, pokes, requests } = makeSync();

    await Promise.all([
      sync.handleDispatch(dispatchFrom('0v3', 'SOUL.md', 'first')),
      sync.handleDispatch(dispatchFrom('0v4', 'USER.md', 'second')),
    ]);

    expect(pokes.map((poke) => poke.json)).toEqual([
      { configure: { owner: '~zod' } },
      { project: { 'SOUL.md': 'first' } },
      { project: { 'SOUL.md': 'first', 'USER.md': 'second' } },
    ]);
    expect(requests).toEqual([
      {
        path: '/steward/~/v1/prompts/finalize',
        method: 'POST',
        body: { requestId: '0v3', body: { type: 'updated', name: 'SOUL.md' } },
      },
      {
        path: '/steward/~/v1/prompts/finalize',
        method: 'POST',
        body: { requestId: '0v4', body: { type: 'updated', name: 'USER.md' } },
      },
    ]);
  });

  it('re-finalizes duplicate dispatches without writing or projecting again', async () => {
    const { sync, pokes, requests } = makeSync();
    const dispatch = dispatchFrom('0v5', 'SOUL.md', 'once');

    await sync.handleDispatch(dispatch);
    await sync.handleDispatch(dispatch);

    expect(pokes.map((poke) => poke.json)).toEqual([
      { configure: { owner: '~zod' } },
      { project: { 'SOUL.md': 'once' } },
    ]);
    expect(requests).toEqual([
      {
        path: '/steward/~/v1/prompts/finalize',
        method: 'POST',
        body: { requestId: '0v5', body: { type: 'updated', name: 'SOUL.md' } },
      },
      {
        path: '/steward/~/v1/prompts/finalize',
        method: 'POST',
        body: { requestId: '0v5', body: { type: 'updated', name: 'SOUL.md' } },
      },
    ]);
  });

  it('refuses a dispatch authorized by a previous owner', async () => {
    const { sync, pokes, requests, logger } = makeSync();

    await sync.handleDispatch(
      dispatchFrom('0v6', 'SOUL.md', 'from the old owner', '~bus')
    );

    expect(fs.existsSync(path.join(workspaceDir, 'SOUL.md'))).toBe(false);
    expect(pokes).toEqual([]);
    expect(requests).toEqual([
      {
        path: '/steward/~/v1/prompts/finalize',
        method: 'POST',
        body: {
          requestId: '0v6',
          body: {
            type: 'error',
            errorType: 'not-authorized',
            message: [expect.stringContaining('~bus')],
          },
        },
      },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('not the configured owner')
    );
  });

  it('replays only the response when a completed edit failed to finalize', async () => {
    const { sync, requests } = makeSync({ failFinalize: RETRY_ATTEMPTS });
    const dispatch = dispatchFrom('0v7', 'SOUL.md', 'original');

    await sync.handleDispatch(dispatch);
    expect(requests).toEqual([]);

    // %steward still holds the request, so it replays it after recovery. The
    // newer text must survive: only the terminal response may be retried.
    fs.writeFileSync(path.join(workspaceDir, 'SOUL.md'), 'newer local edit');
    await sync.handleDispatch(dispatch);

    expect(fs.readFileSync(path.join(workspaceDir, 'SOUL.md'), 'utf8')).toBe(
      'newer local edit'
    );
    expect(requests).toEqual([
      {
        path: '/steward/~/v1/prompts/finalize',
        method: 'POST',
        body: { requestId: '0v7', body: { type: 'updated', name: 'SOUL.md' } },
      },
    ]);
  });

  it('reports a written edit as updated even when its projection fails', async () => {
    const { sync, requests } = makeSync({
      failPokes: { key: 'project', times: 99 },
    });

    await sync.handleDispatch(dispatchFrom('0v8', 'SOUL.md', 'written'));

    expect(fs.readFileSync(path.join(workspaceDir, 'SOUL.md'), 'utf8')).toBe(
      'written'
    );
    expect(requests).toEqual([
      {
        path: '/steward/~/v1/prompts/finalize',
        method: 'POST',
        body: { requestId: '0v8', body: { type: 'updated', name: 'SOUL.md' } },
      },
    ]);
  });

  it('keeps retrying a projection past any fixed attempt budget', async () => {
    // The default has no attempt cap: only close() ends the retries, so a
    // ship outage longer than a fixed budget cannot leave a stale projection.
    const { sync, pokes } = makeSync({
      failPokes: { key: 'project', times: 25 },
      retryAttempts: undefined,
    });
    fs.writeFileSync(path.join(workspaceDir, 'SOUL.md'), 'persistent');

    await sync.start();

    expect(pokes.map((poke) => poke.json)).toEqual([
      { configure: { owner: '~zod' } },
      { project: { 'SOUL.md': 'persistent' } },
    ]);
  });

  it('abandons retries when the sync closes mid-outage', async () => {
    const { sync, pokes, logger } = makeSync({
      failPokes: { key: 'project', times: 1_000 },
      retryAttempts: undefined,
      retryBaseMs: 50,
    });

    const started = sync.start();
    await sync.close();
    await started;

    // close() both stops the retries and settles the queue, so the projection
    // is abandoned rather than hanging on a ship that never answers.
    expect(
      pokes.some((poke) => Object.hasOwn(poke.json as object, 'project'))
    ).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Prompt sync failed')
    );
  });

  it('does not retry a projection whose workspace read fails', async () => {
    // Uncapped retries, so looping on a deterministic file error would hang
    // here — and would hold startup and every later edit in production.
    fs.writeFileSync(
      path.join(workspaceDir, 'SOUL.md'),
      'x'.repeat(MAX_PROMPT_BYTES + 1)
    );
    const { sync, pokes, logger } = makeSync({ retryAttempts: undefined });

    await sync.start();

    expect(pokes.map((poke) => poke.json)).toEqual([
      { configure: { owner: '~zod' } },
    ]);
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('retrying')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('exceeds')
    );
  });

  it('refreshes the session when finalize is refused with 401', async () => {
    const reauthenticate = vi.fn(async () => {});
    const { sync, requests } = makeSync({
      failFinalize: 1,
      finalizeError: new UrbitHttpError({
        operation: 'request /steward/~/v1/prompts/finalize',
        status: 401,
      }),
      reauthenticate,
    });

    await sync.handleDispatch(dispatchFrom('0vc', 'SOUL.md', 'still here'));

    // The stale cookie would fail identically forever; the retry only makes
    // sense once the session has been refreshed.
    expect(reauthenticate).toHaveBeenCalledOnce();
    expect(requests).toEqual([
      {
        path: '/steward/~/v1/prompts/finalize',
        method: 'POST',
        body: { requestId: '0vc', body: { type: 'updated', name: 'SOUL.md' } },
      },
    ]);
  });

  it('refreshes the session when a projection poke is refused with 401', async () => {
    // Every projection is a channel poke, so this transport matters more
    // than finalize: a stale cookie here would stall startup and every
    // later edit.
    const reauthenticate = vi.fn(async () => {});
    const { sync, pokes } = makeSync({
      failPokes: { key: 'project', times: 1 },
      pokeError: new UrbitHttpError({ operation: 'Poke', status: 401 }),
      reauthenticate,
    });
    fs.writeFileSync(path.join(workspaceDir, 'SOUL.md'), 'after refresh');

    await sync.start();

    expect(reauthenticate).toHaveBeenCalledOnce();
    expect(pokes.map((poke) => poke.json)).toEqual([
      { configure: { owner: '~zod' } },
      { project: { 'SOUL.md': 'after refresh' } },
    ]);
  });

  it('does not retry a finalize the ship rejects as a client error', async () => {
    // A 404 is what a plugin newer than its desk gets from a missing route;
    // retrying it forever would block every later edit and projection.
    const { sync, requests, logger } = makeSync({
      failFinalize: 1,
      finalizeError: new UrbitHttpError({
        operation: 'request /steward/~/v1/prompts/finalize',
        status: 404,
      }),
      retryAttempts: undefined,
    });

    await sync.handleDispatch(dispatchFrom('0ve', 'SOUL.md', 'skewed'));
    await sync.handleDispatch(dispatchFrom('0vf', 'USER.md', 'next edit'));

    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Prompt finalize 0ve failed (attempt')
    );
    expect(requests.map((request) => request.body)).toEqual([
      { requestId: '0vf', body: { type: 'updated', name: 'USER.md' } },
    ]);
  });

  it('treats a reused request id with different content as a new edit', async () => {
    const { sync, requests, logger } = makeSync();

    await sync.handleDispatch(dispatchFrom('0vd', 'SOUL.md', 'first'));
    // %steward ages a completed record out after an hour, after which a
    // client may legitimately reuse the id for something else.
    await sync.handleDispatch(dispatchFrom('0vd', 'USER.md', 'second'));

    expect(fs.readFileSync(path.join(workspaceDir, 'USER.md'), 'utf8')).toBe(
      'second'
    );
    expect(requests.map((request) => request.body)).toEqual([
      { requestId: '0vd', body: { type: 'updated', name: 'SOUL.md' } },
      { requestId: '0vd', body: { type: 'updated', name: 'USER.md' } },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('reuses a completed id')
    );
  });

  it('retries a failed projection until it lands', async () => {
    const { sync, pokes, logger } = makeSync({
      failPokes: { key: 'project', times: 2 },
    });
    fs.writeFileSync(path.join(workspaceDir, 'SOUL.md'), 'eventually');

    await sync.start();

    expect(pokes.map((poke) => poke.json)).toEqual([
      { configure: { owner: '~zod' } },
      { project: { 'SOUL.md': 'eventually' } },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('retrying')
    );
  });

  it('re-asserts ownership when reprojecting after a reconnect', async () => {
    const { sync, pokes } = makeSync();

    await sync.start();
    await sync.project('reconnect');

    // %steward may have been reset or re-pointed while this process stayed
    // up, so the owner is configured again rather than assumed.
    expect(pokes.map((poke) => poke.json)).toEqual([
      { configure: { owner: '~zod' } },
      { project: {} },
      { configure: { owner: '~zod' } },
      { project: {} },
    ]);
  });

  it('drops dispatches that arrive after close', async () => {
    const { sync, pokes, requests } = makeSync();

    await sync.start();
    await sync.close();
    await sync.handleDispatch(dispatchFrom('0v9', 'SOUL.md', 'too late'));

    expect(fs.existsSync(path.join(workspaceDir, 'SOUL.md'))).toBe(false);
    expect(pokes).toHaveLength(2);
    expect(requests).toEqual([]);
  });

  it('keeps a restrictive mode when replacing an existing prompt file', async () => {
    const target = path.join(workspaceDir, 'SOUL.md');
    fs.writeFileSync(target, 'private', { mode: 0o600 });
    fs.chmodSync(target, 0o600);
    const { sync } = makeSync();

    await sync.handleDispatch(dispatchFrom('0va', 'SOUL.md', 'still private'));

    expect(fs.readFileSync(target, 'utf8')).toBe('still private');
    expect(fs.statSync(target).mode & 0o777).toBe(0o600);
  });
});

describe('prompt sync selection', () => {
  it('accepts only the workspace allowlist', () => {
    expect(isAllowedPromptName('AGENTS.md')).toBe(true);
    expect(isAllowedPromptName('../SOUL.md')).toBe(false);
    expect(isAllowedPromptName('MEMORY.md')).toBe(false);
  });

  it('selects a single runnable account for the shared workspace', () => {
    const config = {
      channels: {
        tlon: {
          accounts: {
            hosted: {
              enabled: true,
              ship: '~bus',
              url: 'http://bus',
              code: 'x',
            },
          },
        },
      },
    } as never;
    expect(shouldRunPromptSync(config, 'hosted')).toBe(true);

    (
      config as {
        channels: { tlon: { ship?: string; url?: string; code?: string } };
      }
    ).channels.tlon.ship = '~zod';
    (
      config as {
        channels: { tlon: { ship?: string; url?: string; code?: string } };
      }
    ).channels.tlon.url = 'http://zod';
    (
      config as {
        channels: { tlon: { ship?: string; url?: string; code?: string } };
      }
    ).channels.tlon.code = 'x';
    expect(shouldRunPromptSync(config, 'hosted')).toBe(false);
  });
});
