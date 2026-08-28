import { createDevLogger } from '../lib/logger';
import type * as db from '../types/models';
import type * as ub from '../urbit';
import type { BucketsSummary } from '../urbit/buckets';
import { toClientUnreads } from './activityApi';
import { ChannelInit, toClientChannelsInit } from './channelsApi';
import { toClientDms, toClientGroupDms } from './chatApi';
import {
  toClientGroupsFromForeigns,
  toClientGroupsV7,
  toClientPinnedItems,
} from './groupsApi';
import { toClientHiddenPosts } from './postsApi';
import { getActivitySupportsNotes, getCurrentUserId, scry } from './urbit';

const logger = createDevLogger('initApi', false);

export interface InitData {
  pins: db.Pin[];
  groups: db.Group[];
  unjoinedGroups: db.Group[];
  channels: db.Channel[];
  channelPerms: ChannelInit[];
  buckets: BucketsSummary[];
  joinedGroups: string[];
  joinedGroupChannels: string[];
  hiddenPostIds: string[];
  blockedUsers: string[];
  unreads: db.ActivityInit;
}

type InitDataOptions = {
  currentUserId: string;
};

export const getInitData = async () => {
  // /v10/init carries the same v10-native activity /v9 did, plus Buckets and
  // their writer roles. Gated on the same capability as /v9 because the
  // activity shape is what differs from /v7; a backend new enough for one is
  // new enough for the other, since both ship in this desk.
  const response = await scry<ub.GroupsInit7>({
    app: 'groups-ui',
    path: getActivitySupportsNotes() ? '/v10/init' : '/v7/init',
  });

  logger.crumb('got init data from api');

  return toInitData(response, { currentUserId: getCurrentUserId() });
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

  Object.values(groups ?? {}).forEach((group) => {
    (group['active-channels'] ?? []).forEach((channelId) => {
      joinedChannelIds.add(channelId);
    });
  });

  return [...joinedChannelIds];
}

export const toInitData = (
  response: ub.GroupsInit7,
  options: InitDataOptions
): InitData => {
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

  const groups = toClientGroupsV7(response.groups, true, options.currentUserId);

  logger.crumb('converting unjoined groups to client data');

  const unjoinedGroups = toClientGroupsFromForeigns(
    response.foreigns,
    options.currentUserId
  );

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
    buckets: response.buckets ?? [],
  };
};
