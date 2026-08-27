import type { NotesV1NotebookSummary } from '@tloncorp/api';
import { describe, expect, it } from 'bun:test';

import {
  type NotesChannelDeps,
  createNotesChannelInGroup,
} from './notes-channel';

const SUMMARY: NotesV1NotebookSummary = {
  host: '~zod',
  flagName: 'newbook',
  notebook: { id: 5, title: 'New' },
};
const NEW_NEST = 'notes/~zod/newbook';
const READERS = ['members'];

interface MakeDepsOptions {
  administer?: NotesChannelDeps['assertCanAdministerGroup'];
  create?: NotesChannelDeps['createGroupNotesNotebook'];
  channelIds?: NotesChannelDeps['getGroupChannelIds'];
  readers?: NotesChannelDeps['getChannelReaders'];
}

function makeDeps(options: MakeDepsOptions = {}) {
  const calls = {
    administer: [] as string[],
    create: [] as Array<
      Parameters<NotesChannelDeps['createGroupNotesNotebook']>[0]
    >,
    channelIds: [] as string[],
    readers: [] as [string, string][],
    sleep: [] as number[],
  };
  const deps: NotesChannelDeps = {
    assertCanAdministerGroup: async (groupId) => {
      calls.administer.push(groupId);
      await options.administer?.(groupId);
    },
    createGroupNotesNotebook: async (input) => {
      calls.create.push(input);
      return options.create ? options.create(input) : SUMMARY;
    },
    getGroupChannelIds: async (groupId) => {
      calls.channelIds.push(groupId);
      return options.channelIds ? options.channelIds(groupId) : [NEW_NEST];
    },
    getChannelReaders: async (groupId, nest) => {
      calls.readers.push([groupId, nest]);
      return options.readers ? options.readers(groupId, nest) : READERS;
    },
    sleep: async (ms) => {
      calls.sleep.push(ms);
    },
    log: () => undefined,
  };
  return { calls, deps };
}

describe('createNotesChannelInGroup', () => {
  it('threads and verifies the exact reader roles', async () => {
    const { calls, deps } = makeDeps();
    const target = await createNotesChannelInGroup(
      { groupId: '~zod/group', title: 'New', readers: READERS },
      deps
    );

    expect(target).toBe(NEW_NEST);
    expect(calls.create).toEqual([
      {
        title: 'New',
        group: { host: '~zod', flagName: 'group' },
        readers: READERS,
      },
    ]);
    expect(calls.administer).toEqual(['~zod/group']);
    expect(calls.readers).toEqual([['~zod/group', NEW_NEST]]);
  });

  it('accepts an explicitly open reader set after verifying it', async () => {
    const { deps } = makeDeps({ readers: async () => [] });
    await expect(
      createNotesChannelInGroup(
        { groupId: '~zod/group', title: 'New', readers: [] },
        deps
      )
    ).resolves.toBe(NEW_NEST);
  });

  it('compares reader roles as sets rather than by response order', async () => {
    const { deps } = makeDeps({ readers: async () => ['b', 'a'] });
    await expect(
      createNotesChannelInGroup(
        { groupId: '~zod/group', title: 'New', readers: ['a', 'b'] },
        deps
      )
    ).resolves.toBe(NEW_NEST);
  });

  it('calls onCreated before post-create verification', async () => {
    const created: string[] = [];
    const { deps } = makeDeps({ readers: async () => ['wrong'] });
    await expect(
      createNotesChannelInGroup(
        {
          groupId: '~zod/group',
          title: 'New',
          readers: READERS,
          onCreated: (nest) => created.push(nest),
        },
        deps
      )
    ).rejects.toThrow('do not match the approved set');
    expect(created).toEqual([NEW_NEST]);
  });

  it('fails closed when the created channel readers cannot be found', async () => {
    const { deps } = makeDeps({ readers: async () => null });
    await expect(
      createNotesChannelInGroup(
        { groupId: '~zod/group', title: 'New', readers: READERS },
        deps
      )
    ).rejects.toThrow('could not be read for reader verification');
  });

  it('preserves the created nest and cleanup command when the reader scry fails', async () => {
    const { deps } = makeDeps({
      readers: async () => {
        throw new Error('transient group scry failure');
      },
    });

    let caught: unknown;
    try {
      await createNotesChannelInGroup(
        { groupId: '~zod/group', title: 'New', readers: READERS },
        deps
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = caught instanceof Error ? caught.message : String(caught);

    expect(message).toContain(`%notes created ${NEW_NEST}`);
    expect(message).toContain('transient group scry failure');
    expect(message).toContain(`tlon notes notebook-delete ${NEW_NEST} --yes`);
  });

  it('retries asynchronous listing registration', async () => {
    let attempt = 0;
    const { calls, deps } = makeDeps({
      channelIds: async () => {
        attempt += 1;
        return attempt === 3 ? [NEW_NEST] : [];
      },
    });
    await expect(
      createNotesChannelInGroup(
        { groupId: '~zod/group', title: 'New', readers: READERS },
        deps
      )
    ).resolves.toBe(NEW_NEST);
    expect(calls.channelIds).toHaveLength(3);
    expect(calls.sleep).toEqual([500, 500]);
  });

  it('leaves an unverified notebook in place when listing stays absent', async () => {
    const created: string[] = [];
    const { calls, deps } = makeDeps({ channelIds: async () => [] });
    try {
      await createNotesChannelInGroup(
        {
          groupId: '~zod/group',
          title: 'New',
          readers: READERS,
          onCreated: (nest) => created.push(nest),
        },
        deps
      );
      throw new Error('Expected listing verification to fail');
    } catch (error) {
      expect(String(error)).toContain('host may not support group-mode notes');
      expect(String(error)).not.toContain('PR 7');
      expect(String(error)).toContain('Left the notebook in place');
    }
    expect(created).toEqual([NEW_NEST]);
    expect(calls.channelIds).toHaveLength(5);
  });

  it('fails as unverifiable when the final group read fails', async () => {
    const { deps } = makeDeps({
      channelIds: async () => {
        throw new Error('scry failed');
      },
    });
    await expect(
      createNotesChannelInGroup(
        { groupId: '~zod/group', title: 'New', readers: READERS },
        deps
      )
    ).rejects.toThrow('could not be verified');
  });

  it('propagates create failures without polling', async () => {
    const { calls, deps } = makeDeps({
      create: async () => {
        throw new Error('denied');
      },
    });
    await expect(
      createNotesChannelInGroup(
        { groupId: '~zod/group', title: 'New', readers: READERS },
        deps
      )
    ).rejects.toThrow('denied');
    expect(calls.channelIds).toEqual([]);
  });

  it('refuses before creating when the acting ship cannot administer the group', async () => {
    const { calls, deps } = makeDeps({
      administer: async () => {
        throw new Error('not an admin');
      },
    });

    await expect(
      createNotesChannelInGroup(
        { groupId: '~bus/group', title: 'New', readers: READERS },
        deps
      )
    ).rejects.toThrow('not an admin');
    expect(calls.create).toEqual([]);
    expect(calls.channelIds).toEqual([]);
  });

  it('rejects a malformed group before creating', async () => {
    const { calls, deps } = makeDeps();
    await expect(
      createNotesChannelInGroup(
        {
          groupId: 'bad',
          title: 'New',
          readers: READERS,
        },
        deps
      )
    ).rejects.toThrow('Invalid group id');
    expect(calls.create).toEqual([]);
  });
});
