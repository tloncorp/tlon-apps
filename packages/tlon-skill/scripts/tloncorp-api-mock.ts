/**
 * Single shared `mock.module('@tloncorp/api', …)` registration for unit tests.
 *
 * `@tloncorp/api` can only be mocked ONCE per `bun test` process: competing
 * `mock.module` registrations for the same specifier from different test
 * files are order-dependent — the losing file's importers either see the
 * winning file's export shape or fail ESM named-export validation against
 * it (bun's error misleadingly names the real `packages/api/dist` path even
 * though the shape came from the winning mock). Test-file execution order
 * is platform-dependent, so a two-registrant suite can pass on macOS and
 * fail on Linux CI with "Export named 'X' not found".
 * This module is preloaded for every `bun test` run via bunfig.toml, so the
 * mock is registered before ANY test file (or the real module) loads —
 * import ordering inside individual test files cannot break it. Test files
 * needing the api mocked import the exported objects from here and
 * configure behavior on them; never call `mock.module('@tloncorp/api', …)`
 * in a test file.
 *
 * The export shape here is the superset of what the mocked import graphs
 * pull in by value: `api-client.ts` (Urbit, client, configureClient,
 * internalRemoveClient, preSig, scry, subscribe), `dms.ts` (reactions,
 * posts, invites), and the notes runtimes (notesV1 et al.).
 */
import { mock } from 'bun:test';

export const NOTES_V1_OPS = [
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

export type NotesV1Op = (typeof NOTES_V1_OPS)[number];
export type MockedNotesV1 = Record<
  NotesV1Op,
  (...args: unknown[]) => Promise<unknown>
>;

export class MockNotesV1PendingWriteError extends Error {
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

/** Mutable per-test notes surface — reassign ops in a test, restore after. */
export const mockedNotesV1 = Object.fromEntries(
  NOTES_V1_OPS.map((op) => [op, async () => undefined])
) as MockedNotesV1;

export class MockUrbit {
  cookie = '';
  nodeId = '';

  constructor(readonly url: string) {}
}

mock.module('@tloncorp/api', () => ({
  // api-client.ts value imports
  Urbit: MockUrbit,
  client: { cookie: '' },
  configureClient: async () => undefined,
  internalRemoveClient: () => undefined,
  preSig: (ship: string) => (ship.startsWith('~') ? ship : `~${ship}`),
  scry: async () => undefined,
  subscribe: async () => 0,
  // dms.ts value imports (reaction helpers take injected deps in tests, so
  // these defaults are load-time placeholders, never assertion targets)
  addReaction: async () => undefined,
  deletePost: async () => undefined,
  getCurrentUserId: () => '~zod',
  removeReaction: async () => undefined,
  respondToDMInvite: async () => undefined,
  sendPost: async () => undefined,
  sendReply: async () => undefined,
  // notes runtime value imports
  NotesV1PendingWriteError: MockNotesV1PendingWriteError,
  notesV1: mockedNotesV1,
  getGroup: async () => ({ channels: [] }),
  deleteNotesNotebookStrict: async () => undefined,
  joinNotesChannel: async () => undefined,
  leaveNotesChannel: async () => undefined,
}));
