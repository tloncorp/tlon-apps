import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  __resetApiClientForTests,
  setCliCredentialOverrides,
} from './api-client';
import { CommandError } from './commands/command';
// Registers the process-wide '@tloncorp/api' mock as an import side effect —
// see the module doc for why per-file mock.module registrations are unsafe.
import {
  MockNotesV1PendingWriteError,
  mockedGetGroup,
  mockedGetGroups,
  mockedNotes,
  mockedNotesV1,
} from './tloncorp-api-mock';

let runtimeModule: Promise<typeof import('./notes-runtime')> | null = null;
let channelRuntimeModule: Promise<
  typeof import('./notes-channel-runtime')
> | null = null;

function loadRuntime() {
  runtimeModule ??= import('./notes-runtime');
  return runtimeModule;
}

function loadChannelRuntime() {
  channelRuntimeModule ??= import('./notes-channel-runtime');
  return channelRuntimeModule;
}

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected promise to reject');
}

describe('notes runtime wrapper', () => {
  it('wires validated group listings for notebook cleanup', async () => {
    const originalGetGroups = mockedGetGroups.impl;
    const originalGetGroup = mockedGetGroup.impl;
    mockedGetGroups.impl = async () => [
      {
        id: '~zod/alpha',
        channels: [{ id: 'notes/~zod/book' }, { id: 'chat/~zod/general' }],
      },
      {
        id: '~zod/beta',
        channels: [{ id: 'diary/~zod/blog' }],
      },
    ];
    mockedGetGroup.impl = async (groupId: unknown) => ({
      id: groupId,
      channels: [{ id: 'notes/~zod/book' }, { id: 'chat/~zod/general' }],
    });

    try {
      const { createNotesDeps } = await loadRuntime();
      const deps = createNotesDeps();

      await expect(deps.getGroupChannelListings()).resolves.toEqual([
        {
          groupId: '~zod/alpha',
          channelIds: ['notes/~zod/book', 'chat/~zod/general'],
        },
        {
          groupId: '~zod/beta',
          channelIds: ['diary/~zod/blog'],
        },
      ]);
      await expect(deps.getGroupChannelIds('~zod/alpha')).resolves.toEqual([
        'notes/~zod/book',
        'chat/~zod/general',
      ]);

      mockedGetGroup.impl = async () => ({ channels: [{ id: 7 }] });
      await expect(deps.getGroupChannelIds('~zod/alpha')).rejects.toThrow(
        'channel id'
      );

      mockedGetGroups.impl = async () => [{ id: '~zod/alpha' }];
      await expect(deps.getGroupChannelListings()).rejects.toThrow(
        'channels array'
      );
    } finally {
      mockedGetGroups.impl = originalGetGroups;
      mockedGetGroup.impl = originalGetGroup;
    }
  });

  it('rethrows pending-write errors unchanged from production deps', async () => {
    const pending = new MockNotesV1PendingWriteError({
      requestId: '0vabc',
      status: 'acked',
      checks: [{ type: 'note-detail', nest: 'notes/~zod/blog', noteId: 12 }],
    });
    const original = mockedNotesV1.listNotebooks;
    mockedNotesV1.listNotebooks = async () => {
      throw pending;
    };

    try {
      const { createNotesDeps } = await loadRuntime();
      const deps = createNotesDeps();
      const error = await captureRejection(deps.notesV1.listNotebooks());

      expect(error).toBe(pending);
      expect(error).toBeInstanceOf(MockNotesV1PendingWriteError);
      expect(deps.isPendingWriteError(error)).toBe(true);
      expect((error as MockNotesV1PendingWriteError).requestId).toBe('0vabc');
      expect((error as MockNotesV1PendingWriteError).status).toBe('acked');
      expect((error as MockNotesV1PendingWriteError).checks).toEqual([
        { type: 'note-detail', nest: 'notes/~zod/blog', noteId: 12 },
      ]);
    } finally {
      mockedNotesV1.listNotebooks = original;
    }
  });

  it('wraps ordinary API errors as command errors', async () => {
    const original = mockedNotesV1.getNotebook;
    mockedNotesV1.getNotebook = async () => {
      throw new Error('HTTP 500');
    };

    try {
      const { createNotesDeps } = await loadRuntime();
      const deps = createNotesDeps();
      const error = await captureRejection(
        deps.notesV1.getNotebook('notes/~zod/blog')
      );

      expect(error).toBeInstanceOf(CommandError);
      expect((error as CommandError).message).toBe('HTTP 500');
      expect(deps.isPendingWriteError(error)).toBe(false);
    } finally {
      mockedNotesV1.getNotebook = original;
    }
  });
});

describe('notes publish runtime wiring', () => {
  it('wraps notes publish API errors as command errors', async () => {
    const original = mockedNotes.publishNote;
    mockedNotes.publishNote = async () => {
      throw new Error('poke failed');
    };

    try {
      const { createNotesDeps } = await loadRuntime();
      const deps = createNotesDeps();
      const error = await captureRejection(
        deps.notesPublish.publishNote({
          flag: 'notes/~zod/blog',
          noteId: 12,
          html: '<html></html>',
        })
      );

      expect(error).toBeInstanceOf(CommandError);
      expect((error as CommandError).message).toBe('poke failed');
    } finally {
      mockedNotes.publishNote = original;
    }
  });

  it('keeps a raw non-Error nack trace and maps it to the membership error', async () => {
    const trace =
      '/app/notes/hoon::[2.562 3].[2.563 5]\nno-abed-not-found\n[~zod %blog]';
    const original = mockedNotes.unpublishNote;
    mockedNotes.unpublishNote = () => Promise.reject(trace);

    try {
      const { createNotesDeps } = await loadRuntime();
      const { run } = await import('./commands/notes');
      const deps = createNotesDeps();
      const error = await captureRejection(
        deps.notesPublish.unpublishNote({
          flag: 'notes/~zod/blog',
          noteId: 12,
        })
      );
      expect(error).toBeInstanceOf(CommandError);
      expect((error as CommandError).message).toBe(trace);

      let stderr = '';
      const exitCode = await run(['note-unpublish', 'notes/~zod/blog', '12'], {
        ...deps,
        authenticate: async () => {},
        stdout: () => {},
        stderr: (text) => {
          stderr += text;
        },
      });
      expect(exitCode).toBe(1);
      expect(stderr).toBe(
        'Error: notes/~zod/blog is not on this ship (it neither hosts nor has joined it), so nothing there is published.\n'
      );
    } finally {
      mockedNotes.unpublishNote = original;
    }
  });

  it("builds published note URLs on the selected ship's URL", async () => {
    const { createNotesDeps } = await loadRuntime();
    try {
      for (const url of ['https://owner.example', 'https://owner.example/']) {
        setCliCredentialOverrides({
          kind: 'cookie',
          url,
          cookie: 'urbauth-~zod=0v1',
          ship: '~zod',
        });
        expect(createNotesDeps().publishedNoteUrl('~zod/blog', 12)).toBe(
          'https://owner.example/notes/pub/~zod/blog/12'
        );
      }
    } finally {
      setCliCredentialOverrides(null);
      __resetApiClientForTests();
    }
  });

  it('takes the URL base from the owner ship file, not the bot env', async () => {
    const ENV_KEYS = [
      'TLON_SKILL_DIR',
      'TLON_CONFIG_FILE',
      'URBIT_URL',
      'URBIT_SHIP',
      'URBIT_COOKIE',
      'URBIT_CODE',
      'TLON_URL',
      'TLON_SHIP',
      'TLON_COOKIE',
      'TLON_CODE',
    ];
    const savedEnv = Object.fromEntries(
      ENV_KEYS.map((key) => [key, process.env[key]])
    );
    const skillDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-publish-'));
    fs.mkdirSync(path.join(skillDir, 'ships'));
    fs.writeFileSync(
      path.join(skillDir, 'ships', 'owner.json'),
      JSON.stringify({
        url: 'https://owner.public.example',
        ship: '~owner',
        code: 'sampel-ticlyt-migfun-falmel',
      })
    );

    try {
      for (const key of ENV_KEYS) delete process.env[key];
      process.env.TLON_SKILL_DIR = skillDir;
      process.env.URBIT_URL =
        'http://bot-moon-eyre.tlon.svc.cluster.local:8080';
      process.env.URBIT_COOKIE = 'urbauth-~bot=0v1';
      __resetApiClientForTests();

      const { createNotesDeps } = await loadRuntime();
      expect(createNotesDeps().publishedNoteUrl('~zod/blog', 12)).toBe(
        'http://bot-moon-eyre.tlon.svc.cluster.local:8080/notes/pub/~zod/blog/12'
      );

      setCliCredentialOverrides({ kind: 'ship', ship: '~owner' });
      expect(createNotesDeps().publishedNoteUrl('~zod/blog', 12)).toBe(
        'https://owner.public.example/notes/pub/~zod/blog/12'
      );
    } finally {
      for (const key of ENV_KEYS) {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
      }
      setCliCredentialOverrides(null);
      __resetApiClientForTests();
      fs.rmSync(skillDir, { recursive: true, force: true });
    }
  });
});

describe('notes channel runtime wrapper', () => {
  it('formats pending createGroupNotebook errors with request guidance', async () => {
    const pending = new MockNotesV1PendingWriteError({
      requestId: '0vbook',
      status: 'acked',
      checks: [{ type: 'notebook-list' }, { type: 'notebook-detail' }],
    });
    const original = mockedNotesV1.createGroupNotebook;
    mockedNotesV1.createGroupNotebook = async () => {
      throw pending;
    };

    try {
      const { createNotesChannelDeps } = await loadChannelRuntime();
      const deps = createNotesChannelDeps();
      const error = await captureRejection(
        deps.createGroupNotesNotebook({
          title: 'New',
          group: { host: '~zod', flagName: 'group' },
          readers: [],
        })
      );

      expect(error).toBeInstanceOf(CommandError);
      expect((error as CommandError).message).toContain(
        '%notes write request is still pending (request 0vbook)'
      );
      expect((error as CommandError).message).toContain(
        'Do not retry automatically'
      );
      expect((error as CommandError).message).toContain(
        'tlon notes request 0vbook'
      );
      expect((error as CommandError).message).toContain('tlon notes list');
      expect((error as CommandError).message).toContain(
        'tlon notes show <notes-nest-from-list>'
      );
    } finally {
      mockedNotesV1.createGroupNotebook = original;
    }
  });

  it('continues to wrap ordinary createGroupNotebook errors', async () => {
    const original = mockedNotesV1.createGroupNotebook;
    mockedNotesV1.createGroupNotebook = async () => {
      throw new Error('%notes error: denied');
    };

    try {
      const { createNotesChannelDeps } = await loadChannelRuntime();
      const deps = createNotesChannelDeps();
      const error = await captureRejection(
        deps.createGroupNotesNotebook({
          title: 'New',
          group: { host: '~zod', flagName: 'group' },
          readers: [],
        })
      );

      expect(error).toBeInstanceOf(CommandError);
      expect((error as CommandError).message).toBe('%notes error: denied');
    } finally {
      mockedNotesV1.createGroupNotebook = original;
    }
  });
});
