import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import { useEffect, useMemo } from 'react';

import { createDevLogger } from '../debug';

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

  useEffect(() => {
    if (notes.length < MIN_RESULT_LOAD_THRESHOLD && hasNextPage && !loading) {
      fetchNextPage();
    }
  }, [notes, hasNextPage, loading, fetchNextPage]);

  return {
    notes,
    loading,
    errored: isError,
    hasMore: hasNextPage,
    loadMore: fetchNextPage,
    searchComplete: !loading && !hasNextPage,
  };
}
