import { render, tryParse, valid } from '@urbit/aura';
import { z } from 'zod';

import { createDevLogger } from '../lib/logger';
import type * as models from '../types/models';
import { formatUd } from './apiUtils';
import {
  type RequestJsonOptions,
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

export interface NotesFlag {
  host: string;
  name: string;
}

export type NotesTarget = NotesFlag | string;

/**
 * Per-notebook stream event. The agent sends one `snapshot` at subscribe
 * time, then an `update` for every subsequent change. `update` carries the
 * parsed `u-notebook` payload, or null when the payload is a variant this
 * client doesn't model — a null `update` means "something changed, but you
 * must resync to learn what".
 */
export type NotesStreamEvent =
  | { type: 'snapshot'; host: string; flagName: string }
  | {
      type: 'update';
      host: string;
      flagName: string;
      time?: number;
      update: NotesUpdate | null;
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
 * (mark %notes-said). %notes-denied (no read access) and %notes-error
 * (missing note, host failure) both arrive as null facts.
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
  return subscribe<Record<string, unknown>>(
    {
      app: 'notes',
      path: `/v0/notes/${flag.host}/${flag.name}/stream`,
    },
    (raw) => {
      const event = parseNotesStreamEvent(raw);
      if (event) {
        handler(event);
      }
    }
  );
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function parseNotesStreamEvent(raw: any): NotesStreamEvent | null {
  const host = raw?.host;
  const flagName = raw?.flagName;
  if (typeof host !== 'string' || typeof flagName !== 'string') {
    logger.error('Dropping malformed %notes stream event', raw);
    return null;
  }
  if (raw.type === 'snapshot') {
    return { type: 'snapshot', host, flagName };
  }
  if (raw.type === 'update') {
    return {
      type: 'update',
      host,
      flagName,
      time: typeof raw.time === 'number' ? raw.time : undefined,
      update: parseNotesUpdate(raw.update),
    };
  }
  logger.error('Dropping unknown %notes stream event type', raw?.type);
  return null;
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

const nullableOptionalStringSchema = z
  .string()
  .nullish()
  .transform((value) => value ?? undefined);
const nullableOptionalNumberSchema = z
  .number()
  .nullish()
  .transform((value) => value ?? undefined);

const notesVisibilitySchema = z.enum(['public', 'private']);
const notesRoleSchema = z.enum(['owner', 'editor', 'viewer']);
const notesPublishedRecordSchema = z.object({
  host: z.string().refine((value) => value.trim().length > 0),
  flagName: z.string().refine((value) => value.trim().length > 0),
  noteId: z.number(),
});
const notesAuditFields = {
  createdBy: nullableOptionalStringSchema,
  createdAt: nullableOptionalNumberSchema,
  updatedBy: nullableOptionalStringSchema,
  updatedAt: nullableOptionalNumberSchema,
};

const notesV1NotebookListItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  rootFolderId: nullableOptionalNumberSchema,
  ...notesAuditFields,
});

const notesV1NotebookDetailSchema = notesV1NotebookListItemSchema.extend({
  rootFolderId: z.number(),
});

const notesV1NotebookSummarySchema = z.object({
  host: z.string(),
  flagName: z.string(),
  notebook: notesV1NotebookListItemSchema,
  visibility: notesVisibilitySchema
    .nullish()
    .transform((value) => value ?? undefined),
});

const notesV1NotebookDetailSummarySchema = notesV1NotebookSummarySchema.extend({
  notebook: notesV1NotebookDetailSchema,
});

const notesV1FolderSchema = z
  .object({
    id: z.number(),
    notebookId: nullableOptionalNumberSchema,
    name: z.string().optional(),
    folderName: z.string().optional(),
    parentFolderId: nullableOptionalNumberSchema,
    parent: nullableOptionalNumberSchema,
    ...notesAuditFields,
  })
  .refine(
    (folder) => folder.name !== undefined || folder.folderName !== undefined,
    {
      message: 'Required',
      path: ['name'],
    }
  )
  .transform(({ folderName, parent, ...folder }) => ({
    ...folder,
    name: folder.name ?? folderName!,
    parentFolderId: folder.parentFolderId ?? parent ?? null,
  }));

const notesV1NoteSchema = z
  .object({
    id: z.number(),
    notebookId: nullableOptionalNumberSchema,
    folderId: nullableOptionalNumberSchema,
    folder: nullableOptionalNumberSchema,
    title: z.string(),
    slug: z.string().nullable().optional(),
    bodyMd: nullableOptionalStringSchema,
    revision: nullableOptionalNumberSchema,
    ...notesAuditFields,
  })
  .transform(({ folder, ...note }) => ({
    ...note,
    folderId: note.folderId ?? folder,
  }));

// `last` is the last note examined, not the last match; zero means exhausted.
const notesV1SearchPageSchema = z.object({
  last: z.number(),
  notes: z.array(notesV1NoteSchema),
});

const notesV1NoteRevisionSchema = z
  .object({
    revision: nullableOptionalNumberSchema,
    rev: nullableOptionalNumberSchema,
    editedAt: nullableOptionalNumberSchema,
    at: nullableOptionalNumberSchema,
    author: nullableOptionalStringSchema,
    by: nullableOptionalStringSchema,
    bodyMd: nullableOptionalStringSchema,
  })
  .transform(({ rev, at, by, ...revision }) => ({
    ...revision,
    revision: revision.revision ?? rev,
    editedAt: revision.editedAt ?? at,
    author: revision.author ?? by,
  }));

const notesV1MemberSchema = z
  .object({
    ship: z.string(),
    role: notesRoleSchema.optional(),
    roles: z.array(notesRoleSchema).optional(),
  })
  .transform(({ ship, role, roles }) => ({
    ship,
    roles: roles ?? (role ? [role] : []),
  }));

export type NotesV1NotebookListItem = z.infer<
  typeof notesV1NotebookListItemSchema
>;
export type NotesV1NotebookDetail = z.infer<typeof notesV1NotebookDetailSchema>;
export type NotesV1NotebookSummary = z.infer<
  typeof notesV1NotebookSummarySchema
>;
export type NotesV1NotebookDetailSummary = z.infer<
  typeof notesV1NotebookDetailSummarySchema
>;
export type NotesV1Folder = z.infer<typeof notesV1FolderSchema>;
export type NotesV1Note = z.infer<typeof notesV1NoteSchema>;
export type NotesV1NoteRevision = z.infer<typeof notesV1NoteRevisionSchema>;
export type NotesPublishedRecord = z.infer<typeof notesPublishedRecordSchema>;
export type NotesV1SearchPage = z.infer<typeof notesV1SearchPageSchema>;

export interface NotesSearchPage {
  last: number;
  notes: NotesNote[];
}

export type NotesV1MemberRecord = z.infer<typeof notesV1MemberSchema>;

export interface NotesV1GroupRef {
  host: string;
  flagName: string;
}

export type NotesV1RequestBody =
  | { type: 'ok' }
  | { type: 'no-change' }
  | { type: 'notebook'; notebook: NotesV1NotebookSummary }
  | { type: 'error'; message?: string; errorType?: string }
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

// Typed failure from the %notes action-error union ('conflict',
// 'not-authorized', 'not-found', ...). `errorType` mirrors the wire's
// `errorType` field; 'conflict' on a note update means the expectedRevision
// was stale (optimistic-concurrency check failed on the host).
export class NotesV1WriteError extends Error {
  readonly errorType?: string;

  constructor(message: string, errorType?: string) {
    super(message);
    this.name = 'NotesV1WriteError';
    this.errorType = errorType;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isNotesV1ConflictError(
  error: unknown
): error is NotesV1WriteError {
  return error instanceof NotesV1WriteError && error.errorType === 'conflict';
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

const NOTES_V1_PATH = '/notes/~/v1';
const NOTEBOOKS_V1_PATH = '/notes/~/v1/notebooks';
const REQUESTS_V1_PATH = '/notes/~/v1/request';
const NOTES_AUTH_FAILURE_STATUSES = [401, 403] as const;

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

// Search params ride in the query string rather than the path: the URL parser
// splits a trailing dot-group off the last path segment as a file extension,
// which would search a truncated needle. encodeURIComponent's escapes (and its
// unreserved set) are exactly what the backend's query parser accepts.
function searchV1Path(
  flag: NotesFlag,
  { needle, from, tries }: { needle: string; from?: number; tries?: number }
): string {
  const params = [`needle=${encodeURIComponent(needle)}`];
  if (from !== undefined) {
    params.push(`from=${from}`);
  }
  if (tries !== undefined) {
    params.push(`tries=${tries}`);
  }
  return `${notebookV1Path(flag)}/search/bounded/text?${params.join('&')}`;
}

// --- response normalization ------------------------------------------------

function parseNotesResponse<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown,
  label?: string
): z.output<T> {
  const result = schema.safeParse(raw);
  if (result.success) {
    return result.data;
  }
  const issue = result.error.issues[0];
  const path = [label, ...issue.path]
    .filter((segment) => segment !== undefined && segment !== '')
    .join('.');
  throw new Error(
    `Unexpected %notes response${path ? ` at ${path}` : ''}: ${issue.message}`
  );
}

function parseNotesResponseList<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown,
  label?: string
): z.output<T>[] {
  if (!Array.isArray(raw)) {
    throw new Error('Unexpected %notes response: expected an array');
  }
  return raw.map((item) => parseNotesResponse(schema, item, label));
}

function normalizeNotebookSummaryV1(raw: unknown): NotesV1NotebookSummary {
  return parseNotesResponse(notesV1NotebookSummarySchema, raw);
}

function normalizeNotebookDetailSummaryV1(
  raw: unknown
): NotesV1NotebookDetailSummary {
  return parseNotesResponse(notesV1NotebookDetailSummarySchema, raw);
}

function normalizeFolderV1(raw: unknown): NotesV1Folder {
  return parseNotesResponse(notesV1FolderSchema, raw, 'folder');
}

function normalizeNoteV1(raw: unknown): NotesV1Note {
  return parseNotesResponse(notesV1NoteSchema, raw, 'note');
}

function normalizeSearchPageV1(raw: unknown): NotesV1SearchPage {
  return parseNotesResponse(notesV1SearchPageSchema, raw, 'search');
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

const okEnvelopeBodySchema = z.object({
  type: z.literal('ok'),
  response: z.unknown().optional(),
});
const noChangeEnvelopeBodySchema = z.object({
  type: z.literal('no-change'),
});
const notebookEnvelopeBodySchema = z.object({
  type: z.literal('notebook'),
  notebook: z.unknown(),
});
const errorEnvelopeBodySchema = z.object({
  type: z.literal('error'),
  message: z.unknown().optional(),
  errorType: z.string().optional(),
});
const pendingEnvelopeBodySchema = z.object({
  type: z.literal('pending'),
  status: z.string().optional(),
});
const envelopeBodySchema = z.discriminatedUnion('type', [
  okEnvelopeBodySchema,
  noChangeEnvelopeBodySchema,
  notebookEnvelopeBodySchema,
  errorEnvelopeBodySchema,
  pendingEnvelopeBodySchema,
  z.object({ type: z.literal('api-key') }),
]);
const envelopeSchema = z.object({
  requestId: z.string().trim().min(1).optional(),
  body: envelopeBodySchema,
});
const noteWriteResponseSchema = z.object({
  host: z.string(),
  flagName: z.string(),
  update: z.object({
    type: z.literal('note-update'),
    host: z.string(),
    flagName: z.string(),
    noteUpdate: z.object({
      type: z.enum(['note-created', 'note-updated']),
      id: z.number(),
      note: notesV1NoteSchema,
    }),
  }),
});

type NotesEnvelope = z.infer<typeof envelopeSchema>;

function parseEnvelope(raw: unknown): NotesEnvelope {
  return parseNotesResponse(envelopeSchema, raw);
}

function normalizeRequestBodyV1(
  body: NotesEnvelope['body']
): NotesV1RequestBody {
  switch (body.type) {
    case 'ok':
      return { type: 'ok' };
    case 'no-change':
      return { type: 'no-change' };
    case 'notebook':
      return {
        type: 'notebook',
        notebook: normalizeNotebookSummaryV1(body.notebook),
      };
    case 'error': {
      const message =
        body.message === undefined || body.message === null
          ? undefined
          : errorMessageText(body.message);
      return {
        type: 'error',
        message,
        errorType:
          typeof body.errorType === 'string' ? body.errorType : undefined,
      };
    }
    case 'pending':
      return {
        type: 'pending',
        status: typeof body.status === 'string' ? body.status : undefined,
      };
    case 'api-key':
      return { type: 'api-key' };
  }
}

function normalizeRequestStatusV1(raw: unknown): NotesV1RequestStatus {
  const res = parseEnvelope(raw);
  if (!res.requestId) {
    throw new Error('Unexpected %notes response at requestId: Required');
  }
  return {
    requestId: res.requestId,
    body: normalizeRequestBodyV1(res.body),
  };
}

// --- envelope handling -----------------------------------------------------

// The wire's `message` is a rendered tang: an array of lines. Older
// responses may carry a plain string.
function errorMessageText(raw: unknown): string {
  if (typeof raw === 'string') {
    return raw.trim();
  }
  if (Array.isArray(raw)) {
    return raw.map(String).join('\n').trim();
  }
  return raw === undefined || raw === null ? '' : String(raw).trim();
}

function notesEnvelopeErrorMessage(
  body: z.infer<typeof errorEnvelopeBodySchema>
): string {
  const message = errorMessageText(body.message);
  const errorType =
    typeof body.errorType === 'string' ? body.errorType.trim() : '';
  const detail = message || errorType;
  return `%notes error: ${detail || 'backend returned an error without details'}`;
}

function notesEnvelopeError(
  body: z.infer<typeof errorEnvelopeBodySchema>
): NotesV1WriteError {
  return new NotesV1WriteError(
    notesEnvelopeErrorMessage(body),
    typeof body.errorType === 'string' ? body.errorType : undefined
  );
}

function pendingWriteError(
  requestId: string | undefined,
  body: z.infer<typeof pendingEnvelopeBodySchema>,
  checks: NotesV1PendingWriteCheck[]
): NotesV1PendingWriteError {
  return new NotesV1PendingWriteError({
    requestId,
    status: body.status,
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
  res: unknown,
  checks: NotesV1PendingWriteCheck[]
): NotesV1NotebookSummary {
  const envelope = parseEnvelope(res);
  const { body } = envelope;
  switch (body.type) {
    case 'notebook':
      return normalizeNotebookSummaryV1(body.notebook);
    case 'error':
      throw notesEnvelopeError(body);
    case 'pending':
      throw pendingWriteError(envelope.requestId, body, checks);
    default:
      throw new Error(`Unexpected %notes response type: ${body.type}`);
  }
}

// Void writes: in the current backend every v1 write response is an envelope
// whose `body` carries a string `type`. `response:v1:enjs`
// (desk/lib/notes/json.hoon) emits one for all six variants, and every write —
// the envelope POST (`handle-v1-post`) and the REST convenience routes
// (`handle-v1-write`) — funnels through `dispatch-v1-action` →
// `finalize-request`/`finalize-pending` → `give-http-response`
// (desk/app/notes.hoon). A missing or typeless body is therefore a protocol
// violation, not a shape to tolerate. ok/no-change/notebook succeed;
// everything else throws. `requestJson` has already rejected any non-200.
function assertWriteOk(
  res: unknown,
  checks: NotesV1PendingWriteCheck[]
): NotesEnvelope {
  const envelope = parseEnvelope(res);
  const { body } = envelope;
  const { type } = body;
  switch (type) {
    case 'ok':
    case 'no-change':
    case 'notebook':
      return envelope;
    case 'error':
      throw notesEnvelopeError(body);
    case 'pending':
      throw pendingWriteError(envelope.requestId, body, checks);
    case 'api-key':
      throw new Error(`Unexpected %notes response type: ${type}`);
  }
}
async function getRequestV1(requestId: string): Promise<NotesV1RequestStatus> {
  const encoded = encodeURIComponent(requestId);
  const res = await requestJson<unknown>(
    `${REQUESTS_V1_PATH}/${encoded}`,
    'GET'
  );
  return normalizeRequestStatusV1(res);
}

// --- notebook helpers ------------------------------------------------------

async function listNotebooksV1(): Promise<NotesV1NotebookSummary[]> {
  const res = await requestJson<unknown>(NOTEBOOKS_V1_PATH, 'GET');
  return parseNotesResponseList(notesV1NotebookSummarySchema, res);
}

async function getNotebookV1(
  target: NotesTarget
): Promise<NotesV1NotebookDetailSummary> {
  const flag = normalizeNotesTarget(target);
  const res = await requestJson<unknown>(notebookV1Path(flag), 'GET');
  return normalizeNotebookDetailSummaryV1(res);
}

async function createNotebookV1({
  title,
}: {
  title: string;
}): Promise<NotesV1NotebookSummary> {
  const res = await requestJson<unknown>(NOTEBOOKS_V1_PATH, 'POST', { title });
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
  const res = await requestJson<unknown>(NOTEBOOKS_V1_PATH, 'POST', {
    title,
    group,
    readers,
  });
  return unwrapNotebookEnvelope(res, notebookWriteChecks());
}

// --- note helpers ----------------------------------------------------------

async function listNotesV1(
  target: NotesTarget,
  options?: RequestJsonOptions
): Promise<NotesV1Note[]> {
  const flag = normalizeNotesTarget(target);
  const res = await requestJson<unknown>(
    notesV1Path(flag),
    'GET',
    undefined,
    options
  );
  return parseNotesResponseList(notesV1NoteSchema, res, 'note');
}

async function searchNotesV1({
  flag,
  needle,
  from,
  tries,
}: {
  flag: NotesTarget;
  needle: string;
  from?: number;
  tries?: number;
}): Promise<NotesV1SearchPage> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson<unknown>(
    searchV1Path(normalized, { needle, from, tries }),
    'GET'
  );
  return normalizeSearchPageV1(res);
}

async function getNoteV1({
  flag,
  noteId,
}: {
  flag: NotesTarget;
  noteId: number;
}): Promise<NotesV1Note> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson<unknown>(noteV1Path(normalized, noteId), 'GET');
  return normalizeNoteV1(res);
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
}): Promise<NotesV1Note | null> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson<unknown>(notesV1Path(normalized), 'POST', {
    folder,
    title,
    body,
  });
  const envelope = assertWriteOk(
    res,
    noteCreateChecks(notesChannelId(normalized))
  );
  return noteFromWriteEnvelope(envelope, normalized, 'note-created');
}

// ===========================================================================
// u-notebook updates
//
// The same payload reaches the client two ways: nested in a write's `%ok`
// envelope (`body.response.update`) as the update that write applied, and
// broadcast on the per-notebook stream (`RUpdate.update`) for every change,
// local or remote. Both carry the complete post-write entity — the host's
// authoritative revision and server-stamped updatedAt/updatedBy included —
// so a parsed update is enough to advance local state without reading back.
// See docs/notes/asyncapi.yaml for the wire schema.
// ===========================================================================

export type NotesUpdate =
  | { type: 'notebook-created'; notebook: NotesV1NotebookListItem }
  | { type: 'notebook-updated'; notebook: NotesV1NotebookListItem }
  | { type: 'notebook-deleted' }
  | { type: 'notebook-visibility-changed'; visibility: NotesVisibility }
  | { type: 'member-joined'; who: string; role: NotesRole }
  | { type: 'member-left'; who: string }
  | { type: 'folder-created'; folderId: number; folder: NotesV1Folder }
  | { type: 'folder-updated'; folderId: number; folder: NotesV1Folder }
  | { type: 'folder-deleted'; folderId: number }
  | { type: 'note-created'; noteId: number; note: NotesV1Note }
  | { type: 'note-updated'; noteId: number; note: NotesV1Note }
  | { type: 'note-deleted'; noteId: number }
  | { type: 'note-published'; noteId: number }
  | { type: 'note-unpublished'; noteId: number };

const uFolderSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('folder-created'),
    id: z.number(),
    folder: notesV1FolderSchema,
  }),
  z.object({
    type: z.literal('folder-updated'),
    id: z.number(),
    folder: notesV1FolderSchema,
  }),
  z.object({ type: z.literal('folder-deleted'), id: z.number() }),
]);

const uNoteSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('note-created'),
    id: z.number(),
    note: notesV1NoteSchema,
  }),
  z.object({
    type: z.literal('note-updated'),
    id: z.number(),
    note: notesV1NoteSchema,
  }),
  z.object({ type: z.literal('note-deleted'), id: z.number() }),
  // These also carry the rendered `html`, which no client-side consumer
  // stores — published state is tracked as a boolean.
  z.object({ type: z.literal('note-published'), id: z.number() }),
  z.object({ type: z.literal('note-unpublished'), id: z.number() }),
]);

const uNotebookSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('notebook-created'),
    notebook: notesV1NotebookListItemSchema,
  }),
  z.object({
    type: z.literal('notebook-updated'),
    notebook: notesV1NotebookListItemSchema,
  }),
  z.object({ type: z.literal('notebook-deleted') }),
  z.object({
    type: z.literal('notebook-visibility-changed'),
    visibility: notesVisibilitySchema,
  }),
  z.object({
    type: z.literal('member-joined'),
    who: z.string(),
    role: notesRoleSchema,
  }),
  z.object({ type: z.literal('member-left'), who: z.string() }),
  z.object({
    type: z.literal('folder-update'),
    folderUpdate: uFolderSchema,
  }),
  z.object({ type: z.literal('note-update'), noteUpdate: uNoteSchema }),
]);

const notesUpdateResponseSchema = z.object({ update: z.unknown() });

/**
 * Parse a `u-notebook` payload, flattening the folder/note wrappers so every
 * variant is one level deep.
 *
 * Returns null for a missing payload or any variant this client doesn't
 * model — an unknown update is not an error, it just means the caller must
 * fall back to a full sync rather than assume the change was applied.
 */
export function parseNotesUpdate(raw: unknown): NotesUpdate | null {
  const parsed = uNotebookSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const update = parsed.data;
  switch (update.type) {
    case 'folder-update': {
      const inner = update.folderUpdate;
      return inner.type === 'folder-deleted'
        ? { type: inner.type, folderId: inner.id }
        : { type: inner.type, folderId: inner.id, folder: inner.folder };
    }
    case 'note-update': {
      const inner = update.noteUpdate;
      return inner.type === 'note-created' || inner.type === 'note-updated'
        ? { type: inner.type, noteId: inner.id, note: inner.note }
        : { type: inner.type, noteId: inner.id };
    }
    default:
      return update;
  }
}

/**
 * Extract the update a write applied from its response envelope. Null when
 * the write emitted none — `%no-change` bodies, and `%notebook` bodies, which
 * carry the created notebook summary directly instead.
 */
export function notesUpdateFromWriteEnvelope(
  envelope: NotesEnvelope
): NotesUpdate | null {
  if (envelope.body.type !== 'ok') {
    return null;
  }
  const response = notesUpdateResponseSchema.safeParse(envelope.body.response);
  return response.success ? parseNotesUpdate(response.data.update) : null;
}

// The ok envelope of a note write carries the applied update, nested per
// the u-notebook encoder: body.response.update is the notebook-scoped
// wrapper ({type: 'note-update', noteUpdate: {...}}) and the inner
// noteUpdate (`note-created` or `note-updated`) holds the note with the host's
// authoritative id/revision and server-stamped timestamps.
// Extract it when present; null for no-change (no update emitted), bare
// bodies, or unexpected shapes.
function noteFromWriteEnvelope(
  envelope: NotesEnvelope,
  expectedFlag: NotesFlag,
  expectedType: 'note-created' | 'note-updated' = 'note-updated',
  expectedNoteId?: number
): NotesV1Note | null {
  if (envelope.body.type !== 'ok') {
    return null;
  }
  const response = noteWriteResponseSchema.safeParse(envelope.body.response);
  if (
    !response.success ||
    response.data.host !== expectedFlag.host ||
    response.data.flagName !== expectedFlag.name ||
    response.data.update.host !== expectedFlag.host ||
    response.data.update.flagName !== expectedFlag.name ||
    response.data.update.noteUpdate.type !== expectedType ||
    response.data.update.noteUpdate.id !==
      response.data.update.noteUpdate.note.id ||
    (expectedNoteId !== undefined &&
      response.data.update.noteUpdate.id !== expectedNoteId)
  ) {
    return null;
  }
  return response.data.update.noteUpdate.note;
}

export interface NotesV1NoteWriteResult {
  // 'no-change' means the body already matched and the note's revision was
  // NOT bumped — callers tracking revisions must not advance theirs.
  status: 'ok' | 'no-change';
  // The applied note from the response payload, when the host emitted one.
  note: NotesV1Note | null;
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
}): Promise<NotesV1NoteWriteResult> {
  const normalized = normalizeNotesTarget(flag);
  const payload: { body: string; expectedRevision?: number } = { body };
  if (expectedRevision !== undefined) {
    payload.expectedRevision = expectedRevision;
  }
  const res = await requestJson<unknown>(
    noteV1Path(normalized, noteId),
    'PUT',
    payload
  );
  const envelope = assertWriteOk(
    res,
    noteChecks(notesChannelId(normalized), noteId)
  );
  return {
    status: envelope.body.type === 'no-change' ? 'no-change' : 'ok',
    note: noteFromWriteEnvelope(envelope, normalized, 'note-updated', noteId),
  };
}

async function renameNoteV1({
  flag,
  noteId,
  title,
}: {
  flag: NotesTarget;
  noteId: number;
  title: string;
}): Promise<NotesV1Note | null> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson<unknown>(
    noteV1Path(normalized, noteId),
    'PUT',
    {
      title,
    }
  );
  const envelope = assertWriteOk(
    res,
    noteChecks(notesChannelId(normalized), noteId)
  );
  return noteFromWriteEnvelope(envelope, normalized, 'note-updated', noteId);
}

async function moveNoteV1({
  flag,
  noteId,
  folder,
}: {
  flag: NotesTarget;
  noteId: number;
  folder: number;
}): Promise<NotesUpdate | null> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson<unknown>(
    noteV1Path(normalized, noteId),
    'PUT',
    { folder }
  );
  return notesUpdateFromWriteEnvelope(
    assertWriteOk(res, noteChecks(notesChannelId(normalized), noteId))
  );
}

async function deleteNoteV1({
  flag,
  noteId,
}: {
  flag: NotesTarget;
  noteId: number;
}): Promise<NotesUpdate | null> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson<unknown>(
    noteV1Path(normalized, noteId),
    'DELETE'
  );
  return notesUpdateFromWriteEnvelope(
    assertWriteOk(res, noteChecks(notesChannelId(normalized), noteId))
  );
}

async function listNoteHistoryV1({
  flag,
  noteId,
}: {
  flag: NotesTarget;
  noteId: number;
}): Promise<NotesV1NoteRevision[]> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson<unknown>(
    noteHistoryV1Path(normalized, noteId),
    'GET'
  );
  return parseNotesResponseList(notesV1NoteRevisionSchema, res, 'revision');
}

// --- folder helpers --------------------------------------------------------

async function listFoldersV1(
  target: NotesTarget,
  options?: RequestJsonOptions
): Promise<NotesV1Folder[]> {
  const flag = normalizeNotesTarget(target);
  const res = await requestJson<unknown>(
    foldersV1Path(flag),
    'GET',
    undefined,
    options
  );
  return parseNotesResponseList(notesV1FolderSchema, res, 'folder');
}

async function getFolderV1({
  flag,
  folderId,
}: {
  flag: NotesTarget;
  folderId: number;
}): Promise<NotesV1Folder> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson<unknown>(
    folderV1Path(normalized, folderId),
    'GET'
  );
  return normalizeFolderV1(res);
}

async function createFolderV1({
  flag,
  name,
  parent,
}: {
  flag: NotesTarget;
  name: string;
  parent?: number;
}): Promise<NotesUpdate | null> {
  const normalized = normalizeNotesTarget(flag);
  const payload: { folderName: string; parent?: number } = { folderName: name };
  if (parent !== undefined) {
    payload.parent = parent;
  }
  const res = await requestJson<unknown>(
    foldersV1Path(normalized),
    'POST',
    payload
  );
  return notesUpdateFromWriteEnvelope(
    assertWriteOk(res, folderCreateChecks(notesChannelId(normalized)))
  );
}

async function renameFolderV1({
  flag,
  folderId,
  name,
}: {
  flag: NotesTarget;
  folderId: number;
  name: string;
}): Promise<NotesUpdate | null> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson<unknown>(
    folderV1Path(normalized, folderId),
    'PUT',
    { folderName: name }
  );
  return notesUpdateFromWriteEnvelope(
    assertWriteOk(res, folderChecks(notesChannelId(normalized), folderId))
  );
}

async function moveFolderV1({
  flag,
  folderId,
  parent,
}: {
  flag: NotesTarget;
  folderId: number;
  parent: number;
}): Promise<NotesUpdate | null> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson<unknown>(
    folderV1Path(normalized, folderId),
    'PUT',
    { parent }
  );
  return notesUpdateFromWriteEnvelope(
    assertWriteOk(res, folderChecks(notesChannelId(normalized), folderId))
  );
}

async function deleteFolderV1({
  flag,
  folderId,
  recursive,
}: {
  flag: NotesTarget;
  folderId: number;
  recursive: boolean;
}): Promise<NotesUpdate | null> {
  const normalized = normalizeNotesTarget(flag);
  const res = await requestJson<unknown>(
    `${folderV1Path(normalized, folderId)}?recursive=${recursive ? 'true' : 'false'}`,
    'DELETE'
  );
  return notesUpdateFromWriteEnvelope(
    assertWriteOk(res, folderChecks(notesChannelId(normalized), folderId))
  );
}

// --- member helpers --------------------------------------------------------

async function listMembersV1(
  target: NotesTarget
): Promise<NotesV1MemberRecord[]> {
  const flag = normalizeNotesTarget(target);
  const res = await requestJson<unknown>(membersV1Path(flag), 'GET');
  return parseNotesResponseList(notesV1MemberSchema, res, 'member');
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

async function listNotes(
  target: NotesTarget,
  options?: RequestJsonOptions
): Promise<NotesNote[]> {
  const rawNotes = await listNotesV1(target, options);
  return rawNotes.map((note) => toClientNotesNote(target, note));
}

async function searchNotes(input: {
  flag: NotesTarget;
  needle: string;
  from?: number;
  tries?: number;
}): Promise<NotesSearchPage> {
  const page = await searchNotesV1(input);
  return {
    last: page.last,
    notes: page.notes.map((note) => toClientNotesNote(input.flag, note)),
  };
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

export class NotesInvalidRequestIdError extends Error {
  readonly requestId: string;

  constructor(requestId: string, reason: 'invalid' | 'zero' = 'invalid') {
    super(
      reason === 'zero'
        ? `Invalid @uv request id: ${requestId}; request id must be non-zero`
        : `Invalid @uv request id: ${requestId}`
    );
    this.name = 'NotesInvalidRequestIdError';
    this.requestId = requestId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotesUnknownFolderError extends Error {
  readonly flag: string;
  readonly folderId: number;

  constructor(flag: string, folderId: number) {
    super(`%notes folder ${folderId} does not exist in ${flag}`);
    this.name = 'NotesUnknownFolderError';
    this.flag = flag;
    this.folderId = folderId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ===========================================================================
// Batch-import submit over the v1 envelope
// ===========================================================================

/**
 * A node in a `batch-import-tree` payload. The backend discriminates on the
 * *presence of* `children` (lib/notes/json.hoon +import-node), so a folder
 * must always carry the key — even empty — and a note must never carry it.
 */
export type NotesImportNode =
  | { name: string; children: NotesImportNode[] }
  | { title: string; body: string };

/**
 * Mint a request id for a batch import. `%notes` rejects the zero atom, and
 * `renderUv` of all-zero entropy is exactly that, so redraw until non-zero.
 */
export function generateNotesRequestId(): string {
  const source = globalThis.crypto;
  if (!source?.getRandomValues) {
    throw new Error(
      'Cannot generate a %notes request id: no crypto.getRandomValues available'
    );
  }
  let requestId: string;
  do {
    const bytes = source.getRandomValues(new Uint8Array(16));
    let atom = 0n;
    for (const byte of bytes) {
      atom = (atom << 8n) | BigInt(byte);
    }
    requestId = render('uv', atom);
  } while (requestId === '0v0');
  return requestId;
}

function assertValidRequestId(requestId: string) {
  const parsed = tryParse('uv', requestId);
  if (!valid('uv', requestId) || parsed === null) {
    throw new NotesInvalidRequestIdError(requestId);
  }
  if (parsed === 0n) {
    throw new NotesInvalidRequestIdError(requestId, 'zero');
  }
}

/**
 * Import a whole folder/note tree in one poke. `se-batch-import-tree` walks
 * the tree creating folders and notes as it goes — merging a node into an
 * existing same-named child rather than duplicating it — and emits a
 * `%created` update per entity on the notebook stream. The caller therefore
 * learns each new id from the stream, not from this response, whose `%ok`
 * envelope carries only the last update.
 */
export async function batchImportNotesTreeV1({
  flag,
  parent,
  tree,
  requestId,
}: {
  flag: string;
  parent: number;
  tree: NotesImportNode[];
  requestId: string;
}): Promise<string> {
  assertValidRequestId(requestId);

  const normalized = normalizeNotesTarget(flag);
  const canonicalFlag = formatNotesFlag(normalized);

  // The agent asserts this id exists too, so this pre-flight is belt and
  // braces — deliberately kept: against a host that predates that assertion,
  // a stale parent silently persists the whole batch under a folder id
  // nothing traverses, leaving the notes real but invisible. One GET per
  // import is cheap insurance against that, and it buys a typed error
  // instead of a bare crash from the poke.
  const folders = await listFoldersV1(normalized, {
    reauthStatuses: NOTES_AUTH_FAILURE_STATUSES,
  });
  if (!folders.some((existing) => existing.id === parent)) {
    throw new NotesUnknownFolderError(canonicalFlag, parent);
  }

  const res = await requestJson<unknown>(
    NOTES_V1_PATH,
    'POST',
    {
      requestId,
      action: {
        type: 'notebook' as const,
        flag: canonicalFlag,
        action: { type: 'batch-import-tree' as const, parent, tree },
      },
    },
    { reauthStatuses: NOTES_AUTH_FAILURE_STATUSES }
  );

  const envelope = assertWriteOk(
    res,
    noteCreateChecks(notesChannelId(normalized))
  );
  const serverRequestId = envelope.requestId;
  if (!serverRequestId) {
    throw new Error('%notes batch-import-tree response missing requestId');
  }

  return serverRequestId;
}

export async function batchImportNotesV1({
  flag,
  folder,
  notes,
  requestId,
}: {
  flag: string;
  folder: number;
  notes: { title: string; body: string }[];
  requestId: string;
}): Promise<string> {
  assertValidRequestId(requestId);

  const normalized = normalizeNotesTarget(flag);
  const canonicalFlag = formatNotesFlag(normalized);

  // %notes se-batch-import assigns the folder id into every imported note
  // without resolving it (unlike se-create-note), so a stale id would
  // persist a whole batch of notes invisible to folder traversal. Resolve
  // it here before submitting; the backend-side check is TLON-6307.
  const folders = await listFoldersV1(normalized, {
    reauthStatuses: NOTES_AUTH_FAILURE_STATUSES,
  });
  if (!folders.some((existing) => existing.id === folder)) {
    throw new NotesUnknownFolderError(canonicalFlag, folder);
  }

  const body = {
    requestId,
    action: {
      type: 'notebook' as const,
      flag: canonicalFlag,
      action: {
        type: 'batch-import' as const,
        folder,
        notes,
      },
    },
  };

  const res = await requestJson<unknown>(NOTES_V1_PATH, 'POST', body, {
    reauthStatuses: NOTES_AUTH_FAILURE_STATUSES,
  });

  const envelope = assertWriteOk(
    res,
    noteCreateChecks(notesChannelId(normalized))
  );
  const serverRequestId = envelope.requestId;
  if (!serverRequestId) {
    throw new Error('%notes batch-import response missing requestId');
  }

  return serverRequestId;
}

async function listPublished(): Promise<NotesPublishedRecord[]> {
  const rawPublished = await scry({
    app: 'notes',
    path: '/v0/published',
  });
  return parseNotesResponseList(
    notesPublishedRecordSchema,
    rawPublished,
    'published'
  );
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
  searchNotes: typeof searchNotesV1;
  getNote: typeof getNoteV1;
  createNote: typeof createNoteV1;
  batchImport: typeof batchImportNotesV1;
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
  searchNotes: typeof searchNotes;
  getNote: typeof getNote;
  createNote: typeof createNoteV1;
  batchImport: typeof batchImportNotesV1;
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
  searchNotes: searchNotesV1,
  getNote: getNoteV1,
  createNote: createNoteV1,
  batchImport: batchImportNotesV1,
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
  searchNotes,
  getNote,
  createNote: createNoteV1,
  batchImport: batchImportNotesV1,
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
