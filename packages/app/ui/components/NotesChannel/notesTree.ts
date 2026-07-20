import { makePrettyShortDate } from '@tloncorp/api/lib/utils';
import * as db from '@tloncorp/shared/db';

export type FolderRow = { folder: db.NotesFolder; path: string };
export type FolderDestinationRow = {
  folder: db.NotesFolder;
  label: string;
  displayPath: string;
  isRoot: boolean;
};
export type NotesTreeRow =
  | {
      type: 'folder';
      folder: db.NotesFolder;
      noteCount: number;
      path: string;
    }
  | { type: 'note'; note: db.NotesNote };

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
  const aUpdatedAt = a.updatedAt ?? a.createdAt ?? 0;
  const bUpdatedAt = b.updatedAt ?? b.createdAt ?? 0;
  return (
    bUpdatedAt - aUpdatedAt ||
    a.title.localeCompare(b.title) ||
    a.noteId - b.noteId
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
  visit: (folder: db.NotesFolder) => void
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
    .forEach((folder) => visit(folder));

  folders
    .filter((folder) => {
      if (visited.has(folder.folderId)) return false;
      return !hasVisitedAncestor(folder);
    })
    .forEach((folder) => visit(folder));
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

  const visit = (folder: db.NotesFolder, parentPath = '') => {
    if (visited.has(folder.folderId)) return;

    visited.add(folder.folderId);
    const label = getFolderLabel(folder);
    const path = parentPath ? `${parentPath} / ${label}` : label;
    const isRoot = root ? folder.folderId === root.folderId : false;
    if (includeRoot || !isRoot) {
      rows.push({ folder, path });
    }

    const children = byParent.get(folder.folderId) ?? [];
    children.forEach((child) => visit(child, path));
  };

  if (root) {
    visit(root);
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

export function buildFolderDestinationRows({
  folderRows,
  hiddenFolderIds,
}: {
  folderRows: FolderRow[];
  hiddenFolderIds?: Set<number>;
}): FolderDestinationRow[] {
  return folderRows
    .filter((row) => !hiddenFolderIds?.has(row.folder.folderId))
    .map((row) => {
      const label = getFolderLabel(row.folder);
      const isRoot = row.folder.name === '/';
      return {
        folder: row.folder,
        label,
        displayPath: isRoot ? label : row.path.replace(/^Root \/ /, ''),
        isRoot,
      };
    });
}

export function buildFolderContentsRows({
  folderId,
  folderNoteCounts,
  folders,
  notes,
  rootFolderId,
}: {
  folderId: number | null;
  folderNoteCounts: Map<number, number>;
  folders: db.NotesFolder[];
  notes: db.NotesNote[];
  rootFolderId: number | null;
}): NotesTreeRow[] {
  if (folderId === null) {
    return [];
  }

  const { byParent } = indexFolders(folders, { sorted: true });
  const folderRows = buildFolderRows(folders, rootFolderId, {
    includeRoot: true,
  });
  const pathByFolderId = new Map(
    folderRows.map((row) => [row.folder.folderId, row.path])
  );
  const childFolders = byParent.get(folderId) ?? [];
  const folderNotes = notes
    .filter((note) => note.folderId === folderId)
    .sort(compareNotes);

  return [
    ...childFolders.map((folder): NotesTreeRow => {
      return {
        type: 'folder',
        folder,
        noteCount: folderNoteCounts.get(folder.folderId) ?? 0,
        path: pathByFolderId.get(folder.folderId) ?? getFolderLabel(folder),
      };
    }),
    ...folderNotes.map((note): NotesTreeRow => ({ type: 'note', note })),
  ];
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
    : (noteIds[deletedIndex + 1] ?? noteIds[deletedIndex - 1] ?? null);
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

// Note timestamps may arrive in seconds or milliseconds depending on source.
export function noteTimestampMs(timestamp: number | null | undefined) {
  if (!timestamp) return null;
  return timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
}

export function formatNoteDate(timestamp: number | null | undefined) {
  const unixMs = noteTimestampMs(timestamp);
  return unixMs === null ? null : makePrettyShortDate(new Date(unixMs));
}
