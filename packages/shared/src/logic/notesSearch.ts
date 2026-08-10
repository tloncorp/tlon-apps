// Snippet rendering for notes search results.
//
// The %notes bounded-search endpoint returns whole matched notes with no
// snippet or match offset, so the client locates the match itself. Matching
// mirrors the backend's `+find`: a case-insensitive substring scan, no word
// boundaries and no tokenization.
import { stripNoteMarkdown } from './notesText';

export interface NoteSnippetSegment {
  text: string;
  match: boolean;
}

export interface NoteSnippet {
  segments: NoteSnippetSegment[];
  // Whether the window dropped body text on either side, so the caller can
  // render leading/trailing ellipses.
  elidedStart: boolean;
  elidedEnd: boolean;
}

// Characters of surrounding context kept on each side of the first match.
const SNIPPET_CONTEXT = 80;
// Cap for a snippet with no match to anchor on (title-only hits).
const SNIPPET_LEAD = 160;

function findMatches(haystack: string, needle: string): [number, number][] {
  if (!needle) return [];
  const lowerHaystack = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const matches: [number, number][] = [];
  let from = 0;
  for (;;) {
    const start = lowerHaystack.indexOf(lowerNeedle, from);
    if (start === -1) break;
    matches.push([start, start + lowerNeedle.length]);
    from = start + lowerNeedle.length;
  }
  return matches;
}

function toSegments(
  text: string,
  matches: [number, number][]
): NoteSnippetSegment[] {
  const segments: NoteSnippetSegment[] = [];
  let cursor = 0;
  for (const [start, end] of matches) {
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), match: false });
    }
    segments.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }
  return segments;
}

/**
 * Build a one-line snippet of a note's markdown body, windowed around the
 * first match of `query` and split into plain and matched segments.
 *
 * A note can match on its title alone — and the backend matches raw markdown
 * while the snippet is stripped of it — so a body with no match here is not an
 * error: it yields an unhighlighted lead of the body.
 */
export function buildNoteSnippet(
  bodyMd: string | null | undefined,
  query: string
): NoteSnippet {
  const body = stripNoteMarkdown(bodyMd);
  const needle = query.trim();
  const matches = findMatches(body, needle);

  if (matches.length === 0) {
    const text = body.slice(0, SNIPPET_LEAD);
    return {
      segments: text ? [{ text, match: false }] : [],
      elidedStart: false,
      elidedEnd: text.length < body.length,
    };
  }

  const [firstStart, firstEnd] = matches[0];
  const start = Math.max(0, firstStart - SNIPPET_CONTEXT);
  const end = Math.min(body.length, firstEnd + SNIPPET_CONTEXT);
  const window = body.slice(start, end);
  // Re-scan the window rather than reusing the body offsets: later matches can
  // straddle the window edge, and a partial match must not be highlighted.
  return {
    segments: toSegments(window, findMatches(window, needle)),
    elidedStart: start > 0,
    elidedEnd: end < body.length,
  };
}

/**
 * Split a short single-line string (a note title) into plain and matched
 * segments, with no windowing.
 */
export function buildNoteTitleSegments(
  title: string,
  query: string
): NoteSnippetSegment[] {
  return toSegments(title, findMatches(title, query.trim()));
}

/**
 * Which of the result list's states to render. Ordering matters: a failed first
 * page reports `searchComplete` (nothing loading, no next page), so checking
 * completion before the error would make a backend failure read as a
 * successful empty search. Partial results alongside a failed later page still
 * show the results, with the error surfaced in the status line beneath them.
 */
export type NoteSearchListState =
  | 'idle'
  | 'results'
  | 'error'
  | 'searching'
  | 'empty';

export function noteSearchListState({
  errored,
  query,
  resultCount,
  searchComplete,
}: {
  errored: boolean;
  query: string;
  resultCount: number;
  searchComplete: boolean;
}): NoteSearchListState {
  if (query === '') return 'idle';
  if (resultCount > 0) return 'results';
  if (errored) return 'error';
  return searchComplete ? 'empty' : 'searching';
}
