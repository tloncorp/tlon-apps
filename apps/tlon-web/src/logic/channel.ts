import {
  Activity,
  MessageKey,
  Source,
} from '@tloncorp/shared/dist/urbit/activity';
import { Perm, Story } from '@tloncorp/shared/dist/urbit/channel';
import { isLink } from '@tloncorp/shared/dist/urbit/content';
import {
  Channels,
  Group,
  GroupChannel,
  Vessel,
  Zone,
} from '@tloncorp/shared/dist/urbit/groups';
import _, { get, groupBy } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';

import { ChatStore, useChatStore } from '@/chat/useChatStore';
import { useNavWithinTab } from '@/components/Sidebar/util';
import {
  ALPHABETICAL_SORT,
  DEFAULT_SORT,
  RECENT_SORT,
  SortMode,
} from '@/constants';
import { useMarkReadMutation } from '@/state/activity';
import { useChannel, useJoinMutation, usePerms } from '@/state/channel/channel';
import { useGroup, useRouteGroup } from '@/state/groups';
import { useLastReconnect } from '@/state/local';
import { useNegotiate } from '@/state/negotiation';
import {
  Unread,
  UnreadsStore,
  useUnreads,
  useUnreadsStore,
} from '@/state/unreads';

import useRecentChannel from './useRecentChannel';
import useSidebarSort, {
  Sorter,
  sortAlphabetical,
  useRecentSort,
} from './useSidebarSort';
import { getFirstInline, getFlagParts, getNestShip, nestToFlag } from './utils';

export function isChannelJoined(nest: string, unreads: Record<string, Unread>) {
  const [flag] = nestToFlag(nest);
  const { ship } = getFlagParts(flag);

  const isChannelHost = window.our === ship;
  return isChannelHost || (nest && `channel/${nest}` in unreads);
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

function channelUnread(nest: string, unreads: Record<string, Unread>) {
  const unread = unreads[`channel/${nest}`];
  if (!unread) {
    return false;
  }

  return unread.status === 'unread';
}

export function useCheckChannelUnread() {
  const unreads = useUnreads();
  const isChannelUnread = useCallback(
    (nest: string) => {
      return channelUnread(nest, unreads);
    },
    [unreads]
  );

  const getUnread = useCallback(
    (nest: string) => {
      if (!unreads) {
        return null;
      }

      return unreads[`channel/${nest}`];
    },
    [unreads]
  );

  return {
    isChannelUnread,
    getUnread,
  };
}

export function useIsChannelUnread(nest: string) {
  const unreads = useUnreads();

  return channelUnread(nest, unreads);
}

export const useIsChannelHost = (flag: string) =>
  window.our === flag?.split('/')[0];

const UNZONED = 'default';

export function useChannelSort(defaultSort: SortMode = DEFAULT_SORT) {
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const sortRecent = useRecentSort();

  const sortDefault = useCallback(
    (a: Zone, b: Zone) => {
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
    },
    [group]
  );

  const sortOptions: Record<string, Sorter> = useMemo(
    () => ({
      [ALPHABETICAL_SORT]: sortAlphabetical,
      [DEFAULT_SORT]: sortDefault,
      [RECENT_SORT]: sortRecent,
    }),
    [sortDefault, sortRecent]
  );

  const { sortFn, setSortFn, sortRecordsBy } = useSidebarSort({
    sortOptions,
    flag: groupFlag === '' && !group ? '~' : groupFlag,
    defaultSort,
  });

  const sortChannels = useCallback(
    (channels: Channels) => {
      const accessors: Record<string, (k: string, v: GroupChannel) => string> =
        {
          [ALPHABETICAL_SORT]: (_flag: string, channel: GroupChannel) =>
            get(channel, 'meta.title'),
          [DEFAULT_SORT]: (_flag: string, channel: GroupChannel) =>
            channel.zone || UNZONED,
          [RECENT_SORT]: (flag: string, _channel: GroupChannel) => flag,
        };

      return sortRecordsBy(
        channels,
        accessors[sortFn] || accessors[defaultSort],
        sortFn === RECENT_SORT
      );
    },
    [sortFn, defaultSort, sortRecordsBy]
  );

  return {
    setSortFn,
    sortFn,
    sortOptions,
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

const getLoaded = (s: UnreadsStore) => s.loaded;
export function useChannelIsJoined(nest: string) {
  const loaded = useUnreadsStore(getLoaded);
  const unreads = useUnreads();
  return !loaded || isChannelJoined(nest, unreads);
}

export function useCheckChannelJoined() {
  const loaded = useUnreadsStore(getLoaded);
  const unreads = useUnreads();
  return useCallback(
    (nest: string) => {
      return !loaded || isChannelJoined(nest, unreads);
    },
    [unreads, loaded]
  );
}

export function useChannelCompatibility(nest: string) {
  const [, chan] = nestToFlag(nest);
  const { ship } = getFlagParts(chan);
  const { status } = useNegotiate(ship, 'channels', 'channels-server');

  const matched = status === 'match';

  return {
    compatible: matched,
    text: matched
      ? "You're synced with the host."
      : 'Your version of the app does not match the host.',
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
  const { navigate } = useNavWithinTab();
  const group = useGroup(groupFlag);
  const [, chan] = nestToFlag(nest);
  const { ship } = getFlagParts(chan);
  const vessel = useMemo(
    () => group?.fleet?.[window.our] || emptyVessel,
    [group]
  );
  const { writers } = usePerms(nest);
  const groupChannel = group?.channels?.[nest];
  const channel = useChannel(nest);
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
      await join({ group: groupFlag, chan: nest });
    } catch (e) {
      console.log("Couldn't join chat (maybe already joined)", e);
    }
    setJoining(false);
  }, [groupFlag, nest, join]);

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
      navigate(`/groups/${groupFlag}`);
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

export function inlineContentIsLink(content: Story) {
  const firstInline = getFirstInline(content);
  if (!firstInline) {
    return false;
  }

  return isLink(firstInline[0]);
}

export function linkUrlFromContent(content: Story) {
  const firstInline = getFirstInline(content);
  if (!firstInline) {
    return undefined;
  }

  if (isLink(firstInline[0])) {
    return firstInline[0].link.href;
  }

  return undefined;
}

export function useMarkChannelRead(nest: string, thread?: MessageKey) {
  const group = useRouteGroup();
  const { mutateAsync, ...rest } = useMarkReadMutation();
  const markRead = useCallback(() => {
    const source: Source = thread
      ? {
          thread: {
            group,
            channel: nest,
            key: thread,
          },
        }
      : { channel: { group, nest } };
    return mutateAsync({ source });
  }, [group, nest, thread, mutateAsync]);

  return { markRead, ...rest };
}
