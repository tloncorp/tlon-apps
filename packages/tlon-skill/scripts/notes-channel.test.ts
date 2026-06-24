import { describe, expect, it } from 'bun:test';

import type { HttpMethod } from './commands/notes';
import {
  type NotesChannelDeps,
  createNotesChannelInGroup,
} from './notes-channel';

// A successful PR-7 group-mode create response.
const NOTEBOOK_RES = {
  requestId: 'r1',
  body: {
    type: 'notebook',
    notebook: {
      host: '~zod',
      flagName: 'newbook',
      notebook: { id: 5, title: 'New' },
    },
  },
};
const NEW_NEST = 'notes/~zod/newbook';

interface MakeDepsOptions {
  requestJson?: (
    path: string,
    method: HttpMethod,
    body?: unknown
  ) => Promise<unknown>;
  getGroupChannelIds?: (groupId: string) => Promise<string[]>;
}

function makeDeps(options: MakeDepsOptions = {}) {
  const calls = {
    requestJson: [] as Array<{
      path: string;
      method: HttpMethod;
      body?: unknown;
    }>,
    getGroupChannelIds: [] as string[],
    deleteNotesNotebook: [] as string[],
    sleep: [] as number[],
    log: [] as string[],
  };

  const deps: NotesChannelDeps = {
    requestJson: (async (path: string, method: HttpMethod, body?: unknown) => {
      calls.requestJson.push({ path, method, body });
      return options.requestJson
        ? await options.requestJson(path, method, body)
        : undefined;
    }) as NotesChannelDeps['requestJson'],
    getGroupChannelIds: async (groupId) => {
      calls.getGroupChannelIds.push(groupId);
      return options.getGroupChannelIds
        ? await options.getGroupChannelIds(groupId)
        : [];
    },
    deleteNotesNotebook: async (nest) => {
      calls.deleteNotesNotebook.push(nest);
    },
    sleep: async (ms) => {
      calls.sleep.push(ms);
    },
    log: (message) => {
      calls.log.push(message);
    },
  };

  return { deps, calls };
}

describe('createNotesChannelInGroup', () => {
  it('POSTs the group-bound notebook and returns the registered nest', async () => {
    const { deps, calls } = makeDeps({
      requestJson: async () => NOTEBOOK_RES,
      getGroupChannelIds: async () => [NEW_NEST],
    });

    const nest = await createNotesChannelInGroup(
      { groupId: '~zod/group', title: 'New' },
      deps
    );

    expect(nest).toBe(NEW_NEST);
    // Routes to %notes via requestJson — never to createChannel/%channels (which
    // isn't even a dependency here).
    expect(calls.requestJson).toEqual([
      {
        path: '/notes/~/v1/notebooks',
        method: 'POST',
        body: {
          title: 'New',
          group: { host: '~zod', flagName: 'group' },
          readers: [],
        },
      },
    ]);
    expect(calls.deleteNotesNotebook).toEqual([]);
  });

  it('retries the listing check and succeeds once the channel appears', async () => {
    let attempts = 0;
    const { deps, calls } = makeDeps({
      requestJson: async () => NOTEBOOK_RES,
      getGroupChannelIds: async () => {
        attempts += 1;
        return attempts >= 3 ? [NEW_NEST] : [];
      },
    });

    const nest = await createNotesChannelInGroup(
      { groupId: '~zod/group', title: 'New' },
      deps
    );

    expect(nest).toBe(NEW_NEST);
    expect(calls.getGroupChannelIds).toHaveLength(3);
    expect(calls.sleep).toHaveLength(2); // slept after the first two misses
    expect(calls.deleteNotesNotebook).toEqual([]);
  });

  it('cleans up and fails loudly when the listing never registers (pre-PR-7)', async () => {
    const { deps, calls } = makeDeps({
      requestJson: async () => NOTEBOOK_RES,
      getGroupChannelIds: async () => [],
    });

    await expect(
      createNotesChannelInGroup({ groupId: '~zod/group', title: 'New' }, deps)
    ).rejects.toThrow('did not register as a channel');

    // Removed the stray solo notebook; verified all five attempts (four sleeps).
    expect(calls.deleteNotesNotebook).toEqual([NEW_NEST]);
    expect(calls.getGroupChannelIds).toHaveLength(5);
    expect(calls.sleep).toHaveLength(4);
    // Only the create POST went out — no compensating group mutation.
    expect(calls.requestJson).toHaveLength(1);
  });

  it('does NOT roll back when the listing can not be verified (all reads fail)', async () => {
    const { deps, calls } = makeDeps({
      requestJson: async () => NOTEBOOK_RES,
      getGroupChannelIds: async () => {
        throw new Error('group scry failed');
      },
    });

    await expect(
      createNotesChannelInGroup({ groupId: '~zod/group', title: 'New' }, deps)
    ).rejects.toThrow('could not be verified');

    // Every read failed, so we never confirmed the listing is absent — leave the
    // (possibly valid) notebook in place rather than delete it.
    expect(calls.deleteNotesNotebook).toEqual([]);
    expect(calls.getGroupChannelIds).toHaveLength(5);
  });

  it('treats a trailing read failure as unverifiable, not absent', async () => {
    let reads = 0;
    const { deps, calls } = makeDeps({
      requestJson: async () => NOTEBOOK_RES,
      getGroupChannelIds: async () => {
        reads += 1;
        // First poll succeeds but registration hasn't propagated yet; every
        // later poll fails — so absence is never confirmed by a final read.
        if (reads === 1) {
          return [];
        }
        throw new Error('group scry failed');
      },
    });

    await expect(
      createNotesChannelInGroup({ groupId: '~zod/group', title: 'New' }, deps)
    ).rejects.toThrow('could not be verified');

    // A stale early "absent" read must not trigger rollback.
    expect(calls.deleteNotesNotebook).toEqual([]);
  });

  it('fails when %notes returns a non-notebook body', async () => {
    const { deps, calls } = makeDeps({
      requestJson: async () => ({ requestId: 'r1', body: { type: 'ok' } }),
    });

    await expect(
      createNotesChannelInGroup({ groupId: '~zod/group', title: 'New' }, deps)
    ).rejects.toThrow('did not return a notebook');

    // Never reached the listing verification or any cleanup.
    expect(calls.getGroupChannelIds).toEqual([]);
    expect(calls.deleteNotesNotebook).toEqual([]);
  });

  it('surfaces an error envelope from %notes', async () => {
    const { deps } = makeDeps({
      requestJson: async () => ({
        requestId: 'r1',
        body: { type: 'error', message: 'denied' },
      }),
    });

    await expect(
      createNotesChannelInGroup({ groupId: '~zod/group', title: 'New' }, deps)
    ).rejects.toThrow('%notes error: denied');
  });

  it('rejects a malformed group id before any request', async () => {
    const { deps, calls } = makeDeps({ requestJson: async () => NOTEBOOK_RES });

    await expect(
      createNotesChannelInGroup({ groupId: 'badgroup', title: 'New' }, deps)
    ).rejects.toThrow('Invalid group id');

    expect(calls.requestJson).toEqual([]);
  });
});
