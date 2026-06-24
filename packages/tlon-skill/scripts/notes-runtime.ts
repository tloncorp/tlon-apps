import {
  requestJson as apiRequestJson,
  joinNotesChannel,
  leaveNotesChannel,
} from '@tloncorp/api';
import * as fs from 'fs';

import { ensureClient } from './api-client';
import { commandError, errorMessage } from './commands/command';
import type { HttpMethod, NotesDeps } from './commands/notes';

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

export function createNotesDeps(): NotesDeps {
  return {
    ...createProcessCommandDeps(),
    // No subscriptions: %notes CRUD is request/response over the v1 HTTP API.
    authenticate: async () => {
      await ensureClient();
    },
    requestJson: async <T = unknown>(
      path: string,
      method: HttpMethod,
      body?: unknown
    ): Promise<T> => {
      try {
        return await apiRequestJson<T>(path, method, body);
      } catch (error) {
        throw commandError(errorMessage(error));
      }
    },
    joinNotesNotebook: async (nest: string) => {
      try {
        await joinNotesChannel(nest);
      } catch (error) {
        throw commandError(errorMessage(error));
      }
    },
    leaveNotesNotebook: async (nest: string) => {
      try {
        await leaveNotesChannel(nest);
      } catch (error) {
        throw commandError(errorMessage(error));
      }
    },
    readFile: (path: string) => fs.readFileSync(path, 'utf-8'),
    readStdin,
  };
}
