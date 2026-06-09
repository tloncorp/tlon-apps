import * as db from '@tloncorp/shared/db';
import { describe, expect, test } from 'vitest';

import {
  buildFolderNoteCounts,
  buildNotesTreeRows,
  filterNotesTreeData,
  normalizeSearchText,
} from './notesTree';

const notebookFlag = '~zod/native-notes';

function makeFolder(
  folderId: number,
  name: string,
  parentFolderId: number | null
): db.NotesFolder {
  return {
    id: `${notebookFlag}/folder/${folderId}`,
    notebookFlag,
    folderId,
    notebookId: 1,
    name,
    parentFolderId,
    createdBy: '~zod',
    createdAt: folderId,
    updatedBy: '~zod',
    updatedAt: folderId,
    syncedAt: 100,
  };
}

function makeNote(
  noteId: number,
  folderId: number,
  title: string,
  bodyMd = ''
): db.NotesNote {
  return {
    id: `${notebookFlag}/note/${noteId}`,
    notebookFlag,
    noteId,
    notebookId: 1,
    folderId,
    title,
    slug: null,
    bodyMd,
    createdBy: '~zod',
    createdAt: noteId,
    updatedBy: '~zod',
    updatedAt: noteId,
    revision: 1,
    syncedAt: 100,
  };
}

const root = makeFolder(1, '/', null);
const projects = makeFolder(2, 'Projects', 1);
const archive = makeFolder(3, 'Archive', 1);
const backlog = makeFolder(4, 'Backlog', 2);

describe('notes tree helpers', () => {
  test('omits the root folder and preserves nested folder/note ordering', () => {
    const folders = [projects, root, backlog, archive];
    const notes = [
      makeNote(1, 1, 'Alpha'),
      makeNote(2, 2, 'Beta'),
      makeNote(3, 4, 'Gamma'),
    ];

    const rows = buildNotesTreeRows({
      expandedFolderIds: new Set([2, 3, 4]),
      folderNoteCounts: buildFolderNoteCounts(folders, notes),
      folders,
      notes,
      rootFolderId: 1,
    });

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
      query: normalizeSearchText('project'),
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
      query: normalizeSearchText('milestone'),
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

    const rows = buildNotesTreeRows({
      expandedFolderIds: new Set([10, 11, 12]),
      folderNoteCounts: buildFolderNoteCounts(folders, notes),
      folders,
      notes,
      rootFolderId: 1,
    });
    const renderedFolders = rows.flatMap((row) =>
      row.type === 'folder' ? [row.folder.folderId] : []
    );

    expect(renderedFolders.sort()).toEqual([10, 11, 12]);
    expect(new Set(renderedFolders).size).toBe(renderedFolders.length);
    expect(rows.filter((row) => row.type === 'note')).toHaveLength(2);
  });
});
