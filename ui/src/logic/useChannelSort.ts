import { get } from 'lodash';
import { useCallback } from 'react';
import { useGroup, useRouteGroup } from '@/state/groups';
import { GroupChannel, Channels, Zone } from '@/types/groups';
import { useGetLatestMessage } from '@/state/chat';
import { ChatWhom } from '@/types/chat';
import useSidebarSort, {
  ALPHABETICAL,
  DEFAULT,
  RECENT,
  sortAlphabetical,
  Sorter,
} from './useSidebarSort';

const UNZONED = 'default';

function useRecentChannelSort() {
  const getLatest = useGetLatestMessage();

  const sortRecent = useCallback(
    (a: ChatWhom, b: ChatWhom) => {
      // TODO: why is bigInt comparison not working? strings do work :)
      // const aLast = getLatest(a)[0] ?? bigInt(Number.NEGATIVE_INFINITY);
      // const bLast = getLatest(b)[0] ?? bigInt(Number.NEGATIVE_INFINITY);
      const aLast = (getLatest(a)[0] ?? Number.NEGATIVE_INFINITY).toString();
      const bLast = (getLatest(b)[0] ?? Number.NEGATIVE_INFINITY).toString();

      if (aLast < bLast) {
        return -1;
      }
      if (aLast > bLast) {
        return 1;
      }
      return 0;
    },
    [getLatest]
  );

  return sortRecent;
}

export default function useChannelSort() {
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const sortRecent = useRecentChannelSort();

  const sortDefault = (a: Zone, b: Zone) => {
    if (!group) {
      return 0;
    }
    const aIdx =
      a in group['zone-ord']
        ? group['zone-ord'].findIndex((e) => e === a)
        : Number.POSITIVE_INFINITY;
    const bIdx =
      b in group['zone-ord']
        ? group['zone-ord'].findIndex((e) => e === b)
        : Number.POSITIVE_INFINITY;
    return aIdx - bIdx;
  };

  const sortOptions: Record<string, Sorter> = {
    [ALPHABETICAL]: sortAlphabetical,
    [DEFAULT]: sortDefault,
    [RECENT]: sortRecent,
  };

  const { sortFn, setSortFn, sortRecordsBy } = useSidebarSort({
    sortOptions,
    flag: groupFlag,
  });

  function sortChannels(channels: Channels) {
    const accessors: Record<string, (k: string, v: GroupChannel) => string> = {
      [ALPHABETICAL]: (_flag: string, channel: GroupChannel) =>
        get(channel, 'meta.title'),
      [DEFAULT]: (_flag: string, channel: GroupChannel) =>
        channel.zone || UNZONED,
      [RECENT]: (flag: string, _channel: GroupChannel) => flag,
    };

    return sortRecordsBy(channels, accessors[sortFn], sortFn === RECENT);
  }

  return {
    setSortFn,
    sortFn,
    sortOptions: {
      ...sortOptions,
      [DEFAULT]: sortDefault,
    },
    sortChannels,
  };
}
