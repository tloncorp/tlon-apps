import * as db from '../db';
import type * as ub from '../urbit';
// import { toClientUnreads } from './unreadsApi';
import { ActivityInit, toClientActivity } from './activityApi';
import { ChannelInit, toClientChannelsInit } from './channelsApi';
import { toClientDms, toClientGroupDms } from './chatApi';
import {
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
}

export const getInitData = async (): Promise<InitData> => {
  const response = await scry<ub.GroupsInit>({
    app: 'groups-ui',
    path: '/v2/init',
  });

  const pins = toClientPinnedItems(response.pins);
  const channelsInit = toClientChannelsInit(response.channels);
  const groups = toClientGroups(response.groups, true);
  const unjoinedGroups = toClientGroupsFromGangs(response.gangs);
  const dmChannels = toClientDms(response.chat.dms);
  const groupDmChannels = toClientGroupDms(response.chat.clubs);
  const invitedDms = toClientDms(response.chat.invited, true);
  const activity = toClientActivity(response.activity ?? {});

  return {
    pins,
    groups,
    unjoinedGroups,
    activity,
    channels: [...dmChannels, ...groupDmChannels, ...invitedDms],
    channelPerms: channelsInit,
  };
};
