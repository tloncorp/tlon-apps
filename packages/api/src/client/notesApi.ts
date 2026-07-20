import { createDevLogger } from '../lib/logger';
import type * as models from '../types/models';
import { formatUd } from './apiUtils';
import {
  poke,
  requestJson,
  scry,
  subscribe,
  subscribeOnce,
  unsubscribe,
} from './urbit';

const logger = createDevLogger('notesApi', false);

// ===========================================================================
// Notes identifiers and %notes transport helpers
//
// `notes` below is the app-facing notebook/folder/note/member data API backed
// by v1 HTTP routes. The helpers in this section cover operations that are
// still exposed as %notes actions or subscriptions rather than v1 HTTP routes:
// join/leave, notebook delete, and notebook stream events.
// ===========================================================================

export type NotesVisibility = models.NotesVisibility;
export type NotesRole = models.NotesRole;
export type NotesNotebook = models.NotesNotebook;
export type NotesNotebookDetail = models.NotesNotebookDetail;
export type NotesFolder = models.NotesFolder;
export type NotesNote = models.NotesNote;
export type NotesMember = models.NotesMember;
export type NotesNoteRevision = models.NotesNoteRevision;

export interface NotesPublishedRecord {
  host: string;
  flagName: string;
  noteId: number;
}

export interface NotesFlag {
  host: string;
  name: string;
}

export type NotesTarget = NotesFlag | string;

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

type NotesNoteAction =
  | { type: 'publish'; html: string }
  | { type: 'unpublish' };

type NotesNotebookAction =
  | { type: 'delete' }
  | { type: 'note'; id: number; action: NotesNoteAction };
type NotesJoinAction = { type: 'join'; ship: string; name: string };
type NotesLeaveAction = { type: 'leave'; ship: string; name: string };

type NotesNotebookScopedAction = {
  type: 'notebook';
  flag: string;
  action: NotesNotebookAction;
};

type NotesAction =
  | NotesJoinAction
  | NotesLeaveAction
  | NotesNotebookScopedAction;

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
  const [app, host, name, ...extra] = channelId.split('/');
  return app === 'notes' && host && name && extra.length === 0
    ? { host, name }
    : null;
}

export function notesChannelId(flag: NotesFlag | string): string {
  return `notes/${formatNotesFlag(flag)}`;
}

/**
 * Preview payload from the %notes /v0/said single-shot subscription
 * (mark %notes-said-1). A %notes-denied answer arrives as a null fact.
 */
export interface NotesSaidPreview {
  host: string;
  flagName: string;
  id: number;
  title: string;
  snippet: string;
  author: string;
  updatedAt: number;
  notebookTitle: string;
}

export async function getNoteReference({
  channelId,
  noteId,
}: {
  channelId: string;
  noteId: string;
}): Promise<NotesSaidPreview | null> {
  const flag = parseNotesChannelId(channelId);
  if (!flag) {
    throw new Error(`invalid notes channel id: ${channelId}`);
  }
  const data = await subscribeOnce<NotesSaidPreview | null>(
    {
      app: 'notes',
      // the agent parses the id with +slav %ud, so dot-group it (1.234)
      path: `/v0/said/${flag.host}/${flag.name}/note/${formatUd(noteId)}`,
    },
    3000,
    undefined,
    { tag: 'getNoteReference' }
  );
  return data ?? null;
}

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

async function notesAction(action: NotesAction) {
  return poke({
    app: 'notes',
    mark: 'notes-action',
    json: action,
  });
}

function notebookAction(target: NotesTarget, action: NotesNotebookAction) {
  return notesAction({
    type: 'notebook',
    flag: formatNotesFlag(normalizeNotesTarget(target)),
    action,
  });
}

export async function joinNotesNotebook(target: NotesTarget) {
  const flag = normalizeNotesTarget(target);
  return notesAction({
    type: 'join',
    ship: flag.host,
    name: flag.name,
  });
}

// Notes-backed group channels must join/leave through %notes, not %channels,
// because %channels rejects the unknown `notes/...` nest.
export const joinNotesChannel = async (channelId: string) => {
  const flag = parseNotesChannelId(channelId);
  if (!flag) {
    return;
  }
  await joinNotesNotebook(flag);
};

export const leaveNotesChannel = async (channelId: string) => {
  const flag = parseNotesChannelId(channelId);
  if (!flag) {
    return;
  }
  await notesAction({
    type: 'leave',
    ship: flag.host,
    name: flag.name,
  });
};

export async function subscribeToNotesNotebook(
  target: NotesTarget,
  handler: (event: NotesStreamEvent) => void
) {
  const flag = normalizeNotesTarget(target);
  return subscribe<NotesStreamEvent>(
    {
      app: 'notes',
      path: `/v0/notes/${flag.host}/${flag.name}/stream`,
    },
    handler
  );
}

export async function unsubscribeFromNotesNotebook(subscriptionId: number) {
  return unsubscribe(subscriptionId);
}

function deleteNotesNotebook(flag: NotesFlag) {
  return notebookAction(flag, { type: 'delete' });
}

export async function deleteNotesNotebookStrict(target: NotesTarget) {
  return deleteNotesNotebook(normalizeNotesTarget(target));
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
// Protocol-facing v1 surface used by tlon-skill and wrapped by the app-facing
// `notes` facade below. Centralizes path construction, request payloads,
// canonical response shapes, and envelope handling so callers pass typed
// operation arguments instead of string-built paths.
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

export type NotesV1RequestBody =
  | { type: 'ok' }
  | { type: 'no-change' }
  | { type: 'notebook'; notebook: NotesV1NotebookSummary }
  | { type: 'error'; message?: string }
  | { type: 'pending'; status?: string }
  | { type: 'api-key' };

export interface NotesV1RequestStatus {
  requestId: string;
  body: NotesV1RequestBody;
}

export type NotesV1PendingWriteCheck =
  | { type: 'notebook-list' }
  | { type: 'notebook-detail' }
  | { type: 'note-list'; nest: string }
  | { type: 'note-detail'; nest: string; noteId?: number }
  | { type: 'folder-list'; nest: string }
  | { type: 'folder-detail'; nest: string; folderId?: number };

export interface NotesV1PendingWriteErrorOptions {
  requestId?: string;
  status?: string;
  checks?: NotesV1PendingWriteCheck[];
}

export class NotesV1PendingWriteError extends Error {
  readonly requestId?: string;
  readonly status?: string;
  readonly checks: NotesV1PendingWriteCheck[];

  constructor({
    requestId,
    status,
    checks = [],
  }: NotesV1PendingWriteErrorOptions = {}) {
    super('%notes write request is still pending');
    this.name = 'NotesV1PendingWriteError';
    this.requestId = requestId;
    this.status = status;
    this.checks = [...checks];
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const NOTEBOOKS_V1_PATH = '/notes/~/v1/notebooks';
const REQUESTS_V1_PATH = '/notes/~/v1/request';

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

function reqString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
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

function normalizePublishedRecord(raw: any): NotesPublishedRecord {
  const noteId = req(raw.noteId, 'published.noteId');
  if (typeof noteId !== 'number') {
    throw new Error('%notes published record is missing noteId');
  }
  return {
    host: reqString(raw.host, 'published.host'),
    flagName: reqString(raw.flagName, 'published.flagName'),
    noteId,
  };
}

function maybe<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

function notesFolderId(flag: string, folderId: number) {
  return `${flag}/folder/${folderId}`;
}

function notesNoteId(flag: string, noteId: number) {
  return `${flag}/note/${noteId}`;
}

export function toClientNotesNotebook(
  summary: NotesV1NotebookSummary
): NotesNotebook {
  const flag = formatNotesFlag({
    host: summary.host,
    name: summary.flagName,
  });
  return {
    id: flag,
    host: summary.host,
    flagName: summary.flagName,
    notebookId: summary.notebook.id,
    title: summary.notebook.title,
    visibility: maybe(summary.visibility),
    rootFolderId: maybe(summary.notebook.rootFolderId),
    createdBy: maybe(summary.notebook.createdBy),
    createdAt: maybe(summary.notebook.createdAt),
    updatedBy: maybe(summary.notebook.updatedBy),
    updatedAt: maybe(summary.notebook.updatedAt),
  };
}

export function toClientNotesNotebookDetail(
  summary: NotesV1NotebookDetailSummary
): NotesNotebookDetail {
  return {
    ...toClientNotesNotebook(summary),
    rootFolderId: summary.notebook.rootFolderId,
  };
}

export function toClientNotesFolder(
  target: NotesTarget,
  folder: NotesV1Folder
): NotesFolder {
  const flag = formatNotesFlag(normalizeNotesTarget(target));
  return {
    id: notesFolderId(flag, folder.id),
    notebookFlag: flag,
    folderId: folder.id,
    notebookId: maybe(folder.notebookId),
    name: folder.name,
    parentFolderId: folder.parentFolderId,
    createdBy: maybe(folder.createdBy),
    createdAt: maybe(folder.createdAt),
    updatedBy: maybe(folder.updatedBy),
    updatedAt: maybe(folder.updatedAt),
  };
}

export function toClientNotesNote(
  target: NotesTarget,
  note: NotesV1Note
): NotesNote {
  const flag = formatNotesFlag(normalizeNotesTarget(target));
  return {
    id: notesNoteId(flag, note.id),
    notebookFlag: flag,
    noteId: note.id,
    notebookId: note.notebookId,
    folderId: note.folderId,
    title: note.title,
    slug: note.slug,
    bodyMd: note.bodyMd,
    createdBy: note.createdBy,
    createdAt: note.createdAt,
    updatedBy: note.updatedBy,
    updatedAt: note.updatedAt,
    revision: note.revision,
  };
}

export function toClientNotesMembers(
  target: NotesTarget,
  member: NotesV1MemberRecord
): NotesMember[] {
  const flag = formatNotesFlag(normalizeNotesTarget(target));
  const roles = member.roles.length > 0 ? member.roles : [null];
  return roles.map((role) => ({
    notebookFlag: flag,
    contactId: member.ship,
    role,
  }));
}

export function toClientNotesNoteRevision(
  revision: NotesV1NoteRevision
): NotesNoteRevision {
  return {
    revision: maybe(revision.revision),
    editedAt: maybe(revision.editedAt),
    author: maybe(revision.author),
    bodyMd: maybe(revision.bodyMd),
  };
}

function normalizeRequestBodyV1(raw: any): NotesV1RequestBody {
  const body = requireObject(raw);
  switch (body.type) {
    case 'ok':
      return { type: 'ok' };
    case 'no-change':
      return { type: 'no-change' };
    case 'notebook':
      return {
        type: 'notebook',
        notebook: normalizeNotebookSummaryV1(requireObject(body.notebook)),
      };
    case 'error': {
      const message =
        body.message === undefined || body.message === null
          ? undefined
          : String(body.message);
      return { type: 'error', message };
    }
    case 'pending':
      return {
        type: 'pending',
        status: typeof body.status === 'string' ? body.status : undefined,
      };
    case 'api-key':
      return { type: 'api-key' };
    default:
      throw new Error(`Unexpected %notes response type: ${body.type}`);
  }
}

function normalizeRequestStatusV1(raw: unknown): NotesV1RequestStatus {
  const res = requireObject(raw);
  return {
    requestId: reqString(res.requestId, 'requestId'),
    body: normalizeRequestBodyV1(req(res.body, 'body')),
  };
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

function envelopeRequestId(res: any): string | undefined {
  const requestId = res?.requestId;
  return typeof requestId === 'string' && requestId.trim()
    ? requestId.trim()
    : undefined;
}

function envelopePendingStatus(res: any): string | undefined {
  const status = res?.body?.status;
  return typeof status === 'string' ? status : undefined;
}

function pendingWriteError(
  res: any,
  checks: NotesV1PendingWriteCheck[]
): NotesV1PendingWriteError {
  return new NotesV1PendingWriteError({
    requestId: envelopeRequestId(res),
    status: envelopePendingStatus(res),
    checks,
  });
}

function notebookWriteChecks(): NotesV1PendingWriteCheck[] {
  return [{ type: 'notebook-list' }, { type: 'notebook-detail' }];
}

function noteCreateChecks(nest: string): NotesV1PendingWriteCheck[] {
  return [
    { type: 'note-list', nest },
    { type: 'note-detail', nest },
  ];
}

function noteChecks(nest: string, noteId: number): NotesV1PendingWriteCheck[] {
  return [{ type: 'note-detail', nest, noteId }];
}

function folderCreateChecks(nest: string): NotesV1PendingWriteCheck[] {
  return [
    { type: 'folder-list', nest },
    { type: 'folder-detail', nest },
  ];
}

function folderChecks(
  nest: string,
  folderId: number
): NotesV1PendingWriteCheck[] {
  return [{ type: 'folder-detail', nest, folderId }];
}

// A *present* envelope body uses the strict whitelist; error/pending/unexpected
// always throw. `createNotebook`/`createGroupNotebook` require a `notebook`
// body and return its normalized summary.
function unwrapNotebookEnvelope(
  res: any,
  checks: NotesV1PendingWriteCheck[]
): NotesV1NotebookSummary {
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
      throw pendingWriteError(res, checks);
    default:
      throw new Error(`Unexpected %notes response type: ${body.type}`);
  }
}

// Void writes: a *present* envelope body must be ok/no-change/notebook (else
// error/pending/unexpected throw). A bare/empty non-envelope JSON body (e.g. a
// folder object from a convenience route) is accepted and ignored —
// `requestJson` already throws on HTTP failure.
function assertWriteOk(res: any, checks: NotesV1PendingWriteCheck[]): void {
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
      throw pendingWriteError(res, checks);
    default:
      throw new Error(`Unexpected %notes response type: ${body.type}`);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function getRequestV1(requestId: string): Promise<NotesV1RequestStatus> {
  const encoded = encodeURIComponent(requestId);
  const res = await requestJson(`${REQUESTS_V1_PATH}/${encoded}`, 'GET');
  return normalizeRequestStatusV1(res);
}

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
  return unwrapNotebookEnvelope(res, notebookWriteChecks());
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
  return unwrapNotebookEnvelope(res, notebookWriteChecks());
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
  assertWriteOk(res, noteCreateChecks(notesChannelId(normalized)));
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
  assertWriteOk(res, noteChecks(notesChannelId(normalized), noteId));
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
  assertWriteOk(res, noteChecks(notesChannelId(normalized), noteId));
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
  assertWriteOk(res, noteChecks(notesChannelId(normalized), noteId));
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
  assertWriteOk(res, noteChecks(notesChannelId(normalized), noteId));
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
  assertWriteOk(res, folderCreateChecks(notesChannelId(normalized)));
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
  assertWriteOk(res, folderChecks(notesChannelId(normalized), folderId));
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
  assertWriteOk(res, folderChecks(notesChannelId(normalized), folderId));
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
  assertWriteOk(res, folderChecks(notesChannelId(normalized), folderId));
}

// --- member helpers --------------------------------------------------------

async function listMembersV1(
  target: NotesTarget
): Promise<NotesV1MemberRecord[]> {
  const flag = normalizeNotesTarget(target);
  const res = await requestJson(membersV1Path(flag), 'GET');
  return requireArray(res, normalizeMemberV1);
}

async function listNotebooks(): Promise<NotesNotebook[]> {
  const summaries = await listNotebooksV1();
  return summaries.map(toClientNotesNotebook);
}

async function getNotebook(target: NotesTarget): Promise<NotesNotebookDetail> {
  const summary = await getNotebookV1(target);
  return toClientNotesNotebookDetail(summary);
}

async function createNotebook(input: {
  title: string;
}): Promise<NotesNotebook> {
  const summary = await createNotebookV1(input);
  return toClientNotesNotebook(summary);
}

async function createGroupNotebook(input: {
  title: string;
  group: NotesV1GroupRef;
  readers?: string[];
}): Promise<NotesNotebook> {
  const summary = await createGroupNotebookV1(input);
  return toClientNotesNotebook(summary);
}

async function listNotes(target: NotesTarget): Promise<NotesNote[]> {
  const rawNotes = await listNotesV1(target);
  return rawNotes.map((note) => toClientNotesNote(target, note));
}

async function getNote({
  flag,
  noteId,
}: {
  flag: NotesTarget;
  noteId: number;
}): Promise<NotesNote> {
  const rawNote = await getNoteV1({ flag, noteId });
  return toClientNotesNote(flag, rawNote);
}

async function listNoteHistory(input: {
  flag: NotesTarget;
  noteId: number;
}): Promise<NotesNoteRevision[]> {
  const revisions = await listNoteHistoryV1(input);
  return revisions.map(toClientNotesNoteRevision);
}

async function listFolders(target: NotesTarget): Promise<NotesFolder[]> {
  const rawFolders = await listFoldersV1(target);
  return rawFolders.map((folder) => toClientNotesFolder(target, folder));
}

async function getFolder({
  flag,
  folderId,
}: {
  flag: NotesTarget;
  folderId: number;
}): Promise<NotesFolder> {
  const rawFolder = await getFolderV1({ flag, folderId });
  return toClientNotesFolder(flag, rawFolder);
}

async function listMembers(target: NotesTarget): Promise<NotesMember[]> {
  const rawMembers = await listMembersV1(target);
  return rawMembers.flatMap((member) => toClientNotesMembers(target, member));
}

async function listPublished(): Promise<NotesPublishedRecord[]> {
  const rawPublished = await scry({
    app: 'notes',
    path: '/v0/published',
  });
  return requireArray(rawPublished, normalizePublishedRecord);
}

async function publishNote({
  flag,
  noteId,
  html,
}: {
  flag: NotesTarget;
  noteId: number;
  html: string;
}) {
  return notebookAction(flag, {
    type: 'note',
    id: noteId,
    action: { type: 'publish', html },
  });
}

async function unpublishNote({
  flag,
  noteId,
}: {
  flag: NotesTarget;
  noteId: number;
}) {
  return notebookAction(flag, {
    type: 'note',
    id: noteId,
    action: { type: 'unpublish' },
  });
}

export type NotesV1Api = {
  getRequest: typeof getRequestV1;
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

export type NotesApi = {
  getRequest: typeof getRequestV1;
  listNotebooks: typeof listNotebooks;
  getNotebook: typeof getNotebook;
  createNotebook: typeof createNotebook;
  createGroupNotebook: typeof createGroupNotebook;
  listNotes: typeof listNotes;
  getNote: typeof getNote;
  createNote: typeof createNoteV1;
  updateNoteBody: typeof updateNoteBodyV1;
  renameNote: typeof renameNoteV1;
  moveNote: typeof moveNoteV1;
  deleteNote: typeof deleteNoteV1;
  listNoteHistory: typeof listNoteHistory;
  listFolders: typeof listFolders;
  getFolder: typeof getFolder;
  createFolder: typeof createFolderV1;
  renameFolder: typeof renameFolderV1;
  moveFolder: typeof moveFolderV1;
  deleteFolder: typeof deleteFolderV1;
  listMembers: typeof listMembers;
  listPublished: typeof listPublished;
  publishNote: typeof publishNote;
  unpublishNote: typeof unpublishNote;
};

export const notesV1: NotesV1Api = {
  getRequest: getRequestV1,
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

export const notes: NotesApi = {
  getRequest: getRequestV1,
  listNotebooks,
  getNotebook,
  createNotebook,
  createGroupNotebook,
  listNotes,
  getNote,
  createNote: createNoteV1,
  updateNoteBody: updateNoteBodyV1,
  renameNote: renameNoteV1,
  moveNote: moveNoteV1,
  deleteNote: deleteNoteV1,
  listNoteHistory,
  listFolders,
  getFolder,
  createFolder: createFolderV1,
  renameFolder: renameFolderV1,
  moveFolder: moveFolderV1,
  deleteFolder: deleteFolderV1,
  listMembers,
  listPublished,
  publishNote,
  unpublishNote,
};
