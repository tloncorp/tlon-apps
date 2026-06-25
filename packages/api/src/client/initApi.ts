import { createDevLogger } from '../lib/logger';
import type * as db from '../types/models';
import type * as ub from '../urbit';
import { toClientUnreads } from './activityApi';
import { ChannelInit, toClientChannelsInit } from './channelsApi';
import { toClientDms, toClientGroupDms } from './chatApi';
import {
  toClientGroupsFromForeigns,
  toClientGroupsV7,
  toClientPinnedItems,
} from './groupsApi';
import { toClientHiddenPosts } from './postsApi';
import { getCurrentUserId, scry } from './urbit';

const logger = createDevLogger('initApi', false);

export interface InitData {
  pins: db.Pin[];
  groups: db.Group[];
  unjoinedGroups: db.Group[];
  channels: db.Channel[];
  channelPerms: ChannelInit[];
  joinedGroups: string[];
  joinedGroupChannels: string[];
  hiddenPostIds: string[];
  blockedUsers: string[];
  unreads: db.ActivityInit;
}

export const getInitData = async () => {
  const response = await scry<ub.GroupsInit7>({
    app: 'groups-ui',
    path: '/v7/init',
  });

  logger.crumb('got init data from api');

  return toInitData(response);
};

function extractChannelReadersFromV7Groups(
  groups: Record<string, ub.GroupV7>
): Record<string, string[]> {
  const readers: Record<string, string[]> = {};
  Object.entries(groups).forEach(([_groupId, group]) => {
    if (group.channels) {
      Object.entries(group.channels).forEach(([channelId, channel]) => {
        readers[channelId] = channel.readers ?? [];
      });
    }
  });
  return readers;
}

function extractJoinedGroupChannelsFromV7Groups(
  groups: Record<string, ub.GroupV7>
): string[] {
  const joinedChannelIds = new Set<string>();
  const currentUserId = getCurrentUserId();

  Object.values(groups ?? {}).forEach((group) => {
    const currentUserRoles = group.seats?.[currentUserId]?.roles ?? [];

    (group['active-channels'] ?? []).forEach((channelId) => {
      joinedChannelIds.add(channelId);
    });

    // Older %notes backends create a group listing with join=true, but do not
    // report the matching %groups active-channel event. Treat only notes
    // listings as joined so initial sync does not hide newly-created notebooks.
    Object.entries(group.channels ?? {}).forEach(([channelId, channel]) => {
      const readers = channel.readers ?? [];
      const canRead =
        readers.length === 0 ||
        readers.some((roleId) => currentUserRoles.includes(roleId));
      if (channelId.startsWith('notes/') && channel.join && canRead) {
        joinedChannelIds.add(channelId);
      }
    });
  });

  return [...joinedChannelIds];
}

export const toInitData = (response: ub.GroupsInit7): InitData => {
  logger.crumb('converting init data to client data');
  logger.log('response.groups:', response.groups);

  const pins = toClientPinnedItems(response.pins);

  const channelReaders = extractChannelReadersFromV7Groups(response.groups);

  const channelsInit = toClientChannelsInit(
    response.channel.channels,
    channelReaders
  );

  logger.crumb('extracting hidden posts');

  const hiddenGroupPosts = response.channel['hidden-posts'] ?? [];
  const hiddenDmPosts = response.chat['hidden-messages'] ?? [];
  const hiddenPostIds = toClientHiddenPosts([
    ...hiddenGroupPosts,
    ...hiddenDmPosts,
  ]);

  logger.crumb('extracting blocked users');

  const blockedUsers = response.chat.blocked ?? [];

  logger.crumb('converting groups to client data');

  const groups = toClientGroupsV7(response.groups, true);

  logger.crumb('converting unjoined groups to client data');

  const unjoinedGroups = toClientGroupsFromForeigns(response.foreigns);

  logger.crumb('converting dm channels to client data');

  const dmChannels = toClientDms(response.chat.dms);

  logger.crumb('converting group dm channels to client data');

  const groupDmChannels = toClientGroupDms(response.chat.clubs);

  logger.crumb('converting invited dm channels to client data');

  const invitedDms = toClientDms(response.chat.invited, true);

  logger.crumb('converting unreads to client data');

  const unreads = toClientUnreads(response.activity ?? {});

  logger.crumb('extracting joined groups');

  const joinedGroups = groups.map((group) => group.id);

  logger.crumb('extracting joined channels');

  const joinedGroupChannels = extractJoinedGroupChannelsFromV7Groups(
    response.groups
  );

  logger.crumb('returning init data');

  return {
    pins,
    groups,
    unjoinedGroups,
    unreads,
    channels: [...dmChannels, ...groupDmChannels, ...invitedDms],
    channelPerms: channelsInit,
    joinedGroups,
    joinedGroupChannels,
    hiddenPostIds,
    blockedUsers,
  };
};
