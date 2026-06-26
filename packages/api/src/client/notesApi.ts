import { createDevLogger } from '../lib/logger';
import { poke, requestJson, scry, subscribe, unsubscribe } from './urbit';

const logger = createDevLogger('notesApi', false);

// ===========================================================================
// Channel compatibility exports (TLON-6042 / #5997)
//
// Notes-backed group channels are addressed as nests `notes/<host>/<name>`.
// Join/leave/delete go through %notes (not %channels, which would reject the
// unknown nest). These keep their existing channel-id signatures and behavior
// for the app and skill consumers already calling them.
// ===========================================================================

// Notes channel ids are nests of the form `notes/<host>/<name>`.
function notesNestParts(
  channelId: string
): { host: string; name: string } | null {
  const [, host, name] = channelId.split('/');
  if (!host || !name) {
    return null;
  }
  return { host, name };
}

// Join a notes-backed channel by subscribing on %notes, which reports the join
// to %groups so it tracks our membership. (%channels' join would reject the
// unknown nest.) Errors propagate so the caller can roll back its optimistic
// update.
export const joinNotesChannel = async (channelId: string) => {
  const parts = notesNestParts(channelId);
  if (!parts) {
    return;
  }
  await poke({
    app: 'notes',
    mark: 'notes-action',
    json: { type: 'join', ship: parts.host, name: parts.name },
  });
};

// Leave a notes-backed channel via %notes (which unsubscribes and reports the
// leave to %groups) instead of %channels, which would reject the unknown nest.
export const leaveNotesChannel = async (channelId: string) => {
  const parts = notesNestParts(channelId);
  if (!parts) {
    return;
  }
  await poke({
    app: 'notes',
    mark: 'notes-action',
    json: { type: 'leave', ship: parts.host, name: parts.name },
  });
};

// Exact `notes/<host>/<name>` channel-id parse for the legacy wrapper. Unlike
// the lenient v0 `parseNotesChannelId` (which ignores extra segments), this
// rejects extra/missing segments, empty parts, and bare flags — returning null
// so the wrapper no-ops rather than mis-deleting a notebook from a note/cite
// path like `notes/~zod/blog/12`.
function parseExactNotesChannelId(channelId: string): NotesFlag | null {
  const segments = channelId.split('/');
  if (
    segments.length !== 3 ||
    segments[0] !== 'notes' ||
    !segments[1] ||
    !segments[2]
  ) {
    return null;
  }
  return { host: segments[1], name: segments[2] };
}

// Legacy best-effort delete compatibility export. Channel-id wrapper ONLY:
// accepts an exact `notes/<host>/<name>` nest, swallows/logs failures, and is a
// no-op for anything else (a bare `~host/name` flag, or an over-long note/cite
// path) — so a stray flag or path can never silently get best-effort semantics
// here. New TLON-6042 callers use the explicit deleteNotesNotebookStrict /
// deleteNotesNotebookBestEffort helpers.
export const deleteNotesNotebook = async (channelId: string) => {
  const flag = parseExactNotesChannelId(channelId);
  if (!flag) {
    return;
  }
  try {
    await pokeNotebookDelete(flag);
  } catch (e) {
    logger.error('Failed to delete notebook in %notes', e);
  }
};

// ===========================================================================
// v0 API surface (lifted from #5990 db/native-notes-foundation)
//
// App-sync oriented: `/v0/...` scries, `%notes` pokes, and `/stream`
// subscriptions. These preserve #5990's names and semantics so the future
// app/shared adoption is an additive merge. The skill does NOT use these — it
// uses the `notesV1` HTTP surface further below.
// ===========================================================================

export type NotesVisibility = 'public' | 'private';
export type NotesRole = 'owner' | 'editor' | 'viewer';

export interface NotesFlag {
  host: string;
  name: string;
}

export interface NotesNotebook {
  id: number;
  title: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
}

export interface NotesNotebookSummary {
  host: string;
  flagName: string;
  notebook: NotesNotebook;
  visibility?: NotesVisibility;
}

export interface NotesFolder {
  id: number;
  notebookId: number;
  name: string;
  parentFolderId: number | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
}

export interface NotesNote {
  id: number;
  notebookId: number;
  folderId: number;
  title: string;
  slug: string | null;
  bodyMd: string;
  createdBy: string;
  createdAt: number;
  updatedBy: string;
  updatedAt: number;
  revision: number;
}

export interface NotesMemberRecord {
  ship: string;
  role: NotesRole;
}

export interface NotesPublishedRecord {
  host: string;
  flagName: string;
  noteId: number;
}

/**
 * Stream events carry typed update payloads (see the %notes agent docs for
 * the full wire format), but the client treats any event as a signal to
 * resync, so only the envelope is modeled here.
 */
export type NotesStreamEvent = {
  type: 'snapshot' | 'update';
  host: string;
  flagName: string;
};

// Only the poke variants the client produces are modeled; the agent's full
// action surface is documented with the %notes agent.
type NotesFolderAction =
  | { type: 'rename'; name: string }
  | { type: 'move'; newParent: number }
  | { type: 'delete'; recursive: boolean };

type NotesNoteAction =
  | { type: 'rename'; title: string }
  | { type: 'move'; folder: number }
  | { type: 'delete' }
  | { type: 'update'; body: string; expectedRevision: number }
  | { type: 'publish'; html: string }
  | { type: 'unpublish' };

type NotesNotebookAction =
  | { type: 'delete' }
  | { type: 'create-folder'; parent?: number | null; name: string }
  | { type: 'folder'; id: number; action: NotesFolderAction }
  | { type: 'create-note'; folder: number; title: string; body: string }
  | { type: 'note'; id: number; action: NotesNoteAction };

type NotesJoinAction = { type: 'join'; ship: string; name: string };

type NotesNotebookScopedAction = {
  type: 'notebook';
  flag: string;
  action: NotesNotebookAction;
};

type NotesAction = NotesJoinAction | NotesNotebookScopedAction;

type FlagArg = { flag: NotesFlag | string };
type FolderIdArg = FlagArg & { folderId: number };
type NoteIdArg = FlagArg & { noteId: number };

export function formatNotesFlag(flag: NotesFlag | string): string {
  return typeof flag === 'string' ? flag : `${flag.host}/${flag.name}`;
}

export function parseNotesFlag(
  input: string | null | undefined
): NotesFlag | null {
  if (!input) return null;
  const [host, name] = input.split('/');
  return host && name ? { host, name } : null;
}

export function parseNotesChannelId(
  channelId: string | null | undefined
): NotesFlag | null {
  if (!channelId) return null;
  const [app, host, name] = channelId.split('/');
  return app === 'notes' && host && name ? { host, name } : null;
}

export function notesChannelId(flag: NotesFlag | string): string {
  return `notes/${formatNotesFlag(flag)}`;
}

async function notesAction(action: NotesAction) {
  return poke({
    app: 'notes',
    mark: 'notes-action',
    json: action,
  });
}

export async function listNotesNotebooks(): Promise<NotesNotebookSummary[]> {
  return scryNotesList('/v0/notebooks');
}

export async function getNotesNotebook(
  flag: NotesFlag | string
): Promise<NotesNotebookSummary | null> {
  const normalized = requireNotesFlag(flag);
  try {
    const data = await scry<NotesNotebookSummary>({
      app: 'notes',
      path: `/v0/notebook/${normalized.host}/${normalized.name}`,
    });
    return data ?? null;
  } catch (e) {
    return null;
  }
}

export async function listNotesFolders(
  flag: NotesFlag | string
): Promise<NotesFolder[]> {
  const { host, name } = requireNotesFlag(flag);
  return scryNotesList(`/v0/folders/${host}/${name}`);
}

export async function listNotes(
  flag: NotesFlag | string
): Promise<NotesNote[]> {
  const { host, name } = requireNotesFlag(flag);
  return scryNotesList(`/v0/notes/${host}/${name}`);
}

export async function listNotesMembers(
  flag: NotesFlag | string
): Promise<NotesMemberRecord[]> {
  const { host, name } = requireNotesFlag(flag);
  return scryNotesList(`/v0/members/${host}/${name}`);
}

export async function listPublishedNotes(): Promise<NotesPublishedRecord[]> {
  return scryNotesList('/v0/published');
}

export async function joinNotesNotebook(flag: NotesFlag | string) {
  const normalized = requireNotesFlag(flag);
  return notesAction({
    type: 'join',
    ship: normalized.host,
    name: normalized.name,
  });
}

export async function createNotesFolder({
  flag,
  parent,
  name,
}: FlagArg & { parent?: number | null; name: string }) {
  return notebookAction(flag, { type: 'create-folder', parent, name });
}

export async function renameNotesFolder({
  flag,
  folderId,
  name,
}: FolderIdArg & { name: string }) {
  return folderAction(flag, folderId, { type: 'rename', name });
}

export async function moveNotesFolder({
  flag,
  folderId,
  newParent,
}: FolderIdArg & { newParent: number }) {
  return folderAction(flag, folderId, { type: 'move', newParent });
}

export async function deleteNotesFolder({
  flag,
  folderId,
  recursive = true,
}: FolderIdArg & { recursive?: boolean }) {
  return folderAction(flag, folderId, { type: 'delete', recursive });
}

export async function createNotesNote({
  flag,
  folder,
  title,
  body = '',
}: FlagArg & { folder: number; title: string; body?: string }) {
  return notebookAction(flag, { type: 'create-note', folder, title, body });
}

export async function renameNotesNote({
  flag,
  noteId,
  title,
}: NoteIdArg & { title: string }) {
  return noteAction(flag, noteId, { type: 'rename', title });
}

export async function moveNotesNote({
  flag,
  noteId,
  folder,
}: NoteIdArg & { folder: number }) {
  return noteAction(flag, noteId, { type: 'move', folder });
}

export async function updateNotesNoteBody({
  flag,
  noteId,
  body,
  expectedRevision,
}: NoteIdArg & { body: string; expectedRevision: number }) {
  return noteAction(flag, noteId, { type: 'update', body, expectedRevision });
}

export async function deleteNotesNote({ flag, noteId }: NoteIdArg) {
  return noteAction(flag, noteId, { type: 'delete' });
}

export async function publishNotesNote({
  flag,
  noteId,
  html,
}: NoteIdArg & { html: string }) {
  return noteAction(flag, noteId, { type: 'publish', html });
}

export async function unpublishNotesNote({ flag, noteId }: NoteIdArg) {
  return noteAction(flag, noteId, { type: 'unpublish' });
}

export async function subscribeToNotesNotebook(
  flag: NotesFlag | string,
  handler: (event: NotesStreamEvent) => void
) {
  const normalized = requireNotesFlag(flag);
  return subscribe<NotesStreamEvent>(
    {
      app: 'notes',
      path: `/v0/notes/${normalized.host}/${normalized.name}/stream`,
    },
    handler
  );
}

export async function unsubscribeFromNotesNotebook(subscriptionId: number) {
  return unsubscribe(subscriptionId);
}

async function notebookAction(
  flag: NotesFlag | string,
  action: NotesNotebookAction
) {
  return notesAction({
    type: 'notebook',
    flag: formatNotesFlag(flag),
    action,
  });
}

function folderAction(
  flag: NotesFlag | string,
  id: number,
  action: NotesFolderAction
) {
  return notebookAction(flag, { type: 'folder', id, action });
}

function noteAction(
  flag: NotesFlag | string,
  id: number,
  action: NotesNoteAction
) {
  return notebookAction(flag, { type: 'note', id, action });
}

function requireNotesFlag(flag: NotesFlag | string): NotesFlag {
  if (typeof flag !== 'string') {
    return flag;
  }
  const parsed = parseNotesFlag(flag);
  if (!parsed) {
    throw new Error(`Invalid notes flag: ${flag}`);
  }
  return parsed;
}

async function scryNotesList<T>(path: string): Promise<T[]> {
  const data = await scry<T[]>({ app: 'notes', path });
  return Array.isArray(data) ? data : [];
}

// ===========================================================================
// Shared notes target normalizer
//
// Accepts every notes notebook identifier TLON-6042 callers can produce and
// returns a `{ host: '~host', name }` flag. A full `notes/...` nest is never
// parsed as a raw flag with host `notes`; a missing `~` on the host is
// normalized; malformed identifiers are rejected (not silently truncated).
// ===========================================================================

export type NotesTarget = NotesFlag | string;

function ensureSig(host: string): string {
  return host.startsWith('~') ? host : `~${host}`;
}

export function normalizeNotesTarget(target: NotesTarget): NotesFlag {
  if (target && typeof target === 'object') {
    if (!target.host || !target.name) {
      throw new Error('Invalid notes flag: missing host or name');
    }
    return { host: ensureSig(target.host), name: target.name };
  }
  if (typeof target !== 'string' || target.length === 0) {
    throw new Error(`Invalid notes target: ${String(target)}`);
  }
  const segments = target.split('/');
  if (segments[0] === 'notes') {
    // Full channel nest: notes/<host>/<name>
    const [, host, name] = segments;
    if (segments.length !== 3 || !host || !name) {
      throw new Error(`Invalid notes channel id: ${target}`);
    }
    return { host: ensureSig(host), name };
  }
  // Bare flag: <host>/<name>
  const [host, name] = segments;
  if (segments.length !== 2 || !host || !name) {
    throw new Error(`Invalid notes flag: ${target}`);
  }
  return { host: ensureSig(host), name };
}

// ===========================================================================
// Explicit notebook delete helpers (TLON-6042)
//
// Routed through the known-working %notes action path (no confirmed v1 HTTP
// delete route yet). `Strict` propagates failures; `BestEffort` swallows/logs.
// ===========================================================================

// Shared private delete internal used by both the strict helper and the legacy
// channel-id wrapper above.
function pokeNotebookDelete(flag: NotesFlag) {
  return notebookAction(formatNotesFlag(flag), { type: 'delete' });
}

export async function deleteNotesNotebookStrict(target: NotesTarget) {
  return pokeNotebookDelete(normalizeNotesTarget(target));
}

export async function deleteNotesNotebookBestEffort(target: NotesTarget) {
  try {
    await deleteNotesNotebookStrict(target);
  } catch (e) {
    logger.error('Failed to delete notebook in %notes', e);
  }
}

// ===========================================================================
// v1 HTTP API surface (`notesV1`) — `/notes/~/v1/...` request/response
//
// Used by the tlon-skill. Centralizes path construction, request payloads,
// canonical response shapes, and envelope handling. The skill passes typed
// operation arguments, never string-built paths.
// ===========================================================================

export interface NotesV1NotebookListItem {
  id: number;
  title: string;
  rootFolderId?: number;
  createdBy?: string;
  createdAt?: number;
  updatedBy?: string;
  updatedAt?: number;
}

export interface NotesV1NotebookDetail extends NotesV1NotebookListItem {
  rootFolderId: number;
}

export interface NotesV1NotebookSummary {
  host: string;
  flagName: string;
  notebook: NotesV1NotebookListItem;
  visibility?: NotesVisibility;
}

export interface NotesV1NotebookDetailSummary {
  host: string;
  flagName: string;
  notebook: NotesV1NotebookDetail;
  visibility?: NotesVisibility;
}

export interface NotesV1Folder {
  id: number;
  notebookId?: number;
  name: string;
  parentFolderId: number | null;
  createdBy?: string;
  createdAt?: number;
  updatedBy?: string;
  updatedAt?: number;
}

export interface NotesV1Note {
  id: number;
  notebookId?: number;
  folderId?: number;
  title: string;
  slug?: string | null;
  bodyMd?: string;
  revision?: number;
  createdBy?: string;
  createdAt?: number;
  updatedBy?: string;
  updatedAt?: number;
}

export interface NotesV1NoteRevision {
  revision?: number;
  editedAt?: number;
  author?: string;
  bodyMd?: string;
}

export interface NotesV1MemberRecord {
  ship: string;
  roles: NotesRole[];
}

export interface NotesV1GroupRef {
  host: string;
  flagName: string;
}

const NOTEBOOKS_V1_PATH = '/notes/~/v1/notebooks';

function notebookV1Path(flag: NotesFlag): string {
  return `${NOTEBOOKS_V1_PATH}/${flag.host}/${flag.name}`;
}
function notesV1Path(flag: NotesFlag): string {
  return `${notebookV1Path(flag)}/notes`;
}
function noteV1Path(flag: NotesFlag, noteId: number): string {
  return `${notesV1Path(flag)}/${noteId}`;
}
function noteHistoryV1Path(flag: NotesFlag, noteId: number): string {
  return `${noteV1Path(flag, noteId)}/history`;
}
function foldersV1Path(flag: NotesFlag): string {
  return `${notebookV1Path(flag)}/folders`;
}
function folderV1Path(flag: NotesFlag, folderId: number): string {
  return `${foldersV1Path(flag)}/${folderId}`;
}
function membersV1Path(flag: NotesFlag): string {
  return `${notebookV1Path(flag)}/members`;
}

// --- response normalization ------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function requireArray<T>(raw: unknown, normalize: (item: any) => T): T[] {
  if (!Array.isArray(raw)) {
    throw new Error('Unexpected %notes response: expected an array');
  }
  return raw.map(normalize);
}

function requireObject(raw: unknown): any {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Unexpected %notes response: expected an object');
  }
  return raw;
}

// Reject a malformed successful body that omits a field the canonical v1 type
// requires (so the CLI never renders `notes/undefined/undefined`).
function req<T>(value: T | null | undefined, field: string): T {
  if (value === undefined || value === null) {
    throw new Error(`%notes response missing required field: ${field}`);
  }
  return value;
}

function normalizeNotebookListItem(raw: any): NotesV1NotebookListItem {
  return {
    id: req(raw.id, 'notebook.id'),
    title: req(raw.title, 'notebook.title'),
    rootFolderId: raw.rootFolderId,
    createdBy: raw.createdBy,
    createdAt: raw.createdAt,
    updatedBy: raw.updatedBy,
    updatedAt: raw.updatedAt,
  };
}

function normalizeNotebookSummaryV1(raw: any): NotesV1NotebookSummary {
  return {
    host: req(raw.host, 'host'),
    flagName: req(raw.flagName, 'flagName'),
    notebook: normalizeNotebookListItem(requireObject(raw?.notebook)),
    visibility: raw.visibility,
  };
}

function normalizeNotebookDetailSummaryV1(
  raw: any
): NotesV1NotebookDetailSummary {
  const summary = normalizeNotebookSummaryV1(raw);
  const rootFolderId = summary.notebook.rootFolderId;
  if (typeof rootFolderId !== 'number') {
    throw new Error('%notes notebook detail is missing rootFolderId');
  }
  return {
    ...summary,
    notebook: { ...summary.notebook, rootFolderId },
  };
}

function normalizeFolderV1(raw: any): NotesV1Folder {
  const parent = raw.parentFolderId ?? raw.parent;
  return {
    id: req(raw.id, 'folder.id'),
    notebookId: raw.notebookId,
    name: req(raw.name ?? raw.folderName, 'folder.name'),
    parentFolderId: typeof parent === 'number' ? parent : null,
    createdBy: raw.createdBy,
    createdAt: raw.createdAt,
    updatedBy: raw.updatedBy,
    updatedAt: raw.updatedAt,
  };
}

function normalizeNoteV1(raw: any): NotesV1Note {
  return {
    id: req(raw.id, 'note.id'),
    notebookId: raw.notebookId,
    folderId: raw.folderId ?? raw.folder,
    title: req(raw.title, 'note.title'),
    slug: raw.slug,
    bodyMd: raw.bodyMd,
    revision: raw.revision,
    createdBy: raw.createdBy,
    createdAt: raw.createdAt,
    updatedBy: raw.updatedBy,
    updatedAt: raw.updatedAt,
  };
}

function normalizeNoteRevisionV1(raw: any): NotesV1NoteRevision {
  return {
    revision: raw.revision ?? raw.rev,
    editedAt: raw.editedAt ?? raw.at,
    author: raw.author ?? raw.by,
    bodyMd: raw.bodyMd,
  };
}

function normalizeMemberV1(raw: any): NotesV1MemberRecord {
  const roles = Array.isArray(raw.roles)
    ? raw.roles
    : raw.role
      ? [raw.role]
      : [];
  return { ship: req(raw.ship, 'member.ship'), roles };
}

// --- envelope handling -----------------------------------------------------

function notesEnvelopeErrorMessage(body: any): string {
  const raw = body?.message;
  const detail =
    typeof raw === 'string'
      ? raw.trim()
      : raw === undefined || raw === null
        ? ''
        : String(raw).trim();
  return `%notes error: ${detail || 'backend returned an error without details'}`;
}

// A *present* envelope body uses the strict whitelist; error/pending/unexpected
// always throw. `createNotebook`/`createGroupNotebook` require a `notebook`
// body and return its normalized summary.
function unwrapNotebookEnvelope(res: any): NotesV1NotebookSummary {
  const body = res?.body;
  if (!body || typeof body.type !== 'string') {
    throw new Error('Unexpected %notes response (missing body).');
  }
  switch (body.type) {
    case 'notebook':
      return normalizeNotebookSummaryV1(requireObject(body.notebook));
    case 'error':
      throw new Error(notesEnvelopeErrorMessage(body));
    case 'pending':
      throw new Error(
        '%notes request is still pending — try again in a moment.'
      );
    default:
      throw new Error(`Unexpected %notes response type: ${body.type}`);
  }
}

// Void writes: a *present* envelope body must be ok/no-change/notebook (else
// error/pending/unexpected throw). A bare/empty non-envelope JSON body (e.g. a
// folder object from a convenience route) is accepted and ignored —
// `requestJson` already throws on HTTP failure.
function assertWriteOk(res: any): void {
  const body = res?.body;
  if (!body || typeof body.type !== 'string') {
    return;
  }
  switch (body.type) {
    case 'ok':
    case 'no-change':
    case 'notebook':
      return;
    case 'error':
      throw new Error(notesEnvelopeErrorMessage(body));
    case 'pending':
      throw new Error(
        '%notes request is still pending — try again in a moment.'
      );
    default:
      throw new Error(`Unexpected %notes response type: ${body.type}`);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// --- notebook helpers ------------------------------------------------------

async function listNotebooksV1(): Promise<NotesV1NotebookSummary[]> {
  const res = await requestJson(NOTEBOOKS_V1_PATH, 'GET');
  return requireArray(res, normalizeNotebookSummaryV1);
}

async function getNotebookV1(
  target: NotesTarget
): Promise<NotesV1NotebookDetailSummary> {
  const flag = normalizeNotesTarget(target);
  const res = await requestJson(notebookV1Path(flag), 'GET');
  return normalizeNotebookDetailSummaryV1(requireObject(res));
}

async function createNotebookV1({
  title,
}: {
  title: string;
}): Promise<NotesV1NotebookSummary> {
  const res = await requestJson(NOTEBOOKS_V1_PATH, 'POST', { title });
  return unwrapNotebookEnvelope(res);
}

async function createGroupNotebookV1({
  title,
  group,
  readers = [],
}: {
  title: string;
  group: NotesV1GroupRef;
  readers?: string[];
}): Promise<NotesV1NotebookSummary> {
  const res = await requestJson(NOTEBOOKS_V1_PATH, 'POST', {
    title,
    group,
    readers,
  });
  return unwrapNotebookEnvelope(res);
}

// --- note helpers ----------------------------------------------------------

async function listNotesV1(target: NotesTarget): Promise<NotesV1Note[]> {
  const flag = normalizeNotesTarget(target);
  const res = await requestJson(notesV1Path(flag), 'GET');
  return requireArray(res, normalizeNoteV1);
}

async function getNoteV1({
  flag,
  noteId,
}: {
  flag: NotesTarget;
  noteId: number;
}): Promise<NotesV1Note> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson(noteV1Path(normalized, noteId), 'GET');
  return normalizeNoteV1(requireObject(res));
}

async function createNoteV1({
  flag,
  folder,
  title,
  body,
}: {
  flag: NotesTarget;
  folder: number;
  title: string;
  body: string;
}): Promise<void> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson(notesV1Path(normalized), 'POST', {
    folder,
    title,
    body,
  });
  assertWriteOk(res);
}

async function updateNoteBodyV1({
  flag,
  noteId,
  body,
  expectedRevision,
}: {
  flag: NotesTarget;
  noteId: number;
  body: string;
  expectedRevision?: number;
}): Promise<void> {
  const normalized = normalizeNotesTarget(flag);
  const payload: { body: string; expectedRevision?: number } = { body };
  if (expectedRevision !== undefined) {
    payload.expectedRevision = expectedRevision;
  }
  const res = await requestJson(noteV1Path(normalized, noteId), 'PUT', payload);
  assertWriteOk(res);
}

async function renameNoteV1({
  flag,
  noteId,
  title,
}: {
  flag: NotesTarget;
  noteId: number;
  title: string;
}): Promise<void> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson(noteV1Path(normalized, noteId), 'PUT', {
    title,
  });
  assertWriteOk(res);
}

async function moveNoteV1({
  flag,
  noteId,
  folder,
}: {
  flag: NotesTarget;
  noteId: number;
  folder: number;
}): Promise<void> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson(noteV1Path(normalized, noteId), 'PUT', {
    folder,
  });
  assertWriteOk(res);
}

async function deleteNoteV1({
  flag,
  noteId,
}: {
  flag: NotesTarget;
  noteId: number;
}): Promise<void> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson(noteV1Path(normalized, noteId), 'DELETE');
  assertWriteOk(res);
}

async function listNoteHistoryV1({
  flag,
  noteId,
}: {
  flag: NotesTarget;
  noteId: number;
}): Promise<NotesV1NoteRevision[]> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson(noteHistoryV1Path(normalized, noteId), 'GET');
  return requireArray(res, normalizeNoteRevisionV1);
}

// --- folder helpers --------------------------------------------------------

async function listFoldersV1(target: NotesTarget): Promise<NotesV1Folder[]> {
  const flag = normalizeNotesTarget(target);
  const res = await requestJson(foldersV1Path(flag), 'GET');
  return requireArray(res, normalizeFolderV1);
}

async function getFolderV1({
  flag,
  folderId,
}: {
  flag: NotesTarget;
  folderId: number;
}): Promise<NotesV1Folder> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson(folderV1Path(normalized, folderId), 'GET');
  return normalizeFolderV1(requireObject(res));
}

async function createFolderV1({
  flag,
  name,
  parent,
}: {
  flag: NotesTarget;
  name: string;
  parent?: number;
}): Promise<void> {
  const normalized = normalizeNotesTarget(flag);
  const payload: { folderName: string; parent?: number } = { folderName: name };
  if (parent !== undefined) {
    payload.parent = parent;
  }
  const res = await requestJson(foldersV1Path(normalized), 'POST', payload);
  assertWriteOk(res);
}

async function renameFolderV1({
  flag,
  folderId,
  name,
}: {
  flag: NotesTarget;
  folderId: number;
  name: string;
}): Promise<void> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson(folderV1Path(normalized, folderId), 'PUT', {
    folderName: name,
  });
  assertWriteOk(res);
}

async function moveFolderV1({
  flag,
  folderId,
  parent,
}: {
  flag: NotesTarget;
  folderId: number;
  parent: number;
}): Promise<void> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson(folderV1Path(normalized, folderId), 'PUT', {
    parent,
  });
  assertWriteOk(res);
}

async function deleteFolderV1({
  flag,
  folderId,
  recursive,
}: {
  flag: NotesTarget;
  folderId: number;
  recursive: boolean;
}): Promise<void> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson(
    `${folderV1Path(normalized, folderId)}?recursive=${recursive ? 'true' : 'false'}`,
    'DELETE'
  );
  assertWriteOk(res);
}

// --- member helpers --------------------------------------------------------

async function listMembersV1(
  target: NotesTarget
): Promise<NotesV1MemberRecord[]> {
  const flag = normalizeNotesTarget(target);
  const res = await requestJson(membersV1Path(flag), 'GET');
  return requireArray(res, normalizeMemberV1);
}

export type NotesV1Api = {
  listNotebooks: typeof listNotebooksV1;
  getNotebook: typeof getNotebookV1;
  createNotebook: typeof createNotebookV1;
  createGroupNotebook: typeof createGroupNotebookV1;
  listNotes: typeof listNotesV1;
  getNote: typeof getNoteV1;
  createNote: typeof createNoteV1;
  updateNoteBody: typeof updateNoteBodyV1;
  renameNote: typeof renameNoteV1;
  moveNote: typeof moveNoteV1;
  deleteNote: typeof deleteNoteV1;
  listNoteHistory: typeof listNoteHistoryV1;
  listFolders: typeof listFoldersV1;
  getFolder: typeof getFolderV1;
  createFolder: typeof createFolderV1;
  renameFolder: typeof renameFolderV1;
  moveFolder: typeof moveFolderV1;
  deleteFolder: typeof deleteFolderV1;
  listMembers: typeof listMembersV1;
};

export const notesV1: NotesV1Api = {
  listNotebooks: listNotebooksV1,
  getNotebook: getNotebookV1,
  createNotebook: createNotebookV1,
  createGroupNotebook: createGroupNotebookV1,
  listNotes: listNotesV1,
  getNote: getNoteV1,
  createNote: createNoteV1,
  updateNoteBody: updateNoteBodyV1,
  renameNote: renameNoteV1,
  moveNote: moveNoteV1,
  deleteNote: deleteNoteV1,
  listNoteHistory: listNoteHistoryV1,
  listFolders: listFoldersV1,
  getFolder: getFolderV1,
  createFolder: createFolderV1,
  renameFolder: renameFolderV1,
  moveFolder: moveFolderV1,
  deleteFolder: deleteFolderV1,
  listMembers: listMembersV1,
};
