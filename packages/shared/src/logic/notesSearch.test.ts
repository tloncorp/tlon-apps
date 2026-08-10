import { describe, expect, test } from 'vitest';

import {
  buildNoteSnippet,
  buildNoteTitleSegments,
  noteSearchListState,
} from './notesSearch';

function render(segments: { text: string; match: boolean }[]): string {
  return segments
    .map((segment) => (segment.match ? `[${segment.text}]` : segment.text))
    .join('');
}

describe('buildNoteSnippet', () => {
  test('highlights every match in the window, case-insensitively', () => {
    const snippet = buildNoteSnippet('A Needle, then a needle.', 'needle');

    expect(render(snippet.segments)).toBe('A [Needle], then a [needle].');
    expect(snippet.elidedStart).toBe(false);
    expect(snippet.elidedEnd).toBe(false);
  });

  test('windows around the first match and reports both elisions', () => {
    const body = `${'a'.repeat(300)} needle ${'b'.repeat(300)}`;
    const snippet = buildNoteSnippet(body, 'needle');

    expect(snippet.elidedStart).toBe(true);
    expect(snippet.elidedEnd).toBe(true);
    const text = snippet.segments.map((s) => s.text).join('');
    expect(text).toContain('needle');
    // 80 chars of context on each side, plus the match itself.
    expect(text.length).toBe(80 + 'needle'.length + 80);
    expect(snippet.segments.filter((s) => s.match)).toEqual([
      { text: 'needle', match: true },
    ]);
  });

  test('does not highlight a match the window cut in half', () => {
    // The second match starts inside the window but runs past its end.
    const body = `needle ${'x'.repeat(76)}needle`;
    const snippet = buildNoteSnippet(body, 'needle');

    expect(snippet.elidedEnd).toBe(true);
    expect(snippet.segments.filter((s) => s.match)).toEqual([
      { text: 'needle', match: true },
    ]);
    expect(render(snippet.segments).endsWith('nee')).toBe(true);
  });

  test('flattens markdown structure into a single line', () => {
    const snippet = buildNoteSnippet(
      '# Heading\n\n- one\n-   two needle three\n',
      'needle'
    );

    expect(render(snippet.segments)).toBe('Heading one two [needle] three');
  });

  test('matches against the stripped body, so markdown syntax is unmatchable', () => {
    // The backend matched raw markdown; the snippet shows stripped text, so a
    // syntax-only needle falls back to an unhighlighted lead rather than lying.
    const snippet = buildNoteSnippet('some **bold** text', '**bold**');

    expect(render(snippet.segments)).toBe('some bold text');
  });

  test('falls back to a body lead for a title-only match', () => {
    const snippet = buildNoteSnippet('body text without the term', 'needle');

    expect(render(snippet.segments)).toBe('body text without the term');
    expect(snippet.elidedEnd).toBe(false);
  });

  test('truncates a long unmatched lead and marks it elided', () => {
    const snippet = buildNoteSnippet('c'.repeat(400), 'needle');

    expect(snippet.segments).toEqual([{ text: 'c'.repeat(160), match: false }]);
    expect(snippet.elidedEnd).toBe(true);
  });

  test('handles an empty body and an empty query without matching', () => {
    expect(buildNoteSnippet('', 'needle')).toEqual({
      segments: [],
      elidedStart: false,
      elidedEnd: false,
    });
    expect(buildNoteSnippet(null, 'needle').segments).toEqual([]);
    expect(buildNoteSnippet('some body', '   ').segments).toEqual([
      { text: 'some body', match: false },
    ]);
  });

  test('treats regex metacharacters in the query as literal text', () => {
    const snippet = buildNoteSnippet('shipped v1.0 today, not v1x0', 'v1.0');

    expect(render(snippet.segments)).toBe('shipped [v1.0] today, not v1x0');
  });
});

describe('buildNoteTitleSegments', () => {
  test('splits a title on its matches without windowing', () => {
    expect(render(buildNoteTitleSegments('Needle in a title', 'needle'))).toBe(
      '[Needle] in a title'
    );
  });

  test('returns the whole title when nothing matches', () => {
    expect(buildNoteTitleSegments('Untitled', 'needle')).toEqual([
      { text: 'Untitled', match: false },
    ]);
    expect(buildNoteTitleSegments('Untitled', '')).toEqual([
      { text: 'Untitled', match: false },
    ]);
  });
});

describe('noteSearchListState', () => {
  const base = {
    errored: false,
    query: 'blob',
    resultCount: 0,
    searchComplete: false,
  };

  test('an untouched search is idle', () => {
    expect(noteSearchListState({ ...base, query: '' })).toBe('idle');
  });

  test('a failed first page is an error, not an empty result', () => {
    // The failure reports searchComplete — nothing loading, no next page — so
    // ordering completion first would render "no notes match" for a backend
    // that never answered.
    expect(
      noteSearchListState({ ...base, errored: true, searchComplete: true })
    ).toBe('error');
  });

  test('an exhausted search with nothing found is empty', () => {
    expect(noteSearchListState({ ...base, searchComplete: true })).toBe(
      'empty'
    );
  });

  test('no hits yet with more to search is still searching', () => {
    expect(noteSearchListState(base)).toBe('searching');
  });

  test('hits win over a later failed page, which the status line reports', () => {
    expect(
      noteSearchListState({ ...base, resultCount: 3, errored: true })
    ).toBe('results');
  });
});
