import * as db from '@tloncorp/shared/db';
import { describe, expect, test } from 'vitest';

import {
  buildFolderContentsRows,
  buildFolderDestinationRows,
  buildFolderNoteCounts,
  buildFolderRows,
  buildFolderUnreadCounts,
  filterNotesTreeData,
  getFolderPath,
  getNextNoteIdAfterDelete,
  getNextNoteIdAfterFolderDelete,
} from './notesTree';

const makeFolder = (folderId: number, name: string, parentId: number | null) =>
  ({
    id: `folder/${folderId}`,
    folderId,
    name,
    parentFolderId: parentId,
  }) as db.NotesFolder;

const makeNote = (
  noteId: number,
  folderId: number,
  title: string,
  body = '',
  overrides: Partial<db.NotesNote> = {}
) =>
  ({
    id: `note/${noteId}`,
    noteId,
    folderId,
    title,
    bodyMd: body,
    updatedAt: noteId,
    ...overrides,
  }) as db.NotesNote;

const root = makeFolder(1, '/', null);
const projects = makeFolder(2, 'Projects', 1);
const archive = makeFolder(3, 'Archive', 1);
const backlog = makeFolder(4, 'Backlog', 2);

const rowsFor = (
  folderId: number,
  folders: db.NotesFolder[],
  notes: db.NotesNote[]
) =>
  buildFolderContentsRows({
    folderId,
    folderNoteCounts: buildFolderNoteCounts(folders, notes),
    folders,
    notes,
    rootFolderId: 1,
  });

describe('notes tree helpers', () => {
  test('builds a folder path for note metadata', () => {
    expect(getFolderPath([root, projects, backlog], 4, 1)).toBe(
      'Root / Projects / Backlog'
    );
    expect(getFolderPath([root, projects], 999, 1)).toBeNull();
  });

  test('builds flat move destinations with root distinguished and hidden folders omitted', () => {
    const folderRows = buildFolderRows([projects, root, backlog, archive], 1, {
      includeRoot: true,
    });
    const destinations = buildFolderDestinationRows({
      folderRows,
      hiddenFolderIds: new Set([2]),
    });

    expect(
      destinations.map((row) =>
        [row.isRoot ? 'root' : 'folder', row.displayPath].join(':')
      )
    ).toEqual(['root:Root', 'folder:Archive', 'folder:Projects / Backlog']);
  });

  test('builds immediate folder contents with folders first and notes by recency', () => {
    const folders = [projects, root, backlog, archive];
    const notes = [
      makeNote(1, 1, 'Root note'),
      makeNote(2, 2, 'Alpha', '', { updatedAt: 200 }),
      makeNote(3, 4, 'Nested'),
      makeNote(4, 2, 'Beta', '', { updatedAt: 400 }),
    ];
    const rows = buildFolderContentsRows({
      folderId: 2,
      folderNoteCounts: buildFolderNoteCounts(folders, notes),
      folders,
      notes,
      rootFolderId: 1,
    });

    expect(
      rows.map((row) =>
        row.type === 'folder'
          ? `folder:${row.folder.name}:${row.noteCount}`
          : `note:${row.note.title}`
      )
    ).toEqual(['folder:Backlog:1', 'note:Beta', 'note:Alpha']);
  });

  test('builds root contents without nested descendants', () => {
    const folders = [projects, root, backlog, archive];
    const notes = [
      makeNote(1, 1, 'Root note'),
      makeNote(2, 2, 'Nested project note'),
      makeNote(3, 4, 'Deep nested note'),
    ];
    const rows = buildFolderContentsRows({
      folderId: 1,
      folderNoteCounts: buildFolderNoteCounts(folders, notes),
      folders,
      notes,
      rootFolderId: 1,
    });

    expect(
      rows.map((row) =>
        row.type === 'folder'
          ? `folder:${row.folder.name}:${row.noteCount}`
          : `note:${row.note.title}`
      )
    ).toEqual(['folder:Archive:0', 'folder:Projects:2', 'note:Root note']);
  });

  test('searching a folder includes ancestors, descendants, and descendant notes', () => {
    const folders = [root, projects, archive, backlog];
    const notes = [
      makeNote(1, 1, 'Alpha'),
      makeNote(2, 2, 'Beta'),
      makeNote(3, 4, 'Gamma'),
    ];

    const filtered = filterNotesTreeData({
      folders,
      notes,
      query: 'project',
      rootFolderId: 1,
    });

    expect(filtered.folders.map((folder) => folder.folderId).sort()).toEqual([
      1, 2, 4,
    ]);
    expect(filtered.notes.map((note) => note.title).sort()).toEqual([
      'Beta',
      'Gamma',
    ]);
  });

  test('searching a note includes its folder ancestors', () => {
    const folders = [root, projects, archive, backlog];
    const notes = [
      makeNote(1, 3, 'Archived note'),
      makeNote(2, 4, 'Roadmap', 'Deep milestone details'),
    ];

    const filtered = filterNotesTreeData({
      folders,
      notes,
      query: 'milestone',
      rootFolderId: 1,
    });

    expect(filtered.folders.map((folder) => folder.folderId).sort()).toEqual([
      1, 2, 4,
    ]);
    expect(filtered.notes.map((note) => note.noteId)).toEqual([2]);
  });

  test('builds folder rows for orphaned and cyclic folders without looping', () => {
    const cycleA = makeFolder(10, 'Cycle A', 11);
    const cycleB = makeFolder(11, 'Cycle B', 10);
    const orphan = makeFolder(12, 'Orphan', 999);
    const rows = buildFolderRows([root, cycleA, cycleB, orphan], 1, {
      includeRoot: false,
    });

    const renderedFolders = rows.map((row) => row.folder.folderId);

    expect(renderedFolders.sort()).toEqual([10, 11, 12]);
    expect(new Set(renderedFolders).size).toBe(renderedFolders.length);
  });

  test('selects the next visible note after deleting the selected note', () => {
    const folders = [root];
    const alpha = makeNote(1, 1, 'Alpha');
    const beta = makeNote(2, 1, 'Beta');
    const gamma = makeNote(3, 1, 'Gamma');
    const rows = rowsFor(1, folders, [alpha, beta, gamma]);

    expect(getNextNoteIdAfterDelete(rows, 1)).toBe(2);
    expect(getNextNoteIdAfterDelete(rows, 2)).toBe(1);
    expect(getNextNoteIdAfterDelete(rows, 3)).toBe(2);
  });

  test('clears selection after deleting the only visible note', () => {
    const folders = [root];
    const rows = rowsFor(1, folders, [makeNote(1, 1, 'Alpha')]);

    expect(getNextNoteIdAfterDelete(rows, 1)).toBeNull();
    expect(getNextNoteIdAfterDelete(rows, 2)).toBeNull();
  });

  test('keeps a visible note selected after deleting a different folder', () => {
    const folders = [root, projects, backlog, archive];
    const alpha = makeNote(1, 1, 'Alpha');
    const beta = makeNote(2, 2, 'Beta');
    const gamma = makeNote(3, 4, 'Gamma');
    const omega = makeNote(4, 3, 'Omega');
    const rows = rowsFor(1, folders, [alpha, beta, gamma, omega]);

    expect(
      getNextNoteIdAfterFolderDelete({
        rows,
        deletedFolderIds: new Set([2, 4]),
        selectedNoteId: 1,
      })
    ).toBe(1);
  });

  test('clears a note selection that is not visible in the current folder', () => {
    const folders = [root, projects, backlog, archive];
    const alpha = makeNote(1, 1, 'Alpha');
    const beta = makeNote(2, 2, 'Beta');
    const gamma = makeNote(3, 4, 'Gamma');
    const omega = makeNote(4, 3, 'Omega');
    const rows = rowsFor(1, folders, [alpha, beta, gamma, omega]);

    expect(
      getNextNoteIdAfterFolderDelete({
        rows,
        deletedFolderIds: new Set([2]),
        selectedNoteId: 2,
      })
    ).toBeNull();
  });
});

describe('buildFolderUnreadCounts', () => {
  test('rolls an unread note up through every ancestor folder', () => {
    // root(1) -> Projects(2) -> Backlog(4); note in Backlog
    const folders = [root, projects, archive, backlog];
    const notes = [
      makeNote(1, 4, 'Deep'),
      makeNote(2, 3, 'Archived'),
      makeNote(3, 1, 'Top'),
    ];

    const counts = buildFolderUnreadCounts(folders, notes, new Set([1]));

    expect(counts.get(4)).toBe(1);
    expect(counts.get(2)).toBe(1);
    expect(counts.get(1)).toBe(1);
    expect(counts.get(3)).toBe(0);
  });

  test('sums multiple unread notes at shared ancestors', () => {
    const folders = [root, projects, archive, backlog];
    const notes = [
      makeNote(1, 4, 'Deep'),
      makeNote(2, 2, 'Mid'),
      makeNote(3, 3, 'Archived'),
    ];

    const counts = buildFolderUnreadCounts(folders, notes, new Set([1, 2, 3]));

    expect(counts.get(4)).toBe(1);
    expect(counts.get(2)).toBe(2);
    expect(counts.get(3)).toBe(1);
    expect(counts.get(1)).toBe(3);
  });

  test('returns zero counts when nothing is unread', () => {
    const folders = [root, projects];
    const notes = [makeNote(1, 2, 'Alpha')];

    const counts = buildFolderUnreadCounts(folders, notes, new Set());

    expect(counts.get(2)).toBe(0);
    expect(counts.get(1)).toBe(0);
  });
});
