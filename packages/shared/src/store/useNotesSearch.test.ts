import { describe, expect, test } from 'vitest';

import { nextNotesSearchCursor } from './useNotesSearch';

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
