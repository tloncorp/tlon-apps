import _, { get, groupBy } from 'lodash';
import { useParams } from 'react-router';
import { ChatStore, useChatStore } from '@/chat/useChatStore';
import useAllBriefs from '@/logic/useAllBriefs';
import { useBriefs, useChat, useChats, useMultiDms } from '@/state/chat';
import { useGroup, useGroups, useRouteGroup } from '@/state/groups';
import { useCallback, useMemo } from 'react';
import { useDiary } from '@/state/diary';
import { useHeap } from '@/state/heap/heap';
import { useBoardMeta } from '@/state/quorum';
import { Chat } from '@/types/chat';
import { Diary } from '@/types/diary';
import { Heap } from '@/types/heap';
import { Quorum } from '@/types/quorum';
import { Zone, Channels, GroupChannel } from '@/types/groups';
import { canReadChannel, isChannelJoined, nestToFlag } from './utils';
import useSidebarSort, {
  useRecentSort,
  Sorter,
  ALPHABETICAL,
  sortAlphabetical,
  DEFAULT,
  RECENT,
} from './useSidebarSort';

export function useChannelFlag() {
  const { chShip, chName } = useParams();
  return useMemo(
    () => (chShip && chName ? `${chShip}/${chName}` : null),
    [chShip, chName]
  );
}

const selChats = (s: ChatStore) => s.chats;

function channelUnread(
  nest: string,
  briefs: ReturnType<typeof useAllBriefs>,
  chats: ChatStore['chats']
) {
  const [app, chFlag] = nestToFlag(nest);
  const unread = chats[chFlag]?.unread;

  if (app === 'chat') {
    return Boolean(unread && !unread.seen);
  }

  return (briefs[app]?.[chFlag]?.count ?? 0) > 0;
}

interface ChannelUnreadCount {
  scope: 'Group Channels' | 'Direct Messages' | 'All Messages';
}

export function useChannelUnreadCounts(args: ChannelUnreadCount) {
  const briefs = useBriefs();
  const chats = useChats();
  const multiDms = useMultiDms();
  const groups = useGroups();
  const chatKeys = Object.keys(chats);

  const filteredBriefs = _.fromPairs(
    Object.entries(briefs).filter(([k, v]) => {
      const chat = chats[k];
      if (chat) {
        const group = groups[chat.perms.group];
        const channel = group?.channels[`chat/${k}`];
        const vessel = group?.fleet[window.our];
        return channel && vessel && canReadChannel(channel, vessel, group.bloc);
      }

      const club = multiDms[k];
      if (club) {
        return club.team.concat(club.hive).includes(window.our);
      }

      return true;
    })
  );

  switch (args.scope) {
    case 'All Messages':
      return _.sumBy(Object.values(filteredBriefs), 'count');
    case 'Group Channels':
      return _.sumBy(Object.values(_.pick(filteredBriefs, chatKeys)), 'count');
    case 'Direct Messages':
      return _.sumBy(Object.values(_.omit(briefs, chatKeys)), 'count');
    default:
      return _.sumBy(Object.values(filteredBriefs), 'count');
  }
}

export function useCheckChannelUnread() {
  const briefs = useAllBriefs();
  const chats = useChatStore(selChats);

  return useCallback(
    (nest: string) => channelUnread(nest, briefs, chats),
    [briefs, chats]
  );
}

export function useIsChannelUnread(nest: string) {
  const briefs = useAllBriefs();
  const chats = useChatStore(selChats);

  return channelUnread(nest, briefs, chats);
}

export const useIsChannelHost = (flag: string) =>
  window.our === flag?.split('/')[0];

export function useChannel(nest: string): Chat | Heap | Diary | Quorum | undefined {
  const [app, flag] = nestToFlag(nest);
  const chat = useChat(flag);
  const heap = useHeap(flag);
  const diary = useDiary(flag);
  const board = useBoardMeta(flag);

  switch (app) {
    case 'chat':
      return chat;
    case 'heap':
      return heap;
    case 'diary':
      return diary;
    case 'quorum':
      return {
        perms: {
          writers: board?.writers ?? [],
          group: board?.group ?? '',
        }
      };
    default:
      return undefined;
  }
}

const UNZONED = 'default';

export function useChannelSort() {
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const sortRecent = useRecentSort();

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
    flag: groupFlag === '' ? '~' : groupFlag,
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

export function useChannelSections(groupFlag: string) {
  const group = useGroup(groupFlag, true);

  if (!group) {
    return {
      sections: [],
      sectionedChannels: {},
    };
  }

  const sections = [...group['zone-ord']];
  const sectionedChannels = groupBy(
    Object.entries(group.channels),
    ([, ch]) => ch.zone
  );

  Object.entries(sectionedChannels).forEach((section) => {
    const oldOrder = section[1];
    const zone = section[0];
    const sortedChannels: [string, GroupChannel][] = [];
    group?.zones[zone]?.idx?.forEach((nest) => {
      const match = oldOrder.find((n) => n[0] === nest);
      if (match) {
        sortedChannels.push(match);
      }
    });
    sectionedChannels[zone] = sortedChannels;
  });

  return {
    sectionedChannels,
    sections,
  };
}

function channelIsJoined(
  nest: string,
  briefs: ReturnType<typeof useAllBriefs>
) {
  const [app, flag] = nestToFlag(nest);

  return briefs[app] && Object.keys(briefs[app]).length > 0
    ? isChannelJoined(flag, briefs[app])
    : false;
}

export function useChannelIsJoined(nest: string) {
  const briefs = useAllBriefs();

  return channelIsJoined(nest, briefs);
}

export function useCheckChannelJoined() {
  const briefs = useAllBriefs();

  return useCallback(
    (nest: string) => {
      return channelIsJoined(nest, briefs);
    },
    [briefs]
  );
}
