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

let workspaceDir: string;

beforeEach(() => {
  workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlon-prompts-'));
});

afterEach(() => {
  fs.rmSync(workspaceDir, { recursive: true, force: true });
});

function makeSync() {
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
  const sync = createPromptSync({
    owner: '~zod',
    workspaceDir,
    poke: async (poke) => {
      pokes.push(poke);
    },
    requestJson: async (path, method, body) => {
      requests.push({ path, method, body });
    },
    logger,
    watchWorkspace: (_directory, listener) => {
      watchListeners.push(listener);
      return watcher;
    },
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

    await sync.handleDispatch({
      requestId: '0v1',
      action: { set: { name: 'SOUL.md', text: 'be exact' } },
    });

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

    await sync.handleDispatch({
      requestId: '0v2',
      action: { set: { name: 'SOUL.md', text: 'cannot write a directory' } },
    });

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
      sync.handleDispatch({
        requestId: '0v3',
        action: { set: { name: 'SOUL.md', text: 'first' } },
      }),
      sync.handleDispatch({
        requestId: '0v4',
        action: { set: { name: 'USER.md', text: 'second' } },
      }),
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
    const dispatch = {
      requestId: '0v5',
      action: { set: { name: 'SOUL.md' as const, text: 'once' } },
    };

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
