import * as db from '../db';
import { createDevLogger } from '../debug';
import type * as ub from '../urbit';
import {
  FlaggedContent,
  Rank,
  extractGroupPrivacy,
  getChannelType,
} from '../urbit';
import { toClientMeta } from './apiUtils';
import { poke, scry, subscribe } from './urbit';

const logger = createDevLogger('groupsApi', false);

export const getPinnedItems = async () => {
  const pinnedItems = await scry<ub.PinnedGroupsResponse>({
    app: 'groups-ui',
    path: '/pins',
  });
  return toClientPinnedItems(pinnedItems);
};

export const toClientPinnedItems = (rawItems: string[]): db.Pin[] => {
  const items = rawItems.map(toClientPinnedItem);
  return items.reverse();
};

export const toClientPinnedItem = (rawItem: string, index: number): db.Pin => {
  const type = getPinnedItemType(rawItem);
  return {
    type,
    index,
    itemId: rawItem,
  };
};

export const getPinnedItemType = (rawItem: string) => {
  if (rawItem.startsWith('~')) {
    if (rawItem.split('/').length === 2) {
      return 'group';
    }
    return 'dm';
  } else {
    if (rawItem.split('/').length === 3) {
      return 'channel';
    }
    return 'groupDm';
  }
};

export const unpinItem = async (itemId: string) => {
  return await poke({
    app: 'groups-ui',
    mark: 'ui-action',
    json: {
      pins: {
        del: itemId,
      },
    },
  });
};

export const pinItem = async (itemId: string) => {
  return await poke({
    app: 'groups-ui',
    mark: 'ui-action',
    json: {
      pins: {
        add: itemId,
      },
    },
  });
};

export const getGroup = async (groupId: string) => {
  const path = `/groups/${groupId}/v1`;

  const groupData = await scry<ub.Group>({ app: 'groups', path });
  return toClientGroup(groupId, groupData, true);
};

export const getGroups = async (
  {
    includeMembers,
  }: {
    includeMembers: boolean;
  } = {
    includeMembers: false,
  }
) => {
  const path = includeMembers ? '/groups' : '/groups/light';
  const groupData = await scry<ub.Groups>({ app: 'groups', path });
  return toClientGroups(groupData, true);
};

export type GroupDelete = {
  type: 'deleteGroup';
  groupId: string;
};

export type GroupAdd = {
  type: 'addGroup';
  group: db.Group;
};

export type GroupEdit = {
  type: 'editGroup';
  groupId: string;
  meta: db.ClientMeta;
};

export type GroupChannelAdd = {
  type: 'addChannel';
  channel: db.Channel;
};

export type GroupChannelUpdate = {
  type: 'updateChannel';
  channel: db.Channel;
};

export type GroupChannelJoin = {
  type: 'joinChannel';
  channelId: string;
  groupId: string;
};

export type GroupChannelLeave = {
  type: 'leaveChannel';
  channelId: string;
};

export type GroupChannelDelete = {
  type: 'deleteChannel';
  channelId: string;
};

export type GroupChannelNavSectionAdd = {
  type: 'addChannelToNavSection';
  channelId: string;
  navSectionId: string;
};

export type GroupNavSectionAdd = {
  type: 'addNavSection';
  navSectionId: string;
  groupId: string;
  clientMeta: db.ClientMeta;
};

export type GroupNavSectionDelete = {
  type: 'deleteNavSection';
  navSectionId: string;
};

export type GroupNavSectionEdit = {
  type: 'editNavSection';
  navSectionId: string;
  clientMeta: db.ClientMeta;
};

export type GroupNavSectionMove = {
  type: 'moveNavSection';
  navSectionId: string;
  index: number;
};

export type GroupnavSectionMoveChannel = {
  type: 'moveChannel';
  navSectionId: string;
  channelId: string;
  index: number;
};

export type GroupAddMembers = {
  type: 'addGroupMembers';
  ships: string[];
  groupId: string;
};

export type GroupRemoveMembers = {
  type: 'removeGroupMembers';
  ships: string[];
  groupId: string;
};

export type GroupAddMembersToRole = {
  type: 'addGroupMembersToRole';
  ships: string[];
  roles: string[];
  groupId: string;
};

export type GroupRemoveMembersFromRole = {
  type: 'removeGroupMembersFromRole';
  ships: string[];
  roles: string[];
  groupId: string;
};

export type GroupRoleAdd = {
  type: 'addRole';
  groupId: string;
  roleId: string;
  meta: db.ClientMeta;
};

export type GroupRoleDelete = {
  type: 'deleteRole';
  groupId: string;
  roleId: string;
};

export type GroupRoleEdit = {
  type: 'editRole';
  roleId: string;
  groupId: string;
  meta: db.ClientMeta;
};

export type GroupInviteMembers = {
  type: 'inviteGroupMembers';
  groupId: string;
  ships: string[];
};

export type GroupRevokeMemberInvites = {
  type: 'revokeGroupMemberInvites';
  groupId: string;
  ships: string[];
};

export type GroupBanMembers = {
  type: 'banGroupMembers';
  groupId: string;
  ships: string[];
};

export type GroupUnbanMembers = {
  type: 'unbanGroupMembers';
  groupId: string;
  ships: string[];
};

export type GroupBanAzimuthRanks = {
  type: 'banAzimuthRanks';
  groupId: string;
  ranks: Rank[];
};

export type GroupUnbanAzimuthRanks = {
  type: 'unbanAzimuthRanks';
  groupId: string;
  ranks: Rank[];
};

export type GroupSetAsPublic = {
  type: 'setGroupAsPublic';
  groupId: string;
};

export type GroupSetAsPrivate = {
  type: 'setGroupAsPrivate';
  groupId: string;
};

export type GroupSetAsSecret = {
  type: 'setGroupAsSecret';
  groupId: string;
};

export type GroupSetAsNotSecret = {
  type: 'setGroupAsNotSecret';
  groupId: string;
};

export type GroupFlagContent = {
  type: 'flagGroupPost';
  groupId: string;
  channelId: string;
  postId: string;
  flaggingUser: string;
};

export type GroupUpdateUnknown = {
  type: 'unknown';
};

export type GroupUpdate =
  | GroupAdd
  | GroupDelete
  | GroupEdit
  | GroupChannelAdd
  | GroupChannelUpdate
  | GroupChannelDelete
  | GroupChannelJoin
  | GroupChannelLeave
  | GroupChannelNavSectionAdd
  | GroupNavSectionDelete
  | GroupNavSectionEdit
  | GroupNavSectionAdd
  | GroupNavSectionMove
  | GroupnavSectionMoveChannel
  | GroupAddMembers
  | GroupRemoveMembers
  | GroupAddMembersToRole
  | GroupRemoveMembersFromRole
  | GroupRoleAdd
  | GroupRoleDelete
  | GroupRoleEdit
  | GroupInviteMembers
  | GroupRevokeMemberInvites
  | GroupBanMembers
  | GroupUnbanMembers
  | GroupBanAzimuthRanks
  | GroupUnbanAzimuthRanks
  | GroupSetAsPublic
  | GroupSetAsPrivate
  | GroupSetAsSecret
  | GroupSetAsNotSecret
  | GroupFlagContent
  | GroupUpdateUnknown;

export const subscribeGroups = async (
  eventHandler: (update: GroupUpdate) => void
) => {
  subscribe<ub.GroupAction>(
    { app: 'groups', path: '/groups/ui' },
    (groupUpdateEvent) => {
      logger.log('groupUpdateEvent', { groupUpdateEvent });
      eventHandler(toGroupUpdate(groupUpdateEvent));
    }
  );
};

export const toGroupUpdate = (
  groupUpdateEvent: ub.GroupAction
): GroupUpdate => {
  const groupId = groupUpdateEvent.flag;
  const updateDiff = groupUpdateEvent.update.diff;

  if ('create' in updateDiff) {
    return {
      type: 'addGroup',
      group: toClientGroup(groupId, updateDiff.create, true),
    };
  }

  if ('del' in updateDiff) {
    return {
      type: 'deleteGroup',
      groupId,
    };
  }

  if ('meta' in updateDiff) {
    return {
      type: 'editGroup',
      meta: toClientMeta(updateDiff.meta),
      groupId,
    };
  }

  if ('cabal' in updateDiff) {
    const roleId = updateDiff.cabal.sect;
    if ('add' in updateDiff.cabal.diff) {
      return {
        type: 'addRole',
        roleId,
        meta: updateDiff.cabal.diff.add,
        groupId,
      };
    }

    if ('del' in updateDiff.cabal.diff) {
      return {
        type: 'deleteRole',
        roleId,
        groupId,
      };
    }

    if ('edit' in updateDiff.cabal.diff) {
      return {
        type: 'editRole',
        roleId,
        meta: updateDiff.cabal.diff.edit,
        groupId,
      };
    }
  }

  if ('cordon' in updateDiff) {
    if ('shut' in updateDiff.cordon) {
      if ('add-ships' in updateDiff.cordon.shut) {
        if (updateDiff.cordon.shut['add-ships'].kind === 'pending') {
          return {
            type: 'inviteGroupMembers',
            ships: updateDiff.cordon.shut['add-ships'].ships,
            groupId,
          };
        }
      }

      if ('del-ships' in updateDiff.cordon.shut) {
        return {
          type: 'revokeGroupMemberInvites',
          ships: updateDiff.cordon.shut['del-ships'].ships,
          groupId,
        };
      }
    }

    if ('open' in updateDiff.cordon) {
      if ('add-ships' in updateDiff.cordon.open) {
        return {
          type: 'banGroupMembers',
          ships: updateDiff.cordon.open['add-ships'],
          groupId,
        };
      }

      if ('del-ships' in updateDiff.cordon.open) {
        return {
          type: 'unbanGroupMembers',
          ships: updateDiff.cordon.open['del-ships'],
          groupId,
        };
      }

      if ('add-ranks' in updateDiff.cordon.open) {
        return {
          type: 'banAzimuthRanks',
          ranks: updateDiff.cordon.open['add-ranks'] as Rank[],
          groupId,
        };
      }

      if ('del-ranks' in updateDiff.cordon.open) {
        return {
          type: 'unbanAzimuthRanks',
          ranks: updateDiff.cordon.open['del-ranks'] as Rank[],
          groupId,
        };
      }
    }

    if ('swap' in updateDiff.cordon) {
      if ('open' in updateDiff.cordon.swap) {
        return {
          type: 'setGroupAsPublic',
          groupId,
        };
      }

      if ('shut' in updateDiff.cordon.swap) {
        return {
          type: 'setGroupAsPrivate',
          groupId,
        };
      }
    }
  }

  if ('secret' in updateDiff) {
    if (updateDiff.secret) {
      return {
        type: 'setGroupAsSecret',
        groupId,
      };
    } else {
      return {
        type: 'setGroupAsNotSecret',
        groupId,
      };
    }
  }

  if ('flag-content' in updateDiff) {
    return {
      type: 'flagGroupPost',
      groupId,
      channelId: updateDiff['flag-content'].nest,
      postId: updateDiff['flag-content']['post-key'].reply
        ? updateDiff['flag-content']['post-key'].reply
        : updateDiff['flag-content']['post-key'].post,
      flaggingUser: updateDiff['flag-content'].src,
    };
  }

  if ('fleet' in updateDiff) {
    if ('add' in updateDiff.fleet.diff) {
      return {
        type: 'addGroupMembers',
        ships: updateDiff.fleet.ships,
        groupId,
      };
    }

    if ('del' in updateDiff.fleet.diff) {
      return {
        type: 'removeGroupMembers',
        ships: updateDiff.fleet.ships,
        groupId,
      };
    }

    if ('add-sects' in updateDiff.fleet.diff) {
      return {
        type: 'addGroupMembersToRole',
        ships: updateDiff.fleet.ships,
        roles: updateDiff.fleet.diff['add-sects'],
        groupId,
      };
    }

    if ('del-sects' in updateDiff.fleet.diff) {
      return {
        type: 'removeGroupMembersFromRole',
        ships: updateDiff.fleet.ships,
        roles: updateDiff.fleet.diff['del-sects'],
        groupId,
      };
    }
  }

  if ('zone' in updateDiff) {
    const zoneDelta = updateDiff.zone.delta;
    const zoneId = updateDiff.zone.zone;

    if ('add' in zoneDelta) {
      return {
        type: 'addNavSection',
        navSectionId: zoneId,
        groupId,
        clientMeta: toClientMeta(zoneDelta.add),
      };
    }

    if ('del' in zoneDelta) {
      return { type: 'deleteNavSection', navSectionId: zoneId };
    }

    if ('edit' in zoneDelta) {
      return {
        type: 'editNavSection',
        navSectionId: zoneId,
        clientMeta: toClientMeta(zoneDelta.edit),
      };
    }

    if ('mov' in zoneDelta) {
      return {
        type: 'moveNavSection',
        navSectionId: zoneId,
        index: zoneDelta.mov,
      };
    }

    if ('mov-nest' in zoneDelta) {
      return {
        type: 'moveChannel',
        navSectionId: zoneId,
        channelId: zoneDelta['mov-nest'].nest,
        index: zoneDelta['mov-nest'].idx,
      };
    }
  }

  if ('channel' in updateDiff) {
    const channelDiff = updateDiff.channel.diff;
    const channelId = updateDiff.channel.nest;
    logger.log('channelDiff', { channelDiff });

    if ('add' in channelDiff) {
      return {
        type: 'addChannel',
        channel: toClientChannel({
          id: channelId,
          channel: channelDiff.add,
          groupId,
        }),
      };
    }

    if ('edit' in channelDiff) {
      const channelEdit = channelDiff.edit;

      logger.log('channelEdit', { channelEdit });

      return {
        type: 'updateChannel',
        channel: toClientChannel({
          id: channelId,
          channel: channelEdit,
          groupId,
        }),
      };
    }

    if ('join' in channelDiff) {
      const isJoined = channelDiff.join;

      if (!isJoined) {
        return { type: 'leaveChannel', channelId };
      }

      return { type: 'joinChannel', channelId, groupId };
    }

    if ('del' in channelDiff) {
      return { type: 'deleteChannel', channelId };
    }

    if ('zone' in channelDiff) {
      const zoneId = channelDiff.zone;

      return {
        type: 'addChannelToNavSection',
        channelId,
        navSectionId: zoneId,
      };
    }
  }

  return { type: 'unknown' };
};

const extractFlaggedPosts = (
  groupId: string,
  flaggedContent?: FlaggedContent
): db.GroupFlaggedPosts[] => {
  const flaggedPosts: db.GroupFlaggedPosts[] = [];

  if (!flaggedContent) {
    return flaggedPosts;
  }

  Object.entries(flaggedContent).forEach(([channelId, posts]) => {
    Object.entries(posts).forEach(([postId, post]) => {
      post.flaggers.forEach((flagger) => {
        flaggedPosts.push({
          groupId,
          channelId,
          postId,
          flaggedByContactId: flagger,
        });
      });
    });
  });

  return flaggedPosts;
};

export function toClientGroups(
  groups: Record<string, ub.Group>,
  isJoined: boolean
) {
  if (!groups) {
    return [];
  }
  return Object.entries(groups).map(([id, group]) => {
    return toClientGroup(id, group, isJoined);
  });
}

export function toClientGroup(
  id: string,
  group: ub.Group,
  isJoined: boolean
): db.Group {
  const rolesById: Record<string, db.GroupRole> = {};
  const flaggedPosts: db.GroupFlaggedPosts[] = extractFlaggedPosts(
    id,
    group['flagged-content']
  );

  const roles = Object.entries(group.cabals ?? {}).map(([roleId, role]) => {
    const data: db.GroupRole = {
      id: roleId,
      groupId: id,
      ...toClientMeta(role.meta),
    };
    rolesById[roleId] = data;
    return data;
  });
  return {
    id,
    isJoined,
    roles,
    privacy: extractGroupPrivacy(group),
    ...toClientMeta(group.meta),
    flaggedPosts,
    navSections: group['zone-ord']
      ?.map((zoneId, i) => {
        const zone = group.zones?.[zoneId];
        if (!zone) {
          return;
        }
        const data: db.GroupNavSection = {
          id: zoneId,
          groupId: id,
          ...toClientMeta(zone.meta),
          index: i,
          channels: zone.idx.map((channelId, ci) => {
            const data: db.GroupNavSectionChannel = {
              index: ci,
              channelId: channelId,
              groupNavSectionId: zoneId,
            };
            return data;
          }),
        };
        return data;
      })
      .filter((s): s is db.GroupNavSection => !!s),
    members: Object.entries(group.fleet).map(([userId, vessel]) => {
      return toClientGroupMember({
        groupId: id,
        contactId: userId,
        vessel: vessel,
      });
    }),
    channels: group.channels
      ? toClientChannels({ channels: group.channels, groupId: id })
      : [],
  };
}

function toClientChannels({
  channels,
  groupId,
}: {
  channels: Record<string, ub.GroupChannel>;
  groupId: string;
}): db.Channel[] {
  return Object.entries(channels).map(([id, channel]) =>
    toClientChannel({ id, channel, groupId })
  );
}

function toClientChannel({
  id,
  channel,
  groupId,
}: {
  id: string;
  channel: ub.GroupChannel;
  groupId: string;
}): db.Channel {
  return {
    id,
    groupId,
    type: getChannelType(id),
    iconImage: omitEmpty(channel.meta.image),
    title: omitEmpty(channel.meta.title),
    coverImage: omitEmpty(channel.meta.cover),
    description: omitEmpty(channel.meta.description),
  };
}

function toClientGroupMember({
  groupId,
  contactId,
  vessel,
}: {
  groupId: string;
  contactId: string;
  vessel: { sects: string[]; joined: number };
}): db.ChatMember {
  return {
    membershipType: 'group',
    contactId,
    chatId: groupId,
    roles: vessel.sects.map((roleId) => ({
      groupId,
      contactId,
      roleId,
    })),
    joinedAt: vessel.joined,
  };
}

function omitEmpty(val: string) {
  return val === '' ? null : val;
}

export function isColor(value: string) {
  return value[0] === '#';
}
