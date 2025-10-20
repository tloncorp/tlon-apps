import * as db from '../db';
import { createDevLogger } from '../debug';
import type * as ub from '../urbit';
import { toClientUnreads } from './activityApi';
import { ChannelInit, toClientChannelsInit } from './channelsApi';
import { toClientDms, toClientGroupDms } from './chatApi';
import {
  extractChannelReaders,
  toClientGroups,
  toClientGroupsFromForeigns,
  toClientGroupsFromGangs,
  toClientGroupsV7,
  toClientPinnedItems,
} from './groupsApi';
import { toClientHiddenPosts } from './postsApi';
import { scry } from './urbit';

const logger = createDevLogger('initApi', false);

export interface InitData {
  pins: db.Pin[];
  groups: db.Group[];
  unjoinedGroups: db.Group[];
  channels: db.Channel[];
  channelPerms: ChannelInit[];
  joinedGroups: string[];
  joinedChannels: string[];
  hiddenPostIds: string[];
  blockedUsers: string[];
  unreads: db.ActivityInit;
}

export const getInitData = async () => {
  const response = await scry<ub.GroupsInit5>({
    app: 'groups-ui',
    path: '/v5/init',
  });

  logger.crumb('got init data from api');

  return toInitData(response);
};

function isGroupsInit5(
  response: ub.GroupsInit4 | ub.GroupsInit5
): response is ub.GroupsInit5 {
  return 'foreigns' in response && !('gangs' in response);
}

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

export const toInitData = (
  response: ub.GroupsInit4 | ub.GroupsInit5
): InitData => {
  logger.crumb('converting init data to client data');
  logger.log('response.groups:', response.groups);

  const pins = toClientPinnedItems(response.pins);

  const isV5 = isGroupsInit5(response);

  const channelReaders: Record<string, string[]> = isV5
    ? extractChannelReadersFromV7Groups(
        response.groups as Record<string, ub.GroupV7>
      )
    : extractChannelReaders(response.groups as ub.Groups);

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

  const groups = isV5
    ? toClientGroupsV7(response.groups as Record<string, ub.GroupV7>, true)
    : toClientGroups(response.groups as ub.Groups, true);

  logger.crumb('converting unjoined groups to client data');

  const unjoinedGroups = isV5
    ? toClientGroupsFromForeigns((response as ub.GroupsInit5).foreigns)
    : toClientGroupsFromGangs((response as ub.GroupsInit4).gangs);

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
  // Not fully reflective of which channels you're a member of, but if a channel is _not_
  // in here, you're definitely not a member of it
  logger.crumb('extracting joined channels');

  const joinedChannels = channelsInit.map((channel) => channel.channelId);

  logger.crumb('returning init data');

  return {
    pins,
    groups,
    unjoinedGroups,
    unreads,
    channels: [...dmChannels, ...groupDmChannels, ...invitedDms],
    channelPerms: channelsInit,
    joinedGroups,
    joinedChannels,
    hiddenPostIds,
    blockedUsers,
  };
};
