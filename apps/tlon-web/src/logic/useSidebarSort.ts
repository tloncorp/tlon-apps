import { useCallback, useMemo } from 'react';

import { DEFAULT_SORT, RECENT_SORT, SortMode } from '@/constants';
import { useUnreads } from '@/state/channel/channel';
import { useDmUnreads } from '@/state/chat';
import {
  useGroupSideBarSort,
  usePutEntryMutation,
  useSideBarSortMode,
} from '@/state/settings';

import { whomIsDm, whomIsMultiDm } from './utils';

export interface Sorter {
  (a: string, b: string): number;
}
interface UseSidebarSort {
  defaultSort?: SortMode;
  sortOptions: Record<string, Sorter>;
  flag?: string;
}

export const sortAlphabetical = (aNest: string, bNest: string) =>
  aNest.localeCompare(bNest);

export function useRecentSort() {
  const channelUnreads = useUnreads();
  const { data: dmUnreads } = useDmUnreads();
  const sortRecent = useCallback(
    (aNest: string, bNest: string) => {
      const aUnreads =
        whomIsDm(aNest) || whomIsMultiDm(aNest) ? dmUnreads : channelUnreads;
      const aLast = aUnreads[aNest]?.recency ?? Number.NEGATIVE_INFINITY;

      const bUnreads =
        whomIsDm(bNest) || whomIsMultiDm(bNest) ? dmUnreads : channelUnreads;
      const bLast = bUnreads[bNest]?.recency ?? Number.NEGATIVE_INFINITY;

      if (aLast < bLast) {
        return -1;
      }
      if (aLast > bLast) {
        return 1;
      }
      return 0;
    },
    [dmUnreads, channelUnreads]
  );

  return sortRecent;
}

/**
 * This hook implements a few sorting primitives that are consumed via
 * composition in higher order hooks: useChannelSort and useGroupSort
 *
 * @returns an object with sorting functions to be consumed in view components
 */
export default function useSidebarSort({
  defaultSort,
  sortOptions,
  flag = '~',
}: UseSidebarSort) {
  const sideBarSort = useSideBarSortMode();
  const groupSideBarSort = useGroupSideBarSort();
  const sortFn = useMemo(
    () =>
      flag !== '~'
        ? groupSideBarSort[flag] ?? (defaultSort || DEFAULT_SORT)
        : sideBarSort,
    [defaultSort, flag, groupSideBarSort, sideBarSort]
  );
  const { mutate: mutateSidebar } = usePutEntryMutation({
    bucket: 'groups',
    key: 'sideBarSort',
  });
  const { mutate: mutateGroupSidebar } = usePutEntryMutation({
    bucket: 'groups',
    key: 'groupSideBarSort',
  });
  const setSideBarSort = useCallback(
    (mode: string) => {
      mutateSidebar({ val: mode });
    },
    [mutateSidebar]
  );

  const setGroupSideBarSort = useCallback(
    (mode: string) => {
      mutateGroupSidebar({
        val: JSON.stringify({ ...groupSideBarSort, [flag]: mode }),
      });
    },
    [flag, groupSideBarSort, mutateGroupSidebar]
  );

  /**
   * Sorts a Record object by an accessed value of T, returns an array of entries
   * @param records An object shaped like { [string]: [T] }, e.g. { "~tlon/group": [{ // Group obj }]}
   * @param accessor Function to get the comparison field
   * @param reverse Whether to reverse the sorted list (ASC --> DEC)
   * @returns [string, T][]
   */
  const sortRecordsBy = useCallback(
    <T>(
      records: Record<string, T>,
      accessor: (k: string, v: T) => string,
      reverse = false
    ) => {
      const entries = Object.entries(records);
      entries.sort(([aKey, aObj], [bKey, bObj]) => {
        const aVal = accessor(aKey, aObj);
        const bVal = accessor(bKey, bObj);

        const sorter = sortOptions[sortFn] ?? sortOptions[RECENT_SORT];
        return sorter(aVal, bVal);
      });

      return reverse ? entries.reverse() : entries;
    },
    [sortFn, sortOptions]
  );

  const setSortFn = useMemo(
    () => (mode: string) =>
      flag !== '~' ? setGroupSideBarSort(mode) : setSideBarSort(mode),
    [flag, setGroupSideBarSort, setSideBarSort]
  );

  return {
    setSortFn,
    sortFn,
    sortOptions,
    sortRecordsBy,
  };
}
