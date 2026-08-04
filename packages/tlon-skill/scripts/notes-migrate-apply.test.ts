import type { Post, Story } from '@tloncorp/api';
import { describe, expect, it } from 'bun:test';

import type {
  GroupChannelV7,
  GroupInfo,
  MigrationDeps,
  MigrationOptions,
} from './notes-migrate';
import { executeApply, verifyTargetContents } from './notes-migrate-apply';

const SOURCE = 'diary/~zod/blog';
const GROUP = '~zod/group';
const TARGET = 'notes/~zod/newbook';
const TARGET_FLAG = '~zod/newbook';
const DAY = Date.UTC(2025, 0, 2);

function post(text = 'Hello'): Post {
  return {
    id: '170.141',
    type: 'note',
    channelId: SOURCE,
    authorId: '~zod',
    sentAt: DAY,
    receivedAt: DAY,
    sequenceNum: 1,
    content: [{ inline: [text] }],
    reactions: [],
    replyCount: 0,
  };
}

function channel(
  title: string,
  readers: string[] = ['writers']
): GroupChannelV7 {
  return {
    added: DAY,
    meta: {
      title,
      description: 'preserve description',
      image: 'preserve image',
      cover: 'preserve cover',
    },
    section: 'main',
    readers,
    join: false,
  };
}

function sourceGroup(
  readers: string[] = ['writers'],
  privacy: GroupInfo['privacy'] = 'private'
): GroupInfo {
  return {
    privacy,
    admins: ['admins'],
    channels: { [SOURCE]: channel('Field Notes', readers) },
  };
}

interface HarnessOptions {
  group?: GroupInfo;
  writers?: string[];
  sourcePost?: Post;
  identity?: () => Promise<void>;
  create?: MigrationDeps['createGroupNotebook'];
  detail?: Awaited<ReturnType<MigrationDeps['getNotebookDetail']>>;
  batch?: MigrationDeps['batchImport'];
  listNotes?: MigrationDeps['listNotes'];
  getRawGroup?: MigrationDeps['getRawGroup'];
  updateChannel?: MigrationDeps['updateChannel'];
  renameConfirmed?: boolean;
  requestId?: string;
  recoveryInstruction?: MigrationDeps['recoveryInstruction'];
  // Group returned on every getGroup call after the first, so a test can
  // simulate the source's permissions drifting mid-migration.
  groupAfterFirstRead?: GroupInfo;
  // Same idea for channel writers, which are the other input to the widening gate.
  writersAfterFirstRead?: string[];
}

function makeHarness(options: HarnessOptions = {}) {
  const baseGroup = options.group ?? sourceGroup();
  let currentSourceTitle = 'Field Notes';
  const imported: { title: string; body: string }[] = [];
  const order: string[] = [];
  const logs: string[] = [];
  const calls = {
    identity: 0,
    create: 0,
    detail: 0,
    batch: [] as Parameters<MigrationDeps['batchImport']>[0][],
    listNotes: 0,
    getRawGroup: 0,
    updateChannel: [] as Parameters<MigrationDeps['updateChannel']>[0][],
    getGroup: 0,
    perm: 0,
  };

  const deps: MigrationDeps = {
    getChannelPerm: async () => {
      calls.perm += 1;
      const drifted = calls.perm > 1 && options.writersAfterFirstRead;
      return {
        writers: drifted
          ? (options.writersAfterFirstRead as string[])
          : options.writers ?? ['writers'],
        group: GROUP,
      };
    },
    getGroup: async () => {
      calls.getGroup += 1;
      return calls.getGroup > 1 && options.groupAfterFirstRead
        ? options.groupAfterFirstRead
        : baseGroup;
    },
    getChannelPosts: async () => ({
      posts: [options.sourcePost ?? post()],
      older: null,
      totalPosts: 1,
    }),
    createGroupNotebook: async (input) => {
      calls.create += 1;
      order.push('create');
      const trackedInput = {
        ...input,
        onCreated: (nest: string) => {
          input.onCreated(nest);
        },
      };
      if (options.create) return options.create(trackedInput);
      trackedInput.onCreated(TARGET);
      return TARGET;
    },
    getNotebookDetail: async () => {
      calls.detail += 1;
      order.push('detail');
      return (
        options.detail ?? {
          rootFolderId: 42,
          host: '~zod',
          flagName: 'newbook',
        }
      );
    },
    listNotes: async (target) => {
      calls.listNotes += 1;
      order.push('read-back');
      if (options.listNotes) return options.listNotes(target);
      return imported.map((item) => ({
        title: item.title,
        bodyMd: item.body,
      }));
    },
    batchImport: async (input) => {
      calls.batch.push(input);
      order.push('import');
      if (options.batch) return options.batch(input);
      imported.push(...input.notes);
      return input.requestId;
    },
    getRawGroup: async (groupId) => {
      calls.getRawGroup += 1;
      order.push('raw-group');
      if (options.getRawGroup) return options.getRawGroup(groupId);
      return {
        admissions: { privacy: 'private' },
        admins: ['admins'],
        seats: {},
        roles: {},
        channels: { [SOURCE]: channel(currentSourceTitle) },
      };
    },
    updateChannel: async (input) => {
      calls.updateChannel.push(input);
      order.push('rename');
      await options.updateChannel?.(input);
      if (options.renameConfirmed !== false) {
        currentSourceTitle = input.channel.meta.title;
      }
    },
    getActingShip: () => '~zod',
    assertServerIdentity: async () => {
      calls.identity += 1;
      order.push('identity');
      await options.identity?.();
    },
    toUrbitStory: (content) => content as Story,
    storyToMdastStrict: () => undefined,
    storyToMarkdown: (story) =>
      story
        .flatMap((verse) =>
          'inline' in verse
            ? verse.inline.filter((value) => typeof value === 'string')
            : []
        )
        .join(''),
    generateRequestId: () => options.requestId ?? '0v12345',
    recoveryInstruction:
      options.recoveryInstruction ??
      ((targetNest) =>
        `delete the notebook \`${targetNest}\` in the Notes app and run \`tlon notes migrate-apply <diary-nest> --yes\` again.`),
    log: (message) => logs.push(message),
  };
  return { calls, deps, imported, logs, order };
}

function applyOptions(
  overrides: Partial<MigrationOptions> = {}
): MigrationOptions {
  return {
    sourceNest: SOURCE,
    allowWriteWidening: false,
    yes: true,
    ...overrides,
  };
}

async function captureError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('Expected operation to reject');
}

describe('verifyTargetContents', () => {
  it('compares a multiset rather than note ordering', () => {
    expect(() =>
      verifyTargetContents(
        [
          { postId: '1', sequenceNum: 1, title: 'same', body: 'body\n' },
          { postId: '2', sequenceNum: 2, title: 'same', body: 'body\n' },
          { postId: '3', sequenceNum: 3, title: 'other', body: 'x\n' },
        ],
        [
          { title: 'other', bodyMd: 'x\n' },
          { title: 'same', bodyMd: 'body\n' },
          { title: 'same', bodyMd: 'body\n' },
        ]
      )
    ).not.toThrow();
  });

  it('detects duplicate-count differences', () => {
    expect(() =>
      verifyTargetContents(
        [
          { postId: '1', sequenceNum: 1, title: 'same', body: 'body\n' },
          { postId: '2', sequenceNum: 2, title: 'same', body: 'body\n' },
        ],
        [{ title: 'same', bodyMd: 'body\n' }]
      )
    ).toThrow(/1 expected note/);
  });

  it('fails closed when the list response omits a body', () => {
    expect(() =>
      verifyTargetContents(
        [{ postId: '1', sequenceNum: 1, title: 'a', body: 'b' }],
        [{ title: 'a', bodyMd: null }]
      )
    ).toThrow('missing an exact title or Markdown body');
  });
});

describe('executeApply', () => {
  it('refuses an archived source without writes and leaves ordinary sources unaffected', async () => {
    const ordinary = makeHarness();
    await expect(
      executeApply(applyOptions(), ordinary.deps)
    ).resolves.toMatchObject({ status: 'success' });
    expect(ordinary.calls.create).toBe(1);

    const archivedGroup = sourceGroup();
    archivedGroup.channels[SOURCE].meta.title = 'Field Notes-ARCHIVE';
    const archived = makeHarness({ group: archivedGroup });
    await expect(executeApply(applyOptions(), archived.deps)).rejects.toThrow(
      `Refusing to migrate ${SOURCE}: its title appears to have been migrated already. ` +
        `If that is incorrect, rename the source channel to remove the archive marker, then re-run the migration.`
    );
    expect(archived.calls.identity).toBe(0);
    expect(archived.calls.create).toBe(0);
    expect(archived.calls.detail).toBe(0);
    expect(archived.calls.batch).toEqual([]);
    expect(archived.calls.listNotes).toBe(0);
    expect(archived.calls.getRawGroup).toBe(0);
    expect(archived.calls.updateChannel).toEqual([]);
    expect(archived.imported).toEqual([]);
    expect(archived.order).toEqual([]);
  });

  it('requires explicit confirmation before any reads', async () => {
    const context = makeHarness();
    await expect(
      executeApply(applyOptions({ yes: false }), context.deps)
    ).rejects.toThrow('requires explicit confirmation');
    expect(context.calls.getGroup).toBe(0);
    expect(context.calls.create).toBe(0);
  });

  it('runs the fresh-target flow and archives by raw title-only round trip', async () => {
    const context = makeHarness();
    const result = await executeApply(applyOptions(), context.deps);

    expect(result).toEqual({
      status: 'success',
      summary: {
        notesImported: 1,
        targetNest: TARGET,
        archiveTitle: 'Field Notes-ARCHIVE',
        archiveRenamed: true,
        archiveOnly: {
          totalComments: 0,
          totalReactions: 0,
          citeCount: 0,
          linkBlockCount: 0,
          groupMentionCount: 0,
          flattenedInlineCount: 0,
        },
        warnings: [],
      },
    });
    expect(context.order).toEqual([
      'identity',
      'create',
      'detail',
      'import',
      'read-back',
      'raw-group',
      'rename',
      'raw-group',
    ]);
    expect(context.logs[0]).toBe(`Target notebook created: ${TARGET}`);
    expect(context.calls.batch[0]).toMatchObject({
      flag: TARGET_FLAG,
      folder: 42,
      requestId: '0v12345',
    });

    const renamed = context.calls.updateChannel[0].channel;
    expect(renamed.meta.title).toBe('Field Notes-ARCHIVE');
    expect(renamed.meta.description).toBe('preserve description');
    expect(renamed.meta.image).toBe('preserve image');
    expect(renamed.meta.cover).toBe('preserve cover');
    expect(renamed.readers).toEqual(['writers']);
    expect(context.calls.getRawGroup).toBe(2);
  });

  it('passes the exact source reader roles into creation', async () => {
    let createInput:
      | Parameters<MigrationDeps['createGroupNotebook']>[0]
      | undefined;
    const context = makeHarness({
      group: sourceGroup(['members']),
      writers: [],
      create: async (input) => {
        createInput = input;
        input.onCreated(TARGET);
        return TARGET;
      },
    });
    await executeApply(applyOptions(), context.deps);
    expect(createInput?.readers).toEqual(['members']);
  });

  it('refuses widening before identity or creation', async () => {
    const context = makeHarness({
      group: sourceGroup(['members']),
      writers: ['writers'],
    });
    await expect(executeApply(applyOptions(), context.deps)).rejects.toThrow(
      'would widen write access'
    );
    expect(context.calls.identity).toBe(0);
    expect(context.calls.create).toBe(0);
  });

  it('permits widening only with explicit acceptance', async () => {
    const context = makeHarness({
      group: sourceGroup(['members']),
      writers: ['writers'],
    });
    await expect(
      executeApply(applyOptions({ allowWriteWidening: true }), context.deps)
    ).resolves.toMatchObject({ status: 'success' });
  });

  it('checks server identity after all reads but before the first write', async () => {
    const context = makeHarness({
      identity: async () => {
        throw new Error('identity mismatch');
      },
    });
    await expect(executeApply(applyOptions(), context.deps)).rejects.toThrow(
      'identity mismatch'
    );
    expect(context.calls.create).toBe(0);
    expect(context.calls.batch).toEqual([]);
  });

  it('uses conservative title-based recovery when creation fails', async () => {
    const context = makeHarness({
      create: async () => {
        throw new Error('create denied');
      },
    });
    const error = await captureError(
      executeApply(applyOptions(), context.deps)
    );
    expect(error.message).toContain('create denied');
    expect(error.message).toContain(
      'Notebook creation may or may not have landed'
    );
    expect(error.message).toContain(
      'Look for a notebook with the requested title in the Notes app and remove it before retrying'
    );
    expect(context.calls.batch).toEqual([]);
    expect(context.calls.updateChannel).toEqual([]);
  });

  it('adds recovery guidance when post-create reader verification fails', async () => {
    const context = makeHarness({
      create: async (input) => {
        input.onCreated(TARGET);
        throw new Error('reader verification failed');
      },
    });
    const error = await captureError(
      executeApply(applyOptions(), context.deps)
    );
    expect(error.message).toContain('reader verification failed');
    expect(error.message).toContain(
      `delete the notebook \`${TARGET}\` in the Notes app`
    );
    expect(context.calls.batch).toEqual([]);
    expect(context.calls.updateChannel).toEqual([]);
  });

  it('uses the runtime-injected recovery instruction', async () => {
    const context = makeHarness({
      create: async (input) => {
        input.onCreated(TARGET);
        throw new Error('reader verification failed');
      },
      recoveryInstruction: (targetNest) =>
        `ask the owner to run \`tlon notes notebook-delete ${targetNest} --yes\`, then \`tlon notes migrate-apply <diary-nest> --yes\`.`,
    });
    const error = await captureError(
      executeApply(applyOptions(), context.deps)
    );
    expect(error.message).toContain(
      `ask the owner to run \`tlon notes notebook-delete ${TARGET} --yes\`, then \`tlon notes migrate-apply <diary-nest> --yes\`.`
    );
    expect(error.message).not.toContain('Notes app');
  });

  it('uses the real non-zero root folder id', async () => {
    const context = makeHarness({
      detail: { rootFolderId: 987, host: '~zod', flagName: 'newbook' },
    });
    await executeApply(applyOptions(), context.deps);
    expect(context.calls.batch[0].folder).toBe(987);
  });

  it('rejects a zero root folder id, which %notes cannot produce', async () => {
    const context = makeHarness({
      detail: { rootFolderId: 0, host: '~zod', flagName: 'newbook' },
    });
    const error = await captureError(
      executeApply(applyOptions(), context.deps)
    );
    expect(error.message).toContain('rootFolderId');
    expect(context.calls.batch).toEqual([]);
  });

  it('refuses when writers tighten mid-read so the run would now widen access', async () => {
    // The widening gate is decided from the pre-read snapshot. If writers go
    // from open to restricted during the read, an open-readers channel now
    // widens write access, and the operator was never asked.
    const context = makeHarness({
      writers: [],
      writersAfterFirstRead: ['writers'],
      group: sourceGroup([]),
    });
    const error = await captureError(
      executeApply(applyOptions(), context.deps)
    );
    expect(error.message).toContain('writer roles changed');
    expect(error.message).toContain('widen write access');
    expect(context.calls.create).toBe(0);
    expect(context.calls.batch).toEqual([]);
  });

  it('allows a mid-read writer change when widening is explicitly accepted', async () => {
    const context = makeHarness({
      writers: [],
      writersAfterFirstRead: ['writers'],
      group: sourceGroup([]),
    });
    await executeApply(
      applyOptions({ allowWriteWidening: true }),
      context.deps
    );
    expect(context.calls.create).toBe(1);
  });

  it('refuses when only admins drift and the live permissions now widen access', async () => {
    const initialGroup = sourceGroup(['admins']);
    const driftedGroup = sourceGroup(['admins']);
    driftedGroup.admins = [];
    const context = makeHarness({
      group: initialGroup,
      groupAfterFirstRead: driftedGroup,
      writers: ['writers'],
    });

    const error = await captureError(
      executeApply(applyOptions(), context.deps)
    );

    expect(error.message).toContain('admin or privacy settings changed');
    expect(error.message).toContain('widen write access');
    expect(error.message).toContain(
      'reader role "admins" is not writer-authorizing'
    );
    expect(context.calls.create).toBe(0);
    expect(context.calls.batch).toEqual([]);
  });

  it('refuses when the source is restricted while posts are being read', async () => {
    // The plan snapshots readers before the source read; if the source is
    // locked down during it, creating from the stale snapshot would republish
    // the whole diary at the old, wider visibility.
    const context = makeHarness({
      // Writers open too, so the plan itself reports no widening and the run
      // reaches the pre-create check rather than stopping at the widening gate.
      writers: [],
      group: sourceGroup([]),
      groupAfterFirstRead: sourceGroup(['members']),
    });
    const error = await captureError(
      executeApply(applyOptions(), context.deps)
    );
    expect(error.message).toContain('reader roles changed');
    expect(error.message).toContain('members');
    expect(context.calls.create).toBe(0);
    expect(context.calls.batch).toEqual([]);
    expect(context.calls.updateChannel).toEqual([]);
  });

  it('refuses when notebook detail reports a different flagName', async () => {
    // Importing uses detail.flagName while read-back uses targetNest; if they
    // disagree the notes land somewhere we never verify and never clean up.
    const context = makeHarness({
      detail: {
        rootFolderId: 42,
        host: '~zod',
        flagName: 'someone-elses-book',
      },
    });
    const error = await captureError(
      executeApply(applyOptions(), context.deps)
    );
    expect(error.message).toContain('someone-elses-book');
    expect(context.calls.batch).toEqual([]);
  });

  it('rejects malformed root folder data after creation', async () => {
    const context = makeHarness({
      detail: { rootFolderId: Number.NaN, host: '~zod', flagName: 'newbook' },
    });
    const error = await captureError(
      executeApply(applyOptions(), context.deps)
    );
    expect(error.message).toContain('rootFolderId');
    expect(error.message).toContain('delete the notebook');
    expect(context.calls.batch).toEqual([]);
  });

  it('rejects a zero request id before calling batch import', async () => {
    const context = makeHarness({ requestId: '0v0' });
    const error = await captureError(
      executeApply(applyOptions(), context.deps)
    );
    expect(error.message).toContain('invalid zero value');
    expect(error.message).toContain('delete the notebook');
    expect(context.calls.batch).toEqual([]);
  });

  it('names the failed chunk and known-target recovery', async () => {
    const context = makeHarness({
      batch: async () => {
        throw new Error('socket reset');
      },
    });
    const error = await captureError(
      executeApply(applyOptions(), context.deps)
    );
    expect(error.message).toContain('Chunk 1/1 failed');
    expect(error.message).toContain('may or may not have landed');
    expect(error.message).toContain('delete the notebook');
    expect(context.calls.listNotes).toBe(0);
    expect(context.calls.updateChannel).toEqual([]);
  });

  it('rejects a mismatched echoed request id', async () => {
    const context = makeHarness({ batch: async () => '0vwrong' });
    const error = await captureError(
      executeApply(applyOptions(), context.deps)
    );
    expect(error.message).toContain('echoed request id 0vwrong');
    expect(error.message).toContain('may or may not have landed');
    expect(context.calls.updateChannel).toEqual([]);
  });

  it('blocks archive rename when exact read-back verification fails', async () => {
    const context = makeHarness({
      listNotes: async () => [{ title: 'different', bodyMd: 'different' }],
    });
    const error = await captureError(
      executeApply(applyOptions(), context.deps)
    );
    expect(error.message).toContain('Read-back verification failed');
    expect(error.message).toContain('delete the notebook');
    expect(context.calls.updateChannel).toEqual([]);
  });

  it('treats archive rename failure as non-fatal', async () => {
    const context = makeHarness({
      getRawGroup: async () => {
        throw new Error('groups unavailable');
      },
    });
    const result = await executeApply(applyOptions(), context.deps);
    expect(result.summary.archiveRenamed).toBe(false);
    expect(result.summary.warnings[0]).toContain(
      'Rename the channel in the app'
    );
    expect(result.summary.targetNest).toBe(TARGET);
  });

  it('warns and reports archiveRenamed false when rename read-back is unconfirmed', async () => {
    const context = makeHarness({ renameConfirmed: false });

    const result = await executeApply(applyOptions(), context.deps);

    expect(context.calls.updateChannel).toHaveLength(1);
    expect(context.calls.getRawGroup).toBe(2);
    expect(result.summary.archiveRenamed).toBe(false);
    expect(result.summary.warnings[0]).toContain(
      'Source rename was not confirmed'
    );
    expect(result.summary.warnings[0]).toContain(
      'Rename the channel in the app'
    );
    expect(result.summary.notesImported).toBe(1);
  });

  it('preflights an oversized note before identity and creation', async () => {
    const context = makeHarness({
      sourcePost: post('x'.repeat(600 * 1024)),
    });
    await expect(executeApply(applyOptions(), context.deps)).rejects.toThrow(
      'exceeds byte cap'
    );
    expect(context.calls.identity).toBe(0);
    expect(context.calls.create).toBe(0);
  });
});
