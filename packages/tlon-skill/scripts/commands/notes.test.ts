import type { NotesV1Api } from '@tloncorp/api';
import { describe, expect, it } from 'bun:test';

import type { NotesPendingWriteErrorLike } from '../notes-pending-write';
import { commandError } from './command';
import {
  NOTES_COMMAND_HELP,
  NOTES_HELP,
  type NotesDeps,
  parseNotesNest,
  run,
} from './notes';

type AnyFn = (...args: unknown[]) => Promise<unknown>;

const NOTES_V1_OPS = [
  'getRequest',
  'listNotebooks',
  'getNotebook',
  'createNotebook',
  'createGroupNotebook',
  'listNotes',
  'getNote',
  'createNote',
  'updateNoteBody',
  'renameNote',
  'moveNote',
  'deleteNote',
  'listNoteHistory',
  'listFolders',
  'getFolder',
  'createFolder',
  'renameFolder',
  'moveFolder',
  'deleteFolder',
  'listMembers',
  'batchImport',
] as const;

type NotesV1Op = (typeof NOTES_V1_OPS)[number];

const NOTES_PUBLISH_OPS = [
  'listPublished',
  'publishNote',
  'unpublishNote',
] as const;

type NotesPublishOp = (typeof NOTES_PUBLISH_OPS)[number];

interface NotesV1Call {
  op: NotesV1Op;
  args: unknown[];
}

interface MakeDepsOptions {
  authenticate?: () => Promise<void>;
  notesV1?: Partial<Record<NotesV1Op, AnyFn>>;
  notesPublish?: Partial<Record<NotesPublishOp, AnyFn>>;
  isPendingWriteError?: NotesDeps['isPendingWriteError'];
  joinNotesNotebook?: (nest: string) => Promise<void>;
  leaveNotesNotebook?: (nest: string) => Promise<void>;
  readFile?: (path: string) => string;
  readStdin?: () => Promise<string>;
}

class PendingWriteErrorForTest
  extends Error
  implements NotesPendingWriteErrorLike
{
  readonly requestId?: string;
  readonly status?: string;
  readonly checks: NotesPendingWriteErrorLike['checks'];

  constructor({
    requestId,
    status,
    checks = [],
  }: Partial<NotesPendingWriteErrorLike> = {}) {
    super('%notes write request is still pending');
    this.name = 'NotesV1PendingWriteError';
    this.requestId = requestId;
    this.status = status;
    this.checks = checks;
  }
}

function makeDeps(options: MakeDepsOptions = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const calls = {
    authenticate: 0,
    notesV1: [] as NotesV1Call[],
    notesPublish: [] as Array<{ op: NotesPublishOp; args: unknown[] }>,
    render: [] as Array<{ title: string; body: string }>,
    publishedNoteUrl: [] as Array<[string, number]>,
    sleep: [] as number[],
    joinNotesNotebook: [] as string[],
    leaveNotesNotebook: [] as string[],
    readFile: [] as string[],
    readStdin: 0,
    order: [] as string[],
  };

  const notesV1 = {} as Record<NotesV1Op, AnyFn>;
  for (const op of NOTES_V1_OPS) {
    notesV1[op] = async (...args: unknown[]) => {
      calls.notesV1.push({ op, args });
      calls.order.push(`notesV1:${op}`);
      const responder = options.notesV1?.[op];
      return responder ? await responder(...args) : undefined;
    };
  }

  const notesPublish = {} as Record<NotesPublishOp, AnyFn>;
  for (const op of NOTES_PUBLISH_OPS) {
    notesPublish[op] = async (...args: unknown[]) => {
      calls.notesPublish.push({ op, args });
      calls.order.push(`notesPublish:${op}`);
      const responder = options.notesPublish?.[op];
      if (responder) return await responder(...args);
      return op === 'listPublished' ? [] : undefined;
    };
  }

  const deps: NotesDeps = {
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    authenticate: async () => {
      calls.authenticate += 1;
      calls.order.push('authenticate');
      await options.authenticate?.();
    },
    notesV1: notesV1 as unknown as NotesV1Api,
    isPendingWriteError:
      options.isPendingWriteError ??
      ((error): error is NotesPendingWriteErrorLike =>
        error instanceof PendingWriteErrorForTest),
    joinNotesNotebook: async (nest) => {
      calls.joinNotesNotebook.push(nest);
      calls.order.push('joinNotesNotebook');
      await options.joinNotesNotebook?.(nest);
    },
    leaveNotesNotebook: async (nest) => {
      calls.leaveNotesNotebook.push(nest);
      calls.order.push('leaveNotesNotebook');
      await options.leaveNotesNotebook?.(nest);
    },
    deleteNotesNotebookStrict: async () => undefined,
    getGroupChannelListings: async () => [],
    getGroupChannelIds: async () => [],
    sleep: async (ms) => {
      calls.sleep.push(ms);
    },
    notesPublish: notesPublish as unknown as NotesDeps['notesPublish'],
    renderPublishedNoteHtml: (note) => {
      calls.render.push(note);
      calls.order.push('render');
      return `<html>${note.title}|${note.body}</html>`;
    },
    publishedNoteUrl: (flag, noteId) => {
      calls.publishedNoteUrl.push([flag, noteId]);
      return `https://owner.example/notes/pub/${flag}/${noteId}`;
    },
    readFile: (path) => {
      calls.readFile.push(path);
      calls.order.push('readFile');
      if (options.readFile) return options.readFile(path);
      throw new Error(`ENOENT: no such file, open '${path}'`);
    },
    readStdin: async () => {
      calls.readStdin += 1;
      calls.order.push('readStdin');
      return options.readStdin ? options.readStdin() : '';
    },
  };

  return {
    deps,
    calls,
    ops: () => calls.notesV1.map((c) => c.op),
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
  };
}

function expectNoAuthOrIo(context: ReturnType<typeof makeDeps>) {
  expect(context.calls.authenticate).toBe(0);
  expect(context.calls.notesV1).toEqual([]);
  expect(context.calls.notesPublish).toEqual([]);
  expect(context.calls.joinNotesNotebook).toEqual([]);
  expect(context.calls.leaveNotesNotebook).toEqual([]);
  expect(context.calls.readFile).toEqual([]);
  expect(context.calls.readStdin).toBe(0);
}

// Canonical v1 fixtures (already normalized — variant normalization is the
// API's job and is covered in packages/api).
const NOTEBOOK_SUMMARY = {
  host: '~zod',
  flagName: 'blog',
  notebook: { id: 2, title: 'Blog' },
};
const NOTEBOOK_DETAIL = {
  host: '~zod',
  flagName: 'blog',
  notebook: { id: 2, title: 'Blog', rootFolderId: 3 },
  visibility: 'public',
};

describe('notes help and shell', () => {
  it('prints family help for --help and -h without auth/IO', async () => {
    for (const flag of ['--help', '-h']) {
      const context = makeDeps();
      const exitCode = await run([flag], context.deps);

      expect(exitCode).toBe(0);
      expect(context.stdout()).toBe(`${NOTES_HELP}\n`);
      expect(context.stderr()).toBe('');
      expectNoAuthOrIo(context);
    }
  });

  it('prints per-subcommand help for a help token after the subcommand', async () => {
    const cases: Array<[string, string]> = [
      ['status', NOTES_COMMAND_HELP.status],
      ['request', NOTES_COMMAND_HELP.request],
      ['show', NOTES_COMMAND_HELP.show],
      ['note-create', NOTES_COMMAND_HELP['note-create']],
      ['note-update', NOTES_COMMAND_HELP['note-update']],
      ['join', NOTES_COMMAND_HELP.join],
    ];

    for (const [command, help] of cases) {
      const context = makeDeps();
      const exitCode = await run([command, '--help'], context.deps);

      expect(exitCode).toBe(0);
      expect(context.stdout()).toBe(`${help}\n`);
      expect(context.stderr()).toBe('');
      expectNoAuthOrIo(context);
    }
  });

  it('returns a family usage error for bare invocation and unknown subcommand', async () => {
    for (const args of [[], ['bogus']]) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`${NOTES_HELP}\n`);
      expectNoAuthOrIo(context);
    }
  });
});

describe('notes nest parsing', () => {
  it('parses a well-formed nest and normalizes a missing ~', () => {
    expect(parseNotesNest('notes/~zod/blog', 'usage')).toEqual({
      nest: 'notes/~zod/blog',
      host: '~zod',
      name: 'blog',
    });
    expect(parseNotesNest('notes/zod/blog', 'usage').host).toBe('~zod');
  });

  it('rejects a malformed nest locally before auth', async () => {
    for (const nest of ['chat/~zod/blog', 'notes/~zod', '~zod/blog']) {
      const context = makeDeps();
      const exitCode = await run(['show', nest], context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toContain(`Invalid notes nest: ${nest}`);
      expectNoAuthOrIo(context);
    }
  });

  it('rejects a malformed request id locally before auth', async () => {
    for (const requestId of ['notes/~zod/blog', '']) {
      const args = requestId ? ['request', requestId] : ['request'];
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toContain(
        requestId ? 'Invalid request id' : NOTES_COMMAND_HELP.request
      );
      expectNoAuthOrIo(context);
    }
  });
});

describe('notes reads call operations and format output', () => {
  it('lists notebooks', async () => {
    const context = makeDeps({
      notesV1: {
        listNotebooks: async () => [
          NOTEBOOK_SUMMARY,
          { host: '~bus', flagName: 'log', notebook: { id: 8, title: 'Log' } },
        ],
      },
    });

    const exitCode = await run(['list'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.notesV1).toEqual([{ op: 'listNotebooks', args: [] }]);
    expect(context.stdout()).toBe(
      'notes/~zod/blog  Blog  (id 2)\nnotes/~bus/log  Log  (id 8)\n'
    );
  });

  it('reports an empty notebook list', async () => {
    const context = makeDeps({ notesV1: { listNotebooks: async () => [] } });
    const exitCode = await run(['list'], context.deps);
    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('No notebooks.\n');
  });

  it('shows a notebook via getNotebook(target.nest)', async () => {
    const context = makeDeps({
      notesV1: { getNotebook: async () => NOTEBOOK_DETAIL },
    });

    const exitCode = await run(['show', 'notes/~zod/blog'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.notesV1).toEqual([
      { op: 'getNotebook', args: ['notes/~zod/blog'] },
    ]);
    expect(context.stdout()).toContain('Nest: notes/~zod/blog');
    expect(context.stdout()).toContain('Root folder: 3');
    expect(context.stdout()).toContain('Visibility: public');
  });

  it('lists notes', async () => {
    const context = makeDeps({
      notesV1: {
        listNotes: async () => [
          { id: 12, title: 'First', revision: 1 },
          { id: 13, title: 'Second', revision: 4 },
        ],
      },
    });

    const exitCode = await run(['notes', 'notes/~zod/blog'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.notesV1).toEqual([
      { op: 'listNotes', args: ['notes/~zod/blog'] },
    ]);
    expect(context.stdout()).toBe(
      '#12  First  (rev 1)\n#13  Second  (rev 4)\n'
    );
  });

  it('shows a single note via getNote({ flag, noteId })', async () => {
    const context = makeDeps({
      notesV1: {
        getNote: async () => ({
          id: 12,
          title: 'First',
          revision: 1,
          folderId: 3,
          bodyMd: '# Hello\n\nWorld',
        }),
      },
    });

    const exitCode = await run(['note', 'notes/~zod/blog', '12'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.notesV1).toEqual([
      { op: 'getNote', args: [{ flag: 'notes/~zod/blog', noteId: 12 }] },
    ]);
    expect(context.stdout()).toContain('#12  First');
    expect(context.stdout()).toContain('Folder: 3');
    expect(context.stdout()).toContain('# Hello\n\nWorld');
  });

  it('lists folders / members', async () => {
    const folders = makeDeps({
      notesV1: {
        listFolders: async () => [
          { id: 3, name: 'Root', parentFolderId: null },
          { id: 4, name: 'Drafts', parentFolderId: 3 },
        ],
      },
    });
    await run(['folders', 'notes/~zod/blog'], folders.deps);
    expect(folders.calls.notesV1).toEqual([
      { op: 'listFolders', args: ['notes/~zod/blog'] },
    ]);
    expect(folders.stdout()).toBe('#3  Root\n#4  Drafts  parent 3\n');

    const members = makeDeps({
      notesV1: {
        listMembers: async () => [
          { ship: '~zod', roles: ['owner'] },
          { ship: '~bus', roles: [] },
        ],
      },
    });
    await run(['members', 'notes/~zod/blog'], members.deps);
    expect(members.stdout()).toBe('~zod  [owner]\n~bus\n');
  });

  it('shows folder detail and note history', async () => {
    const folder = makeDeps({
      notesV1: {
        getFolder: async () => ({ id: 4, name: 'Drafts', parentFolderId: 3 }),
      },
    });
    await run(['folder', 'notes/~zod/blog', '4'], folder.deps);
    expect(folder.calls.notesV1).toEqual([
      { op: 'getFolder', args: [{ flag: 'notes/~zod/blog', folderId: 4 }] },
    ]);
    expect(folder.stdout()).toContain('#4  Drafts');
    expect(folder.stdout()).toContain('Parent: 3');

    const history = makeDeps({
      notesV1: {
        listNoteHistory: async () => [
          { revision: 2, author: '~zod', editedAt: 100 },
          { revision: 1, author: '~zod' },
        ],
      },
    });
    await run(['history', 'notes/~zod/blog', '12'], history.deps);
    expect(history.calls.notesV1).toEqual([
      {
        op: 'listNoteHistory',
        args: [{ flag: 'notes/~zod/blog', noteId: 12 }],
      },
    ]);
    expect(history.stdout()).toContain('rev 2  ~zod  @ 100');
  });
});

describe('notes status', () => {
  it('reports reachable when listNotebooks resolves', async () => {
    const context = makeDeps({ notesV1: { listNotebooks: async () => [] } });
    const exitCode = await run(['status'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.ops()).toEqual(['listNotebooks']);
    expect(context.stdout()).toContain('%notes v1 API: reachable');
    expect(context.stdout()).toContain('group-channel mode: unknown');
  });

  it('reports unreachable when listNotebooks rejects', async () => {
    const context = makeDeps({
      notesV1: {
        listNotebooks: async () => {
          throw commandError('boom');
        },
      },
    });
    const exitCode = await run(['status'], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toContain('%notes v1 API: unreachable');
  });
});

describe('notes request status', () => {
  it('prints pending request status and exits nonzero', async () => {
    const context = makeDeps({
      notesV1: {
        getRequest: async () => ({
          requestId: '0vabc',
          body: { type: 'pending', status: 'acked' },
        }),
      },
    });

    const exitCode = await run(['request', '0vabc'], context.deps);

    expect(exitCode).toBe(1);
    expect(context.calls.notesV1).toEqual([
      { op: 'getRequest', args: ['0vabc'] },
    ]);
    expect(context.stdout()).toContain('Request: 0vabc');
    expect(context.stdout()).toContain('Status: pending (acked)');
    expect(context.stdout()).toContain('Do not issue the write again');
  });

  it('prints successful and failed terminal request statuses', async () => {
    const ok = makeDeps({
      notesV1: {
        getRequest: async () => ({ requestId: '0vok', body: { type: 'ok' } }),
      },
    });
    expect(await run(['request', '0vok'], ok.deps)).toBe(0);
    expect(ok.stdout()).toContain('Status: ok');

    const failed = makeDeps({
      notesV1: {
        getRequest: async () => ({
          requestId: '0verr',
          body: { type: 'error', errorType: 'not-found', message: '' },
        }),
      },
    });
    expect(await run(['request', '0verr'], failed.deps)).toBe(1);
    expect(failed.stdout()).toContain('Status: error');
    expect(failed.stdout()).toContain('Message: not-found');
  });

  it('prints notebook request results', async () => {
    const context = makeDeps({
      notesV1: {
        getRequest: async () => ({
          requestId: '0vbook',
          body: { type: 'notebook', notebook: NOTEBOOK_SUMMARY },
        }),
      },
    });

    const exitCode = await run(['request', '0vbook'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toContain('Status: notebook');
    expect(context.stdout()).toContain('Nest: notes/~zod/blog');
  });
});

describe('notes writes call operations with typed args', () => {
  it('creates a solo notebook and prints the derived nest', async () => {
    const context = makeDeps({
      notesV1: {
        createNotebook: async () => ({
          host: '~zod',
          flagName: 'new-book',
          notebook: { id: 5, title: 'New' },
        }),
      },
    });

    const exitCode = await run(['create', 'New Notebook'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.notesV1).toEqual([
      { op: 'createNotebook', args: [{ title: 'New Notebook' }] },
    ]);
    expect(context.stdout()).toContain('✓ Notebook created');
    expect(context.stdout()).toContain('Nest: notes/~zod/new-book');
  });

  it('preserves option-like words in notebook titles', async () => {
    const context = makeDeps({
      notesV1: {
        createNotebook: async () => ({
          host: '~zod',
          flagName: 'b',
          notebook: { id: 5, title: '--draft Roadmap' },
        }),
      },
    });

    await run(['create', '--draft', 'Roadmap'], context.deps);
    expect(context.calls.notesV1[0].args).toEqual([
      { title: '--draft Roadmap' },
    ]);
  });

  it('note-create resolves root via getNotebook before createNote', async () => {
    const context = makeDeps({
      readFile: () => '# Body',
      notesV1: {
        getNotebook: async () => NOTEBOOK_DETAIL,
        createNote: async () => ({ id: 12, folderId: 3, title: 'Title' }),
      },
    });

    const exitCode = await run(
      ['note-create', 'notes/~zod/blog', 'root', 'Title', '--body', 'note.md'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.ops()).toEqual(['getNotebook', 'createNote']);
    expect(context.calls.notesV1[1]).toEqual({
      op: 'createNote',
      args: [
        { flag: 'notes/~zod/blog', folder: 3, title: 'Title', body: '# Body' },
      ],
    });
    expect(context.calls.readFile).toEqual(['note.md']);
    expect(context.stdout()).toBe(
      [
        '✓ Note created',
        '  ID: 12',
        '  Ref: /1/chan/notes/~zod/blog/note/12',
        '  Share: include the Ref path in a chat message to post a tappable note card.',
        '',
      ].join('\n')
    );
  });

  it('note-create points at a readback when the host omits the created note', async () => {
    const context = makeDeps({ readStdin: async () => 'body' });

    const exitCode = await run(
      ['note-create', 'notes/~zod/blog', '7', 'Title', '--stdin'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe(
      '✓ Note created\n  ID: not returned by this host; find it with `notes notes notes/~zod/blog`.\n'
    );
  });

  it('note-create passes an explicit numeric folder without a detail read', async () => {
    const context = makeDeps({ readStdin: async () => 'stdin body' });

    await run(
      ['note-create', 'notes/~zod/blog', '7', 'Title', '--stdin'],
      context.deps
    );

    expect(context.ops()).toEqual(['createNote']);
    expect(context.calls.notesV1[0].args).toEqual([
      {
        flag: 'notes/~zod/blog',
        folder: 7,
        title: 'Title',
        body: 'stdin body',
      },
    ]);
    expect(context.calls.readStdin).toBe(1);
  });

  it('note-create preserves option-like titles and dashed body paths', async () => {
    const context = makeDeps({ readFile: () => '# Body' });

    await run(
      [
        'note-create',
        'notes/~zod/blog',
        '7',
        'Roadmap',
        '--draft',
        '--body',
        '--draft.md',
      ],
      context.deps
    );

    expect(context.calls.notesV1[0].args).toEqual([
      {
        flag: 'notes/~zod/blog',
        folder: 7,
        title: 'Roadmap --draft',
        body: '# Body',
      },
    ]);
    expect(context.calls.readFile).toEqual(['--draft.md']);
  });

  it('note-create surfaces a getNotebook (root resolution) failure and never creates', async () => {
    const context = makeDeps({
      readStdin: async () => 'body',
      notesV1: {
        getNotebook: async () => {
          throw commandError('%notes notebook detail is missing rootFolderId');
        },
      },
    });

    const exitCode = await run(
      ['note-create', 'notes/~zod/blog', 'root', 'Title', '--stdin'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toContain('rootFolderId');
    expect(context.ops()).toEqual(['getNotebook']);
  });

  it('note-create rejects missing, mixed, and duplicate content sources before auth', async () => {
    const base = ['note-create', 'notes/~zod/blog', 'root', 'Title'];
    const cases: Array<{ args: string[]; message: string }> = [
      { args: [...base], message: 'A content source is required' },
      {
        args: [...base, '--stdin', '--body', 'a.md'],
        message: 'Only one content source may be provided',
      },
      {
        args: [...base, '--body', 'a.md', '--body', 'b.md'],
        message: '--body may be given only once',
      },
      {
        args: [...base, '--stdin', '--stdin'],
        message: '--stdin may be given only once',
      },
    ];

    for (const { args, message } of cases) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);
      expect(exitCode).toBe(1);
      expect(context.stderr()).toContain(message);
      expectNoAuthOrIo(context);
    }
  });

  it('note-update forwards body and expectedRevision (omitted when absent)', async () => {
    const withRev = makeDeps({ readStdin: async () => 'updated' });
    await run(
      [
        'note-update',
        'notes/~zod/blog',
        '12',
        '--stdin',
        '--expected-revision',
        '4',
      ],
      withRev.deps
    );
    expect(withRev.calls.notesV1[0]).toEqual({
      op: 'updateNoteBody',
      args: [
        {
          flag: 'notes/~zod/blog',
          noteId: 12,
          body: 'updated',
          expectedRevision: 4,
        },
      ],
    });

    const noRev = makeDeps({ readFile: () => 'from file' });
    await run(
      ['note-update', 'notes/~zod/blog', '12', '--body', 'x.md'],
      noRev.deps
    );
    expect(noRev.calls.notesV1[0].args).toEqual([
      {
        flag: 'notes/~zod/blog',
        noteId: 12,
        body: 'from file',
        expectedRevision: undefined,
      },
    ]);
    expect(noRev.stdout()).toBe(
      [
        '✓ Note updated',
        '  ID: 12',
        '  Ref: /1/chan/notes/~zod/blog/note/12',
        '  Share: include the Ref path in a chat message to post a tappable note card.',
        '',
      ].join('\n')
    );
  });

  it('note-update rejects a known option token as a file value', async () => {
    const context = makeDeps();
    const exitCode = await run(
      [
        'note-update',
        'notes/~zod/blog',
        '12',
        '--body',
        '--expected-revision',
        '4',
      ],
      context.deps
    );
    expect(exitCode).toBe(1);
    expect(context.stderr()).toContain('--body requires a value');
    expectNoAuthOrIo(context);
  });

  it('note-rename / note-move / note-delete call metadata-only operations', async () => {
    const rename = makeDeps();
    await run(
      ['note-rename', 'notes/~zod/blog', '12', 'New Title'],
      rename.deps
    );
    expect(rename.calls.notesV1[0]).toEqual({
      op: 'renameNote',
      args: [{ flag: 'notes/~zod/blog', noteId: 12, title: 'New Title' }],
    });
    expect(rename.stdout()).toBe('✓ Note renamed\n');

    const move = makeDeps();
    await run(['note-move', 'notes/~zod/blog', '12', '3'], move.deps);
    expect(move.calls.notesV1[0]).toEqual({
      op: 'moveNote',
      args: [{ flag: 'notes/~zod/blog', noteId: 12, folder: 3 }],
    });

    const del = makeDeps();
    await run(['note-delete', 'notes/~zod/blog', '12'], del.deps);
    expect(del.calls.notesV1[0]).toEqual({
      op: 'deleteNote',
      args: [{ flag: 'notes/~zod/blog', noteId: 12 }],
    });
    expect(del.stdout()).toBe('✓ Note deleted\n');
  });

  it('folder writes call typed operations', async () => {
    const create = makeDeps();
    await run(
      ['folder-create', 'notes/~zod/blog', 'Drafts', '--parent', '3'],
      create.deps
    );
    expect(create.calls.notesV1[0]).toEqual({
      op: 'createFolder',
      args: [{ flag: 'notes/~zod/blog', name: 'Drafts', parent: 3 }],
    });
    expect(create.stdout()).toBe('✓ Folder created\n');

    const createRoot = makeDeps();
    await run(['folder-create', 'notes/~zod/blog', 'Drafts'], createRoot.deps);
    expect(createRoot.calls.notesV1[0].args).toEqual([
      { flag: 'notes/~zod/blog', name: 'Drafts', parent: undefined },
    ]);

    const rename = makeDeps();
    await run(
      ['folder-rename', 'notes/~zod/blog', '4', 'Archive'],
      rename.deps
    );
    expect(rename.calls.notesV1[0]).toEqual({
      op: 'renameFolder',
      args: [{ flag: 'notes/~zod/blog', folderId: 4, name: 'Archive' }],
    });

    const move = makeDeps();
    await run(['folder-move', 'notes/~zod/blog', '4', '3'], move.deps);
    expect(move.calls.notesV1[0]).toEqual({
      op: 'moveFolder',
      args: [{ flag: 'notes/~zod/blog', folderId: 4, parent: 3 }],
    });

    const del = makeDeps();
    await run(['folder-delete', 'notes/~zod/blog', '4'], del.deps);
    expect(del.calls.notesV1[0]).toEqual({
      op: 'deleteFolder',
      args: [{ flag: 'notes/~zod/blog', folderId: 4, recursive: false }],
    });
    const delRecursive = makeDeps();
    await run(
      ['folder-delete', 'notes/~zod/blog', '4', '--recursive'],
      delRecursive.deps
    );
    expect(delRecursive.calls.notesV1[0].args).toEqual([
      { flag: 'notes/~zod/blog', folderId: 4, recursive: true },
    ]);
  });

  it('surfaces a write failure as a nonzero exit with no ✓', async () => {
    const context = makeDeps({
      notesV1: {
        deleteFolder: async () => {
          throw commandError('%notes error: folder not empty');
        },
      },
    });

    const exitCode = await run(
      ['folder-delete', 'notes/~zod/blog', '4'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain('%notes error: folder not empty');
  });

  it('prints pending-write guidance for notebook create', async () => {
    const context = makeDeps({
      notesV1: {
        createNotebook: async () => {
          throw new PendingWriteErrorForTest({
            requestId: '0vabc',
            status: 'acked',
            checks: [{ type: 'notebook-list' }, { type: 'notebook-detail' }],
          });
        },
      },
    });

    const exitCode = await run(['create', 'New Notebook'], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain(
      '%notes write request is still pending (request 0vabc)'
    );
    expect(context.stderr()).toContain('Do not retry automatically');
    expect(context.stderr()).toContain('tlon notes request 0vabc');
    expect(context.stderr()).toContain('tlon notes list');
    expect(context.stderr()).toContain(
      'tlon notes show <notes-nest-from-list>'
    );
    expect(context.stderr()).toContain(
      'Only retry if the request failed or the requested change is not present.'
    );
    expect(context.stdout()).not.toContain('✓');
  });

  it('prints pending-write guidance for note create and update checks', async () => {
    const create = makeDeps({
      readStdin: async () => 'body',
      notesV1: {
        createNote: async () => {
          throw new PendingWriteErrorForTest({
            requestId: '0vnote',
            checks: [
              { type: 'note-list', nest: 'notes/~zod/blog' },
              { type: 'note-detail', nest: 'notes/~zod/blog' },
            ],
          });
        },
      },
    });

    expect(
      await run(
        ['note-create', 'notes/~zod/blog', '7', 'Title', '--stdin'],
        create.deps
      )
    ).toBe(1);
    expect(create.stdout()).toBe('');
    expect(create.stderr()).toContain('tlon notes request 0vnote');
    expect(create.stderr()).toContain('tlon notes notes notes/~zod/blog');
    expect(create.stderr()).toContain(
      'tlon notes note notes/~zod/blog <id-from-list>'
    );

    const update = makeDeps({
      readStdin: async () => 'updated',
      notesV1: {
        updateNoteBody: async () => {
          throw new PendingWriteErrorForTest({
            requestId: '0vupdate',
            checks: [
              { type: 'note-detail', nest: 'notes/~zod/blog', noteId: 12 },
            ],
          });
        },
      },
    });

    expect(
      await run(
        ['note-update', 'notes/~zod/blog', '12', '--stdin'],
        update.deps
      )
    ).toBe(1);
    expect(update.stdout()).toBe('');
    expect(update.stderr()).toContain('tlon notes request 0vupdate');
    expect(update.stderr()).toContain('tlon notes note notes/~zod/blog 12');
  });

  it('prints pending-write guidance for folder create and update checks', async () => {
    const create = makeDeps({
      notesV1: {
        createFolder: async () => {
          throw new PendingWriteErrorForTest({
            checks: [
              { type: 'folder-list', nest: 'notes/~zod/blog' },
              { type: 'folder-detail', nest: 'notes/~zod/blog' },
            ],
          });
        },
      },
    });

    expect(
      await run(['folder-create', 'notes/~zod/blog', 'Drafts'], create.deps)
    ).toBe(1);
    expect(create.stdout()).toBe('');
    expect(create.stderr()).toContain(
      'No request id was returned, so inspect whether the write landed'
    );
    expect(create.stderr()).not.toContain('tlon notes request');
    expect(create.stderr()).toContain('tlon notes folders notes/~zod/blog');
    expect(create.stderr()).toContain(
      'tlon notes folder notes/~zod/blog <id-from-list>'
    );

    const rename = makeDeps({
      notesV1: {
        renameFolder: async () => {
          throw new PendingWriteErrorForTest({
            requestId: '0vfolder',
            checks: [
              { type: 'folder-detail', nest: 'notes/~zod/blog', folderId: 4 },
            ],
          });
        },
      },
    });

    expect(
      await run(
        ['folder-rename', 'notes/~zod/blog', '4', 'Archive'],
        rename.deps
      )
    ).toBe(1);
    expect(rename.stdout()).toBe('');
    expect(rename.stderr()).toContain('tlon notes request 0vfolder');
    expect(rename.stderr()).toContain('tlon notes folder notes/~zod/blog 4');
  });

  it('prints pending-write guidance for representative delete paths', async () => {
    const noteDelete = makeDeps({
      notesV1: {
        deleteNote: async () => {
          throw new PendingWriteErrorForTest({
            requestId: '0vdel-note',
            checks: [
              { type: 'note-detail', nest: 'notes/~zod/blog', noteId: 12 },
            ],
          });
        },
      },
    });

    expect(
      await run(['note-delete', 'notes/~zod/blog', '12'], noteDelete.deps)
    ).toBe(1);
    expect(noteDelete.stdout()).toBe('');
    expect(noteDelete.stderr()).toContain('tlon notes request 0vdel-note');
    expect(noteDelete.stderr()).toContain('tlon notes note notes/~zod/blog 12');

    const folderDelete = makeDeps({
      notesV1: {
        deleteFolder: async () => {
          throw new PendingWriteErrorForTest({
            requestId: '0vdel-folder',
            checks: [
              { type: 'folder-detail', nest: 'notes/~zod/blog', folderId: 4 },
            ],
          });
        },
      },
    });

    expect(
      await run(['folder-delete', 'notes/~zod/blog', '4'], folderDelete.deps)
    ).toBe(1);
    expect(folderDelete.stdout()).toBe('');
    expect(folderDelete.stderr()).toContain('tlon notes request 0vdel-folder');
    expect(folderDelete.stderr()).toContain(
      'tlon notes folder notes/~zod/blog 4'
    );
  });
});

describe('notes join and leave', () => {
  it('joins/leaves via the membership wrapper with the full nest', async () => {
    const join = makeDeps();
    await run(['join', 'notes/~zod/blog'], join.deps);
    expect(join.calls.joinNotesNotebook).toEqual(['notes/~zod/blog']);
    expect(join.stdout()).toBe('✓ Joined\n');

    const leave = makeDeps();
    await run(['leave', 'notes/~zod/blog'], leave.deps);
    expect(leave.calls.leaveNotesNotebook).toEqual(['notes/~zod/blog']);
    expect(leave.stdout()).toBe('✓ Left\n');
  });

  it('normalizes a missing ~ host before poking the membership wrapper', async () => {
    const join = makeDeps();
    await run(['join', 'notes/zod/blog'], join.deps);
    expect(join.calls.joinNotesNotebook).toEqual(['notes/~zod/blog']);
  });
});

describe('notes ordering and error propagation', () => {
  it('authenticates before any API work', async () => {
    const context = makeDeps({ notesV1: { listNotebooks: async () => [] } });
    await run(['list'], context.deps);
    expect(context.calls.order[0]).toBe('authenticate');
  });

  it('routes an adapter commandError through the shared error path', async () => {
    const context = makeDeps({
      notesV1: {
        listNotebooks: async () => {
          throw commandError('network down');
        },
      },
    });

    const exitCode = await run(['list'], context.deps);
    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe('Error: network down\n');
  });

  it('reads a content file only after auth', async () => {
    const context = makeDeps({
      authenticate: async () => {
        throw new Error('Missing Urbit config');
      },
    });

    await expect(
      run(
        ['note-create', 'notes/~zod/blog', '7', 'Title', '--body', 'x.md'],
        context.deps
      )
    ).rejects.toThrow('Missing Urbit config');

    expect(context.calls.readFile).toEqual([]);
    expect(context.calls.notesV1).toEqual([]);
  });
});

describe('notes publish and unpublish', () => {
  const NOTE = { id: 12, title: 'Launch plan', bodyMd: '# Hello', revision: 3 };
  const LISTED = { host: '~zod', flagName: 'blog', noteId: 12 };
  const PUBLISHED_STDOUT =
    '✓ Note published\n' +
    '  Public URL: https://owner.example/notes/pub/~zod/blog/12\n' +
    '  This is a snapshot: later edits are not shown until you run note-publish again.\n';

  function publishDeps(
    overrides: Partial<Record<NotesPublishOp, AnyFn>> = {},
    getNote: AnyFn = async () => NOTE
  ) {
    return makeDeps({
      notesV1: { getNote },
      notesPublish: { listPublished: async () => [LISTED], ...overrides },
    });
  }

  function listings(context: ReturnType<typeof makeDeps>) {
    return context.calls.notesPublish.filter((c) => c.op === 'listPublished')
      .length;
  }

  function opsOf(context: ReturnType<typeof makeDeps>) {
    return context.calls.notesPublish.map((c) => c.op);
  }

  it('note-publish reads the note, renders its title and Markdown body, then publishes that HTML', async () => {
    const context = publishDeps();

    const exitCode = await run(
      ['note-publish', 'notes/~zod/blog', '12'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.order).toEqual([
      'authenticate',
      'notesV1:getNote',
      'render',
      'notesPublish:publishNote',
      'notesPublish:listPublished',
    ]);
    expect(context.calls.notesV1[0].args).toEqual([
      { flag: 'notes/~zod/blog', noteId: 12 },
    ]);
    expect(context.calls.render).toEqual([
      { title: 'Launch plan', body: '# Hello' },
    ]);
    expect(context.calls.notesPublish[0].args).toEqual([
      {
        flag: 'notes/~zod/blog',
        noteId: 12,
        html: '<html>Launch plan|# Hello</html>',
      },
    ]);
  });

  it('note-publish waits for the poke before confirming or reporting', async () => {
    let resolvePoke!: () => void;
    const context = publishDeps({
      publishNote: () =>
        new Promise<void>((resolve) => {
          resolvePoke = resolve;
        }),
    });

    const pending = run(
      ['note-publish', 'notes/~zod/blog', '12'],
      context.deps
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(opsOf(context)).toEqual(['publishNote']);
    expect(context.stdout()).toBe('');

    resolvePoke();
    expect(await pending).toBe(0);
    expect(context.stdout()).toBe(PUBLISHED_STDOUT);
  });

  it('note-publish prints the public URL and the snapshot note once listPublished confirms', async () => {
    const context = publishDeps();

    const exitCode = await run(
      ['note-publish', 'notes/zod/blog', '12'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe(PUBLISHED_STDOUT);
    expect(context.stderr()).toBe('');
    expect(context.calls.publishedNoteUrl).toEqual([['~zod/blog', 12]]);
    expect(context.calls.sleep).toEqual([]);
  });

  it('note-publish polls listPublished until the note appears', async () => {
    let call = 0;
    const context = publishDeps({
      listPublished: async () => (call++ === 0 ? [] : [LISTED]),
    });

    const exitCode = await run(
      ['note-publish', 'notes/~zod/blog', '12'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(listings(context)).toBe(2);
    expect(context.calls.sleep).toEqual([300]);
    expect(context.stdout()).toBe(PUBLISHED_STDOUT);
  });

  it('note-publish does not accept a published record for another host, notebook, or note', async () => {
    const context = publishDeps({
      listPublished: async () => [
        { host: '~bus', flagName: 'blog', noteId: 12 },
        { host: '~zod', flagName: 'other', noteId: 12 },
        { host: '~zod', flagName: 'blog', noteId: 13 },
      ],
    });

    const exitCode = await run(
      ['note-publish', 'notes/~zod/blog', '12'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(listings(context)).toBe(8);
  });

  it('note-publish reports an unconfirmed publish', async () => {
    const context = publishDeps({ listPublished: async () => [] });

    const exitCode = await run(
      ['note-publish', 'notes/~zod/blog', '12'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      "Error: Publish of note 12 in notes/~zod/blog was sent but is not confirmed: the note is not listed as published yet. Retrying publishes the note's current contents.\n"
    );
    expect(listings(context)).toBe(8);
    expect(context.calls.sleep).toEqual(Array(7).fill(300));
  });

  it('note-publish never publishes a note it cannot read', async () => {
    const unreadable = publishDeps({}, async () => {
      throw commandError('HTTP 404: notebook not found');
    });
    expect(
      await run(['note-publish', 'notes/~zod/blog', '12'], unreadable.deps)
    ).toBe(1);
    expect(unreadable.stderr()).toBe(
      'Error: Could not read note 12 in notes/~zod/blog; nothing was published: HTTP 404: notebook not found\n'
    );
    expect(unreadable.calls.notesPublish).toEqual([]);
    expect(unreadable.calls.render).toEqual([]);

    const noBody = publishDeps({}, async () => ({ ...NOTE, bodyMd: null }));
    expect(
      await run(['note-publish', 'notes/~zod/blog', '12'], noBody.deps)
    ).toBe(1);
    expect(noBody.stderr()).toBe(
      'Error: Could not read the body of note 12 in notes/~zod/blog; nothing was published.\n'
    );
    expect(noBody.calls.notesPublish).toEqual([]);
    expect(noBody.stdout()).toBe('');
  });

  it('note-publish publishes a note whose body is empty', async () => {
    const context = publishDeps({}, async () => ({ ...NOTE, bodyMd: '' }));

    const exitCode = await run(
      ['note-publish', 'notes/~zod/blog', '12'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.render).toEqual([{ title: 'Launch plan', body: '' }]);
    expect(opsOf(context)).toEqual(['publishNote', 'listPublished']);
  });

  it('note-publish surfaces poke and listing failures with context', async () => {
    const pokeFails = publishDeps({
      publishNote: async () => {
        throw commandError('poke timed out');
      },
    });
    expect(
      await run(['note-publish', 'notes/~zod/blog', '12'], pokeFails.deps)
    ).toBe(1);
    expect(pokeFails.stderr()).toBe(
      'Error: Could not publish note 12 in notes/~zod/blog: poke timed out\n'
    );
    expect(listings(pokeFails)).toBe(0);
    expect(pokeFails.stdout()).toBe('');

    const listingFails = publishDeps({
      listPublished: async () => {
        throw commandError('HTTP 500');
      },
    });
    expect(
      await run(['note-publish', 'notes/~zod/blog', '12'], listingFails.deps)
    ).toBe(1);
    expect(listingFails.stderr()).toBe(
      "Error: Publish of note 12 in notes/~zod/blog was sent but could not be confirmed: HTTP 500. Retrying publishes the note's current contents.\n"
    );
    expect(listingFails.stdout()).toBe('');

    const notOnShip = publishDeps({
      publishNote: async () => {
        throw commandError(
          '/app/notes/hoon::[2.562 3].[2.563 5]\nno-abed-not-found\n[~zod %blog]'
        );
      },
    });
    expect(
      await run(['note-publish', 'notes/~zod/blog', '12'], notOnShip.deps)
    ).toBe(1);
    expect(notOnShip.stderr()).toBe(
      'Error: notes/~zod/blog is not on this ship (it neither hosts nor has joined it); join it before publishing.\n'
    );
    expect(listings(notOnShip)).toBe(0);
  });

  it('note-unpublish unpublishes without reading the note and confirms it is gone', async () => {
    let call = 0;
    const context = publishDeps({
      listPublished: async () => (call++ === 0 ? [LISTED] : []),
    });

    const exitCode = await run(
      ['note-unpublish', 'notes/~zod/blog', '12'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.notesV1).toEqual([]);
    expect(context.calls.order).toEqual([
      'authenticate',
      'notesPublish:unpublishNote',
      'notesPublish:listPublished',
      'notesPublish:listPublished',
    ]);
    expect(context.calls.notesPublish[0].args).toEqual([
      { flag: 'notes/~zod/blog', noteId: 12 },
    ]);
    expect(context.calls.sleep).toEqual([300]);
    expect(context.stdout()).toBe('✓ Note unpublished\n');
  });

  it('note-unpublish succeeds immediately when the note is already absent', async () => {
    const context = publishDeps({
      listPublished: async () => [
        { host: '~zod', flagName: 'blog', noteId: 13 },
      ],
    });

    const exitCode = await run(
      ['note-unpublish', 'notes/~zod/blog', '12'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(listings(context)).toBe(1);
    expect(context.calls.sleep).toEqual([]);
    expect(context.stdout()).toBe('✓ Note unpublished\n');
  });

  it('note-unpublish reports an unpublish the listing never confirms', async () => {
    const context = publishDeps();

    const exitCode = await run(
      ['note-unpublish', 'notes/~zod/blog', '12'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      'Error: Unpublish of note 12 in notes/~zod/blog was sent but is not confirmed: the note is still listed as published. Running note-unpublish again is safe.\n'
    );
    expect(listings(context)).toBe(8);
  });

  it('note-unpublish surfaces poke, membership, and listing failures', async () => {
    const pokeFails = publishDeps({
      unpublishNote: async () => {
        throw commandError('poke timed out');
      },
    });
    expect(
      await run(['note-unpublish', 'notes/~zod/blog', '12'], pokeFails.deps)
    ).toBe(1);
    expect(pokeFails.stderr()).toBe(
      'Error: Could not unpublish note 12 in notes/~zod/blog: poke timed out\n'
    );
    expect(pokeFails.stdout()).toBe('');
    expect(listings(pokeFails)).toBe(0);

    const notOnShip = publishDeps({
      unpublishNote: async () => {
        throw commandError('no-abed-not-found');
      },
    });
    expect(
      await run(['note-unpublish', 'notes/~zod/blog', '12'], notOnShip.deps)
    ).toBe(1);
    expect(notOnShip.stderr()).toBe(
      'Error: notes/~zod/blog is not on this ship (it neither hosts nor has joined it), so nothing there is published.\n'
    );

    const listingFails = publishDeps({
      listPublished: async () => {
        throw commandError('HTTP 500');
      },
    });
    expect(
      await run(['note-unpublish', 'notes/~zod/blog', '12'], listingFails.deps)
    ).toBe(1);
    expect(listingFails.stderr()).toBe(
      'Error: Unpublish of note 12 in notes/~zod/blog was sent but could not be confirmed: HTTP 500. Running note-unpublish again is safe.\n'
    );
    expect(listingFails.stdout()).toBe('');
  });

  it('--self is a no-op for note-publish and note-unpublish', async () => {
    const cases: Array<[string, string]> = [
      ['note-publish', PUBLISHED_STDOUT],
      ['note-unpublish', '✓ Note unpublished\n'],
    ];
    for (const [command, expectedStdout] of cases) {
      const variants = [
        [command, 'notes/~zod/blog', '12'],
        [command, '--self', 'notes/~zod/blog', '12'],
        [command, 'notes/~zod/blog', '12', '--self'],
        [command, 'notes/~zod/blog', '--self', '12', '--self'],
      ];
      const results = [];
      for (const args of variants) {
        const context =
          command === 'note-publish'
            ? publishDeps()
            : publishDeps({ listPublished: async () => [] });
        const exitCode = await run(args, context.deps);
        expect(exitCode).toBe(0);
        expect(context.stdout()).toBe(expectedStdout);
        results.push({
          stdout: context.stdout(),
          stderr: context.stderr(),
          order: context.calls.order,
          publish: context.calls.notesPublish,
        });
      }
      expect(results[0].order).toContain(
        command === 'note-publish'
          ? 'notesPublish:publishNote'
          : 'notesPublish:unpublishNote'
      );
      for (const result of results.slice(1)) {
        expect(result).toEqual(results[0]);
      }
    }
  });

  it('note-publish and note-unpublish reject bad arguments before auth', async () => {
    for (const command of ['note-publish', 'note-unpublish']) {
      const help = NOTES_COMMAND_HELP[command];
      const cases: Array<[string[], string]> = [
        [[command, 'notes/~zod/blog'], `${help}\n`],
        [
          [command, 'notes/~zod/blog', 'x'],
          `Error: Invalid note id: x. Expected a number.\n\n${help}\n`,
        ],
        [
          [command, '~zod/blog', '12'],
          `Error: Invalid notes nest: ~zod/blog. Expected notes/~host/name.\n\n${help}\n`,
        ],
        [
          [command, 'notes/~zod/blog', '12', '--force'],
          `Error: Unknown option: --force\n\n${help}\n`,
        ],
        [
          [command, 'notes/~zod/blog', '12', 'x'],
          `Error: Unexpected argument: x\n\n${help}\n`,
        ],
      ];
      for (const [args, expectedStderr] of cases) {
        const context = makeDeps();
        const exitCode = await run(args, context.deps);

        expect(exitCode).toBe(1);
        expect(context.stdout()).toBe('');
        expect(context.stderr()).toBe(expectedStderr);
        expectNoAuthOrIo(context);
      }
    }
  });
});
