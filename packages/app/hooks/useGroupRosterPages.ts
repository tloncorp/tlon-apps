import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo, useState } from 'react';

// At most this many pages of holders per role section. A role held by most
// of a big group would otherwise pull the whole roster in.
const MAX_ROLE_PAGES = 4;

/**
 * Loads a big group's roster a page at a time for the members screen. Pages
 * are stored as they arrive, so the screen keeps reading members from the
 * group; this only decides what to fetch and how far the list is complete.
 * Small groups, and desks that don't serve pages, sync whole as before.
 */
export function useGroupRosterPages(group: db.Group | null) {
  const groupId = group?.id ?? '';
  const pagedNow = !!group && store.isRosterPaged(group);
  // once this screen pages a group, it keeps paging: a count dipping under
  // the threshold mid-load would otherwise switch it to the partial roster
  // stored so far, and nothing would load the rest until it remounts
  const [pagedGroupId, setPagedGroupId] = useState<string | null>(null);
  if (pagedNow && pagedGroupId !== groupId) {
    setPagedGroupId(groupId);
  }
  const paged = pagedNow || (!!group && pagedGroupId === groupId);
  const roleIds = useMemo(
    () => (group?.roles ?? []).map((role) => role.id).sort(),
    [group?.roles]
  );

  // every role's holders up front, so the role sections are whole
  useQuery({
    queryKey: ['groupRosterRoles', groupId, roleIds],
    enabled: paged && roleIds.length > 0,
    queryFn: async () => {
      for (const roleId of roleIds) {
        let after: string | null = null;
        for (let i = 0; i < MAX_ROLE_PAGES; i++) {
          const page = await store.syncGroupMembersPage({
            groupId,
            roleId,
            after,
          });
          after = page.next;
          if (!after) break;
        }
      }
      return null;
    },
  });

  const pages = useInfiniteQuery({
    queryKey: ['groupRosterPages', groupId],
    enabled: paged,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      store.syncGroupMembersPage({ groupId, after: pageParam }),
    getNextPageParam: (page) => page.next ?? undefined,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = pages;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const lastPage = pages.data?.pages.at(-1);
  return {
    paged,
    // members past this ship haven't been checked against the desk yet;
    // null once every page has loaded, or when the group isn't paged
    loadedThrough: paged && lastPage?.next ? lastPage.next : null,
    // until the first page lands, nothing past the light roster is known
    awaitingFirstPage: paged && !pages.data,
    hasMore: paged && (!pages.data || !!hasNextPage),
    isLoading: paged && pages.isFetching,
    loadMore,
  };
}
