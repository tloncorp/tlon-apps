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

// Unwrap the v1 `{requestId, body}` envelope for action writes. Returns the
// ok/no-change/notebook body and converts error/pending (and any unexpected
// type) into a commandError — so a `✓` is never printed for a failed write.
export function expectNotesResponse(
  res: NotesResponseEnvelope
): NotesResponseBody {
  const body = res?.body;
  if (!body || typeof body.type !== 'string') {
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
