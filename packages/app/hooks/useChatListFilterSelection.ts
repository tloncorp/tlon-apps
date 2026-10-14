import { useEffect, useState } from 'react';

import { type ChatListFilter, resolveListFilter } from './chatListFilters';

/**
 * The Workspaces filter the user picked, read against the chips on offer.
 *
 * A pick whose chip has gone (the last solo group grew) reads as All in the
 * same render, so the empty segment never paints. Once the list has loaded,
 * the fallback is committed, so a segment that refills later does not
 * re-select itself without a tap. Nothing was pressed, so callers should not
 * report the fallback as a selection.
 */
export function useChatListFilterSelection({
  visibleFilters,
  loaded,
}: {
  visibleFilters: ChatListFilter[];
  /** Whether the chat list has loaded. Before then nothing is committed. */
  loaded: boolean;
}) {
  const [selectedFilter, setSelectedFilter] = useState<ChatListFilter>('all');
  const listFilter = resolveListFilter(selectedFilter, visibleFilters);
  useEffect(() => {
    if (loaded && selectedFilter !== listFilter) {
      setSelectedFilter(listFilter);
    }
  }, [listFilter, loaded, selectedFilter]);
  return { listFilter, selectFilter: setSelectedFilter };
}
