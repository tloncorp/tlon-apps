import type { NotesV1NotebookSummary } from '@tloncorp/api';
import { describe, expect, it } from 'bun:test';

import {
  type NotesChannelDeps,
  createNotesChannelInGroup,
} from './notes-channel';

// A successful PR-7 group-mode create summary.
const SUMMARY: NotesV1NotebookSummary = {
  host: '~zod',
  flagName: 'newbook',
  notebook: { id: 5, title: 'New' },
};
const NEW_NEST = 'notes/~zod/newbook';

interface MakeDepsOptions {
  createGroupNotesNotebook?: (input: {
    title: string;
    group: { host: string; flagName: string };
    readers: string[];
  }) => Promise<NotesV1NotebookSummary>;
  getGroupChannelIds?: (groupId: string) => Promise<string[]>;
  deleteNotesNotebookStrict?: (nest: string) => Promise<void>;
}

function makeDeps(options: MakeDepsOptions = {}) {
  const calls = {
    createGroupNotesNotebook: [] as unknown[],
    getGroupChannelIds: [] as string[],
    deleteNotesNotebookStrict: [] as string[],
    sleep: [] as number[],
    log: [] as string[],
  };

  const deps: NotesChannelDeps = {
    createGroupNotesNotebook: async (input) => {
      calls.createGroupNotesNotebook.push(input);
      return options.createGroupNotesNotebook
        ? await options.createGroupNotesNotebook(input)
        : SUMMARY;
    },
    getGroupChannelIds: async (groupId) => {
      calls.getGroupChannelIds.push(groupId);
      return options.getGroupChannelIds
        ? await options.getGroupChannelIds(groupId)
        : [];
    },
    deleteNotesNotebookStrict: async (nest) => {
      calls.deleteNotesNotebookStrict.push(nest);
      if (options.deleteNotesNotebookStrict) {
        await options.deleteNotesNotebookStrict(nest);
      }
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
  it('creates the group-bound notebook via the API helper and returns the nest', async () => {
    const { deps, calls } = makeDeps({
      getGroupChannelIds: async () => [NEW_NEST],
    });

    const nest = await createNotesChannelInGroup(
      { groupId: '~zod/group', title: 'New' },
      deps
    );

    expect(nest).toBe(NEW_NEST);
    // Routes through the notesV1 API helper — never builds paths or pokes
    // %channels itself.
    expect(calls.createGroupNotesNotebook).toEqual([
      {
        title: 'New',
        group: { host: '~zod', flagName: 'group' },
        readers: [],
      },
    ]);
    expect(calls.deleteNotesNotebookStrict).toEqual([]);
  });

  it('retries the listing check and succeeds once the channel appears', async () => {
    let attempts = 0;
    const { deps, calls } = makeDeps({
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
    expect(calls.sleep).toHaveLength(2);
    expect(calls.deleteNotesNotebookStrict).toEqual([]);
  });

  it('strict-deletes and reports removal when the listing never registers', async () => {
    const { deps, calls } = makeDeps({ getGroupChannelIds: async () => [] });

    await expect(
      createNotesChannelInGroup({ groupId: '~zod/group', title: 'New' }, deps)
    ).rejects.toThrow('Removed the stray notebook');

    expect(calls.deleteNotesNotebookStrict).toEqual([NEW_NEST]);
    expect(calls.getGroupChannelIds).toHaveLength(5);
    expect(calls.sleep).toHaveLength(4);
  });

  it('reports manual-cleanup guidance when strict rollback delete rejects', async () => {
    const { deps, calls } = makeDeps({
      getGroupChannelIds: async () => [],
      deleteNotesNotebookStrict: async () => {
        throw new Error('delete failed');
      },
    });

    let error: Error | undefined;
    try {
      await createNotesChannelInGroup(
        { groupId: '~zod/group', title: 'New' },
        deps
      );
    } catch (e) {
      error = e as Error;
    }

    expect(calls.deleteNotesNotebookStrict).toEqual([NEW_NEST]);
    expect(error?.message).toContain(NEW_NEST);
    expect(error?.message).toContain('Manual cleanup');
    // Must NOT claim the stray notebook was removed.
    expect(error?.message).not.toContain('Removed the stray notebook');
  });

  it('does NOT roll back when the listing can not be verified (all reads fail)', async () => {
    const { deps, calls } = makeDeps({
      getGroupChannelIds: async () => {
        throw new Error('group scry failed');
      },
    });

    await expect(
      createNotesChannelInGroup({ groupId: '~zod/group', title: 'New' }, deps)
    ).rejects.toThrow('could not be verified');

    expect(calls.deleteNotesNotebookStrict).toEqual([]);
    expect(calls.getGroupChannelIds).toHaveLength(5);
  });

  it('treats a trailing read failure as unverifiable, not absent', async () => {
    let reads = 0;
    const { deps, calls } = makeDeps({
      getGroupChannelIds: async () => {
        reads += 1;
        if (reads === 1) {
          return [];
        }
        throw new Error('group scry failed');
      },
    });

    await expect(
      createNotesChannelInGroup({ groupId: '~zod/group', title: 'New' }, deps)
    ).rejects.toThrow('could not be verified');

    expect(calls.deleteNotesNotebookStrict).toEqual([]);
  });

  it('propagates a create failure from the API helper', async () => {
    const { deps, calls } = makeDeps({
      createGroupNotesNotebook: async () => {
        throw new Error('%notes error: denied');
      },
    });

    await expect(
      createNotesChannelInGroup({ groupId: '~zod/group', title: 'New' }, deps)
    ).rejects.toThrow('%notes error: denied');

    // Never reached the listing verification or any cleanup.
    expect(calls.getGroupChannelIds).toEqual([]);
    expect(calls.deleteNotesNotebookStrict).toEqual([]);
  });

  it('rejects a malformed group id before any request', async () => {
    const { deps, calls } = makeDeps();

    await expect(
      createNotesChannelInGroup({ groupId: 'badgroup', title: 'New' }, deps)
    ).rejects.toThrow('Invalid group id');

    expect(calls.createGroupNotesNotebook).toEqual([]);
  });
});
