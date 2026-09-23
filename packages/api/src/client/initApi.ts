import { createDevLogger } from '../lib/logger';
import type * as db from '../types/models';
import type * as ub from '../urbit';
import type { BucketsSummary } from '../urbit/buckets';
import { toClientUnreads } from './activityApi';
import { ChannelInit, toClientChannelsInit } from './channelsApi';
import { toClientDms, toClientGroupDms } from './chatApi';
import {
  toClientGroups,
  toClientGroupsFromForeigns,
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
  // /v11/init is /v10 plus Buckets and their writer roles, which no agent
  // but %buckets models — so a Bucket learned from the group alone arrives
  // without them. /v10 is /v9 plus the group blob: v10-native activity
  // (notebook/note sources) so a fresh init hydrates pre-existing note
  // unreads, over v11 groups so it also carries blob. Old backends don't
  // serve it.
  // A ship whose desk predates Buckets serves /v10 but not /v11, and letting
  // that 404 escape abandons the whole high-priority batch -- the client then
  // hydrates no groups and no channels at all. That is every user in the
  // window between updating the app and updating their ship, so fall back
  // rather than fail. An absent buckets field is simply no buckets, which
  // +toInitData already accepts.
  let response: ub.GroupsInit11 | (ub.GroupsInit10 & { buckets?: never });
  try {
    response = await scry<ub.GroupsInit11>({
      app: 'groups-ui',
      path: '/v11/init',
    });
  } catch (v11Error) {
    logger.crumb('v11 init unavailable, falling back to v10');
    try {
      response = await scry<ub.GroupsInit10>({
        app: 'groups-ui',
        path: '/v10/init',
      });
    } catch (v10Error) {
      // Both gone means the ship is unreachable or far older, which is a real
      // failure -- surface the original rather than masking it as a fallback
      // problem.
      throw v11Error;
    }
  }

  logger.crumb('got init data from api');

  return toInitData(response, { currentUserId: getCurrentUserId() });
};

function extractChannelReadersFromGroups(
  groups: Record<string, ub.GroupV11>
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
  groups: Record<string, ub.GroupV11>
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
  // Accepts a /v10 payload too: fixtures and older captures have no buckets
  // field, and an absent one is simply no buckets.
  response: ub.GroupsInit10 & { buckets?: ub.BucketsSummary[] },
  options: InitDataOptions
): InitData => {
  logger.crumb('converting init data to client data');
  logger.log('response.groups:', response.groups);

  const pins = toClientPinnedItems(response.pins);

  const channelReaders = extractChannelReadersFromGroups(response.groups);

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

  const groups = toClientGroups(response.groups, true, options.currentUserId);

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
