import { get } from 'lodash';
import { useCallback } from 'react';
import { useGroup, useRouteGroup } from '@/state/groups';
import { GroupChannel, Channels, Zone } from '@/types/groups';
import { useGetLatestChat } from '@/state/chat';
import { ChatWhom } from '@/types/chat';
import { useGetLatestNote } from '@/state/diary';
import { useGetLatestCurio } from '@/state/heap/heap';
import useSidebarSort, {
  ALPHABETICAL,
  DEFAULT,
  RECENT,
  sortAlphabetical,
  Sorter,
} from './useSidebarSort';
import { nestToFlag } from './utils';

const UNZONED = 'default';

function useGetLatestPost() {
  const getLatestChat = useGetLatestChat();
  const getLatestCurio = useGetLatestCurio();
  const getLatestNote = useGetLatestNote();

  return (flag: string) => {
    const [chType, _chFlag] = nestToFlag(flag);

    switch (chType) {
      case 'chat':
        return (getLatestChat(flag)[0] ?? Number.NEGATIVE_INFINITY).toString();

      case 'diary':
        return (getLatestNote(flag)[0] ?? Number.NEGATIVE_INFINITY).toString();

      case 'heap':
        return (getLatestCurio(flag)[0] ?? Number.NEGATIVE_INFINITY).toString();

      default:
        return Number.NEGATIVE_INFINITY.toString();
    }
  };
}

function useRecentChannelSort() {
  const getLatestPost = useGetLatestPost();

  const sortRecent = useCallback(
    (a: ChatWhom, b: ChatWhom) => {
      const aLast = getLatestPost(a);
      const bLast = getLatestPost(b);

      if (aLast < bLast) {
        return -1;
      }
      if (aLast > bLast) {
        return 1;
      }
      return 0;
    },
    [getLatestPost]
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
