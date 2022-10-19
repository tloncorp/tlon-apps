import { useCallback } from 'react';
import { useBriefs } from '@/state/chat';
import { ChatWhom } from '@/types/chat';
import {
  SettingsState,
  useSettingsState,
  useGroupSideBarSort,
} from '@/state/settings';

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

export const sortAlphabetical = (a: ChatWhom, b: ChatWhom) =>
  a.localeCompare(b);

const selSideBarSort = (s: SettingsState) => ({
  sideBarSort: s.groups.sideBarSort,
});

export function useRecentSort() {
  const briefs = useBriefs();
  const sortRecent = useCallback(
    (a: ChatWhom, b: ChatWhom) => {
      const aLast = briefs[a]?.last ?? Number.NEGATIVE_INFINITY;
      const bLast = briefs[b]?.last ?? Number.NEGATIVE_INFINITY;
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
  sortOptions,
  flag = '~',
}: UseSidebarSort) {
  const { sideBarSort } = useSettingsState(selSideBarSort);
  const groupSideBarSort = useGroupSideBarSort();

  const setSideBarSort = (mode: SortMode) => {
    useSettingsState.getState().putEntry('groups', 'sideBarSort', mode);
  };

  const setGroupSideBarSort = (mode: SortMode) => {
    useSettingsState
      .getState()
      .putEntry('groups', 'groupSideBarSort', JSON.stringify({ [flag]: mode }));
  };

  /**
   * Sorts a Record object by an accessed value of T, returns an array of entries
   * @param records An object shaped like { [string]: [T] }, e.g. { "~tlon/group": [{ // Group obj }]}
   * @param accessor Function to get the comparison field
   * @param reverse Whether to reverse the sorted list (ASC --> DEC)
   * @returns [string, T][]
   */
  function sortRecordsBy<T>(
    records: Record<string, T>,
    accessor: (k: string, v: T) => string,
    reverse = false
  ) {
    const entries = Object.entries(records);
    entries.sort(([aKey, aObj], [bKey, bObj]) => {
      const aVal = accessor(aKey, aObj);
      const bVal = accessor(bKey, bObj);

      return sortOptions[sideBarSort ?? 'A → Z'](aVal, bVal);
    });

    return reverse ? entries.reverse() : entries;
  }

  const sortFn = groupSideBarSort[flag] || sideBarSort;

  return {
    setSortFn: flag ? setGroupSideBarSort : setSideBarSort,
    sortFn,
    sortOptions,
    sortRecordsBy,
  };
}
