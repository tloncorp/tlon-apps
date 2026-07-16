import { describe, expect, it } from 'bun:test';

import { CommandError } from './commands/command';
// Registers the process-wide '@tloncorp/api' mock as an import side effect —
// see the module doc for why per-file mock.module registrations are unsafe.
import {
  MockNotesV1PendingWriteError,
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
