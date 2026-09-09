import type { Story } from '@tloncorp/api';
import { describe, expect, it } from 'bun:test';

import type { MigrationDeps, MigrationPlan } from '../notes-migrate';
import {
  MIGRATE_HELP,
  formatApplySummaryLines,
  formatPlanText,
  parseMigrateArgs,
  runMigrate,
  runMigrateApply,
  runMigratePlan,
} from './migrate';
import { run as runNotes } from './notes';
import type { NotesDeps } from './notes';

const PLAN: MigrationPlan = {
  sourceNest: 'diary/~zod/blog',
  group: '~zod/group',
  sourceTitle: 'Field Notes',
  targetTitle: 'Field Notes',
  eligibleCount: 2,
  tombstoneCount: 1,
  stubCount: 0,
  previewTitles: ['First', 'Untitled — 2025-03-14'],
  writeWidening: true,
  wideningReasons: [
    'reader role "members" is not writer-authorizing and would gain write access',
  ],
  readerRoles: ['members'],
  writerRoles: ['writers'],
  privacy: 'private',
  archiveTitle: 'Field Notes-ARCHIVE',
  metrics: {
    totalComments: 3,
    totalReactions: 4,
    citeCount: 5,
    linkBlockCount: 6,
    groupMentionCount: 7,
    flattenedInlineCount: 0,
  },
};

function migrationDeps(): MigrationDeps {
  return {
    getChannelPerm: async () => ({
      writers: ['writers'],
      group: '~zod/group',
    }),
    getGroup: async () => ({
      privacy: 'private',
      admins: [],
      channels: {
        'diary/~zod/blog': {
          added: 1,
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
    }),
    getChannelPosts: async () => ({
      posts: [
        {
          id: '1',
          type: 'note',
          channelId: 'diary/~zod/blog',
          authorId: '~zod',
          sentAt: Date.UTC(2025, 0, 1),
          receivedAt: Date.UTC(2025, 0, 1),
          sequenceNum: 1,
          content: [{ inline: ['Hello'] }],
        },
      ],
      older: null,
      totalPosts: 1,
    }),
    createGroupNotebook: async () => {
      throw new Error('not used');
    },
    getNotebookDetail: async () => {
      throw new Error('not used');
    },
    listNotes: async () => {
      throw new Error('not used');
    },
    batchImport: async () => {
      throw new Error('not used');
    },
    getRawGroup: async () => {
      throw new Error('not used');
    },
    updateChannel: async () => {
      throw new Error('not used');
    },
    getActingShip: () => '~zod',
    assertServerIdentity: async () => {
      throw new Error('not used');
    },
    toUrbitStory: (content) => content as Story,
    storyToMdastStrict: () => undefined,
    storyToMarkdown: () => 'Hello',
    generateRequestId: () => '0v1',
    recoveryInstruction: () => 'recover',
    log: () => undefined,
  };
}

describe('parseMigrateArgs', () => {
  it('accepts only the two specified command surfaces', () => {
    expect(parseMigrateArgs('migrate-plan', ['diary/zod/blog'])).toEqual({
      sourceNest: 'diary/~zod/blog',
      allowWriteWidening: false,
      yes: false,
    });
    expect(
      parseMigrateArgs('migrate-apply', [
        'diary/~zod/blog',
        '--yes',
        '--allow-write-widening',
      ])
    ).toEqual({
      sourceNest: 'diary/~zod/blog',
      allowWriteWidening: true,
      yes: true,
    });
  });

  for (const removed of [
    '--into',
    '--title',
    '--expect-posts',
    '--expect-digest',
    '--self-bind',
    '--json',
  ]) {
    it(`rejects removed flag ${removed}`, () => {
      expect(() =>
        parseMigrateArgs('migrate-plan', ['diary/~zod/blog', removed, 'value'])
      ).toThrow(`${removed} is not permitted`);
    });
  }

  it('requires --yes only for apply', () => {
    expect(() =>
      parseMigrateArgs('migrate-apply', ['diary/~zod/blog'])
    ).toThrow('requires --yes');
    expect(() =>
      parseMigrateArgs('migrate-plan', ['diary/~zod/blog', '--yes'])
    ).toThrow('--yes is not permitted');
  });

  it('rejects duplicate flags and extra positional arguments', () => {
    expect(() =>
      parseMigrateArgs('migrate-apply', ['diary/~zod/blog', '--yes', '--yes'])
    ).toThrow('Duplicate option --yes');
    expect(() =>
      parseMigrateArgs('migrate-plan', ['diary/~zod/blog', 'diary/~zod/other'])
    ).toThrow('Unexpected argument');
  });

  it('makes bare migrate point at the two supported verbs', () => {
    expect(() => parseMigrateArgs('migrate', [])).toThrow(
      'Use either migrate-plan or migrate-apply'
    );
  });
});

describe('plain-text plan rendering', () => {
  it('states losses, authorship, permission classes, and result', () => {
    const text = formatPlanText(PLAN);
    expect(text).toContain('Migration plan — Field Notes');
    expect(text).toContain('2 posts → 2 notes');
    expect(text).toContain(
      '5 post references and 6 link blocks — dropped in conversion'
    );
    expect(text).toContain('7 group mentions → converted to plain text');
    expect(text).toContain('3 comments and 4 post reactions');
    expect(text).toContain('every note will show ~zod as author');
    expect(text).toContain('"writers" can post');
    expect(text).toContain('members with "members" can read');
    expect(text).toContain('Blocked by default; requires explicit acceptance.');
    expect(text).toContain('Original renamed "Field Notes-ARCHIVE"');
  });

  // The read-only terminal report does not accept the widening on the user's
  // behalf. The flag is named by migrate-apply's refusal instead.
  it('never names the CLI flag, in either widening state', () => {
    expect(formatPlanText(PLAN)).not.toContain('--allow-write-widening');
    expect(
      formatPlanText({ ...PLAN, writeWidening: false, wideningReasons: [] })
    ).not.toContain('--allow-write-widening');
  });

  it('states that an open channel in a public group is readable by anyone', () => {
    const text = formatPlanText({
      ...PLAN,
      readerRoles: [],
      writerRoles: [],
      privacy: 'public',
    });
    expect(text).toContain(
      'Now:   all group members can post; anyone can read.'
    );
    expect(text).not.toContain('everyone who can read can post');
    expect(text).toContain('readable by: anyone');
    expect(text).not.toContain('all group members can read');
  });

  it('states that an open channel in a private group is readable by group members', () => {
    const text = formatPlanText({
      ...PLAN,
      readerRoles: [],
      writerRoles: [],
      privacy: 'private',
    });
    expect(text).toContain(
      'Now:   all group members can post; all group members can read.'
    );
    expect(text).toContain('readable by: all group members');
  });

  it('states that open writers remain all group members with role-restricted readers', () => {
    const text = formatPlanText({
      ...PLAN,
      readerRoles: ['readers'],
      writerRoles: [],
      privacy: 'secret',
    });
    expect(text).toContain(
      'Now:   all group members can post; members with "readers" can read.'
    );
  });
});

describe('completion summary rendering', () => {
  it('reports converted group mentions separately from archive-only losses', () => {
    const lines = formatApplySummaryLines({
      notesImported: 2,
      targetNest: 'notes/~zod/field-notes',
      archiveTitle: 'Field Notes-ARCHIVE',
      archiveRenamed: true,
      archiveOnly: PLAN.metrics,
      warnings: [],
    });
    const archiveLine = lines.find((line) => line.includes('Left in archive'));
    expect(archiveLine).not.toContain('group mention');
    expect(lines).toContain(
      '  Converted to plain text: 7 group mentions, 0 tags/inline references'
    );
  });
});

describe('CLI dispatch', () => {
  it('runs migrate-plan as a complete authenticated read', async () => {
    const output: string[] = [];
    let auth = 0;
    const code = await runMigratePlan(['diary/~zod/blog'], {
      stdout: (text) => output.push(text),
      stderr: () => undefined,
      authenticate: async () => {
        auth += 1;
      },
      migration: migrationDeps(),
    });
    expect(code).toBe(0);
    expect(auth).toBe(1);
    expect(output.join('')).toContain('Migration plan — Field Notes');
    expect(output.join('')).not.toStartWith('{');
  });

  it('validates apply confirmation before authentication', async () => {
    let auth = 0;
    await expect(
      runMigrateApply(['diary/~zod/blog'], {
        stdout: () => undefined,
        stderr: () => undefined,
        authenticate: async () => {
          auth += 1;
        },
        migration: migrationDeps(),
      })
    ).rejects.toThrow('requires --yes');
    expect(auth).toBe(0);
  });

  it('renders help for the migration command family', async () => {
    const output: string[] = [];
    await expect(
      runMigrate(['--help'], {
        stdout: (text) => output.push(text),
        stderr: () => undefined,
        authenticate: async () => undefined,
        migration: migrationDeps(),
      })
    ).resolves.toBe(0);
    expect(output.join('')).toContain(MIGRATE_HELP);
  });
});

describe('notebook-delete recovery CLI', () => {
  const markedBody =
    'Migrated body\n\n<!-- tlon-migrate: diary/~zod/blog 170.141 -->\n';

  function notesDeps(
    options: {
      bodies?: Array<string | null>;
      deletionConfirmed?: boolean;
      groupListings?: Array<{ groupId: string; channelIds: string[] }>;
      groupSnapshotError?: Error;
      pollResponses?: Record<string, Array<string[] | Error>>;
    } = {}
  ) {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const calls = {
      auth: 0,
      deleted: [] as string[],
      listedNotes: [] as string[],
      listedNotebooks: 0,
      groupSnapshots: 0,
      groupPolls: [] as string[],
      sleeps: [] as number[],
      order: [] as string[],
    };
    const deps = {
      stdout: (text: string) => {
        stdout.push(text);
        calls.order.push(`stdout:${text.trim()}`);
      },
      stderr: (text: string) => stderr.push(text),
      authenticate: async () => {
        calls.auth += 1;
        calls.order.push('authenticate');
      },
      notesV1: {
        listNotes: async (nest: string) => {
          calls.listedNotes.push(nest);
          calls.order.push('listNotes');
          return (options.bodies ?? [markedBody]).map((bodyMd, index) => ({
            id: index + 1,
            title: `Note ${index + 1}`,
            bodyMd,
          }));
        },
        listNotebooks: async () => {
          calls.listedNotebooks += 1;
          calls.order.push('listNotebooks');
          return options.deletionConfirmed === false
            ? [
                {
                  host: '~zod',
                  flagName: 'book',
                  notebook: { id: 1, title: 'Book' },
                },
              ]
            : [];
        },
      },
      deleteNotesNotebookStrict: async (nest: string) => {
        calls.deleted.push(nest);
        calls.order.push('deleteNotesNotebookStrict');
      },
      getGroupChannelListings: async () => {
        calls.groupSnapshots += 1;
        calls.order.push('getGroupChannelListings');
        if (options.groupSnapshotError) throw options.groupSnapshotError;
        return options.groupListings ?? [];
      },
      getGroupChannelIds: async (groupId: string) => {
        const attempt = calls.groupPolls.filter(
          (polledGroup) => polledGroup === groupId
        ).length;
        calls.groupPolls.push(groupId);
        calls.order.push(`getGroupChannelIds:${groupId}`);
        expect(stdout).toEqual([]);
        const responses = options.pollResponses?.[groupId] ?? [[]];
        const response = responses[Math.min(attempt, responses.length - 1)];
        if (response instanceof Error) throw response;
        return response;
      },
      sleep: async (ms: number) => {
        calls.sleeps.push(ms);
        calls.order.push(`sleep:${ms}`);
      },
      isPendingWriteError: () => false,
    } as unknown as NotesDeps;
    return {
      calls,
      deps,
      stdout: () => stdout.join(''),
      stderr: () => stderr.join(''),
    };
  }

  it('requires --yes before authentication', async () => {
    const { calls, deps } = notesDeps();
    expect(await runNotes(['notebook-delete', 'notes/~zod/book'], deps)).toBe(
      1
    );
    expect(calls.auth).toBe(0);
    expect(calls.deleted).toEqual([]);
  });

  it('deletes the exact normalized notes nest after authentication', async () => {
    const { calls, deps, stdout } = notesDeps();
    expect(
      await runNotes(['notebook-delete', 'notes/zod/book', '--yes'], deps)
    ).toBe(0);
    expect(calls.auth).toBe(1);
    expect(calls.listedNotes).toEqual(['notes/~zod/book']);
    expect(calls.deleted).toEqual(['notes/~zod/book']);
    expect(calls.listedNotebooks).toBe(1);
    expect(calls.groupSnapshots).toBe(1);
    expect(calls.groupPolls).toEqual([]);
    expect(calls.order).toEqual([
      'authenticate',
      'listNotes',
      'getGroupChannelListings',
      'deleteNotesNotebookStrict',
      'listNotebooks',
      'stdout:✓ Notebook deleted: notes/~zod/book',
    ]);
    expect(stdout()).toBe('✓ Notebook deleted: notes/~zod/book\n');
  });

  it('waits for every recorded group listing to clear before reporting success', async () => {
    const target = 'notes/~zod/book';
    const { calls, deps, stdout } = notesDeps({
      groupListings: [
        { groupId: '~zod/alpha', channelIds: [target, 'chat/~zod/general'] },
        { groupId: '~zod/beta', channelIds: ['chat/~zod/random'] },
        { groupId: '~zod/gamma', channelIds: [target] },
      ],
      pollResponses: {
        '~zod/alpha': [[target], []],
        '~zod/gamma': [[], []],
      },
    });

    expect(await runNotes(['notebook-delete', target, '--yes'], deps)).toBe(0);
    expect(calls.groupPolls).toEqual([
      '~zod/alpha',
      '~zod/gamma',
      '~zod/alpha',
      '~zod/gamma',
    ]);
    expect(calls.groupPolls).not.toContain('~zod/beta');
    expect(calls.sleeps).toEqual([500]);
    expect(calls.order.indexOf('getGroupChannelListings')).toBeLessThan(
      calls.order.indexOf('deleteNotesNotebookStrict')
    );
    expect(calls.order.indexOf('listNotebooks')).toBeGreaterThan(
      calls.order.indexOf('deleteNotesNotebookStrict')
    );
    expect(stdout()).toBe(`✓ Notebook deleted: ${target}\n`);
  });

  it('refuses deletion before mutation when the group snapshot cannot be read', async () => {
    const target = 'notes/~zod/book';
    const { calls, deps, stderr, stdout } = notesDeps({
      groupSnapshotError: new Error('groups unavailable'),
    });

    expect(await runNotes(['notebook-delete', target, '--yes'], deps)).toBe(1);
    expect(stderr()).toContain(
      `Error: Could not inspect group listings before deleting ${target}: groups unavailable`
    );
    expect(calls.deleted).toEqual([]);
    expect(calls.listedNotebooks).toBe(0);
    expect(calls.groupPolls).toEqual([]);
    expect(stdout()).toBe('');
  });

  it('reports deleted but unconfirmed when a recorded listing stays present', async () => {
    const target = 'notes/~zod/book';
    const { calls, deps, stderr, stdout } = notesDeps({
      groupListings: [
        { groupId: '~zod/alpha', channelIds: [target] },
        { groupId: '~zod/beta', channelIds: [target] },
      ],
      pollResponses: {
        '~zod/alpha': [[target]],
        '~zod/beta': [[], [], [], [], new Error('final beta failure')],
      },
    });

    expect(await runNotes(['notebook-delete', target, '--yes'], deps)).toBe(1);
    expect(calls.deleted).toEqual([target]);
    expect(calls.listedNotebooks).toBe(1);
    expect(
      calls.groupPolls.filter((group) => group === '~zod/alpha')
    ).toHaveLength(5);
    expect(
      calls.groupPolls.filter((group) => group === '~zod/beta')
    ).toHaveLength(5);
    expect(calls.sleeps).toEqual([500, 500, 500, 500]);
    expect(stderr()).toBe(
      `Error: Notebook deleted; group cleanup unconfirmed for ${target}: its old group listing is still present. Wait a few seconds before retrying the migration.\n`
    );
    expect(stdout()).not.toContain('✓ Notebook deleted');
  });

  it('reports deleted but unverifiable when the final group read fails', async () => {
    const target = 'notes/~zod/book';
    const { calls, deps, stderr, stdout } = notesDeps({
      groupListings: [{ groupId: '~zod/alpha', channelIds: [target] }],
      pollResponses: {
        '~zod/alpha': [
          [target],
          new Error('read 2 failed'),
          new Error('read 3 failed'),
          new Error('read 4 failed'),
          new Error('read 5 failed'),
        ],
      },
    });

    expect(await runNotes(['notebook-delete', target, '--yes'], deps)).toBe(1);
    expect(calls.deleted).toEqual([target]);
    expect(calls.listedNotebooks).toBe(1);
    expect(calls.groupPolls).toHaveLength(5);
    expect(calls.sleeps).toEqual([500, 500, 500, 500]);
    expect(stderr()).toBe(
      `Error: Notebook deleted; group cleanup unconfirmed for ${target}: the group listing could not be checked. Wait a few seconds before retrying the migration.\n`
    );
    expect(stdout()).not.toContain('✓ Notebook deleted');
  });

  it('refuses to delete a notebook containing unmarked notes', async () => {
    const { calls, deps, stderr } = notesDeps({
      bodies: [markedBody, 'A member wrote this note.'],
    });

    expect(
      await runNotes(['notebook-delete', 'notes/~zod/book', '--yes'], deps)
    ).toBe(1);
    expect(stderr()).toContain('found 1 unmarked note(s)');
    expect(stderr()).toContain('--yes --force');
    expect(calls.deleted).toEqual([]);
    expect(calls.listedNotebooks).toBe(0);
  });

  it('requires --force when user content follows a valid provenance line', async () => {
    const { calls, deps, stderr } = notesDeps({
      bodies: [
        '<!-- tlon-migrate: diary/~zod/blog 170.141 -->\nUser-added content',
      ],
    });

    expect(
      await runNotes(['notebook-delete', 'notes/~zod/book', '--yes'], deps)
    ).toBe(1);
    expect(stderr()).toContain('found 1 unmarked note(s)');
    expect(calls.deleted).toEqual([]);
  });

  it('allows intentional deletion of unmarked notes only with --force and --yes', async () => {
    const forced = notesDeps({ bodies: ['A member wrote this note.'] });
    expect(
      await runNotes(
        ['notebook-delete', 'notes/~zod/book', '--yes', '--force'],
        forced.deps
      )
    ).toBe(0);
    expect(forced.calls.deleted).toEqual(['notes/~zod/book']);

    const missingYes = notesDeps({ bodies: ['A member wrote this note.'] });
    expect(
      await runNotes(
        ['notebook-delete', 'notes/~zod/book', '--force'],
        missingYes.deps
      )
    ).toBe(1);
    expect(missingYes.calls.auth).toBe(0);
    expect(missingYes.calls.deleted).toEqual([]);
  });

  it('errors instead of reporting deletion when read-back still lists the notebook', async () => {
    const { calls, deps, stderr } = notesDeps({ deletionConfirmed: false });

    expect(
      await runNotes(['notebook-delete', 'notes/~zod/book', '--yes'], deps)
    ).toBe(1);
    expect(calls.deleted).toEqual(['notes/~zod/book']);
    expect(calls.listedNotebooks).toBe(1);
    expect(stderr()).toContain('Notebook deletion was not confirmed');
    expect(stderr()).toContain('notes/~zod/book is still present');
  });
});
