import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  getDeskServesRosterPages,
  onDeskServesRosterPagesChange,
} from '@tloncorp/api';
import type * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

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
  // re-render when the desk starts or stops serving pages
  const servesPages = useSyncExternalStore(
    onDeskServesRosterPagesChange,
    getDeskServesRosterPages
  );
  const pagedNow = !!group && store.isRosterPaged(group);
  // once this screen pages a group, it keeps paging: a count dipping under
  // the threshold mid-load would otherwise switch it to the partial roster
  // stored so far, and nothing would load the rest until it remounts
  const [pagedGroupId, setPagedGroupId] = useState<string | null>(null);
  if (pagedNow && pagedGroupId !== groupId) {
    setPagedGroupId(groupId);
  }
  // ...as long as the desk still serves pages
  const paged =
    pagedNow || (!!group && pagedGroupId === groupId && servesPages);
  // a desk that stops serving them leaves only part of the roster stored,
  // so load the rest whole
  const pagesWithdrawn = !!groupId && pagedGroupId === groupId && !servesPages;
  useEffect(() => {
    if (!pagesWithdrawn) return;
    // wholeRoster, so a light sync still in flight can't stand in for it.
    // syncGroup reports its own failures.
    store
      .syncGroup(
        groupId,
        { priority: store.SyncPriority.High },
        { wholeRoster: true }
      )
      .catch(() => {});
  }, [pagesWithdrawn, groupId]);
  // a new session follows a dropped connection, which may have missed seat
  // events, so the pages start over with it
  const sessionStartTime = store.useCurrentSession()?.startTime;
  const roleIds = useMemo(
    () => (group?.roles ?? []).map((role) => role.id).sort(),
    [group?.roles]
  );

  // every role's holders up front, so the role sections are whole. A role
  // with more holders than the cap isn't checked past the pages it loaded,
  // so it isn't reported whole and its holders wait for the main pages.
  const roleHolders = useQuery({
    queryKey: ['groupRosterRoles', groupId, roleIds, sessionStartTime],
    enabled: paged && roleIds.length > 0,
    // fresh on every visit: the cache never goes stale on its own, and a
    // group left and rejoined would otherwise keep its old pages
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const wholeRoles: string[] = [];
      for (const roleId of roleIds) {
        let after: string | null = null;
        for (let i = 0; i < MAX_ROLE_PAGES; i++) {
          if (signal.aborted) return wholeRoles;
          const page = await store.syncGroupMembersPage(
            { groupId, roleId, after },
            { priority: store.SyncPriority.Medium, abortSignal: signal }
          );
          after = page.next;
          if (!after) break;
        }
        if (!after) wholeRoles.push(roleId);
      }
      return wholeRoles;
    },
  });
  const wholeRoles = useMemo(
    () => new Set(roleHolders.data ?? []),
    [roleHolders.data]
  );

  const pages = useInfiniteQuery({
    queryKey: ['groupRosterPages', groupId, sessionStartTime],
    enabled: paged,
    gcTime: 0,
    initialPageParam: null as string | null,
    // the signal cancels a page still in flight when the screen closes, so
    // it can't write after a leave and rejoin
    queryFn: ({ pageParam, signal }) =>
      store.syncGroupMembersPage(
        { groupId, after: pageParam },
        { priority: store.SyncPriority.Medium, abortSignal: signal }
      ),
    getNextPageParam: (page) => page.next ?? undefined,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = pages;
  // a first page that failed leaves no cursor to go on from
  const firstPageFailed = pages.isError && !pages.data;
  const loadMore = useCallback(() => {
    if (firstPageFailed) {
      refetch();
    } else if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [
    firstPageFailed,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  const lastPage = pages.data?.pages.at(-1);
  return {
    paged,
    // members past this ship haven't been checked against the desk yet;
    // null once every page has loaded, or when the group isn't paged
    loadedThrough: paged && lastPage?.next ? lastPage.next : null,
    // until the first page lands, nothing past the light roster is known.
    // If it failed, the light roster is all there is to show until loadMore
    // retries it.
    awaitingFirstPage: paged && !pages.data && !firstPageFailed,
    // roles whose holders have all been checked against the desk
    wholeRoles,
    hasMore: paged && (!pages.data || !!hasNextPage),
    isLoading: paged && pages.isFetching,
    loadMore,
  };
}
