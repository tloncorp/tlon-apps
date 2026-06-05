import { getCurrentUserId, poke, scry, subscribe, unsubscribe } from './urbit';

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

export interface NotesNoteRevision {
  rev: number;
  at: number;
  author: string;
  title: string;
  bodyMd: string;
}

export type NotesFolderUpdate =
  | { type: 'folder-created'; id: number; folder: NotesFolder }
  | { type: 'folder-updated'; id: number; folder: NotesFolder }
  | { type: 'folder-deleted'; id: number };

export type NotesNoteUpdate =
  | { type: 'note-created'; id: number; note: NotesNote }
  | { type: 'note-updated'; id: number; note: NotesNote }
  | { type: 'note-deleted'; id: number }
  | { type: 'note-published'; id: number; html: string }
  | { type: 'note-unpublished'; id: number }
  | { type: 'note-history-archived'; id: number; revision: NotesNoteRevision };

export type NotesNotebookUpdate =
  | {
      type: 'notebook-created';
      host: string;
      flagName: string;
      notebook: NotesNotebook;
      visibility: NotesVisibility;
    }
  | {
      type: 'notebook-updated';
      host: string;
      flagName: string;
      notebook: NotesNotebook;
    }
  | {
      type: 'notebook-deleted';
      host: string;
      flagName: string;
    }
  | {
      type: 'notebook-visibility-changed';
      host: string;
      flagName: string;
      visibility: NotesVisibility;
    }
  | {
      type: 'member-joined';
      host: string;
      flagName: string;
      who: string;
      role: NotesRole;
    }
  | {
      type: 'member-left';
      host: string;
      flagName: string;
      who: string;
    }
  | {
      type: 'folder-update';
      host: string;
      flagName: string;
      folderUpdate: NotesFolderUpdate;
    }
  | {
      type: 'note-update';
      host: string;
      flagName: string;
      noteUpdate: NotesNoteUpdate;
    };

export type NotesStreamEvent =
  | {
      type: 'snapshot';
      host: string;
      flagName: string;
      visibility: NotesVisibility;
    }
  | {
      type: 'update';
      host: string;
      flagName: string;
      time: number;
      update: NotesNotebookUpdate;
    };

export type NotesNotebookAction =
  | { type: 'rename'; title: string }
  | { type: 'delete' }
  | { type: 'visibility'; visibility: NotesVisibility }
  | { type: 'invite'; who: string }
  | { type: 'create-folder'; parent?: number | null; name: string }
  | {
      type: 'folder';
      id: number;
      action:
        | { type: 'rename'; name: string }
        | { type: 'move'; newParent: number }
        | { type: 'delete'; recursive: boolean };
    }
  | { type: 'create-note'; folder: number; title: string; body: string }
  | {
      type: 'note';
      id: number;
      action:
        | { type: 'rename'; title: string }
        | { type: 'move'; folder: number }
        | { type: 'delete' }
        | { type: 'update'; body: string; expectedRevision: number }
        | { type: 'publish'; html: string }
        | { type: 'unpublish' }
        | { type: 'restore'; rev: number };
    };

export type NotesAction =
  | { type: 'create-notebook'; title: string }
  | ({ type: 'join' } & NotesFlagAction)
  | ({ type: 'leave' } & NotesFlagAction)
  | ({ type: 'accept-invite' } & NotesFlagAction)
  | ({ type: 'decline-invite' } & NotesFlagAction)
  | { type: 'notebook'; flag: string; action: NotesNotebookAction };

type NotesFlagAction = {
  ship: string;
  name: string;
};

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

export async function notesAction(action: NotesAction) {
  return poke({
    app: 'notes',
    mark: 'notes-action',
    json: action,
  });
}

export async function listNotesNotebooks(): Promise<NotesNotebookSummary[]> {
  const data = await scry<NotesNotebookSummary[]>({
    app: 'notes',
    path: '/v0/notebooks',
  });
  return Array.isArray(data) ? data : [];
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
  const normalized = requireNotesFlag(flag);
  const data = await scry<NotesFolder[]>({
    app: 'notes',
    path: `/v0/folders/${normalized.host}/${normalized.name}`,
  });
  return Array.isArray(data) ? data : [];
}

export async function listNotes(
  flag: NotesFlag | string
): Promise<NotesNote[]> {
  const normalized = requireNotesFlag(flag);
  const data = await scry<NotesNote[]>({
    app: 'notes',
    path: `/v0/notes/${normalized.host}/${normalized.name}`,
  });
  return Array.isArray(data) ? data : [];
}

export async function getNotesNote({
  flag,
  noteId,
}: {
  flag: NotesFlag | string;
  noteId: number;
}): Promise<NotesNote | null> {
  const normalized = requireNotesFlag(flag);
  try {
    const data = await scry<NotesNote>({
      app: 'notes',
      path: `/v0/note/${normalized.host}/${normalized.name}/${noteId}`,
    });
    return data ?? null;
  } catch (e) {
    return null;
  }
}

export async function listNotesMembers(
  flag: NotesFlag | string
): Promise<NotesMemberRecord[]> {
  const normalized = requireNotesFlag(flag);
  const data = await scry<NotesMemberRecord[]>({
    app: 'notes',
    path: `/v0/members/${normalized.host}/${normalized.name}`,
  });
  return Array.isArray(data) ? data : [];
}

export async function listNotesHistory({
  flag,
  noteId,
}: {
  flag: NotesFlag | string;
  noteId: number;
}): Promise<NotesNoteRevision[]> {
  const normalized = requireNotesFlag(flag);
  const data = await scry<NotesNoteRevision[]>({
    app: 'notes',
    path: `/v0/note-history/${normalized.host}/${normalized.name}/${noteId}`,
  });
  return Array.isArray(data) ? data : [];
}

export async function createNotesNotebook(
  title: string
): Promise<NotesNotebookSummary> {
  const currentUserId = getCurrentUserId();
  const before = await listNotesNotebooks();
  const beforeOurs = new Set(
    before.filter((n) => n.host === currentUserId).map((n) => n.flagName)
  );

  await notesAction({ type: 'create-notebook', title });

  const created = await pollForNewNotebook({
    currentUserId,
    title,
    excluded: beforeOurs,
  });
  if (!created) {
    throw new Error('Failed to create notes notebook');
  }
  return created;
}

export async function setNotesNotebookVisibility({
  flag,
  visibility,
}: {
  flag: NotesFlag | string;
  visibility: NotesVisibility;
}) {
  return notebookAction(flag, { type: 'visibility', visibility });
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

export async function leaveNotesNotebook(flag: NotesFlag | string) {
  const normalized = requireNotesFlag(flag);
  return notesAction({
    type: 'leave',
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
  recursive = false,
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

async function pollForNewNotebook({
  currentUserId,
  title,
  excluded,
  attempts = 12,
  delayMs = 300,
}: {
  currentUserId: string;
  title: string;
  excluded: Set<string>;
  attempts?: number;
  delayMs?: number;
}): Promise<NotesNotebookSummary | null> {
  for (let i = 0; i < attempts; i++) {
    const all = await listNotesNotebooks();
    const ours = all.filter((n) => n.host === currentUserId);
    const fresh = ours.filter((n) => !excluded.has(n.flagName));
    const match =
      fresh.find((n) => n.notebook.title === title) ?? fresh[0] ?? null;
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}
