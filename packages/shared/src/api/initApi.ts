import * as db from '../db';
import type * as ub from '../urbit';
import { toClientChannelsInit } from './channelsApi';
import { toClientDms, toClientGroupDms } from './chatApi';
import {
  toClientGroups,
  toClientGroupsFromGangs,
  toClientPinnedItems,
} from './groupsApi';
import { toClientUnreads } from './unreadsApi';
import { scry } from './urbit';

export interface InitData {
  pins: db.Pin[];
  groups: db.Group[];
  unreads: db.Unread[];
  channels: db.Channel[];
}

export const getInitData = async (currentUserId: string) => {
  const response = await scry<ub.GroupsInit>({
    app: 'groups-ui',
    path: '/v1/init',
  });

  const pins = toClientPinnedItems(response.pins);
  const channelsInit = toClientChannelsInit(response.channels);
  const groups = [
    ...toClientGroupsFromGangs(response.gangs),
    ...toClientGroups(response.groups, true),
  ];
  const channelUnreads = toClientUnreads(response.unreads, 'channel');
  const dmChannels = toClientDms(response.chat.dms);
  const groupDmChannels = toClientGroupDms(response.chat.clubs, currentUserId);
  const talkUnreads = toClientUnreads(response.chat.unreads, 'dm');

  return {
    pins,
    groups,
    unreads: [...channelUnreads, ...talkUnreads],
    channels: [...dmChannels, ...groupDmChannels],
    channelPerms: channelsInit,
  };
};
