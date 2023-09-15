import _, { get, groupBy } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChatStore, useChatStore } from '@/chat/useChatStore';
import { useChat, useChats, useMultiDms } from '@/state/chat';
import { useGroup, useGroups, useRouteGroup } from '@/state/groups';
import {
  useBriefs,
  useChannel as useChannelFromState,
  useJoinMutation,
  usePerms,
} from '@/state/channel/channel';
import { Chat } from '@/types/chat';
import { Briefs, Diary, Perm } from '@/types/channel';
import { Zone, Channels, GroupChannel, Vessel, Group } from '@/types/groups';
import { useLastReconnect } from '@/state/local';
import {
  getCompatibilityText,
  getFlagParts,
  isTalk,
  getNestShip,
  nestToFlag,
  sagaCompatible,
} from './utils';
import useSidebarSort, {
  useRecentSort,
  Sorter,
  ALPHABETICAL,
  sortAlphabetical,
  DEFAULT,
  RECENT,
} from './useSidebarSort';
import useRecentChannel from './useRecentChannel';

export function isChannelJoined(nest: string, briefs: Briefs) {
  const [flag] = nestToFlag(nest);
  const { ship } = getFlagParts(flag);

  const isChannelHost = window.our === ship;
  return isChannelHost || (nest && nest in briefs);
}

export function canReadChannel(
  channel: GroupChannel,
  vessel: Vessel,
  bloc: string[] = []
) {
  if (channel.readers.length === 0) {
    return true;
  }

  return _.intersection([...channel.readers, ...bloc], vessel.sects).length > 0;
}

export function canWriteChannel(
  perms: Perm,
  vessel: Vessel,
  bloc: string[] = []
) {
  if (perms.writers.length === 0) {
    return true;
  }

  return _.intersection([...perms.writers, ...bloc], vessel.sects).length > 0;
}

export function getChannelHosts(group: Group): string[] {
  return Object.keys(group.channels).map(getNestShip);
}

export function prettyChannelTypeName(app: string) {
  switch (app) {
    case 'chat':
      return 'Chat';
    case 'heap':
      return 'Collection';
    case 'diary':
      return 'Notebook';
    default:
      return 'Unknown';
  }
}

export function channelHref(flag: string, ch: string) {
  return `/groups/${flag}/channels/${ch}`;
}

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
  briefs: Briefs,
  chats: ChatStore['chats']
) {
  const [app, chFlag] = nestToFlag(nest);
  const unread = chats[chFlag]?.unread;

  if (app === 'chat') {
    return Boolean(unread && !unread.seen);
  }

  return (briefs[nest]?.count ?? 0) > 0;
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
  const briefs = useBriefs();
  const chats = useChatStore(selChats);

  return useCallback(
    (nest: string) => channelUnread(nest, briefs, chats),
    [briefs, chats]
  );
}

export function useIsChannelUnread(nest: string) {
  const briefs = useBriefs();
  const chats = useChatStore(selChats);

  return channelUnread(nest, briefs, chats);
}

export const useIsChannelHost = (flag: string) =>
  window.our === flag?.split('/')[0];

export function useChannelOld(nest: string): Chat | Diary | undefined {
  const [app, flag] = nestToFlag(nest);
  const chat = useChat(flag);
  const heap = useChannelFromState(`heap/${flag}`);
  const diary = useChannelFromState(`diary/${flag}`);

  switch (app) {
    case 'chat':
      return chat;
    case 'heap':
      return heap;
    case 'diary':
      return diary;
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

export function useChannelIsJoined(nest: string) {
  const briefs = useBriefs();
  return isChannelJoined(nest, briefs);
}

export function useCheckChannelJoined() {
  const briefs = useBriefs();

  return useCallback(
    (nest: string) => {
      return isChannelJoined(nest, briefs);
    },
    [briefs]
  );
}

export function useChannelCompatibility(nest: string) {
  const channel = useChannelOld(nest);
  const saga = channel?.saga || null;

  return {
    saga,
    compatible: sagaCompatible(saga),
    text: getCompatibilityText(saga),
  };
}

interface FullChannelParams {
  groupFlag: string;
  nest: string;
  initialize?: () => void;
}

const emptyVessel = {
  sects: [],
  joined: 0,
};

export function useFullChannel({
  groupFlag,
  nest,
  initialize,
}: FullChannelParams) {
  const navigate = useNavigate();
  const group = useGroup(groupFlag);
  const [, chan] = nestToFlag(nest);
  const { ship } = getFlagParts(chan);
  const vessel = useMemo(
    () => group?.fleet?.[window.our] || emptyVessel,
    [group]
  );
  const { writers } = usePerms(nest);
  const groupChannel = group?.channels?.[nest];
  const channel = useChannelFromState(nest);
  const compat = useChannelCompatibility(nest);
  const canWrite =
    ship === window.our ||
    (canWriteChannel({ writers, group: groupFlag }, vessel, group?.bloc) &&
      compat.compatible);
  const canRead = groupChannel
    ? canReadChannel(groupChannel, vessel, group?.bloc)
    : false;
  const [joining, setJoining] = useState(false);
  const joined = useChannelIsJoined(nest);
  const { setRecentChannel } = useRecentChannel(groupFlag);
  const lastReconnect = useLastReconnect();
  const { mutateAsync: join } = useJoinMutation();

  const joinChannel = useCallback(async () => {
    setJoining(true);
    try {
      await join({ group: groupFlag, chan });
    } catch (e) {
      console.log("Couldn't join chat (maybe already joined)", e);
    }
    setJoining(false);
  }, [groupFlag, chan, join]);

  useEffect(() => {
    if (!joined) {
      joinChannel();
    }
  }, [joined, joinChannel, channel]);

  useEffect(() => {
    if (joined && !joining && channel && canRead) {
      if (initialize) {
        initialize();
      }
      setRecentChannel(nest);
    }
  }, [
    nest,
    setRecentChannel,
    joined,
    joining,
    channel,
    canRead,
    lastReconnect,
    initialize,
  ]);

  useEffect(() => {
    if (channel && !canRead) {
      if (isTalk) {
        navigate('/');
      } else {
        navigate(`/groups/${groupFlag}`);
      }
      setRecentChannel('');
    }
  }, [groupFlag, group, channel, vessel, navigate, setRecentChannel, canRead]);

  return {
    groupFlag,
    nest,
    flag: chan,
    group,
    channel,
    groupChannel,
    canRead,
    canWrite,
    compat,
    joined,
  };
}
