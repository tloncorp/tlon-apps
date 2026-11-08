import { describe, expect, it } from 'vitest';

import { insertNoteBodyBlocks } from './noteImageMarkdown';

describe('insertNoteBodyBlocks', () => {
  it('puts a block in its own paragraph mid-line', () => {
    const result = insertNoteBodyBlocks('before after', { start: 6, end: 7 }, [
      'IMG',
    ]);
    expect(result.body).toBe('before\n\nIMG\n\nafter');
    expect(result.body.slice(0, result.caret)).toBe('before\n\nIMG\n\n');
  });

  it('adds no padding at the edges of the body', () => {
    expect(insertNoteBodyBlocks('', { start: 0, end: 0 }, ['A', 'B'])).toEqual({
      body: 'A\n\nB',
      caret: 4,
    });
  });

  it('reuses newlines already around the caret', () => {
    expect(
      insertNoteBodyBlocks('one\n\ntwo', { start: 5, end: 5 }, ['IMG']).body
    ).toBe('one\n\nIMG\n\ntwo');
    expect(
      insertNoteBodyBlocks('one\n', { start: 4, end: 4 }, ['IMG']).body
    ).toBe('one\n\nIMG');
  });

  it('clamps a selection past the end of the body', () => {
    expect(
      insertNoteBodyBlocks('abc', { start: 10, end: 10 }, ['IMG']).body
    ).toBe('abc\n\nIMG');
  });
});
