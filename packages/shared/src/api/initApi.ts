import * as db from '../db';
import type * as ub from '../urbit';
import { ActivityInit, toClientUnreads } from './activityApi';
import { ChannelInit, toClientChannelsInit } from './channelsApi';
import { toClientDms, toClientGroupDms } from './chatApi';
import {
  extractChannelReaders,
  toClientGroups,
  toClientGroupsFromGangs,
  toClientPinnedItems,
} from './groupsApi';
import { scry } from './urbit';

export interface InitData {
  pins: db.Pin[];
  groups: db.Group[];
  unjoinedGroups: db.Group[];
  activity: ActivityInit;
  channels: db.Channel[];
  channelPerms: ChannelInit[];
  joinedGroups: string[];
  joinedChannels: string[];
}

export const getInitData = async () => {
  const response = await scry<ub.GroupsInit4>({
    app: 'groups-ui',
    path: '/v4/init',
  });

  const pins = toClientPinnedItems(response.pins);
  const channelReaders = extractChannelReaders(response.groups);
  const channelsInit = toClientChannelsInit(
    response.channel.channels,
    channelReaders
  );

  const hiddenGroupPosts = response.channel['hidden-posts'] ?? [];
  const hiddenDmPosts = response.chat['hidden-messages'] ?? [];
  const hiddenPostIds = [...hiddenGroupPosts, ...hiddenDmPosts]; // TODO: write these to DB
  const blockedUsers = response.chat.blocked ?? []; // TODO: write these to DB

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
    channelPerms: channelsInit,
    joinedGroups,
    joinedChannels,
  };
};
