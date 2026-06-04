import { describe, expect, it } from 'vitest';

import { parseTlonMarkdownRanges } from './tlonMarkdownParser';

// Helper: find a range of a given type covering the substring `sub` in `text`.
function rangeFor(text: string, sub: string, type: string) {
  const start = text.indexOf(sub);
  return { type, start, length: sub.length };
}

describe('parseTlonMarkdownRanges (Tlon dialect)', () => {
  it('returns nothing for plain text', () => {
    expect(parseTlonMarkdownRanges('just some text')).toEqual([]);
  });

  it('bolds **double-asterisk** content and dims the markers', () => {
    const text = 'a **bold** b';
    const ranges = parseTlonMarkdownRanges(text);
    expect(ranges).toContainEqual({ type: 'syntax', start: 2, length: 2 });
    expect(ranges).toContainEqual({ type: 'bold', start: 4, length: 4 }); // "bold"
    expect(ranges).toContainEqual({ type: 'syntax', start: 8, length: 2 });
  });

  it('treats single *asterisk* as italic, not bold (CommonMark)', () => {
    const text = 'a *it* b';
    const ranges = parseTlonMarkdownRanges(text);
    expect(ranges).toContainEqual({ type: 'italic', start: 3, length: 2 }); // "it"
    expect(ranges.some((r) => r.type === 'bold')).toBe(false);
  });

  it('treats _underscore_ as italic', () => {
    const text = 'x _em_ y';
    const ranges = parseTlonMarkdownRanges(text);
    expect(ranges).toContainEqual({ type: 'italic', start: 3, length: 2 });
  });

  it('treats __double-underscore__ as bold', () => {
    const text = '__b__';
    const ranges = parseTlonMarkdownRanges(text);
    expect(ranges).toContainEqual({ type: 'bold', start: 2, length: 1 });
  });

  it('treats ~~text~~ as strikethrough (GFM), not a mention', () => {
    const text = 'a ~~no~~ b';
    const ranges = parseTlonMarkdownRanges(text);
    expect(ranges).toContainEqual({
      type: 'strikethrough',
      start: 4,
      length: 2,
    });
  });

  it('styles `inline code` and excludes markdown inside it', () => {
    const text = 'use `a *b* c` now';
    const ranges = parseTlonMarkdownRanges(text);
    expect(ranges).toContainEqual(rangeFor(text, 'a *b* c', 'code'));
    // the * inside code must NOT be parsed as italic
    expect(ranges.some((r) => r.type === 'italic')).toBe(false);
  });

  it('styles an h1 heading and dims the # marker', () => {
    const text = '# Title';
    const ranges = parseTlonMarkdownRanges(text);
    expect(ranges).toContainEqual({ type: 'syntax', start: 0, length: 2 }); // "# "
    expect(ranges).toContainEqual({ type: 'h1', start: 2, length: 5 }); // "Title"
  });

  it('styles deeper headings by level (h2, h3, ... by # count)', () => {
    const h2 = parseTlonMarkdownRanges('## Two');
    expect(h2).toContainEqual({ type: 'syntax', start: 0, length: 3 }); // "## "
    expect(h2).toContainEqual({ type: 'h2', start: 3, length: 3 }); // "Two"

    const h3 = parseTlonMarkdownRanges('### Deep');
    expect(h3).toContainEqual({ type: 'syntax', start: 0, length: 4 }); // "### "
    expect(h3).toContainEqual({ type: 'h3', start: 4, length: 4 }); // "Deep"
  });

  it('styles a blockquote line (whole-line range + depth) and dims the > marker', () => {
    const text = '> quoted';
    const ranges = parseTlonMarkdownRanges(text);
    expect(ranges).toContainEqual({ type: 'syntax', start: 0, length: 2 }); // "> "
    // whole line, depth 1 — the native side draws the bar from depth at line start
    expect(ranges).toContainEqual({
      type: 'blockquote',
      start: 0,
      length: 8,
      depth: 1,
    });
  });

  it('handles bold and italic on the same line', () => {
    const text = '**b** and *i*';
    const ranges = parseTlonMarkdownRanges(text);
    expect(ranges).toContainEqual({ type: 'bold', start: 2, length: 1 }); // "b"
    expect(ranges).toContainEqual({ type: 'italic', start: 11, length: 1 }); // "i"
  });
});
