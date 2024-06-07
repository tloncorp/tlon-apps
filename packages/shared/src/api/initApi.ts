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
  unjoinedGroups: db.Group[];
  unreads: db.Unread[];
  channels: db.Channel[];
}

export const getInitData = async () => {
  const response = await scry<
    ub.GroupsInit & {
      unreads: ub.Unreads;
      chat: ub.DMInit & { unreads: ub.Unreads };
    }
  >({
    app: 'groups-ui',
    path: '/v1/init',
  });

  const pins = toClientPinnedItems(response.pins);
  const channelsInit = toClientChannelsInit(response.channels);
  const groups = toClientGroups(response.groups, true);
  const unjoinedGroups = toClientGroupsFromGangs(response.gangs);
  const channelUnreads = toClientUnreads(response.unreads, 'channel');
  const dmChannels = toClientDms(response.chat.dms);
  const groupDmChannels = toClientGroupDms(response.chat.clubs);
  const invitedDms = toClientDms(response.chat.invited, true);
  const talkUnreads = toClientUnreads(response.chat.unreads, 'dm');

  return {
    pins,
    groups,
    unjoinedGroups,
    unreads: [...channelUnreads, ...talkUnreads],
    channels: [...dmChannels, ...groupDmChannels, ...invitedDms],
    channelPerms: channelsInit,
  };
};
