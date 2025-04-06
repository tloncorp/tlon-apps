import * as db from '../db';
import type * as ub from '../urbit';
import { nullIfError } from '../utils';
import { ActivityInit, toClientUnreads } from './activityApi';
import { ChannelInit, toClientChannelsInit } from './channelsApi';
import { toClientDms, toClientGroupDms } from './chatApi';
import {
  extractChannelReaders,
  toClientGroups,
  toClientGroupsFromGangs,
  toClientPinnedItems,
} from './groupsApi';
import { toClientHiddenPosts } from './postsApi';
import { scry } from './urbit';

export interface InitData {
  pins: db.Pin[];
  groups: db.Group[];
  unjoinedGroups: db.Group[];
  activity: ActivityInit;
  channels: db.Channel[];
  channelsInit: ChannelInit[];
  joinedGroups: string[];
  joinedChannels: string[];
  hiddenPostIds: string[];
  blockedUsers: string[];
}

export const getInitData = async () => {
  const response = await scry<ub.GroupsInit5>({
    app: 'groups-ui',
    path: '/v5/init',
  });

  const pins = toClientPinnedItems(response.pins);
  const channelReaders = extractChannelReaders(response.groups);
  const channelsInit = toClientChannelsInit(
    Object.entries(response.channel.channels).reduce((acc, [key, value]) => {
      acc[key] = {
        ...value,
        meta: nullIfError(() =>
          value.meta == null ? null : JSON.parse(value.meta)
        ),
      };
      return acc;
    }, {} as ub.Channels),
    channelReaders
  );

  const hiddenGroupPosts = response.channel['hidden-posts'] ?? [];
  const hiddenDmPosts = response.chat['hidden-messages'] ?? [];
  const hiddenPostIds = toClientHiddenPosts([
    ...hiddenGroupPosts,
    ...hiddenDmPosts,
  ]);
  const blockedUsers = response.chat.blocked ?? [];

  const groups = toClientGroups(response.groups, true);
  const unjoinedGroups = toClientGroupsFromGangs(response.gangs);
  const dmChannels = toClientDms(response.chat.dms);
  const groupDmChannels = toClientGroupDms(response.chat.clubs);
  const invitedDms = toClientDms(response.chat.invited, true);
  const unreads = toClientUnreads(response.activity ?? {});

  const joinedGroups = groups.map((group) => group.id);
  // Not fully reflective of which channels you're a member of, but if a channel is _not_
  // in here, you're definitely not a member of it
  const joinedChannels = channelsInit.map((channel) => channel.channelId);

  return {
    pins,
    groups,
    unjoinedGroups,
    unreads,
    channels: [...dmChannels, ...groupDmChannels, ...invitedDms],
    channelsInit,
    joinedGroups,
    joinedChannels,
    hiddenPostIds,
    blockedUsers,
  };
};
