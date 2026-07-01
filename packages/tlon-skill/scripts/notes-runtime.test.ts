import { describe, expect, it, mock } from 'bun:test';

import { CommandError } from './commands/command';

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
] as const;

type NotesV1Op = (typeof NOTES_V1_OPS)[number];
type MockedNotesV1 = Record<
  NotesV1Op,
  (...args: unknown[]) => Promise<unknown>
>;

class MockNotesV1PendingWriteError extends Error {
  readonly requestId?: string;
  readonly status?: string;
  readonly checks: unknown[];

  constructor({
    requestId,
    status,
    checks = [],
  }: {
    requestId?: string;
    status?: string;
    checks?: unknown[];
  } = {}) {
    super('%notes write request is still pending');
    this.name = 'NotesV1PendingWriteError';
    this.requestId = requestId;
    this.status = status;
    this.checks = checks;
  }
}

const mockedNotesV1 = Object.fromEntries(
  NOTES_V1_OPS.map((op) => [op, async () => undefined])
) as MockedNotesV1;

class MockUrbit {
  cookie = '';
  nodeId = '';

  constructor(readonly url: string) {}
}

mock.module('@tloncorp/api', () => ({
  Urbit: MockUrbit,
  client: { cookie: '' },
  configureClient: async () => undefined,
  internalRemoveClient: () => undefined,
  preSig: (ship: string) => (ship.startsWith('~') ? ship : `~${ship}`),
  scry: async () => undefined,
  subscribe: async () => 0,
  NotesV1PendingWriteError: MockNotesV1PendingWriteError,
  notesV1: mockedNotesV1,
  getGroup: async () => ({ channels: [] }),
  deleteNotesNotebookStrict: async () => undefined,
  joinNotesChannel: async () => undefined,
  leaveNotesChannel: async () => undefined,
}));

let runtimeModule: Promise<typeof import('./notes-runtime')> | null = null;
let channelRuntimeModule:
  | Promise<typeof import('./notes-channel-runtime')>
  | null = null;

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
