import _ from 'lodash';
import { useCallback, useMemo } from 'react';

import { DEFAULT_SORT, RECENT_SORT, SortMode } from '@/constants';
import { useActivity } from '@/state/activity';
import {
  useGroupSideBarSort,
  usePutEntryMutation,
  useSideBarSortMode,
} from '@/state/settings';

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
  const { activity } = useActivity();
  const recencyMap = useMemo(() => {
    return _.mapValues(activity, ({ recency }) => recency);
  }, [activity]);

  const sortRecent = useCallback(
    (aIndex: string, bIndex: string) => {
      const aLast = recencyMap[aIndex] ?? Number.NEGATIVE_INFINITY;
      const bLast = recencyMap[bIndex] ?? Number.NEGATIVE_INFINITY;

      return Math.sign(aLast - bLast);
    },
    [recencyMap]
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
    ): [string, T][] => {
      // pre-compute values for comparison
      const entries = Object.entries(records).map(([key, obj]) => ({
        key,
        obj,
        value: accessor(key, obj),
      }));

      // integrate reverse sorting logic into the comparison
      const directionMultiplier = reverse ? -1 : 1;

      entries.sort((a, b) => {
        const sorter = sortOptions[sortFn] ?? sortOptions[RECENT_SORT];
        return directionMultiplier * sorter(a.value, b.value);
      });

      // map back to the original format
      return entries.map(({ key, obj }) => [key, obj]);
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
