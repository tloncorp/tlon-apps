import type {
  NotesV1Api,
  NotesV1Folder,
  NotesV1MemberRecord,
  NotesV1Note,
  NotesV1NoteRevision,
  NotesV1NotebookSummary,
  NotesV1PendingWriteCheck,
  NotesV1RequestStatus,
} from '@tloncorp/api';

import {
  type CommandDeps,
  commandError,
  errorMessage,
  handleExpectedCommandError,
  isHelpArg,
  usageError,
  writeHelp,
  writeLine,
} from './command';

export const NOTES_HELP = `Usage: tlon notes <command>

Manage %notes notebooks (Markdown-first notebooks). Notebooks are addressed as
nests of the form notes/~host/name. Note bodies are plain Markdown.

For Tlon app/group notebooks, create a notes channel with:
  tlon channels create ~host/group-slug "Title" --kind notes

The notes create command is for standalone %notes notebooks only; it does not
create a Tlon app group channel.

Commands:
  status                                  Report %notes reachability
  request <request-id>                    Check a pending %notes write request
  list                                    List your notebooks
  show <nest>                             Show a notebook
  notes <nest>                            List notes in a notebook
  note <nest> <id>                        Show a note (with its Markdown body)
  create <title>                          Create a standalone %notes notebook (not an app channel)
  note-create <nest> <folder-id|root> <title> (--body <f> | --stdin | --markdown <f>)
  note-update <nest> <id> (--body <f> | --stdin) [--expected-revision <n>]
  note-rename <nest> <id> <title>         Rename a note
  note-move <nest> <id> <folder-id>       Move a note into a folder
  note-delete <nest> <id>                 Delete a note
  history <nest> <id>                     Show a note's revision history
  folders <nest>                          List folders in a notebook
  folder <nest> <id>                      Show a folder
  folder-create <nest> <name> [--parent <id>]   Create a folder (root if no --parent)
  folder-rename <nest> <id> <name>        Rename a folder
  folder-move <nest> <id> <parent-id>     Move a folder under a parent
  folder-delete <nest> <id> [--recursive] Delete a folder (--recursive for non-empty)
  members <nest>                          List notebook members
  join <nest>                             Join a notes notebook
  leave <nest>                            Leave a notes notebook

Content sources (Markdown):
  --body <file>       Read the note body from a Markdown file
  --markdown <file>   Alias for --body
  --stdin             Read the note body from stdin

Examples:
  tlon notes list
  tlon notes request 0vabc
  tlon channels create ~zod/group "Notes" --kind notes
  tlon notes note-create notes/~zod/blog root "First Note" --markdown post.md
  tlon notes note-update notes/~zod/blog 12 --stdin --expected-revision 3`;

export const NOTES_COMMAND_HELP: Record<string, string> = {
  status: 'Usage: tlon notes status',
  request:
    'Usage: tlon notes request <request-id>\nExample: tlon notes request 0vabc',
  list: 'Usage: tlon notes list',
  show: 'Usage: tlon notes show <nest>\nExample: tlon notes show notes/~zod/blog',
  notes:
    'Usage: tlon notes notes <nest>\nExample: tlon notes notes notes/~zod/blog',
  note: 'Usage: tlon notes note <nest> <id>\nExample: tlon notes note notes/~zod/blog 12',
  create:
    'Usage: tlon notes create <title>\nCreates a standalone %notes notebook only. For Tlon app/group notebooks, use:\n  tlon channels create ~host/group-slug "Title" --kind notes',
  'note-create':
    'Usage: tlon notes note-create <nest> <folder-id|root> <title> (--body <file> | --stdin | --markdown <file>)',
  'note-update':
    'Usage: tlon notes note-update <nest> <id> (--body <file> | --stdin) [--expected-revision <n>]',
  'note-rename':
    'Usage: tlon notes note-rename <nest> <id> <title>\nExample: tlon notes note-rename notes/~zod/blog 12 "New Title"',
  'note-move':
    'Usage: tlon notes note-move <nest> <id> <folder-id>\nExample: tlon notes note-move notes/~zod/blog 12 3',
  'note-delete':
    'Usage: tlon notes note-delete <nest> <id>\nExample: tlon notes note-delete notes/~zod/blog 12',
  history:
    'Usage: tlon notes history <nest> <id>\nExample: tlon notes history notes/~zod/blog 12',
  folders:
    'Usage: tlon notes folders <nest>\nExample: tlon notes folders notes/~zod/blog',
  folder:
    'Usage: tlon notes folder <nest> <id>\nExample: tlon notes folder notes/~zod/blog 3',
  'folder-create':
    'Usage: tlon notes folder-create <nest> <name> [--parent <id>]\nExample: tlon notes folder-create notes/~zod/blog "Drafts" --parent 3',
  'folder-rename':
    'Usage: tlon notes folder-rename <nest> <id> <name>\nExample: tlon notes folder-rename notes/~zod/blog 4 "Archive"',
  'folder-move':
    'Usage: tlon notes folder-move <nest> <id> <parent-id>\nExample: tlon notes folder-move notes/~zod/blog 4 3',
  'folder-delete':
    'Usage: tlon notes folder-delete <nest> <id> [--recursive]\nExample: tlon notes folder-delete notes/~zod/blog 4 --recursive',
  members:
    'Usage: tlon notes members <nest>\nExample: tlon notes members notes/~zod/blog',
  join: 'Usage: tlon notes join <nest>\nExample: tlon notes join notes/~zod/blog',
  leave:
    'Usage: tlon notes leave <nest>\nExample: tlon notes leave notes/~zod/blog',
};

// The %notes v1 protocol (path construction, request payloads, canonical
// response shapes, and envelope handling) lives in `@tloncorp/api`'s `notesV1`.
// This module owns CLI parsing, pre-auth validation, content-source handling,
// `root` resolution, pending-write guidance, and human-readable output — it
// passes typed operations, never string-built paths. Runtime deps identify API
// error classes, keeping API imports type-only for the command-source contract.
export interface NotesPendingWriteErrorLike {
  requestId?: string;
  status?: string;
  checks: NotesV1PendingWriteCheck[];
}

export interface NotesDeps extends CommandDeps {
  authenticate: () => Promise<void>;
  notesV1: NotesV1Api;
  isPendingWriteError: (error: unknown) => error is NotesPendingWriteErrorLike;
  joinNotesNotebook: (nest: string) => Promise<void>;
  leaveNotesNotebook: (nest: string) => Promise<void>;
  readFile: (path: string) => string;
  readStdin: () => Promise<string>;
}

type ContentSource = { kind: 'file'; path: string } | { kind: 'stdin' };

type Nest = { nest: string; host: string; name: string };

type ParsedNotesArgs =
  | { kind: 'help'; help: string }
  | { kind: 'status' }
  | { kind: 'request'; requestId: string }
  | { kind: 'list' }
  | { kind: 'show'; target: Nest }
  | { kind: 'list-notes'; target: Nest }
  | { kind: 'note'; target: Nest; id: string }
  | { kind: 'create'; title: string }
  | {
      kind: 'note-create';
      target: Nest;
      folder: string;
      title: string;
      source: ContentSource;
    }
  | {
      kind: 'note-update';
      target: Nest;
      id: string;
      source: ContentSource;
      expectedRevision?: number;
    }
  | { kind: 'note-rename'; target: Nest; id: string; title: string }
  | { kind: 'note-move'; target: Nest; id: string; folder: number }
  | { kind: 'note-delete'; target: Nest; id: string }
  | { kind: 'history'; target: Nest; id: string }
  | { kind: 'folders'; target: Nest }
  | { kind: 'folder'; target: Nest; id: string }
  | { kind: 'folder-create'; target: Nest; folderName: string; parent?: number }
  | { kind: 'folder-rename'; target: Nest; id: string; folderName: string }
  | { kind: 'folder-move'; target: Nest; id: string; parent: number }
  | { kind: 'folder-delete'; target: Nest; id: string; recursive: boolean }
  | { kind: 'members'; target: Nest }
  | { kind: 'join'; target: Nest }
  | { kind: 'leave'; target: Nest };

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function wantsHelp(args: string[]): boolean {
  return args.some(isHelpArg);
}

// Validate and normalize a notes nest `notes/~host/name` up front (pre-auth) so
// a malformed nest fails locally with a usage error. Returns the normalized nest
// (with a `~` host) that handlers pass as the `NotesTarget` to `@tloncorp/api`
// notesV1 operations and to the join/leave wrappers.
export function parseNotesNest(nest: string, usage: string): Nest {
  const parts = nest.split('/');
  if (parts.length !== 3 || parts[0] !== 'notes' || !parts[1] || !parts[2]) {
    throw usageError(
      `Invalid notes nest: ${nest}. Expected notes/~host/name.`,
      usage
    );
  }
  const host = parts[1].startsWith('~') ? parts[1] : `~${parts[1]}`;
  const name = parts[2];
  // Return the *normalized* nest (with a `~` host) so downstream consumers — the
  // membership poke wrappers in particular — never receive a `notes/zod/blog`
  // that would poke %notes with `ship: 'zod'` instead of `ship: '~zod'`.
  return { nest: `notes/${host}/${name}`, host, name };
}

function notebookNest(summary: NotesV1NotebookSummary): string {
  return `notes/${summary.host}/${summary.flagName}`;
}

function requireNumericId(id: string, label: string, usage: string): string {
  if (!/^\d+$/.test(id)) {
    throw usageError(`Invalid ${label}: ${id}. Expected a number.`, usage);
  }
  return id;
}

function parseRequestId(requestId: string, usage: string): string {
  const trimmed = requestId.trim();
  if (!trimmed || trimmed.includes('/')) {
    throw usageError(
      `Invalid request id: ${requestId}. Expected a %notes request id.`,
      usage
    );
  }
  return trimmed;
}

const NOTE_CREATE_OPTION_FLAGS = ['body', 'markdown', 'stdin'] as const;
const NOTE_UPDATE_OPTION_FLAGS = [
  'body',
  'stdin',
  'expected-revision',
] as const;
const FOLDER_CREATE_OPTION_FLAGS = ['parent'] as const;

function isKnownOptionToken(
  arg: string | undefined,
  flags: readonly string[]
): boolean {
  return !!arg && flags.some((flag) => arg === `--${flag}`);
}

// Index of the first exact known option flag at or after `from`. Other
// dash-prefixed words are valid title/name tokens.
function firstKnownFlagIndex(
  args: string[],
  from: number,
  flags: readonly string[]
): number {
  for (let i = from; i < args.length; i += 1) {
    if (isKnownOptionToken(args[i], flags)) {
      return i;
    }
  }
  return args.length;
}

// Resolve exactly one Markdown content source from the allowed file flags plus
// `--stdin`. The actual read happens later (post-auth); this only selects.
function parseContentSource(
  args: string[],
  fileFlags: string[],
  usage: string,
  knownOptionFlags: readonly string[] = [...fileFlags, 'stdin']
): ContentSource {
  const found: ContentSource[] = [];
  for (const flag of fileFlags) {
    const occurrences = args.filter((arg) => arg === `--${flag}`).length;
    if (occurrences > 1) {
      throw usageError(`--${flag} may be given only once`, usage);
    }
    if (occurrences === 1) {
      const value = args[args.indexOf(`--${flag}`) + 1];
      if (!value || isKnownOptionToken(value, knownOptionFlags)) {
        throw usageError(`--${flag} requires a value`, usage);
      }
      found.push({ kind: 'file', path: value });
    }
  }
  const stdinCount = args.filter((arg) => arg === '--stdin').length;
  if (stdinCount > 1) {
    throw usageError('--stdin may be given only once', usage);
  }
  if (stdinCount === 1) {
    found.push({ kind: 'stdin' });
  }
  if (found.length === 0) {
    const sources = [...fileFlags.map((flag) => `--${flag} <file>`), '--stdin'];
    throw usageError(
      `A content source is required (${sources.join(' | ')})`,
      usage
    );
  }
  if (found.length > 1) {
    throw usageError('Only one content source may be provided', usage);
  }
  return found[0];
}

function parseArgs(args: string[]): ParsedNotesArgs {
  const command = args[0];

  if (isHelpArg(command)) {
    return { kind: 'help', help: NOTES_HELP };
  }

  if (command && wantsHelp(args.slice(1))) {
    return { kind: 'help', help: NOTES_COMMAND_HELP[command] ?? NOTES_HELP };
  }

  if (!command || !NOTES_COMMAND_HELP[command]) {
    throw usageError(NOTES_HELP);
  }

  const help = NOTES_COMMAND_HELP[command];

  switch (command) {
    case 'status':
      return { kind: 'status' };
    case 'request': {
      const requestId = args[1];
      if (!requestId) {
        throw usageError(help);
      }
      return { kind: 'request', requestId: parseRequestId(requestId, help) };
    }
    case 'list':
      return { kind: 'list' };
    case 'show': {
      if (!args[1]) {
        throw usageError(help);
      }
      return { kind: 'show', target: parseNotesNest(args[1], help) };
    }
    case 'notes': {
      if (!args[1]) {
        throw usageError(help);
      }
      return { kind: 'list-notes', target: parseNotesNest(args[1], help) };
    }
    case 'note': {
      const nest = args[1];
      const id = args[2];
      if (!nest || !id) {
        throw usageError(help);
      }
      requireNumericId(id, 'note id', help);
      return { kind: 'note', target: parseNotesNest(nest, help), id };
    }
    case 'create': {
      const title = args.slice(1).join(' ').trim();
      if (!title) {
        throw usageError(help);
      }
      return { kind: 'create', title };
    }
    case 'note-create': {
      const nest = args[1];
      const folder = args[2];
      const title = args
        .slice(3, firstKnownFlagIndex(args, 3, NOTE_CREATE_OPTION_FLAGS))
        .join(' ')
        .trim();
      if (!nest || !folder || !title) {
        throw usageError(help);
      }
      const target = parseNotesNest(nest, help);
      if (folder !== 'root' && !/^\d+$/.test(folder)) {
        throw usageError(
          `Invalid folder: ${folder}. Expected a folder id or "root".`,
          help
        );
      }
      const source = parseContentSource(
        args,
        [...NOTE_CREATE_OPTION_FLAGS].filter((flag) => flag !== 'stdin'),
        help,
        NOTE_CREATE_OPTION_FLAGS
      );
      return { kind: 'note-create', target, folder, title, source };
    }
    case 'note-update': {
      const nest = args[1];
      const id = args[2];
      if (!nest || !id) {
        throw usageError(help);
      }
      requireNumericId(id, 'note id', help);
      const target = parseNotesNest(nest, help);
      const source = parseContentSource(
        args,
        [...NOTE_UPDATE_OPTION_FLAGS].filter(
          (flag) => flag !== 'stdin' && flag !== 'expected-revision'
        ),
        help,
        NOTE_UPDATE_OPTION_FLAGS
      );
      const revisionIdx = args.indexOf('--expected-revision');
      let expectedRevision: number | undefined;
      if (revisionIdx !== -1) {
        const value = args[revisionIdx + 1];
        if (!value || !/^\d+$/.test(value)) {
          throw usageError(
            '--expected-revision requires a numeric value',
            help
          );
        }
        expectedRevision = Number(value);
      }
      return { kind: 'note-update', target, id, source, expectedRevision };
    }
    case 'note-rename': {
      const nest = args[1];
      const id = args[2];
      const title = args.slice(3).join(' ').trim();
      if (!nest || !id || !title) {
        throw usageError(help);
      }
      requireNumericId(id, 'note id', help);
      return {
        kind: 'note-rename',
        target: parseNotesNest(nest, help),
        id,
        title,
      };
    }
    case 'note-move': {
      const nest = args[1];
      const id = args[2];
      const folderArg = args[3];
      if (!nest || !id || !folderArg) {
        throw usageError(help);
      }
      requireNumericId(id, 'note id', help);
      if (!/^\d+$/.test(folderArg)) {
        throw usageError(
          `Invalid folder id: ${folderArg}. Expected a number.`,
          help
        );
      }
      return {
        kind: 'note-move',
        target: parseNotesNest(nest, help),
        id,
        folder: Number(folderArg),
      };
    }
    case 'note-delete': {
      const nest = args[1];
      const id = args[2];
      if (!nest || !id) {
        throw usageError(help);
      }
      requireNumericId(id, 'note id', help);
      return { kind: 'note-delete', target: parseNotesNest(nest, help), id };
    }
    case 'history': {
      const nest = args[1];
      const id = args[2];
      if (!nest || !id) {
        throw usageError(help);
      }
      requireNumericId(id, 'note id', help);
      return { kind: 'history', target: parseNotesNest(nest, help), id };
    }
    case 'folders': {
      if (!args[1]) {
        throw usageError(help);
      }
      return { kind: 'folders', target: parseNotesNest(args[1], help) };
    }
    case 'folder': {
      const nest = args[1];
      const id = args[2];
      if (!nest || !id) {
        throw usageError(help);
      }
      requireNumericId(id, 'folder id', help);
      return { kind: 'folder', target: parseNotesNest(nest, help), id };
    }
    case 'folder-create': {
      const nest = args[1];
      if (!nest) {
        throw usageError(help);
      }
      const target = parseNotesNest(nest, help);
      const folderName = args
        .slice(2, firstKnownFlagIndex(args, 2, FOLDER_CREATE_OPTION_FLAGS))
        .join(' ')
        .trim();
      if (!folderName) {
        throw usageError(help);
      }
      const parentIdx = args.indexOf('--parent');
      let parent: number | undefined;
      if (parentIdx !== -1) {
        const value = args[parentIdx + 1];
        if (!value || !/^\d+$/.test(value)) {
          throw usageError('--parent requires a numeric value', help);
        }
        parent = Number(value);
      }
      return { kind: 'folder-create', target, folderName, parent };
    }
    case 'folder-rename': {
      const nest = args[1];
      const id = args[2];
      const folderName = args.slice(3).join(' ').trim();
      if (!nest || !id || !folderName) {
        throw usageError(help);
      }
      requireNumericId(id, 'folder id', help);
      return {
        kind: 'folder-rename',
        target: parseNotesNest(nest, help),
        id,
        folderName,
      };
    }
    case 'folder-move': {
      const nest = args[1];
      const id = args[2];
      const parentArg = args[3];
      if (!nest || !id || !parentArg) {
        throw usageError(help);
      }
      requireNumericId(id, 'folder id', help);
      if (!/^\d+$/.test(parentArg)) {
        throw usageError(
          `Invalid parent id: ${parentArg}. Expected a number.`,
          help
        );
      }
      return {
        kind: 'folder-move',
        target: parseNotesNest(nest, help),
        id,
        parent: Number(parentArg),
      };
    }
    case 'folder-delete': {
      const nest = args[1];
      const id = args[2];
      if (!nest || !id) {
        throw usageError(help);
      }
      requireNumericId(id, 'folder id', help);
      return {
        kind: 'folder-delete',
        target: parseNotesNest(nest, help),
        id,
        recursive: args.includes('--recursive'),
      };
    }
    case 'members': {
      if (!args[1]) {
        throw usageError(help);
      }
      return { kind: 'members', target: parseNotesNest(args[1], help) };
    }
    case 'join': {
      if (!args[1]) {
        throw usageError(help);
      }
      return { kind: 'join', target: parseNotesNest(args[1], help) };
    }
    case 'leave': {
      if (!args[1]) {
        throw usageError(help);
      }
      return { kind: 'leave', target: parseNotesNest(args[1], help) };
    }
  }

  // Unreachable: command is validated against NOTES_COMMAND_HELP above.
  throw usageError(NOTES_HELP);
}

function readFileContent(path: string, deps: NotesDeps): string {
  try {
    return deps.readFile(path);
  } catch (error) {
    throw commandError(errorMessage(error));
  }
}

async function resolveBody(
  source: ContentSource,
  deps: NotesDeps
): Promise<string> {
  return source.kind === 'stdin'
    ? deps.readStdin()
    : readFileContent(source.path, deps);
}

// Resolve the numeric folder id for a note-create placement. `root` triggers a
// notebook-detail read to look up rootFolderId (never `0`); an explicit numeric
// id passes through. `getNotebook` returns a detail with `rootFolderId`
// guaranteed (the API rejects a detail that lacks it).
async function resolveFolder(
  folder: string,
  target: Nest,
  deps: NotesDeps
): Promise<number> {
  if (folder !== 'root') {
    return Number(folder);
  }
  const detail = await deps.notesV1.getNotebook(target.nest);
  return detail.notebook.rootFolderId;
}

// ---------------------------------------------------------------------------
// Read formatters
// ---------------------------------------------------------------------------

function formatNotebookLine(summary: NotesV1NotebookSummary): string {
  return `notes/${summary.host}/${summary.flagName}  ${summary.notebook.title}  (id ${summary.notebook.id})`;
}

function formatNoteLine(note: NotesV1Note): string {
  return `#${note.id}  ${note.title}  (rev ${note.revision ?? '?'})`;
}

function formatFolderLine(folder: NotesV1Folder): string {
  const parent =
    typeof folder.parentFolderId === 'number'
      ? `  parent ${folder.parentFolderId}`
      : '';
  return `#${folder.id}  ${folder.name}${parent}`;
}

function formatRevisionLine(rev: NotesV1NoteRevision): string {
  const author = rev.author ? `  ${rev.author}` : '';
  const at = typeof rev.editedAt === 'number' ? `  @ ${rev.editedAt}` : '';
  return `rev ${rev.revision ?? '?'}${author}${at}`;
}

function formatMemberLine(member: NotesV1MemberRecord): string {
  const roles = member.roles.length > 0 ? `  [${member.roles.join(', ')}]` : '';
  return `${member.ship}${roles}`;
}

function formatRequestStatus(status: NotesV1RequestStatus): string[] {
  const lines = [`Request: ${status.requestId}`];
  switch (status.body.type) {
    case 'ok':
      lines.push('Status: ok');
      break;
    case 'no-change':
      lines.push('Status: no-change');
      break;
    case 'notebook':
      lines.push('Status: notebook');
      lines.push(`Nest: ${notebookNest(status.body.notebook)}`);
      lines.push(`Title: ${status.body.notebook.notebook.title}`);
      lines.push(`ID: ${status.body.notebook.notebook.id}`);
      break;
    case 'error':
      lines.push('Status: error');
      lines.push(
        `Message: ${status.body.message?.trim() || 'backend returned an error without details'}`
      );
      break;
    case 'pending':
      lines.push(
        `Status: pending${status.body.status ? ` (${status.body.status})` : ''}`
      );
      lines.push('Do not issue the write again while this request is pending.');
      break;
    case 'api-key':
      lines.push('Status: api-key');
      break;
  }
  return lines;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled pending-write check: ${JSON.stringify(value)}`);
}

function pendingCheckCommand(check: NotesV1PendingWriteCheck): string {
  switch (check.type) {
    case 'notebook-list':
      return 'tlon notes list';
    case 'notebook-detail':
      return 'tlon notes show <notes-nest-from-list>';
    case 'note-list':
      return `tlon notes notes ${check.nest}`;
    case 'note-detail':
      return `tlon notes note ${check.nest} ${check.noteId ?? '<id-from-list>'}`;
    case 'folder-list':
      return `tlon notes folders ${check.nest}`;
    case 'folder-detail':
      return `tlon notes folder ${check.nest} ${check.folderId ?? '<id-from-list>'}`;
  }
  return assertNever(check);
}

function formatPendingWriteError(error: NotesPendingWriteErrorLike): string[] {
  const lines = error.requestId
    ? [
        `%notes write request is still pending (request ${error.requestId}); the outcome is unknown and it may still complete.`,
        'Do not retry automatically. Check the request before retrying:',
        `  tlon notes request ${error.requestId}`,
        'If the request is still pending, do not issue the write again.',
        'If the request has completed, inspect whether the write landed:',
      ]
    : [
        '%notes write request is still pending; the outcome is unknown and it may still complete.',
        'Do not retry automatically. No request id was returned, so inspect whether the write landed:',
      ];

  lines.push(
    ...error.checks.map((check) => `  ${pendingCheckCommand(check)}`),
    'Only retry if the request failed or the requested change is not present.'
  );
  return lines;
}

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

async function runStatus(deps: NotesDeps): Promise<number> {
  let reachable = true;
  try {
    await deps.notesV1.listNotebooks();
  } catch {
    reachable = false;
  }
  writeLine(
    deps.stdout,
    `%notes v1 API: ${reachable ? 'reachable' : 'unreachable'}`
  );
  // No runtime signal for group-channel mode exists yet (see Phase D); report it
  // as unknown rather than guessing.
  writeLine(deps.stdout, 'group-channel mode: unknown (no runtime signal yet)');
  return reachable ? 0 : 1;
}

async function runRequest(requestId: string, deps: NotesDeps): Promise<number> {
  const status = await deps.notesV1.getRequest(requestId);
  for (const line of formatRequestStatus(status)) {
    writeLine(deps.stdout, line);
  }
  return ['ok', 'no-change', 'notebook'].includes(status.body.type) ? 0 : 1;
}

async function runList(deps: NotesDeps): Promise<number> {
  const notebooks = await deps.notesV1.listNotebooks();
  if (notebooks.length === 0) {
    writeLine(deps.stdout, 'No notebooks.');
    return 0;
  }
  for (const notebook of notebooks) {
    writeLine(deps.stdout, formatNotebookLine(notebook));
  }
  return 0;
}

async function runShow(target: Nest, deps: NotesDeps): Promise<number> {
  const summary = await deps.notesV1.getNotebook(target.nest);
  writeLine(deps.stdout, `Nest: ${notebookNest(summary)}`);
  writeLine(deps.stdout, `Title: ${summary.notebook.title}`);
  writeLine(deps.stdout, `ID: ${summary.notebook.id}`);
  writeLine(deps.stdout, `Root folder: ${summary.notebook.rootFolderId}`);
  if (summary.visibility) {
    writeLine(deps.stdout, `Visibility: ${summary.visibility}`);
  }
  return 0;
}

async function runListNotes(target: Nest, deps: NotesDeps): Promise<number> {
  const notes = await deps.notesV1.listNotes(target.nest);
  if (notes.length === 0) {
    writeLine(deps.stdout, 'No notes.');
    return 0;
  }
  for (const note of notes) {
    writeLine(deps.stdout, formatNoteLine(note));
  }
  return 0;
}

async function runNote(
  target: Nest,
  id: string,
  deps: NotesDeps
): Promise<number> {
  const note = await deps.notesV1.getNote({
    flag: target.nest,
    noteId: Number(id),
  });
  writeLine(deps.stdout, `#${note.id}  ${note.title}`);
  writeLine(deps.stdout, `Revision: ${note.revision ?? '?'}`);
  if (typeof note.folderId === 'number') {
    writeLine(deps.stdout, `Folder: ${note.folderId}`);
  }
  writeLine(deps.stdout, '');
  writeLine(deps.stdout, note.bodyMd ?? '(empty)');
  return 0;
}

async function runCreate(title: string, deps: NotesDeps): Promise<number> {
  const summary = await deps.notesV1.createNotebook({ title });
  writeLine(deps.stdout, '✓ Notebook created');
  writeLine(deps.stdout, `  Nest: ${notebookNest(summary)}`);
  writeLine(deps.stdout, `  ID: ${summary.notebook.id}`);
  return 0;
}

async function runNoteCreate(
  parsed: {
    target: Nest;
    folder: string;
    title: string;
    source: ContentSource;
  },
  deps: NotesDeps
): Promise<number> {
  const folder = await resolveFolder(parsed.folder, parsed.target, deps);
  const body = await resolveBody(parsed.source, deps);
  await deps.notesV1.createNote({
    flag: parsed.target.nest,
    folder,
    title: parsed.title,
    body,
  });
  writeLine(deps.stdout, '✓ Note created');
  return 0;
}

async function runNoteUpdate(
  parsed: {
    target: Nest;
    id: string;
    source: ContentSource;
    expectedRevision?: number;
  },
  deps: NotesDeps
): Promise<number> {
  const body = await resolveBody(parsed.source, deps);
  await deps.notesV1.updateNoteBody({
    flag: parsed.target.nest,
    noteId: Number(parsed.id),
    body,
    expectedRevision: parsed.expectedRevision,
  });
  writeLine(deps.stdout, '✓ Note updated');
  return 0;
}

async function runNoteRename(
  target: Nest,
  id: string,
  title: string,
  deps: NotesDeps
): Promise<number> {
  await deps.notesV1.renameNote({
    flag: target.nest,
    noteId: Number(id),
    title,
  });
  writeLine(deps.stdout, '✓ Note renamed');
  return 0;
}

async function runNoteMove(
  target: Nest,
  id: string,
  folder: number,
  deps: NotesDeps
): Promise<number> {
  await deps.notesV1.moveNote({
    flag: target.nest,
    noteId: Number(id),
    folder,
  });
  writeLine(deps.stdout, '✓ Note moved');
  return 0;
}

async function runNoteDelete(
  target: Nest,
  id: string,
  deps: NotesDeps
): Promise<number> {
  await deps.notesV1.deleteNote({ flag: target.nest, noteId: Number(id) });
  writeLine(deps.stdout, '✓ Note deleted');
  return 0;
}

async function runHistory(
  target: Nest,
  id: string,
  deps: NotesDeps
): Promise<number> {
  const revisions = await deps.notesV1.listNoteHistory({
    flag: target.nest,
    noteId: Number(id),
  });
  if (revisions.length === 0) {
    writeLine(deps.stdout, 'No revisions.');
    return 0;
  }
  for (const rev of revisions) {
    writeLine(deps.stdout, formatRevisionLine(rev));
  }
  return 0;
}

async function runFolders(target: Nest, deps: NotesDeps): Promise<number> {
  const folders = await deps.notesV1.listFolders(target.nest);
  if (folders.length === 0) {
    writeLine(deps.stdout, 'No folders.');
    return 0;
  }
  for (const folder of folders) {
    writeLine(deps.stdout, formatFolderLine(folder));
  }
  return 0;
}

async function runFolder(
  target: Nest,
  id: string,
  deps: NotesDeps
): Promise<number> {
  const folder = await deps.notesV1.getFolder({
    flag: target.nest,
    folderId: Number(id),
  });
  writeLine(deps.stdout, `#${folder.id}  ${folder.name}`);
  if (typeof folder.parentFolderId === 'number') {
    writeLine(deps.stdout, `Parent: ${folder.parentFolderId}`);
  }
  return 0;
}

async function runFolderCreate(
  parsed: { target: Nest; folderName: string; parent?: number },
  deps: NotesDeps
): Promise<number> {
  await deps.notesV1.createFolder({
    flag: parsed.target.nest,
    name: parsed.folderName,
    parent: parsed.parent,
  });
  writeLine(deps.stdout, '✓ Folder created');
  return 0;
}

async function runFolderRename(
  target: Nest,
  id: string,
  folderName: string,
  deps: NotesDeps
): Promise<number> {
  await deps.notesV1.renameFolder({
    flag: target.nest,
    folderId: Number(id),
    name: folderName,
  });
  writeLine(deps.stdout, '✓ Folder renamed');
  return 0;
}

async function runFolderMove(
  target: Nest,
  id: string,
  parent: number,
  deps: NotesDeps
): Promise<number> {
  await deps.notesV1.moveFolder({
    flag: target.nest,
    folderId: Number(id),
    parent,
  });
  writeLine(deps.stdout, '✓ Folder moved');
  return 0;
}

async function runFolderDelete(
  target: Nest,
  id: string,
  recursive: boolean,
  deps: NotesDeps
): Promise<number> {
  await deps.notesV1.deleteFolder({
    flag: target.nest,
    folderId: Number(id),
    recursive,
  });
  writeLine(deps.stdout, '✓ Folder deleted');
  return 0;
}

async function runMembers(target: Nest, deps: NotesDeps): Promise<number> {
  const members = await deps.notesV1.listMembers(target.nest);
  if (members.length === 0) {
    writeLine(deps.stdout, 'No members.');
    return 0;
  }
  for (const member of members) {
    writeLine(deps.stdout, formatMemberLine(member));
  }
  return 0;
}

async function runJoin(target: Nest, deps: NotesDeps): Promise<number> {
  await deps.joinNotesNotebook(target.nest);
  writeLine(deps.stdout, '✓ Joined');
  return 0;
}

async function runLeave(target: Nest, deps: NotesDeps): Promise<number> {
  await deps.leaveNotesNotebook(target.nest);
  writeLine(deps.stdout, '✓ Left');
  return 0;
}

export async function run(args: string[], deps: NotesDeps): Promise<number> {
  try {
    const parsed = parseArgs(args);

    if (parsed.kind === 'help') {
      return writeHelp(deps, parsed.help);
    }

    await deps.authenticate();

    switch (parsed.kind) {
      case 'status':
        return await runStatus(deps);
      case 'request':
        return await runRequest(parsed.requestId, deps);
      case 'list':
        return await runList(deps);
      case 'show':
        return await runShow(parsed.target, deps);
      case 'list-notes':
        return await runListNotes(parsed.target, deps);
      case 'note':
        return await runNote(parsed.target, parsed.id, deps);
      case 'create':
        return await runCreate(parsed.title, deps);
      case 'note-create':
        return await runNoteCreate(parsed, deps);
      case 'note-update':
        return await runNoteUpdate(parsed, deps);
      case 'note-rename':
        return await runNoteRename(
          parsed.target,
          parsed.id,
          parsed.title,
          deps
        );
      case 'note-move':
        return await runNoteMove(parsed.target, parsed.id, parsed.folder, deps);
      case 'note-delete':
        return await runNoteDelete(parsed.target, parsed.id, deps);
      case 'history':
        return await runHistory(parsed.target, parsed.id, deps);
      case 'folders':
        return await runFolders(parsed.target, deps);
      case 'folder':
        return await runFolder(parsed.target, parsed.id, deps);
      case 'folder-create':
        return await runFolderCreate(parsed, deps);
      case 'folder-rename':
        return await runFolderRename(
          parsed.target,
          parsed.id,
          parsed.folderName,
          deps
        );
      case 'folder-move':
        return await runFolderMove(
          parsed.target,
          parsed.id,
          parsed.parent,
          deps
        );
      case 'folder-delete':
        return await runFolderDelete(
          parsed.target,
          parsed.id,
          parsed.recursive,
          deps
        );
      case 'members':
        return await runMembers(parsed.target, deps);
      case 'join':
        return await runJoin(parsed.target, deps);
      case 'leave':
        return await runLeave(parsed.target, deps);
    }
  } catch (error) {
    if (deps.isPendingWriteError(error)) {
      for (const line of formatPendingWriteError(error)) {
        writeLine(deps.stderr, line);
      }
      return 1;
    }
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) return handled;
    throw error;
  }
}
