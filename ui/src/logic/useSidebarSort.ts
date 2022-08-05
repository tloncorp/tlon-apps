import { GroupChannel, Channels, Group, Groups } from '@/types/groups';
import { get } from 'lodash';
import { useCallback, useState } from 'react';
import { useBriefs } from '../state/chat';
import { ChatWhom } from '../types/chat';

export const ALPHABETICAL = 'A → Z';
export const RECENT = 'Recent';

export default function useSidebarSort(
  defaultSort?: typeof ALPHABETICAL | typeof RECENT
) {
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

  const sortAlphabetical = (a: ChatWhom, b: ChatWhom) => a.localeCompare(b);

  const [sortFn, setSortFn] = useState<string>(defaultSort || ALPHABETICAL);
  const sortOptions: Record<
    string,
    typeof sortRecent | typeof sortAlphabetical
  > = {
    [ALPHABETICAL]: sortAlphabetical,
    [RECENT]: sortRecent,
  };

  /**
   * Sorts a Record object by an accessed value of T, returns an array of entries
   * @param records An object shaped like { [string]: [T] }, e.g. { "~tlon/group": { // Group obj }}
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

      return sortOptions[sortFn](aVal, bVal);
    });

    return reverse ? entries.reverse() : entries;
  }

  function sortChannels(channels: Channels) {
    const accessors: Record<string, (k: string, v: GroupChannel) => string> = {
      [ALPHABETICAL]: (_flag: string, channel: GroupChannel) =>
        get(channel, 'meta.title'),
      [RECENT]: (flag: string, _channel: GroupChannel) => flag,
    };

    return sortRecordsBy(channels, accessors[sortFn], sortFn === RECENT);
  }

  function sortGroups(groups: Groups) {
    const accessors: Record<string, (k: string, v: Group) => string> = {
      [ALPHABETICAL]: (_flag: string, group: Group) => get(group, 'meta.title'),
      [RECENT]: (flag: string, group: Group) => {
        /**
         * Use the latest channel flag associated with the Group; otherwise
         * fallback to the Group flag itself, which won't be in the briefs and
         * thus use INFINITY by default
         */
        const channels = sortChannels(group.channels);
        return channels.length > 0 ? channels[0][0] : flag;
      },
    };

    return sortRecordsBy(groups, accessors[sortFn], sortFn === RECENT);
  }

  return {
    setSortFn,
    sortFn,
    sortOptions,
    sortChannels,
    sortGroups,
  };
}
