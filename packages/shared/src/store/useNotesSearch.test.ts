import { describe, expect, test } from 'vitest';

import { nextNotesSearchCursor, notesSearchHasMore } from './useNotesSearch';

describe('nextNotesSearchCursor', () => {
  test('resumes from the cursor a partial walk stopped at', () => {
    expect(nextNotesSearchCursor({ last: 42, notes: [] })).toBe(42);
  });

  test('keeps paging after a page that found nothing', () => {
    // The endpoint bounds by notes examined, so an empty page is not the end.
    expect(nextNotesSearchCursor({ last: 7, notes: [] })).toBe(7);
  });

  test('stops at last=0, the end of the notebook', () => {
    expect(nextNotesSearchCursor({ last: 0, notes: [] })).toBeUndefined();
  });
});

describe('notesSearchHasMore', () => {
  test('reports more while pages remain and nothing has failed', () => {
    expect(notesSearchHasMore({ errored: false, hasNextPage: true })).toBe(
      true
    );
  });

  test('reports no more once a page has failed', () => {
    // react-query keeps hasNextPage from the last good page, so without this
    // every consumer asking for the next page retries the failed one forever.
    expect(notesSearchHasMore({ errored: true, hasNextPage: true })).toBe(
      false
    );
  });

  test('reports no more at the end of the notebook', () => {
    expect(notesSearchHasMore({ errored: false, hasNextPage: false })).toBe(
      false
    );
  });
});
