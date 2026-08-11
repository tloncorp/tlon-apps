import {
  type NotesV1Api,
  NotesV1PendingWriteError,
  deleteNotesNotebookStrict,
  getGroup,
  getGroups,
  joinNotesChannel,
  leaveNotesChannel,
  notesV1,
} from '@tloncorp/api';
import * as fs from 'fs';

import { ensureClient } from './api-client';
import { commandError, errorMessage } from './commands/command';
import type { NotesDeps } from './commands/notes';
import { mapGroupChannelIds } from './notes-channel-runtime';
import type { NotesPendingWriteErrorLike } from './notes-pending-write';

const STDIN_TIMEOUT_MS = 30_000;

function createProcessCommandDeps() {
  return {
    stdout: (text: string) => process.stdout.write(text),
    stderr: (text: string) => process.stderr.write(text),
  };
}

async function readStdin(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      process.stdin.destroy();
      reject(
        new Error(
          'stdin read timed out after 30s - did you forget to pipe input?'
        )
      );
    }, STDIN_TIMEOUT_MS);

    process.stdin.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    process.stdin.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// Wrap every `notesV1` operation so an expected API/transport failure surfaces
// as a commandError (rendered as `Error: <message>`), keeping the command module
// free of transport-error handling.
function notesRuntimeErrorMessage(error: unknown): string {
  return errorMessage(error).trim() || '%notes request failed without details';
}

function wrapNotesV1(): NotesV1Api {
  const wrapped: Record<string, unknown> = {};
  for (const [key, fn] of Object.entries(notesV1)) {
    const call = fn as unknown as (...args: unknown[]) => Promise<unknown>;
    wrapped[key] = async (...args: unknown[]) => {
      try {
        return await call(...args);
      } catch (error) {
        if (error instanceof NotesV1PendingWriteError) {
          throw error;
        }
        throw commandError(notesRuntimeErrorMessage(error));
      }
    };
  }
  return wrapped as NotesV1Api;
}

export function createNotesDeps(): NotesDeps {
  let _migration: import('./notes-migrate').MigrationDeps | undefined;
  return {
    ...createProcessCommandDeps(),
    // No subscriptions: %notes CRUD is request/response over the v1 HTTP API.
    // Membership uses the %notes action wrappers (not the v0 app-sync helpers).
    authenticate: async () => {
      await ensureClient();
    },
    notesV1: wrapNotesV1(),
    isPendingWriteError: (error): error is NotesPendingWriteErrorLike =>
      error instanceof NotesV1PendingWriteError,
    joinNotesNotebook: async (nest: string) => {
      try {
        await joinNotesChannel(nest);
      } catch (error) {
        throw commandError(notesRuntimeErrorMessage(error));
      }
    },
    leaveNotesNotebook: async (nest: string) => {
      try {
        await leaveNotesChannel(nest);
      } catch (error) {
        throw commandError(notesRuntimeErrorMessage(error));
      }
    },
    deleteNotesNotebookStrict: async (nest: string) => {
      try {
        await deleteNotesNotebookStrict(nest);
      } catch (error) {
        throw commandError(notesRuntimeErrorMessage(error));
      }
    },
    getGroupChannelListings: async () => {
      const groups: unknown = await getGroups();
      if (!Array.isArray(groups)) {
        throw new Error('Groups response is malformed: expected an array');
      }
      return groups.map((group, index) => {
        if (!group || typeof group !== 'object') {
          throw new Error(`Group listing ${index}: group is malformed`);
        }
        const groupId = (group as { id?: unknown }).id;
        if (typeof groupId !== 'string') {
          throw new Error(`Group listing ${index}: group id is malformed`);
        }
        return {
          groupId,
          channelIds: mapGroupChannelIds(group, groupId),
        };
      });
    },
    getGroupChannelIds: async (groupId: string) => {
      const group = await getGroup(groupId);
      return mapGroupChannelIds(group, groupId);
    },
    sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    readFile: (path: string) => fs.readFileSync(path, 'utf-8'),
    readStdin,
    get migration() {
      if (!_migration) {
        const { createMigrationDeps } = require('./notes-migrate-runtime');
        _migration = createMigrationDeps();
      }
      return _migration;
    },
  };
}
