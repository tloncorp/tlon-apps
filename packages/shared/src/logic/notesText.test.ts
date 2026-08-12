import { describe, expect, test } from 'vitest';

import { getNoteBodyPreview, stripNoteMarkdown } from './notesText';

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
