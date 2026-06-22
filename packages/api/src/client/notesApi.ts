import { poke, scry, subscribe, unsubscribe } from './urbit';

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
export type NotesFolderAction =
  | { type: 'rename'; name: string }
  | { type: 'move'; newParent: number }
  | { type: 'delete'; recursive: boolean };

export type NotesNoteAction =
  | { type: 'rename'; title: string }
  | { type: 'move'; folder: number }
  | { type: 'delete' }
  | { type: 'update'; body: string; expectedRevision: number };

export type NotesNotebookAction =
  | { type: 'delete' }
  | { type: 'create-folder'; parent?: number | null; name: string }
  | { type: 'folder'; id: number; action: NotesFolderAction }
  | { type: 'create-note'; folder: number; title: string; body: string }
  | { type: 'note'; id: number; action: NotesNoteAction };

export type NotesJoinAction = { type: 'join'; ship: string; name: string };

export type NotesNotebookScopedAction = {
  type: 'notebook';
  flag: string;
  action: NotesNotebookAction;
};

export type NotesAction = NotesJoinAction | NotesNotebookScopedAction;

export function formatNotesFlag(flag: NotesFlag | string): string {
  if (typeof flag === 'string') {
    return flag;
  }
  return `${flag.host}/${flag.name}`;
}

export function parseNotesFlag(
  input: string | null | undefined
): NotesFlag | null {
  if (!input) return null;
  const [host, name] = input.split('/');
  if (!host || !name) return null;
  return { host, name };
}

export function parseNotesChannelId(
  channelId: string | null | undefined
): NotesFlag | null {
  if (!channelId) return null;
  const [app, host, name] = channelId.split('/');
  if (app !== 'notes' || !host || !name) return null;
  return { host, name };
}

export function notesChannelId(flag: NotesFlag | string): string {
  const formatted = formatNotesFlag(flag);
  return `notes/${formatted}`;
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

export async function deleteNotesNotebook(flag: NotesFlag | string) {
  return notebookAction(flag, { type: 'delete' });
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
}: {
  flag: NotesFlag | string;
  parent?: number | null;
  name: string;
}) {
  return notebookAction(flag, { type: 'create-folder', parent, name });
}

export async function renameNotesFolder({
  flag,
  folderId,
  name,
}: {
  flag: NotesFlag | string;
  folderId: number;
  name: string;
}) {
  return notebookAction(flag, {
    type: 'folder',
    id: folderId,
    action: { type: 'rename', name },
  });
}

export async function moveNotesFolder({
  flag,
  folderId,
  newParent,
}: {
  flag: NotesFlag | string;
  folderId: number;
  newParent: number;
}) {
  return notebookAction(flag, {
    type: 'folder',
    id: folderId,
    action: { type: 'move', newParent },
  });
}

export async function deleteNotesFolder({
  flag,
  folderId,
  recursive = true,
}: {
  flag: NotesFlag | string;
  folderId: number;
  recursive?: boolean;
}) {
  return notebookAction(flag, {
    type: 'folder',
    id: folderId,
    action: { type: 'delete', recursive },
  });
}

export async function createNotesNote({
  flag,
  folder,
  title,
  body = '',
}: {
  flag: NotesFlag | string;
  folder: number;
  title: string;
  body?: string;
}) {
  return notebookAction(flag, { type: 'create-note', folder, title, body });
}

export async function renameNotesNote({
  flag,
  noteId,
  title,
}: {
  flag: NotesFlag | string;
  noteId: number;
  title: string;
}) {
  return notebookAction(flag, {
    type: 'note',
    id: noteId,
    action: { type: 'rename', title },
  });
}

export async function moveNotesNote({
  flag,
  noteId,
  folder,
}: {
  flag: NotesFlag | string;
  noteId: number;
  folder: number;
}) {
  return notebookAction(flag, {
    type: 'note',
    id: noteId,
    action: { type: 'move', folder },
  });
}

export async function updateNotesNoteBody({
  flag,
  noteId,
  body,
  expectedRevision,
}: {
  flag: NotesFlag | string;
  noteId: number;
  body: string;
  expectedRevision: number;
}) {
  return notebookAction(flag, {
    type: 'note',
    id: noteId,
    action: { type: 'update', body, expectedRevision },
  });
}

export async function deleteNotesNote({
  flag,
  noteId,
}: {
  flag: NotesFlag | string;
  noteId: number;
}) {
  return notebookAction(flag, {
    type: 'note',
    id: noteId,
    action: { type: 'delete' },
  });
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
