import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import { useEffect, useMemo } from 'react';

import * as db from '../db';
import { createDevLogger } from '../debug';
import { groupsVersionSupportsNotesSearch } from '../logic/notesSearchSupport';

const logger = createDevLogger('notes search', false);

// Notes examined per request. The endpoint bounds a call by notes *searched*,
// not hits returned, so this is a work budget: one page may contain no hits at
// all and still leave the notebook only partly searched.
const SEARCH_PAGE_TRIES = 100;

// Keep paging until the list can plausibly fill a screen, so a query whose only
// hits are old notes doesn't read as "no results" after one empty page.
const MIN_RESULT_LOAD_THRESHOLD = 20;

/**
 * The cursor to resume the walk from, or undefined when the notebook has been
 * searched to its end. `last` is 0 only at the end — an empty page with a live
 * cursor still has more to search.
 */
export function nextNotesSearchCursor(
  page: api.NotesSearchPage
): number | undefined {
  return page.last === 0 ? undefined : page.last;
}

/**
 * Whether this ship's %notes can serve a notebook search. Gate search entry
 * points on it so an older backend gets no affordance rather than a 404.
 */
export function useNotesSearchSupported(): boolean {
  const appInfo = db.appInfo.useValue();
  return groupsVersionSupportsNotesSearch(appInfo?.groupsVersion);
}

/**
 * Whether there is more notebook left to search. A failed page leaves
 * react-query's `hasNextPage` set from the last successful one, and reporting
 * that as "more" is what lets a failure loop: every consumer that asks for the
 * next page — the fill-the-screen effect, the list's `onEndReached` — retries
 * the page that just failed. Derived in one place so no caller has to remember
 * to check `errored` alongside it.
 */
export function notesSearchHasMore({
  errored,
  hasNextPage,
}: {
  errored: boolean;
  hasNextPage: boolean;
}): boolean {
  return hasNextPage && !errored;
}

export function useNotesSearch(
  notebookFlag: string | null | undefined,
  query: string
) {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    isError,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['notesSearch', notebookFlag, query],
    enabled: query !== '' && Boolean(notebookFlag),
    queryFn: async ({ pageParam }) => {
      logger.log('searching', notebookFlag, query, pageParam);
      const page = await api.notes.searchNotes({
        flag: notebookFlag!,
        needle: query,
        from: pageParam,
        tries: SEARCH_PAGE_TRIES,
      });
      logger.log('got result page', page.notes.length, 'next', page.last);
      return page;
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: nextNotesSearchCursor,
  });

  // The walk is newest-first and each page's window is strictly below the
  // previous cursor, so concatenating pages preserves descending note order
  // without a re-sort.
  const notes = useMemo(
    () => data?.pages.flatMap((page) => page.notes) ?? [],
    [data]
  );

  const loading = isLoading || isFetchingNextPage;

  // A failed page leaves react-query's hasNextPage set from the last good one.
  // Reporting that as "more to search" is what lets a failure loop: both the
  // fill-the-screen effect below and the list's onEndReached would keep asking
  // for the page that just failed. One derived value so no consumer has to
  // remember to check `errored` itself.
  const hasMore = notesSearchHasMore({ errored: isError, hasNextPage });

  useEffect(() => {
    if (notes.length < MIN_RESULT_LOAD_THRESHOLD && hasMore && !loading) {
      fetchNextPage();
    }
  }, [notes, hasMore, loading, fetchNextPage]);

  return {
    notes,
    loading,
    errored: isError,
    hasMore,
    loadMore: fetchNextPage,
    searchComplete: !loading && !hasMore,
  };
}
