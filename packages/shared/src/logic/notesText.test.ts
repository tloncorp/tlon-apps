import { describe, expect, test } from 'vitest';

import {
  formatNotesActivityLabel,
  formatNotesChannelSubtitle,
  getNoteBodyPreview,
  stripNoteMarkdown,
} from './notesText';

describe('stripNoteMarkdown', () => {
  test('drops code fences and keeps inline code text', () => {
    expect(
      stripNoteMarkdown('before\n```\nconst a = 1;\n```\nafter `inline` end')
    ).toBe('before after inline end');
  });

  test('keeps link text and drops images', () => {
    expect(
      stripNoteMarkdown('see [the spec](https://x.dev) ![shot](a.png) done')
    ).toBe('see the spec done');
  });

  test('strips headings, quotes, list markers and checkboxes', () => {
    expect(
      stripNoteMarkdown('## Title\n> quoted\n- [x] done item\n* bullet')
    ).toBe('Title quoted done item bullet');
  });

  test('strips emphasis markers and collapses whitespace', () => {
    expect(stripNoteMarkdown('**bold**   _italic_\n\n~strike~')).toBe(
      'bold italic strike'
    );
  });
});

describe('getNoteBodyPreview', () => {
  test('returns null when nothing survives stripping', () => {
    expect(getNoteBodyPreview('')).toBeNull();
    expect(getNoteBodyPreview(null)).toBeNull();
    expect(getNoteBodyPreview('```\ncode only\n```')).toBeNull();
  });

  test('returns the flattened body otherwise', () => {
    expect(getNoteBodyPreview('# Hi\n\nthere')).toBe('Hi there');
  });
});

describe('formatNotesChannelSubtitle', () => {
  test('counts notes and folders', () => {
    expect(formatNotesChannelSubtitle({ noteCount: 25, folderCount: 4 })).toBe(
      '25 notes in 4 folders'
    );
  });

  test('omits folders when there are none', () => {
    expect(formatNotesChannelSubtitle({ noteCount: 3, folderCount: 0 })).toBe(
      '3 notes'
    );
  });

  test('singularizes', () => {
    expect(formatNotesChannelSubtitle({ noteCount: 1, folderCount: 1 })).toBe(
      '1 note in 1 folder'
    );
  });

  test('reads as empty when there are no notes', () => {
    expect(formatNotesChannelSubtitle({ noteCount: 0, folderCount: 0 })).toBe(
      'No notes'
    );
    expect(formatNotesChannelSubtitle({ noteCount: 0, folderCount: 2 })).toBe(
      'No notes in 2 folders'
    );
  });
});

describe('formatNotesActivityLabel', () => {
  test('identifies a new note and its notebook', () => {
    expect(
      formatNotesActivityLabel({
        noteTitle: 'Weekly plan',
        notebookTitle: 'Journal',
        isNew: true,
      })
    ).toBe('New note “Weekly plan” in Journal');
  });

  test('distinguishes an edited note', () => {
    expect(
      formatNotesActivityLabel({
        noteTitle: 'Weekly plan',
        notebookTitle: 'Journal',
        isNew: false,
      })
    ).toBe('Note “Weekly plan” edited in Journal');
  });

  test('falls back cleanly when titles are unavailable', () => {
    expect(
      formatNotesActivityLabel({
        noteTitle: null,
        notebookTitle: 'Journal',
        isNew: true,
      })
    ).toBe('New note in Journal');
    expect(
      formatNotesActivityLabel({
        noteTitle: null,
        notebookTitle: null,
        isNew: false,
      })
    ).toBe('Note edited');
  });
});
