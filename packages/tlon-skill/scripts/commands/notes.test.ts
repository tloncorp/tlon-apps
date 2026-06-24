import { describe, expect, it } from 'bun:test';

import { commandError } from './command';
import {
  type HttpMethod,
  NOTES_COMMAND_HELP,
  NOTES_HELP,
  type NotesDeps,
  expectNotesResponse,
  parseNotesNest,
  run,
} from './notes';

interface RequestCall {
  path: string;
  method: HttpMethod;
  body?: unknown;
}

interface MakeDepsOptions {
  authenticate?: () => Promise<void>;
  requestJson?: (
    path: string,
    method: HttpMethod,
    body?: unknown
  ) => Promise<unknown>;
  joinNotesNotebook?: (nest: string) => Promise<void>;
  leaveNotesNotebook?: (nest: string) => Promise<void>;
  readFile?: (path: string) => string;
  readStdin?: () => Promise<string>;
}

function makeDeps(options: MakeDepsOptions = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const calls = {
    authenticate: 0,
    requestJson: [] as RequestCall[],
    joinNotesNotebook: [] as string[],
    leaveNotesNotebook: [] as string[],
    readFile: [] as string[],
    readStdin: 0,
    order: [] as string[],
  };

  const deps: NotesDeps = {
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    authenticate: async () => {
      calls.authenticate += 1;
      calls.order.push('authenticate');
      await options.authenticate?.();
    },
    // The generic `<T>(...) => Promise<T>` shape can't be satisfied by a
    // concrete fake; cast the stub to the dep signature.
    requestJson: (async (path: string, method: HttpMethod, body?: unknown) => {
      calls.requestJson.push({ path, method, body });
      calls.order.push(`requestJson:${method}`);
      return (await options.requestJson?.(path, method, body)) ?? undefined;
    }) as NotesDeps['requestJson'],
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
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
  };
}

function expectNoAuthOrIo(context: ReturnType<typeof makeDeps>) {
  expect(context.calls.authenticate).toBe(0);
  expect(context.calls.requestJson).toEqual([]);
  expect(context.calls.joinNotesNotebook).toEqual([]);
  expect(context.calls.leaveNotesNotebook).toEqual([]);
  expect(context.calls.readFile).toEqual([]);
  expect(context.calls.readStdin).toBe(0);
}

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
});

describe('notes reads', () => {
  it('lists notebooks via GET and formats each line', async () => {
    const context = makeDeps({
      requestJson: async () => [
        { host: '~zod', flagName: 'blog', notebook: { id: 2, title: 'Blog' } },
        { host: '~bus', flagName: 'log', notebook: { id: 8, title: 'Log' } },
      ],
    });

    const exitCode = await run(['list'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson).toEqual([
      { path: '/notes/~/v1/notebooks', method: 'GET', body: undefined },
    ]);
    expect(context.stdout()).toBe(
      'notes/~zod/blog  Blog  (id 2)\nnotes/~bus/log  Log  (id 8)\n'
    );
  });

  it('reports an empty notebook list', async () => {
    const context = makeDeps({ requestJson: async () => [] });
    const exitCode = await run(['list'], context.deps);
    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('No notebooks.\n');
  });

  it('shows a notebook from its detail path', async () => {
    const context = makeDeps({
      requestJson: async () => ({
        host: '~zod',
        flagName: 'blog',
        notebook: { id: 2, title: 'Blog', rootFolderId: 3 },
        visibility: 'public',
      }),
    });

    const exitCode = await run(['show', 'notes/~zod/blog'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson).toEqual([
      {
        path: '/notes/~/v1/notebooks/~zod/blog',
        method: 'GET',
        body: undefined,
      },
    ]);
    expect(context.stdout()).toContain('Nest: notes/~zod/blog');
    expect(context.stdout()).toContain('Root folder: 3');
    expect(context.stdout()).toContain('Visibility: public');
  });

  it('lists notes in a notebook', async () => {
    const context = makeDeps({
      requestJson: async () => [
        { id: 12, title: 'First', revision: 1 },
        { id: 13, title: 'Second', revision: 4 },
      ],
    });

    const exitCode = await run(['notes', 'notes/~zod/blog'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson[0].path).toBe(
      '/notes/~/v1/notebooks/~zod/blog/notes'
    );
    expect(context.stdout()).toBe(
      '#12  First  (rev 1)\n#13  Second  (rev 4)\n'
    );
  });

  it('shows a single note with its Markdown body', async () => {
    const context = makeDeps({
      requestJson: async () => ({
        id: 12,
        title: 'First',
        revision: 1,
        folder: 3,
        bodyMd: '# Hello\n\nWorld',
      }),
    });

    const exitCode = await run(['note', 'notes/~zod/blog', '12'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson[0].path).toBe(
      '/notes/~/v1/notebooks/~zod/blog/notes/12'
    );
    expect(context.stdout()).toContain('#12  First');
    expect(context.stdout()).toContain('# Hello\n\nWorld');
  });
});

describe('notes status', () => {
  it('reports reachable and exits 0 when the v1 API responds', async () => {
    const context = makeDeps({ requestJson: async () => [] });
    const exitCode = await run(['status'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson).toEqual([
      { path: '/notes/~/v1/notebooks', method: 'GET', body: undefined },
    ]);
    expect(context.stdout()).toContain('%notes v1 API: reachable');
    expect(context.stdout()).toContain('group-channel mode: unknown');
  });

  it('reports unreachable and exits 1 when the v1 API errors', async () => {
    const context = makeDeps({
      requestJson: async () => {
        throw new Error('boom');
      },
    });
    const exitCode = await run(['status'], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toContain('%notes v1 API: unreachable');
  });
});

describe('notes create', () => {
  it('creates a solo notebook and prints the derived nest', async () => {
    const context = makeDeps({
      requestJson: async () => ({
        requestId: 'r1',
        body: {
          type: 'notebook',
          notebook: {
            host: '~zod',
            flagName: 'new-book',
            notebook: { id: 5, title: 'New' },
          },
        },
      }),
    });

    const exitCode = await run(['create', 'New Notebook'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson).toEqual([
      {
        path: '/notes/~/v1/notebooks',
        method: 'POST',
        body: { title: 'New Notebook' },
      },
    ]);
    expect(context.stdout()).toContain('✓ Notebook created');
    expect(context.stdout()).toContain('Nest: notes/~zod/new-book');
  });
});

describe('notes note-create', () => {
  it('resolves root to rootFolderId via a detail read before the POST', async () => {
    const context = makeDeps({
      readFile: () => '# Body',
      requestJson: async (path, method) => {
        if (method === 'GET') {
          return {
            host: '~zod',
            flagName: 'blog',
            notebook: { id: 2, title: 'Blog', rootFolderId: 3 },
          };
        }
        return { requestId: 'r1', body: { type: 'ok' } };
      },
    });

    const exitCode = await run(
      ['note-create', 'notes/~zod/blog', 'root', 'Title', '--body', 'note.md'],
      context.deps
    );

    expect(exitCode).toBe(0);
    // GET detail read happens before the POST, and never sends folder 0.
    expect(context.calls.requestJson.map((c) => c.method)).toEqual([
      'GET',
      'POST',
    ]);
    expect(context.calls.requestJson[0].path).toBe(
      '/notes/~/v1/notebooks/~zod/blog'
    );
    expect(context.calls.requestJson[1]).toEqual({
      path: '/notes/~/v1/notebooks/~zod/blog/notes',
      method: 'POST',
      body: { folder: 3, title: 'Title', body: '# Body' },
    });
    expect(context.calls.readFile).toEqual(['note.md']);
    expect(context.stdout()).toBe('✓ Note created\n');
  });

  it('passes an explicit numeric folder through without a detail read', async () => {
    const context = makeDeps({
      readStdin: async () => 'stdin body',
      requestJson: async () => ({ requestId: 'r1', body: { type: 'ok' } }),
    });

    const exitCode = await run(
      ['note-create', 'notes/~zod/blog', '7', 'Title', '--stdin'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson).toHaveLength(1);
    expect(context.calls.requestJson[0]).toEqual({
      path: '/notes/~/v1/notebooks/~zod/blog/notes',
      method: 'POST',
      body: { folder: 7, title: 'Title', body: 'stdin body' },
    });
    expect(context.calls.readStdin).toBe(1);
  });

  it('fails when root cannot be resolved (no rootFolderId)', async () => {
    const context = makeDeps({
      readStdin: async () => 'body',
      requestJson: async (_path, method) =>
        method === 'GET'
          ? { host: '~zod', flagName: 'blog', notebook: { id: 2, title: 'B' } }
          : { requestId: 'r1', body: { type: 'ok' } },
    });

    const exitCode = await run(
      ['note-create', 'notes/~zod/blog', 'root', 'Title', '--stdin'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toContain('Could not resolve the root folder');
    // Never reached the POST.
    expect(context.calls.requestJson.map((c) => c.method)).toEqual(['GET']);
  });

  it('rejects missing, mixed, and duplicate content sources before auth', async () => {
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
});

describe('notes note-update', () => {
  it('replaces the body and forwards expectedRevision', async () => {
    const context = makeDeps({
      readStdin: async () => 'updated',
      requestJson: async () => ({ requestId: 'r1', body: { type: 'ok' } }),
    });

    const exitCode = await run(
      [
        'note-update',
        'notes/~zod/blog',
        '12',
        '--stdin',
        '--expected-revision',
        '4',
      ],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson[0]).toEqual({
      path: '/notes/~/v1/notebooks/~zod/blog/notes/12',
      method: 'PUT',
      body: { body: 'updated', expectedRevision: 4 },
    });
    expect(context.stdout()).toBe('✓ Note updated\n');
  });

  it('omits expectedRevision when not provided', async () => {
    const context = makeDeps({
      readFile: () => 'from file',
      requestJson: async () => ({
        requestId: 'r1',
        body: { type: 'no-change' },
      }),
    });

    const exitCode = await run(
      ['note-update', 'notes/~zod/blog', '12', '--body', 'x.md'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson[0].body).toEqual({ body: 'from file' });
  });
});

describe('notes join and leave', () => {
  it('joins via the membership wrapper with the full nest', async () => {
    const context = makeDeps();
    const exitCode = await run(['join', 'notes/~zod/blog'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.joinNotesNotebook).toEqual(['notes/~zod/blog']);
    expect(context.stdout()).toBe('✓ Joined\n');
  });

  it('leaves via the membership wrapper with the full nest', async () => {
    const context = makeDeps();
    const exitCode = await run(['leave', 'notes/~zod/blog'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.leaveNotesNotebook).toEqual(['notes/~zod/blog']);
    expect(context.stdout()).toBe('✓ Left\n');
  });

  it('normalizes a missing ~ host before poking the membership wrapper', async () => {
    const joinCtx = makeDeps();
    await run(['join', 'notes/zod/blog'], joinCtx.deps);
    expect(joinCtx.calls.joinNotesNotebook).toEqual(['notes/~zod/blog']);

    const leaveCtx = makeDeps();
    await run(['leave', 'notes/zod/blog'], leaveCtx.deps);
    expect(leaveCtx.calls.leaveNotesNotebook).toEqual(['notes/~zod/blog']);
  });
});

describe('notes folders', () => {
  it('lists folders via GET and formats each line', async () => {
    const context = makeDeps({
      requestJson: async () => [
        { id: 3, folderName: 'Root' },
        { id: 4, folderName: 'Drafts', parent: 3 },
      ],
    });

    const exitCode = await run(['folders', 'notes/~zod/blog'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson[0].path).toBe(
      '/notes/~/v1/notebooks/~zod/blog/folders'
    );
    expect(context.stdout()).toBe('#3  Root\n#4  Drafts  parent 3\n');
  });

  it('shows a single folder', async () => {
    const context = makeDeps({
      requestJson: async () => ({ id: 4, folderName: 'Drafts', parent: 3 }),
    });

    const exitCode = await run(
      ['folder', 'notes/~zod/blog', '4'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson[0].path).toBe(
      '/notes/~/v1/notebooks/~zod/blog/folders/4'
    );
    expect(context.stdout()).toContain('#4  Drafts');
    expect(context.stdout()).toContain('Parent: 3');
  });

  // The convenience-route writes below model a bare/empty success response (no
  // `{requestId, body}` envelope) — requestJson throwing is the failure signal.
  it('creates a folder at root (no parent) via POST {folderName}', async () => {
    const context = makeDeps({
      requestJson: async () => ({ id: 5, folderName: 'Drafts' }),
    });

    const exitCode = await run(
      ['folder-create', 'notes/~zod/blog', 'Drafts'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson[0]).toEqual({
      path: '/notes/~/v1/notebooks/~zod/blog/folders',
      method: 'POST',
      body: { folderName: 'Drafts' },
    });
    expect(context.stdout()).toBe('✓ Folder created\n');
  });

  it('creates a folder under a parent via POST {folderName, parent}', async () => {
    const context = makeDeps({
      requestJson: async () => ({ id: 6, folderName: 'Drafts', parent: 3 }),
    });

    await run(
      ['folder-create', 'notes/~zod/blog', 'Drafts', '--parent', '3'],
      context.deps
    );

    expect(context.calls.requestJson[0].body).toEqual({
      folderName: 'Drafts',
      parent: 3,
    });
  });

  it('renames a folder via PUT {folderName} (bare success)', async () => {
    // No responder: the dep returns undefined, modeling an empty success body.
    const context = makeDeps();

    const exitCode = await run(
      ['folder-rename', 'notes/~zod/blog', '4', 'Archive'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson[0]).toEqual({
      path: '/notes/~/v1/notebooks/~zod/blog/folders/4',
      method: 'PUT',
      body: { folderName: 'Archive' },
    });
    expect(context.stdout()).toBe('✓ Folder renamed\n');
  });

  it('moves a folder via PUT {parent} (bare success)', async () => {
    const context = makeDeps();

    await run(['folder-move', 'notes/~zod/blog', '4', '3'], context.deps);

    expect(context.calls.requestJson[0]).toEqual({
      path: '/notes/~/v1/notebooks/~zod/blog/folders/4',
      method: 'PUT',
      body: { parent: 3 },
    });
  });

  it('deletes a folder via DELETE with an explicit recursive query', async () => {
    const nonRecursive = makeDeps();
    const exitCode = await run(
      ['folder-delete', 'notes/~zod/blog', '4'],
      nonRecursive.deps
    );
    expect(exitCode).toBe(0);
    expect(nonRecursive.calls.requestJson[0]).toEqual({
      path: '/notes/~/v1/notebooks/~zod/blog/folders/4?recursive=false',
      method: 'DELETE',
      body: undefined,
    });
    expect(nonRecursive.stdout()).toBe('✓ Folder deleted\n');

    const recursive = makeDeps();
    await run(
      ['folder-delete', 'notes/~zod/blog', '4', '--recursive'],
      recursive.deps
    );
    expect(recursive.calls.requestJson[0].path).toBe(
      '/notes/~/v1/notebooks/~zod/blog/folders/4?recursive=true'
    );
  });
});

describe('notes remaining note ops', () => {
  // These convenience-route writes model a bare/empty success response.
  it('renames a note via metadata-only PUT {title}', async () => {
    const context = makeDeps();

    const exitCode = await run(
      ['note-rename', 'notes/~zod/blog', '12', 'New Title'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson[0]).toEqual({
      path: '/notes/~/v1/notebooks/~zod/blog/notes/12',
      method: 'PUT',
      body: { title: 'New Title' },
    });
    expect(context.stdout()).toBe('✓ Note renamed\n');
  });

  it('moves a note via metadata-only PUT {folder}', async () => {
    const context = makeDeps();

    await run(['note-move', 'notes/~zod/blog', '12', '3'], context.deps);

    expect(context.calls.requestJson[0]).toEqual({
      path: '/notes/~/v1/notebooks/~zod/blog/notes/12',
      method: 'PUT',
      body: { folder: 3 },
    });
  });

  it('deletes a note via DELETE', async () => {
    const context = makeDeps();

    const exitCode = await run(
      ['note-delete', 'notes/~zod/blog', '12'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson[0]).toEqual({
      path: '/notes/~/v1/notebooks/~zod/blog/notes/12',
      method: 'DELETE',
      body: undefined,
    });
    expect(context.stdout()).toBe('✓ Note deleted\n');
  });

  it('shows note revision history via GET', async () => {
    const context = makeDeps({
      requestJson: async () => [
        { revision: 2, author: '~zod' },
        { revision: 1, author: '~zod' },
      ],
    });

    const exitCode = await run(
      ['history', 'notes/~zod/blog', '12'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson[0].path).toBe(
      '/notes/~/v1/notebooks/~zod/blog/notes/12/history'
    );
    expect(context.stdout()).toContain('rev 2  ~zod');
  });

  it('lists members via GET', async () => {
    const context = makeDeps({
      requestJson: async () => [
        { ship: '~zod', roles: ['admin'] },
        { ship: '~bus' },
      ],
    });

    const exitCode = await run(['members', 'notes/~zod/blog'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.requestJson[0].path).toBe(
      '/notes/~/v1/notebooks/~zod/blog/members'
    );
    expect(context.stdout()).toBe('~zod  [admin]\n~bus\n');
  });

  it('surfaces a write error body as a nonzero exit with no ✓', async () => {
    const context = makeDeps({
      requestJson: async () => ({
        requestId: 'r1',
        body: { type: 'error', message: 'folder not empty' },
      }),
    });

    const exitCode = await run(
      ['folder-delete', 'notes/~zod/blog', '4'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain('%notes error: folder not empty');
  });
});

describe('expectNotesResponse envelope handling', () => {
  it('returns ok/no-change/notebook bodies', () => {
    expect(expectNotesResponse({ body: { type: 'ok' } }).type).toBe('ok');
    expect(expectNotesResponse({ body: { type: 'no-change' } }).type).toBe(
      'no-change'
    );
    expect(expectNotesResponse({ body: { type: 'notebook' } }).type).toBe(
      'notebook'
    );
  });

  it('converts error and pending bodies into a commandError (both modes)', () => {
    expect(() =>
      expectNotesResponse({ body: { type: 'error', message: 'nope' } })
    ).toThrow('%notes error: nope');
    expect(() => expectNotesResponse({ body: { type: 'pending' } })).toThrow(
      'still pending'
    );
    // error/pending still fail even when bare success is allowed.
    expect(() =>
      expectNotesResponse(
        { body: { type: 'error', message: 'x' } },
        { allowBareSuccess: true }
      )
    ).toThrow('%notes error: x');
  });

  it('rejects an unexpected present body.type in both modes', () => {
    // A present envelope body always uses the strict whitelist; api-key is not a
    // success even for convenience routes.
    expect(() => expectNotesResponse({ body: { type: 'api-key' } })).toThrow(
      'Unexpected %notes response type: api-key'
    );
    expect(() =>
      expectNotesResponse(
        { body: { type: 'api-key' } },
        { allowBareSuccess: true }
      )
    ).toThrow('Unexpected %notes response type: api-key');
  });

  it('rejects a missing body unless allowBareSuccess is set', () => {
    expect(() => expectNotesResponse({})).toThrow('missing body');
    expect(expectNotesResponse({}, { allowBareSuccess: true }).type).toBe('ok');
  });

  it('surfaces an error-body write as a nonzero exit with no ✓', async () => {
    const context = makeDeps({
      requestJson: async () => ({
        requestId: 'r1',
        body: { type: 'error', message: 'denied' },
      }),
    });

    const exitCode = await run(['create', 'Title'], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toContain('%notes error: denied');
  });
});

describe('notes ordering and error propagation', () => {
  it('authenticates before any API work', async () => {
    const context = makeDeps({ requestJson: async () => [] });
    await run(['list'], context.deps);
    expect(context.calls.order[0]).toBe('authenticate');
  });

  it('routes a facade commandError through the shared error path', async () => {
    // The runtime facade wraps requestJson failures in a commandError; model
    // that here so the shared error path renders `Error: <message>`.
    const context = makeDeps({
      requestJson: async () => {
        throw commandError('network down');
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
    expect(context.calls.requestJson).toEqual([]);
  });
});
