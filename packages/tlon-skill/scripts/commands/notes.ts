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

Commands:
  status                                  Report %notes reachability
  list                                    List your notebooks
  show <nest>                             Show a notebook
  notes <nest>                            List notes in a notebook
  note <nest> <id>                        Show a note (with its Markdown body)
  create <title>                          Create a solo notebook
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
  tlon notes create "My Notebook"
  tlon notes note-create notes/~zod/blog root "First Note" --markdown post.md
  tlon notes note-update notes/~zod/blog 12 --stdin --expected-revision 3`;

export const NOTES_COMMAND_HELP: Record<string, string> = {
  status: 'Usage: tlon notes status',
  list: 'Usage: tlon notes list',
  show: 'Usage: tlon notes show <nest>\nExample: tlon notes show notes/~zod/blog',
  notes:
    'Usage: tlon notes notes <nest>\nExample: tlon notes notes notes/~zod/blog',
  note: 'Usage: tlon notes note <nest> <id>\nExample: tlon notes note notes/~zod/blog 12',
  create:
    'Usage: tlon notes create <title>\nExample: tlon notes create "My Notebook"',
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

// ---------------------------------------------------------------------------
// v1 %notes response shapes. The exact GET read shapes come from the unmerged
// `notes-groups-integration` branch OpenAPI and must be re-pinned against a live
// ship; the formatters below stay defensive about optional fields so a contract
// drift degrades to "(unknown)" rather than crashing.
// ---------------------------------------------------------------------------

export interface NotebookDetail {
  id: number;
  title: string;
  // Top-level placement uses rootFolderId (the OpenAPI notes it "equals id + 1",
  // but we resolve it explicitly rather than computing it).
  rootFolderId?: number;
}

export interface NotebookSummary {
  host: string;
  flagName: string;
  notebook: NotebookDetail;
  visibility?: string;
}

export interface NoteSummary {
  id: number;
  title?: string;
  revision?: number;
  folder?: number;
}

export interface NoteDetail extends NoteSummary {
  // %notes content is plain Markdown.
  bodyMd?: string;
}

// The OpenAPI field is `folderName` (the README's `name` is wrong).
export interface Folder {
  id: number;
  folderName?: string;
  parent?: number;
}

export interface NoteRevision {
  revision?: number;
  editedAt?: number;
  author?: string;
}

export interface MemberRecord {
  ship?: string;
  roles?: string[];
}

// Action writes (POST/PUT/DELETE) return this envelope; GET reads return bare
// typed bodies, not the envelope.
export interface NotesResponseBody {
  type: string;
  notebook?: NotebookSummary;
  message?: string;
}

export interface NotesResponseEnvelope {
  requestId?: string;
  body?: NotesResponseBody;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface NotesDeps extends CommandDeps {
  authenticate: () => Promise<void>;
  requestJson: <T = unknown>(
    path: string,
    method: HttpMethod,
    body?: unknown
  ) => Promise<T>;
  joinNotesNotebook: (nest: string) => Promise<void>;
  leaveNotesNotebook: (nest: string) => Promise<void>;
  readFile: (path: string) => string;
  readStdin: () => Promise<string>;
}

const NOTEBOOKS_PATH = '/notes/~/v1/notebooks';

type ContentSource = { kind: 'file'; path: string } | { kind: 'stdin' };

type Nest = { nest: string; host: string; name: string };

type ParsedNotesArgs =
  | { kind: 'help'; help: string }
  | { kind: 'status' }
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

// Parse a notes nest `notes/~host/name` into the `~host` / `name` parts the v1
// HTTP paths expect. Normalizes a missing `~` on the host. Validated up front
// (pre-auth) so a malformed nest fails locally — and so join/leave never silently
// no-op on a bad nest.
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

function notebookPath(target: Nest): string {
  return `${NOTEBOOKS_PATH}/${target.host}/${target.name}`;
}

function notesPath(target: Nest): string {
  return `${notebookPath(target)}/notes`;
}

function notePath(target: Nest, id: string): string {
  return `${notesPath(target)}/${id}`;
}

function noteHistoryPath(target: Nest, id: string): string {
  return `${notePath(target, id)}/history`;
}

function foldersPath(target: Nest): string {
  return `${notebookPath(target)}/folders`;
}

function folderPath(target: Nest, id: string): string {
  return `${foldersPath(target)}/${id}`;
}

function membersPath(target: Nest): string {
  return `${notebookPath(target)}/members`;
}

function notebookNest(summary: NotebookSummary): string {
  return `notes/${summary.host}/${summary.flagName}`;
}

function requireNumericId(id: string, label: string, usage: string): string {
  if (!/^\d+$/.test(id)) {
    throw usageError(`Invalid ${label}: ${id}. Expected a number.`, usage);
  }
  return id;
}

// Index of the first `--flag` token at or after `from`.
function firstFlagIndex(args: string[], from: number): number {
  for (let i = from; i < args.length; i += 1) {
    if (args[i].startsWith('--')) {
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
  usage: string
): ContentSource {
  const found: ContentSource[] = [];
  for (const flag of fileFlags) {
    const occurrences = args.filter((arg) => arg === `--${flag}`).length;
    if (occurrences > 1) {
      throw usageError(`--${flag} may be given only once`, usage);
    }
    if (occurrences === 1) {
      const value = args[args.indexOf(`--${flag}`) + 1];
      if (!value || value.startsWith('--')) {
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
      const title = args.slice(1, firstFlagIndex(args, 1)).join(' ').trim();
      if (!title) {
        throw usageError(help);
      }
      return { kind: 'create', title };
    }
    case 'note-create': {
      const nest = args[1];
      const folder = args[2];
      const title = args.slice(3, firstFlagIndex(args, 3)).join(' ').trim();
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
      const source = parseContentSource(args, ['body', 'markdown'], help);
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
      const source = parseContentSource(args, ['body'], help);
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
      const title = args.slice(3, firstFlagIndex(args, 3)).join(' ').trim();
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
        .slice(2, firstFlagIndex(args, 2))
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
      const folderName = args
        .slice(3, firstFlagIndex(args, 3))
        .join(' ')
        .trim();
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

// Interpret an action-write response. A *present* envelope body always uses the
// strict whitelist — only ok/no-change/notebook pass; error/pending (and any
// other body.type, e.g. api-key) are surfaced as a commandError so a `✓` is
// never printed for a failed write.
//
// `allowBareSuccess` relaxes only the *missing-body* case: the v1 convenience
// routes (Phase C: folder/note rename/move/delete) may answer with a bare or
// empty success, and `requestJson` already throws on HTTP failures, so those
// callers treat an absent envelope as success. The enveloped Phase B endpoints
// (create/note-create/note-update) leave it strict, where a missing body is an
// error.
export function expectNotesResponse(
  res: NotesResponseEnvelope,
  options: { allowBareSuccess?: boolean } = {}
): NotesResponseBody {
  const body = res?.body;
  if (!body || typeof body.type !== 'string') {
    if (options.allowBareSuccess) {
      return { type: 'ok' };
    }
    throw commandError('Unexpected %notes response (missing body).');
  }
  switch (body.type) {
    case 'ok':
    case 'no-change':
    case 'notebook':
      return body;
    case 'error':
      throw commandError(`%notes error: ${body.message ?? '(no message)'}`);
    case 'pending':
      throw commandError(
        '%notes request is still pending — try again in a moment.'
      );
    default:
      throw commandError(`Unexpected %notes response type: ${body.type}`);
  }
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
// id passes through.
async function resolveFolder(
  folder: string,
  target: Nest,
  deps: NotesDeps
): Promise<number> {
  if (folder !== 'root') {
    return Number(folder);
  }
  const detail = await deps.requestJson<NotebookSummary>(
    notebookPath(target),
    'GET'
  );
  const rootFolderId = detail?.notebook?.rootFolderId;
  if (typeof rootFolderId !== 'number') {
    throw commandError(
      `Could not resolve the root folder for ${target.nest} (no rootFolderId in the notebook detail).`
    );
  }
  return rootFolderId;
}

// ---------------------------------------------------------------------------
// Read formatters
// ---------------------------------------------------------------------------

function formatNotebookLine(summary: NotebookSummary): string {
  const title = summary.notebook?.title ?? '(untitled)';
  const id = summary.notebook?.id ?? '?';
  return `notes/${summary.host}/${summary.flagName}  ${title}  (id ${id})`;
}

function formatNoteLine(note: NoteSummary): string {
  const title = note.title ?? '(untitled)';
  const revision = note.revision ?? '?';
  return `#${note.id}  ${title}  (rev ${revision})`;
}

function formatFolderLine(folder: Folder): string {
  const name = folder.folderName ?? '(unnamed)';
  const parent =
    typeof folder.parent === 'number' ? `  parent ${folder.parent}` : '';
  return `#${folder.id}  ${name}${parent}`;
}

function formatRevisionLine(rev: NoteRevision): string {
  const author = rev.author ? `  ${rev.author}` : '';
  const at = typeof rev.editedAt === 'number' ? `  @ ${rev.editedAt}` : '';
  return `rev ${rev.revision ?? '?'}${author}${at}`;
}

function formatMemberLine(member: MemberRecord): string {
  const roles =
    member.roles && member.roles.length > 0
      ? `  [${member.roles.join(', ')}]`
      : '';
  return `${member.ship ?? '(unknown)'}${roles}`;
}

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

async function runStatus(deps: NotesDeps): Promise<number> {
  let reachable = true;
  try {
    await deps.requestJson(NOTEBOOKS_PATH, 'GET');
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

async function runList(deps: NotesDeps): Promise<number> {
  const notebooks = await deps.requestJson<NotebookSummary[]>(
    NOTEBOOKS_PATH,
    'GET'
  );
  if (!notebooks || notebooks.length === 0) {
    writeLine(deps.stdout, 'No notebooks.');
    return 0;
  }
  for (const notebook of notebooks) {
    writeLine(deps.stdout, formatNotebookLine(notebook));
  }
  return 0;
}

async function runShow(target: Nest, deps: NotesDeps): Promise<number> {
  const summary = await deps.requestJson<NotebookSummary>(
    notebookPath(target),
    'GET'
  );
  writeLine(deps.stdout, `Nest: ${notebookNest(summary)}`);
  writeLine(deps.stdout, `Title: ${summary.notebook?.title ?? '(untitled)'}`);
  writeLine(deps.stdout, `ID: ${summary.notebook?.id ?? '?'}`);
  writeLine(
    deps.stdout,
    `Root folder: ${summary.notebook?.rootFolderId ?? '(unknown)'}`
  );
  if (summary.visibility) {
    writeLine(deps.stdout, `Visibility: ${summary.visibility}`);
  }
  return 0;
}

async function runListNotes(target: Nest, deps: NotesDeps): Promise<number> {
  const notes = await deps.requestJson<NoteSummary[]>(notesPath(target), 'GET');
  if (!notes || notes.length === 0) {
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
  const note = await deps.requestJson<NoteDetail>(notePath(target, id), 'GET');
  writeLine(deps.stdout, `#${note.id}  ${note.title ?? '(untitled)'}`);
  writeLine(deps.stdout, `Revision: ${note.revision ?? '?'}`);
  if (typeof note.folder === 'number') {
    writeLine(deps.stdout, `Folder: ${note.folder}`);
  }
  writeLine(deps.stdout, '');
  writeLine(deps.stdout, note.bodyMd ?? '(empty)');
  return 0;
}

async function runCreate(title: string, deps: NotesDeps): Promise<number> {
  const res = await deps.requestJson<NotesResponseEnvelope>(
    NOTEBOOKS_PATH,
    'POST',
    { title }
  );
  const body = expectNotesResponse(res);
  writeLine(deps.stdout, '✓ Notebook created');
  if (body.notebook) {
    writeLine(deps.stdout, `  Nest: ${notebookNest(body.notebook)}`);
    writeLine(deps.stdout, `  ID: ${body.notebook.notebook?.id ?? '?'}`);
  }
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
  const res = await deps.requestJson<NotesResponseEnvelope>(
    notesPath(parsed.target),
    'POST',
    { folder, title: parsed.title, body }
  );
  expectNotesResponse(res);
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
  const payload: { body: string; expectedRevision?: number } = { body };
  if (parsed.expectedRevision !== undefined) {
    payload.expectedRevision = parsed.expectedRevision;
  }
  const res = await deps.requestJson<NotesResponseEnvelope>(
    notePath(parsed.target, parsed.id),
    'PUT',
    payload
  );
  expectNotesResponse(res);
  writeLine(deps.stdout, '✓ Note updated');
  return 0;
}

// PUT …/notes/<id> is single-mode: a `body` payload wins over title/folder. So
// note-rename / note-move send metadata-only bodies and never carry `body`.
async function runNoteRename(
  target: Nest,
  id: string,
  title: string,
  deps: NotesDeps
): Promise<number> {
  const res = await deps.requestJson<NotesResponseEnvelope>(
    notePath(target, id),
    'PUT',
    { title }
  );
  expectNotesResponse(res, { allowBareSuccess: true });
  writeLine(deps.stdout, '✓ Note renamed');
  return 0;
}

async function runNoteMove(
  target: Nest,
  id: string,
  folder: number,
  deps: NotesDeps
): Promise<number> {
  const res = await deps.requestJson<NotesResponseEnvelope>(
    notePath(target, id),
    'PUT',
    { folder }
  );
  expectNotesResponse(res, { allowBareSuccess: true });
  writeLine(deps.stdout, '✓ Note moved');
  return 0;
}

async function runNoteDelete(
  target: Nest,
  id: string,
  deps: NotesDeps
): Promise<number> {
  const res = await deps.requestJson<NotesResponseEnvelope>(
    notePath(target, id),
    'DELETE'
  );
  expectNotesResponse(res, { allowBareSuccess: true });
  writeLine(deps.stdout, '✓ Note deleted');
  return 0;
}

async function runHistory(
  target: Nest,
  id: string,
  deps: NotesDeps
): Promise<number> {
  const revisions = await deps.requestJson<NoteRevision[]>(
    noteHistoryPath(target, id),
    'GET'
  );
  if (!revisions || revisions.length === 0) {
    writeLine(deps.stdout, 'No revisions.');
    return 0;
  }
  for (const rev of revisions) {
    writeLine(deps.stdout, formatRevisionLine(rev));
  }
  return 0;
}

async function runFolders(target: Nest, deps: NotesDeps): Promise<number> {
  const folders = await deps.requestJson<Folder[]>(foldersPath(target), 'GET');
  if (!folders || folders.length === 0) {
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
  const folder = await deps.requestJson<Folder>(folderPath(target, id), 'GET');
  writeLine(deps.stdout, `#${folder.id}  ${folder.folderName ?? '(unnamed)'}`);
  if (typeof folder.parent === 'number') {
    writeLine(deps.stdout, `Parent: ${folder.parent}`);
  }
  return 0;
}

async function runFolderCreate(
  parsed: { target: Nest; folderName: string; parent?: number },
  deps: NotesDeps
): Promise<number> {
  const payload: { folderName: string; parent?: number } = {
    folderName: parsed.folderName,
  };
  // parent omitted → folder is created at the notebook root.
  if (parsed.parent !== undefined) {
    payload.parent = parsed.parent;
  }
  const res = await deps.requestJson<NotesResponseEnvelope>(
    foldersPath(parsed.target),
    'POST',
    payload
  );
  expectNotesResponse(res, { allowBareSuccess: true });
  writeLine(deps.stdout, '✓ Folder created');
  return 0;
}

async function runFolderRename(
  target: Nest,
  id: string,
  folderName: string,
  deps: NotesDeps
): Promise<number> {
  const res = await deps.requestJson<NotesResponseEnvelope>(
    folderPath(target, id),
    'PUT',
    { folderName }
  );
  expectNotesResponse(res, { allowBareSuccess: true });
  writeLine(deps.stdout, '✓ Folder renamed');
  return 0;
}

async function runFolderMove(
  target: Nest,
  id: string,
  parent: number,
  deps: NotesDeps
): Promise<number> {
  const res = await deps.requestJson<NotesResponseEnvelope>(
    folderPath(target, id),
    'PUT',
    { parent }
  );
  expectNotesResponse(res, { allowBareSuccess: true });
  writeLine(deps.stdout, '✓ Folder moved');
  return 0;
}

async function runFolderDelete(
  target: Nest,
  id: string,
  recursive: boolean,
  deps: NotesDeps
): Promise<number> {
  const res = await deps.requestJson<NotesResponseEnvelope>(
    `${folderPath(target, id)}?recursive=${recursive ? 'true' : 'false'}`,
    'DELETE'
  );
  expectNotesResponse(res, { allowBareSuccess: true });
  writeLine(deps.stdout, '✓ Folder deleted');
  return 0;
}

async function runMembers(target: Nest, deps: NotesDeps): Promise<number> {
  const members = await deps.requestJson<MemberRecord[]>(
    membersPath(target),
    'GET'
  );
  if (!members || members.length === 0) {
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
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) return handled;
    throw error;
  }
}
