import { describe, expect, test } from 'vitest';

import {
  buildNotesImportItems,
  makeUniqueNoteTitle,
  normalizeTitleKey,
} from './notesImport';

describe('notes import helpers', () => {
  test('builds import items for single markdown and text files', () => {
    const items = buildNotesImportItems([
      {
        name: 'Plan.md',
        relativePath: 'Plan.md',
        contents: '# Plan',
      },
      {
        name: 'Memo.txt',
        relativePath: 'Memo.txt',
        contents: 'Memo body',
      },
    ]);

    expect(items).toMatchObject([
      {
        title: 'Plan',
        body: '# Plan',
        folderSegments: [],
      },
      {
        title: 'Memo',
        body: 'Memo body',
        folderSegments: [],
      },
    ]);
  });

  test('preserves nested folder paths and ignores unsupported files', () => {
    const items = buildNotesImportItems([
      {
        name: 'Index.markdown',
        relativePath: 'Research/Trips/Index.markdown',
        contents: 'Trip notes',
      },
      {
        name: 'image.png',
        relativePath: 'Research/image.png',
        contents: 'not text',
      },
      {
        name: 'Secret.md',
        relativePath: 'Research/.drafts/Secret.md',
        contents: 'hidden',
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Index',
      folderSegments: ['Research', 'Trips'],
      body: 'Trip notes',
    });
  });

  test('dedupes titles within a folder', () => {
    const existingTitles = new Set([normalizeTitleKey('Plan')]);

    expect(makeUniqueNoteTitle('Plan', existingTitles)).toBe('Plan (2)');
    expect(makeUniqueNoteTitle('Plan', existingTitles)).toBe('Plan (3)');
    expect(makeUniqueNoteTitle('', existingTitles)).toBe('Untitled');
  });
});
