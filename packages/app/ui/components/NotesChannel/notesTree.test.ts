import * as db from '@tloncorp/shared/db';
import { describe, expect, test } from 'vitest';

import {
  buildFolderNoteCounts,
  buildNotesTreeRows,
  filterNotesTreeData,
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

const makeNote = (noteId: number, folderId: number, title: string, body = '') =>
  ({
    id: `note/${noteId}`,
    noteId,
    folderId,
    title,
    bodyMd: body,
    updatedAt: noteId,
  }) as db.NotesNote;

const root = makeFolder(1, '/', null);
const projects = makeFolder(2, 'Projects', 1);
const archive = makeFolder(3, 'Archive', 1);
const backlog = makeFolder(4, 'Backlog', 2);

const rowsFor = (
  folders: db.NotesFolder[],
  notes: db.NotesNote[],
  expandedIds: number[] = []
) =>
  buildNotesTreeRows({
    expandedFolderIds: new Set(expandedIds),
    folderNoteCounts: buildFolderNoteCounts(folders, notes),
    folders,
    notes,
    rootFolderId: 1,
  });

describe('notes tree helpers', () => {
  test('omits the root folder and preserves nested folder/note ordering', () => {
    const folders = [projects, root, backlog, archive];
    const notes = [
      makeNote(1, 1, 'Alpha'),
      makeNote(2, 2, 'Beta'),
      makeNote(3, 4, 'Gamma'),
    ];

    const rows = rowsFor(folders, notes, [2, 3, 4]);

    expect(
      rows.map((row) =>
        row.type === 'folder'
          ? `folder:${row.folder.name}:${row.depth}`
          : `note:${row.note.title}:${row.depth}`
      )
    ).toEqual([
      'folder:Archive:0',
      'folder:Projects:0',
      'folder:Backlog:1',
      'note:Gamma:2',
      'note:Beta:1',
      'note:Alpha:0',
    ]);
    expect(
      rows.some((row) => row.type === 'folder' && row.folder.folderId === 1)
    ).toBe(false);
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

  test('renders orphaned and cyclic folders once without looping', () => {
    const cycleA = makeFolder(10, 'Cycle A', 11);
    const cycleB = makeFolder(11, 'Cycle B', 10);
    const orphan = makeFolder(12, 'Orphan', 999);
    const folders = [root, cycleA, cycleB, orphan];
    const notes = [
      makeNote(1, 10, 'Cycle note'),
      makeNote(2, 12, 'Orphan note'),
    ];

    const rows = rowsFor(folders, notes, [10, 11, 12]);
    const renderedFolders = rows.flatMap((row) =>
      row.type === 'folder' ? [row.folder.folderId] : []
    );

    expect(renderedFolders.sort()).toEqual([10, 11, 12]);
    expect(new Set(renderedFolders).size).toBe(renderedFolders.length);
    expect(rows.filter((row) => row.type === 'note')).toHaveLength(2);
  });

  test('selects the next visible note after deleting the selected note', () => {
    const folders = [root];
    const alpha = makeNote(1, 1, 'Alpha');
    const beta = makeNote(2, 1, 'Beta');
    const gamma = makeNote(3, 1, 'Gamma');
    const rows = rowsFor(folders, [alpha, beta, gamma]);

    expect(getNextNoteIdAfterDelete(rows, 1)).toBe(2);
    expect(getNextNoteIdAfterDelete(rows, 2)).toBe(3);
    expect(getNextNoteIdAfterDelete(rows, 3)).toBe(2);
  });

  test('clears selection after deleting the only visible note', () => {
    const folders = [root];
    const rows = rowsFor(folders, [makeNote(1, 1, 'Alpha')]);

    expect(getNextNoteIdAfterDelete(rows, 1)).toBeNull();
    expect(getNextNoteIdAfterDelete(rows, 2)).toBeNull();
  });

  test('selects the nearest surviving note after deleting a folder', () => {
    const folders = [root, projects, backlog, archive];
    const alpha = makeNote(1, 1, 'Alpha');
    const beta = makeNote(2, 2, 'Beta');
    const gamma = makeNote(3, 4, 'Gamma');
    const omega = makeNote(4, 3, 'Omega');
    const rows = rowsFor(folders, [alpha, beta, gamma, omega], [2, 3, 4]);

    expect(
      getNextNoteIdAfterFolderDelete({
        rows,
        deletedFolderIds: new Set([2, 4]),
        selectedNoteId: 3,
      })
    ).toBe(1);
    expect(
      getNextNoteIdAfterFolderDelete({
        rows,
        deletedFolderIds: new Set([2, 4]),
        selectedNoteId: 2,
      })
    ).toBe(1);
    expect(
      getNextNoteIdAfterFolderDelete({
        rows,
        deletedFolderIds: new Set([2, 4]),
        selectedNoteId: 1,
      })
    ).toBe(1);
  });
});
