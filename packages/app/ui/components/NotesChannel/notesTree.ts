import { makePrettyShortDate } from '@tloncorp/api/lib/utils';
import * as db from '@tloncorp/shared/db';

export type FolderRow = { folder: db.NotesFolder; depth: number; path: string };
export type NotesTreeRow =
  | {
      type: 'folder';
      folder: db.NotesFolder;
      depth: number;
      expanded: boolean;
      hasChildren: boolean;
      noteCount: number;
      path: string;
    }
  | { type: 'note'; note: db.NotesNote; depth: number };

function indexFolders(
  folders: db.NotesFolder[],
  { sorted = false }: { sorted?: boolean } = {}
) {
  const byId = new Map<number, db.NotesFolder>();
  const byParent = new Map<number | null, db.NotesFolder[]>();
  folders.forEach((folder) => {
    byId.set(folder.folderId, folder);
    const parentFolderId = folder.parentFolderId ?? null;
    const siblings = byParent.get(parentFolderId) ?? [];
    siblings.push(folder);
    byParent.set(parentFolderId, siblings);
  });
  if (sorted) {
    byParent.forEach((siblings) => {
      siblings.sort((a, b) => a.name.localeCompare(b.name));
    });
  }
  return { byId, byParent };
}

function compareNotes(a: db.NotesNote, b: db.NotesNote) {
  return (
    a.title.localeCompare(b.title) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
  );
}

function findRootFolder(
  folders: db.NotesFolder[],
  rootFolderId: number | null
) {
  return (
    folders.find((folder) => folder.folderId === rootFolderId) ??
    folders.find((folder) => folder.parentFolderId === null)
  );
}

function visitOrphans(
  folders: db.NotesFolder[],
  byId: Map<number, db.NotesFolder>,
  visited: Set<number>,
  visit: (folder: db.NotesFolder, depth: number) => void
) {
  const hasVisitedAncestor = (folder: db.NotesFolder) => {
    const seen = new Set<number>();
    let parentFolderId = folder.parentFolderId ?? null;

    while (parentFolderId !== null) {
      if (visited.has(parentFolderId)) return true;
      if (seen.has(parentFolderId)) return false;
      seen.add(parentFolderId);

      const parent = byId.get(parentFolderId);
      if (!parent) return false;
      parentFolderId = parent.parentFolderId ?? null;
    }

    return false;
  };

  folders
    .filter((folder) => {
      if (visited.has(folder.folderId)) return false;
      return folder.parentFolderId == null || !byId.has(folder.parentFolderId);
    })
    .forEach((folder) => visit(folder, 0));

  folders
    .filter((folder) => {
      if (visited.has(folder.folderId)) return false;
      return !hasVisitedAncestor(folder);
    })
    .forEach((folder) => visit(folder, 0));
}

export function filterNotesTreeData({
  folders,
  notes,
  query,
  rootFolderId,
}: {
  folders: db.NotesFolder[];
  notes: db.NotesNote[];
  query: string;
  rootFolderId: number | null;
}) {
  if (!query) {
    return { folders, notes };
  }

  const { byId, byParent } = indexFolders(folders);

  const visibleFolderIds = new Set<number>();
  const folderMatchSubtreeIds = new Set<number>();

  const includeFolderAndAncestors = (folderId: number | null | undefined) => {
    let currentFolderId = folderId;
    const visited = new Set<number>();
    while (currentFolderId != null && !visited.has(currentFolderId)) {
      visited.add(currentFolderId);
      visibleFolderIds.add(currentFolderId);
      currentFolderId = byId.get(currentFolderId)?.parentFolderId;
    }
  };

  const includeFolderDescendants = (folderId: number) => {
    if (folderMatchSubtreeIds.has(folderId)) {
      return;
    }

    folderMatchSubtreeIds.add(folderId);
    visibleFolderIds.add(folderId);
    const children = byParent.get(folderId) ?? [];
    children.forEach((child) => includeFolderDescendants(child.folderId));
  };

  folders.forEach((folder) => {
    if (normalizeSearchText(getFolderLabel(folder)).includes(query)) {
      includeFolderAndAncestors(folder.folderId);
      includeFolderDescendants(folder.folderId);
    }
  });

  const visibleNotes = notes.filter((note) => {
    const noteMatches =
      normalizeSearchText(note.title).includes(query) ||
      normalizeSearchText(note.bodyMd).includes(query);
    if (noteMatches || folderMatchSubtreeIds.has(note.folderId)) {
      includeFolderAndAncestors(note.folderId);
      return true;
    }

    return false;
  });

  if (rootFolderId !== null) {
    visibleFolderIds.add(rootFolderId);
  }

  return {
    folders: folders.filter((folder) => visibleFolderIds.has(folder.folderId)),
    notes: visibleNotes,
  };
}

export function buildFolderRows(
  folders: db.NotesFolder[],
  rootFolderId: number | null,
  { includeRoot }: { includeRoot: boolean }
): FolderRow[] {
  const { byId, byParent } = indexFolders(folders, { sorted: true });

  const rows: FolderRow[] = [];
  const visited = new Set<number>();
  const root = findRootFolder(folders, rootFolderId);

  const visit = (folder: db.NotesFolder, depth: number, parentPath = '') => {
    if (visited.has(folder.folderId)) return;

    visited.add(folder.folderId);
    const label = getFolderLabel(folder);
    const path = parentPath ? `${parentPath} / ${label}` : label;
    const isRoot = root ? folder.folderId === root.folderId : false;
    if (includeRoot || !isRoot) {
      rows.push({
        folder,
        depth: includeRoot ? depth : Math.max(0, depth - 1),
        path,
      });
    }

    const children = byParent.get(folder.folderId) ?? [];
    children.forEach((child) => visit(child, depth + 1, path));
  };

  if (root) {
    visit(root, 0);
  }
  visitOrphans(folders, byId, visited, visit);

  return rows;
}

export function getFolderPath(
  folders: db.NotesFolder[],
  folderId: number | null | undefined,
  rootFolderId: number | null
) {
  if (folderId == null) return null;
  return (
    buildFolderRows(folders, rootFolderId, { includeRoot: true }).find(
      (row) => row.folder.folderId === folderId
    )?.path ?? null
  );
}

export function buildNotesTreeRows({
  expandedFolderIds,
  folderNoteCounts,
  folders,
  notes,
  rootFolderId,
}: {
  expandedFolderIds: Set<number>;
  folderNoteCounts: Map<number, number>;
  folders: db.NotesFolder[];
  notes: db.NotesNote[];
  rootFolderId: number | null;
}): NotesTreeRow[] {
  const { byId, byParent } = indexFolders(folders, { sorted: true });
  const notesByFolder = new Map<number, db.NotesNote[]>();
  const renderedNoteIds = new Set<string>();

  notes.forEach((note) => {
    const folderNotes = notesByFolder.get(note.folderId) ?? [];
    folderNotes.push(note);
    notesByFolder.set(note.folderId, folderNotes);
  });
  notesByFolder.forEach((folderNotes) => {
    folderNotes.sort(compareNotes);
  });

  const rows: NotesTreeRow[] = [];
  const visitedFolderIds = new Set<number>();
  const root = findRootFolder(folders, rootFolderId);

  const appendNotes = (folderId: number, depth: number) => {
    const folderNotes = notesByFolder.get(folderId) ?? [];
    folderNotes.forEach((note) => {
      rows.push({ type: 'note', note, depth });
      renderedNoteIds.add(note.id);
    });
  };

  const visit = (folder: db.NotesFolder, depth: number, parentPath = '') => {
    if (visitedFolderIds.has(folder.folderId)) return;

    visitedFolderIds.add(folder.folderId);
    const label = getFolderLabel(folder);
    const path = parentPath ? `${parentPath} / ${label}` : label;
    const isRoot = root ? folder.folderId === root.folderId : false;
    const childFolders = byParent.get(folder.folderId) ?? [];
    const folderNotes = notesByFolder.get(folder.folderId) ?? [];
    const hasChildren = childFolders.length > 0 || folderNotes.length > 0;
    const expanded = isRoot || expandedFolderIds.has(folder.folderId);

    if (!isRoot) {
      rows.push({
        type: 'folder',
        folder,
        depth,
        expanded,
        hasChildren,
        noteCount: folderNoteCounts.get(folder.folderId) ?? 0,
        path,
      });
    }

    if (!expanded) return;

    const childDepth = isRoot ? depth : depth + 1;
    childFolders.forEach((child) => visit(child, childDepth, path));
    appendNotes(folder.folderId, childDepth);
  };

  if (root) {
    visit(root, 0);
  }

  visitOrphans(folders, byId, visitedFolderIds, visit);

  notes
    .filter((note) => !renderedNoteIds.has(note.id) && !byId.has(note.folderId))
    .sort(compareNotes)
    .forEach((note) => rows.push({ type: 'note', note, depth: 0 }));

  return rows;
}

export function getNextNoteIdAfterDelete(
  rows: NotesTreeRow[],
  deletedNoteId: number
) {
  const noteIds = rows.flatMap((row) =>
    row.type === 'note' ? [row.note.noteId] : []
  );
  const deletedIndex = noteIds.indexOf(deletedNoteId);
  return deletedIndex === -1
    ? null
    : noteIds[deletedIndex + 1] ?? noteIds[deletedIndex - 1] ?? null;
}

export function getNextNoteIdAfterFolderDelete({
  rows,
  deletedFolderIds,
  selectedNoteId,
}: {
  rows: NotesTreeRow[];
  deletedFolderIds: Set<number>;
  selectedNoteId: number;
}) {
  const noteRows = rows.flatMap((row) => (row.type === 'note' ? [row] : []));
  const selectedIndex = noteRows.findIndex(
    (row) => row.note.noteId === selectedNoteId
  );
  if (selectedIndex === -1) {
    return null;
  }

  const isDeleted = (row: (typeof noteRows)[number]) =>
    deletedFolderIds.has(row.note.folderId);
  if (!isDeleted(noteRows[selectedIndex])) {
    return selectedNoteId;
  }

  return (
    [
      ...noteRows.slice(selectedIndex + 1),
      ...noteRows.slice(0, selectedIndex).reverse(),
    ].find((row) => !isDeleted(row))?.note.noteId ?? null
  );
}

export function buildFolderNoteCounts(
  folders: db.NotesFolder[],
  notes: db.NotesNote[]
) {
  const counts = new Map<number, number>();
  const parentByFolderId = new Map<number, number | null>();
  folders.forEach((folder) => {
    counts.set(folder.folderId, 0);
    parentByFolderId.set(folder.folderId, folder.parentFolderId ?? null);
  });

  notes.forEach((note) => {
    const visited = new Set<number>();
    let folderId: number | null = note.folderId;
    while (
      folderId !== null &&
      counts.has(folderId) &&
      !visited.has(folderId)
    ) {
      visited.add(folderId);
      counts.set(folderId, (counts.get(folderId) ?? 0) + 1);
      folderId = parentByFolderId.get(folderId) ?? null;
    }
  });

  return counts;
}

export function getFolderLabel(folder: db.NotesFolder | null | undefined) {
  if (!folder) return 'Folder';
  return folder.name === '/' ? 'Root' : folder.name;
}

export function normalizeSearchText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

export function formatNoteDate(timestamp: number | null | undefined) {
  if (!timestamp) return null;
  const unixMs = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  return makePrettyShortDate(new Date(unixMs));
}
