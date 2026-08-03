import type { Post, Story } from '@tloncorp/api';
import { describe, expect, it } from 'bun:test';

import type {
  GroupInfo,
  MigrationDeps,
  MigrationOptions,
} from './notes-migrate';
import { executePlan, readSourceComplete } from './notes-migrate-plan';

const SOURCE = 'diary/~zod/blog';
const GROUP = '~zod/group';
const DAY = Date.UTC(2025, 0, 2);

function post(id: string, sequenceNum: number, text = id): Post {
  return {
    id,
    type: 'note',
    channelId: SOURCE,
    authorId: '~zod',
    sentAt: DAY + sequenceNum,
    receivedAt: DAY + sequenceNum,
    sequenceNum,
    content: [{ inline: [text] }],
    replyCount: 0,
    reactions: [],
  };
}

function group(overrides: Partial<GroupInfo> = {}): GroupInfo {
  return {
    privacy: 'private',
    admins: ['admins'],
    channels: {
      [SOURCE]: {
        added: DAY,
        meta: {
          title: 'Field Notes',
          description: '',
          image: '',
          cover: '',
        },
        section: 'main',
        readers: ['writers'],
        join: false,
      },
    },
    ...overrides,
  };
}

function groupWithTitle(title: string): GroupInfo {
  const sourceGroup = group();
  sourceGroup.channels[SOURCE].meta.title = title;
  return sourceGroup;
}

function groupWithNotebooks(
  ...notebooks: Array<{ host: string; name: string; title: string }>
): GroupInfo {
  const sourceGroup = group();
  return {
    ...sourceGroup,
    channels: {
      ...sourceGroup.channels,
      ...Object.fromEntries(
        notebooks.map(({ host, name, title }) => [
          `notes/${host}/${name}`,
          {
            ...sourceGroup.channels[SOURCE],
            meta: {
              ...sourceGroup.channels[SOURCE].meta,
              title,
            },
          },
        ])
      ),
    },
  };
}

type Page = Awaited<ReturnType<MigrationDeps['getChannelPosts']>>;

function makeDeps(
  options: {
    pages?: Page[];
    actingShip?: string;
    group?: GroupInfo;
    perm?: { writers: string[]; group: string };
    listNotes?: MigrationDeps['listNotes'];
  } = {}
) {
  const pages = options.pages ?? [
    { posts: [post('1', 1)], older: null, totalPosts: 1 },
  ];
  const calls = {
    posts: [] as Array<{
      nest: string;
      cursor: string | undefined;
      mode: 'newest' | 'older';
      count: number;
    }>,
    listNotes: [] as string[],
    mutate: 0,
    identity: 0,
  };
  let pageIndex = 0;
  const mutation = async () => {
    calls.mutate += 1;
    throw new Error('plan attempted a mutation');
  };
  const deps: MigrationDeps = {
    getChannelPerm: async () =>
      options.perm ?? { writers: ['writers'], group: GROUP },
    getGroup: async () => options.group ?? group(),
    getChannelPosts: async (nest, cursor, mode, count) => {
      calls.posts.push({ nest, cursor, mode, count });
      const page = pages[pageIndex];
      pageIndex += 1;
      if (!page) throw new Error('unexpected page read');
      return page;
    },
    createGroupNotebook: mutation,
    getNotebookDetail: mutation,
    listNotes: async (target) => {
      calls.listNotes.push(target);
      if (options.listNotes) return options.listNotes(target);
      return [];
    },
    batchImport: mutation,
    getRawGroup: mutation,
    updateChannel: mutation,
    getActingShip: () => options.actingShip ?? '~zod',
    assertServerIdentity: async () => {
      calls.identity += 1;
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
    generateRequestId: () => '0v1',
    recoveryInstruction: () => 'recover',
    log: () => undefined,
  };
  return { calls, deps };
}

function options(overrides: Partial<MigrationOptions> = {}): MigrationOptions {
  return {
    sourceNest: SOURCE,
    allowWriteWidening: false,
    yes: false,
    ...overrides,
  };
}

describe('readSourceComplete', () => {
  it('starts at newest, follows older cursors, and sorts globally by sequence', async () => {
    const { calls, deps } = makeDeps({
      pages: [
        {
          posts: [post('3', 3), post('2', 2)],
          older: 'cursor-1',
          totalPosts: 3,
        },
        { posts: [post('1', 1)], older: null, totalPosts: 3 },
      ],
    });
    const result = await readSourceComplete(SOURCE, deps);
    expect(result.map((row) => row.id)).toEqual(['1', '2', '3']);
    expect(calls.posts).toEqual([
      {
        nest: SOURCE,
        cursor: undefined,
        mode: 'newest',
        count: 100,
      },
      {
        nest: SOURCE,
        cursor: 'cursor-1',
        mode: 'older',
        count: 100,
      },
    ]);
  });

  it('rejects a non-adjacent cursor cycle', async () => {
    const { deps } = makeDeps({
      pages: [
        { posts: [post('3', 3)], older: 'a', totalPosts: 3 },
        { posts: [post('2', 2)], older: 'b', totalPosts: 3 },
        { posts: [post('1', 1)], older: 'a', totalPosts: 3 },
      ],
    });
    await expect(readSourceComplete(SOURCE, deps)).rejects.toThrow(
      'repeated cursor'
    );
  });

  it('rejects duplicate post ids across pages', async () => {
    const { deps } = makeDeps({
      pages: [
        { posts: [post('same', 2)], older: 'a', totalPosts: 2 },
        { posts: [post('same', 1)], older: null, totalPosts: 2 },
      ],
    });
    await expect(readSourceComplete(SOURCE, deps)).rejects.toThrow(
      'duplicate post id same'
    );
  });

  it('rejects totalPosts drift', async () => {
    const { deps } = makeDeps({
      pages: [
        { posts: [post('2', 2)], older: 'a', totalPosts: 2 },
        { posts: [post('1', 1)], older: null, totalPosts: 3 },
      ],
    });
    await expect(readSourceComplete(SOURCE, deps)).rejects.toThrow(
      'totalPosts changed'
    );
  });

  it('rejects a non-null cursor yielding no rows', async () => {
    const { deps } = makeDeps({
      pages: [
        { posts: [post('1', 1)], older: 'a', totalPosts: 1 },
        { posts: [], older: null, totalPosts: 1 },
      ],
    });
    await expect(readSourceComplete(SOURCE, deps)).rejects.toThrow(
      'yielded no new rows'
    );
  });

  it('checks terminal non-stub rows against totalPosts', async () => {
    const { deps } = makeDeps({
      pages: [{ posts: [post('1', 1)], older: null, totalPosts: 2 }],
    });
    await expect(readSourceComplete(SOURCE, deps)).rejects.toThrow(
      'completeness invariant failed'
    );
  });

  it('does not count a synthetic stub toward totalPosts', async () => {
    const stub = {
      ...post('stub', 2),
      isSequenceStub: true,
    };
    const { deps } = makeDeps({
      pages: [
        {
          posts: [post('1', 1), stub],
          older: null,
          totalPosts: 1,
        },
      ],
    });
    await expect(readSourceComplete(SOURCE, deps)).resolves.toHaveLength(2);
  });

  it('uses the raw seal reaction count when UI normalization filtered entries', async () => {
    const sourcePost = {
      ...post('1', 1),
      reactions: [],
      rawReactionCount: 3,
    };
    const { deps } = makeDeps({
      pages: [{ posts: [sourcePost], older: null, totalPosts: 1 }],
    });

    const result = await readSourceComplete(SOURCE, deps);

    expect(result[0].reactionCount).toBe(3);
  });

  it('rejects a source above the 5,000-post ceiling immediately', async () => {
    const { deps } = makeDeps({
      pages: [{ posts: [post('1', 1)], older: null, totalPosts: 5001 }],
    });
    await expect(readSourceComplete(SOURCE, deps)).rejects.toThrow(
      'exceeds the migration ceiling'
    );
  });

  it('rejects missing or malformed sequence numbers on eligible posts', async () => {
    for (const sequenceNum of [undefined, null, '1', 1.5, -1]) {
      const malformed = {
        ...post('1', 1),
        sequenceNum,
      } as unknown as Post;
      const { deps } = makeDeps({
        pages: [{ posts: [malformed], older: null, totalPosts: 1 }],
      });
      await expect(readSourceComplete(SOURCE, deps)).rejects.toThrow(
        'sequenceNum'
      );
    }
  });

  it('counts but does not import a sequence-less tombstone without perturbing eligible order', async () => {
    const tombstone = {
      ...post('gone', 0),
      sequenceNum: null,
      isDeleted: true,
    } as Post;
    const { deps } = makeDeps({
      pages: [
        {
          posts: [post('third', 3), tombstone, post('first', 1)],
          older: null,
          totalPosts: 3,
        },
      ],
    });

    const result = await executePlan(options(), deps);

    expect(result.plan).toMatchObject({
      eligibleCount: 2,
      tombstoneCount: 1,
      stubCount: 0,
      previewTitles: ['first', 'third'],
    });
    expect(result.convertedNotes.map((note) => note.postId)).toEqual([
      'first',
      'third',
    ]);
    expect(result.convertedNotes.map((note) => note.sequenceNum)).toEqual([
      1, 3,
    ]);
    expect(result.convertedNotes.some((note) => note.postId === 'gone')).toBe(
      false
    );
  });
});

describe('executePlan', () => {
  it('refuses an archived source while preserving exact suffix semantics', async () => {
    const ordinary = makeDeps({ group: groupWithTitle('Field Notes') });
    await expect(executePlan(options(), ordinary.deps)).resolves.toMatchObject({
      plan: { sourceTitle: 'Field Notes' },
    });

    const differentCase = makeDeps({
      group: groupWithTitle('Field Notes-archive'),
    });
    await expect(
      executePlan(options(), differentCase.deps)
    ).resolves.toMatchObject({
      plan: {
        sourceTitle: 'Field Notes-archive',
        archiveTitle: 'Field Notes-archive-ARCHIVE',
      },
    });

    const emptyTitle = makeDeps({ group: groupWithTitle('  ') });
    await expect(
      executePlan(options(), emptyTitle.deps)
    ).resolves.toMatchObject({
      plan: {
        targetTitle: 'blog',
        archiveTitle: 'blog-ARCHIVE',
      },
    });

    const archived = makeDeps({
      group: groupWithTitle('  Field Notes-ARCHIVE  '),
    });
    await expect(executePlan(options(), archived.deps)).rejects.toThrow(
      `Refusing to migrate ${SOURCE}: its title appears to have been migrated already. ` +
        `If that is incorrect, rename the source channel to remove the archive marker, then re-run the migration.`
    );
    expect(archived.calls.listNotes).toEqual([]);
    expect(archived.calls.posts).toEqual([]);
  });

  it('refuses a same-title notes target containing provenance for this source', async () => {
    const target = 'notes/~zod/field-notes';
    const { calls, deps } = makeDeps({
      group: groupWithNotebooks({
        host: '~zod',
        name: 'field-notes',
        title: 'Field Notes',
      }),
      listNotes: async () => [
        {
          title: 'Migrated note',
          bodyMd: `Body\n\n<!-- tlon-migrate: ${SOURCE} 170.141 -->`,
        },
      ],
    });

    const result = executePlan(options(), deps);
    await expect(result).rejects.toThrow(SOURCE);
    await expect(result).rejects.toThrow(target);
    await expect(result).rejects.toThrow('rename');
    await expect(result).rejects.toThrow(
      `tlon notes notebook-delete ${target} --yes`
    );
    expect(calls.listNotes).toEqual([target]);
    expect(calls.posts).toEqual([]);
  });

  it('refuses provenance on an earlier line when content is appended', async () => {
    const target = 'notes/~zod/field-notes';
    const { calls, deps } = makeDeps({
      group: groupWithNotebooks({
        host: '~zod',
        name: 'field-notes',
        title: 'Field Notes',
      }),
      listNotes: async () => [
        {
          title: 'Migrated note with later edits',
          bodyMd: `<!-- tlon-migrate: ${SOURCE} 170.141 -->\nUser-added content`,
        },
      ],
    });

    const result = executePlan(options(), deps);
    await expect(result).rejects.toThrow(SOURCE);
    await expect(result).rejects.toThrow(target);
    expect(calls.listNotes).toEqual([target]);
    expect(calls.posts).toEqual([]);
  });

  it('refuses provenance on an earlier complete CRLF line after content is appended', async () => {
    const target = 'notes/~zod/field-notes';
    const { calls, deps } = makeDeps({
      group: groupWithNotebooks({
        host: '~zod',
        name: 'field-notes',
        title: 'Field Notes',
      }),
      listNotes: async () => [
        {
          title: 'Migrated note with later edits',
          bodyMd: `<!-- tlon-migrate: ${SOURCE} 170.141 -->\r\nUser-added content`,
        },
      ],
    });

    const result = executePlan(options(), deps);
    await expect(result).rejects.toThrow(SOURCE);
    await expect(result).rejects.toThrow(target);
    await expect(result).rejects.toThrow(
      `tlon notes notebook-delete ${target} --yes`
    );
    expect(calls.listNotes).toEqual([target]);
    expect(calls.posts).toEqual([]);
  });

  it('scries only same-title notes candidates and allows unrelated provenance', async () => {
    const candidate = 'notes/~zod/field-notes';
    const sourceGroup = groupWithNotebooks(
      {
        host: '~zod',
        name: 'different-title',
        title: 'Different title',
      },
      {
        host: '~zod',
        name: 'field-notes',
        title: 'Field Notes',
      }
    );
    sourceGroup.channels['chat/~zod/field-notes'] = {
      ...sourceGroup.channels[SOURCE],
      meta: {
        ...sourceGroup.channels[SOURCE].meta,
        title: 'Field Notes',
      },
    };
    const { calls, deps } = makeDeps({
      group: sourceGroup,
      listNotes: async () => [
        {
          title: 'Unrelated source marker',
          bodyMd:
            'Body\n<!-- tlon-migrate: diary/~zod/blog-copy 170.141 -->\nAppended content',
        },
        {
          title: 'Leading whitespace marker',
          bodyMd: `Body\n <!-- tlon-migrate: ${SOURCE} 170.141 -->\nAppended content`,
        },
        {
          title: 'Trailing whitespace marker',
          bodyMd: `Body\n<!-- tlon-migrate: ${SOURCE} 170.141 --> \nAppended content`,
        },
      ],
    });

    await expect(executePlan(options(), deps)).resolves.toMatchObject({
      plan: { targetTitle: 'Field Notes' },
    });
    expect(calls.listNotes).toEqual([candidate]);
  });

  it('checks every same-title candidate before allowing a retry', async () => {
    const firstTarget = 'notes/~zod/field-notes-old';
    const secondTarget = 'notes/~zod/field-notes';
    const { calls, deps } = makeDeps({
      group: groupWithNotebooks(
        {
          host: '~zod',
          name: 'field-notes-old',
          title: 'Field Notes',
        },
        {
          host: '~zod',
          name: 'field-notes',
          title: 'Field Notes',
        }
      ),
      listNotes: async (target) => [
        target === firstTarget
          ? {
              title: 'Unrelated note',
              bodyMd:
                'Body\n\n<!-- tlon-migrate: diary/~zod/blog-copy 170.141 -->',
            }
          : {
              title: 'Migrated note',
              bodyMd: `Body\n\n<!-- tlon-migrate: ${SOURCE} 170.141 -->`,
            },
      ],
    });

    await expect(executePlan(options(), deps)).rejects.toThrow(secondTarget);
    expect(calls.listNotes).toEqual([firstTarget, secondTarget]);
    expect(calls.posts).toEqual([]);
  });

  // Scoped to a thrown read. A successful response carrying a malformed
  // `bodyMd` is treated as absent provenance and fails open by design; see the
  // note on `hasSourceProvenanceFooter`.
  it('fails closed when reading a colliding target throws', async () => {
    const target = 'notes/~zod/field-notes';
    const readError = new Error('target notes unavailable');
    const { calls, deps } = makeDeps({
      group: groupWithNotebooks({
        host: '~zod',
        name: 'field-notes',
        title: 'Field Notes',
      }),
      listNotes: async () => {
        throw readError;
      },
    });

    await expect(executePlan(options(), deps)).rejects.toBe(readError);
    expect(calls.listNotes).toEqual([target]);
    expect(calls.posts).toEqual([]);
    expect(calls.mutate).toBe(0);
  });

  it('never scries a same-title notebook hosted by another ship', async () => {
    const foreignTarget = 'notes/~sampel-palnet/field-notes';
    const localTarget = 'notes/~zod/field-notes-copy';
    const { calls, deps } = makeDeps({
      group: groupWithNotebooks(
        {
          host: '~sampel-palnet',
          name: 'field-notes',
          title: 'Field Notes',
        },
        {
          host: '~zod',
          name: 'field-notes-copy',
          title: 'Field Notes',
        }
      ),
      listNotes: async (target) => {
        if (target === foreignTarget) {
          throw new Error('foreign notebook must not be scried');
        }
        return [
          {
            title: 'Unrelated note',
            bodyMd:
              'Body\n\n<!-- tlon-migrate: diary/~zod/blog-copy 170.141 -->',
          },
        ];
      },
    });

    await expect(executePlan(options(), deps)).resolves.toMatchObject({
      plan: { targetTitle: 'Field Notes' },
    });
    expect(calls.listNotes).toEqual([localTarget]);
    expect(calls.listNotes).not.toContain(foreignTarget);
  });

  it('performs complete read and conversion without invoking any mutation', async () => {
    const tombstone = { ...post('gone', 2), isDeleted: true };
    const { calls, deps } = makeDeps({
      pages: [
        {
          posts: [post('live', 3, 'Converted title'), tombstone],
          older: null,
          totalPosts: 2,
        },
      ],
    });
    const result = await executePlan(options(), deps);
    expect(result.plan).toMatchObject({
      sourceNest: SOURCE,
      group: GROUP,
      sourceTitle: 'Field Notes',
      targetTitle: 'Field Notes',
      eligibleCount: 1,
      tombstoneCount: 1,
      stubCount: 0,
      previewTitles: ['Converted title'],
      writeWidening: false,
      archiveTitle: 'Field Notes-ARCHIVE',
    });
    expect(result.convertedNotes[0].body).toContain(
      '<!-- tlon-migrate: diary/~zod/blog live -->'
    );
    expect(calls.mutate).toBe(0);
    expect(calls.identity).toBe(0);
  });

  it('refuses a source hosted by another ship before reading posts', async () => {
    const { calls, deps } = makeDeps({ actingShip: '~nec' });
    await expect(executePlan(options(), deps)).rejects.toThrow(
      'acting ship ~nec is not the host ~zod'
    );
    expect(calls.posts).toEqual([]);
  });

  it('refuses a group hosted by another ship', async () => {
    const { calls, deps } = makeDeps({
      perm: { writers: [], group: '~nec/group' },
    });
    await expect(executePlan(options(), deps)).rejects.toThrow(
      'source group: acting ship ~zod is not the host ~nec'
    );
    expect(calls.posts).toEqual([]);
  });

  it('fails closed when the source channel is missing from the group', async () => {
    const { deps } = makeDeps({ group: group({ channels: {} }) });
    await expect(executePlan(options(), deps)).rejects.toThrow(
      'refusing to assume open readers'
    );
  });

  it('refuses an empty eligible source set', async () => {
    const deleted = { ...post('gone', 1), isDeleted: true };
    const { deps } = makeDeps({
      pages: [{ posts: [deleted], older: null, totalPosts: 1 }],
    });
    await expect(executePlan(options(), deps)).rejects.toThrow(
      'has no eligible posts'
    );
  });

  it('reports widening without enumerating group seats', async () => {
    const sourceGroup = group();
    sourceGroup.channels[SOURCE].readers = ['members'];
    const { deps } = makeDeps({ group: sourceGroup });
    const { plan } = await executePlan(options(), deps);
    expect(plan.writeWidening).toBe(true);
    expect(plan.wideningReasons.join(' ')).toContain('reader role "members"');
    expect(JSON.stringify(plan)).not.toContain('~sampel-palnet');
  });
});
