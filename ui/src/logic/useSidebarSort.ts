import { useCallback, useMemo } from 'react';
import {
  useGroupSideBarSort,
  usePutEntryMutation,
  useSideBarSortMode,
} from '@/state/settings';
import useAllBriefs from './useAllBriefs';
import { nestToFlag } from './utils';

export const ALPHABETICAL = 'A → Z';
export const DEFAULT = 'Arranged';
export const RECENT = 'Recent';

type SortMode = typeof ALPHABETICAL | typeof DEFAULT | typeof RECENT;
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
  const briefs = useAllBriefs();
  const sortRecent = useCallback(
    (aNest: string, bNest: string) => {
      const [aApp, aFlag] = nestToFlag(aNest);
      const aLast = briefs[aApp]?.[aFlag]?.last ?? Number.NEGATIVE_INFINITY;
      const [bApp, bFlag] = nestToFlag(bNest);
      const bLast = briefs[bApp]?.[bFlag]?.last ?? Number.NEGATIVE_INFINITY;
      if (aLast < bLast) {
        return -1;
      }
      if (aLast > bLast) {
        return 1;
      }
      return 0;
    },
    [briefs]
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
      defaultSort ||
      (flag !== '~' ? groupSideBarSort[flag] ?? DEFAULT : sideBarSort),
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

        const sorter = sortOptions[sortFn] ?? sortOptions[ALPHABETICAL];
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
