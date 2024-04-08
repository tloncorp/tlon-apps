import * as db from '../db';
import type * as ub from '../urbit';
import { getChannelType } from '../urbit';
import { toClientMeta } from './converters';
import { scry } from './urbit';

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
    return 'club';
  }
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
): db.GroupInsert {
  const rolesById: Record<string, db.GroupRoleInsert> = {};
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
    isSecret: group.secret,
    ...toClientMeta(group.meta),
    navSections: group['zone-ord']
      ?.map((zoneId, i) => {
        const zone = group.zones?.[zoneId];
        if (!zone) {
          return;
        }
        const data: db.GroupNavSectionWithRelations = {
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
      .filter((s): s is db.GroupNavSectionWithRelations => !!s),
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
}): db.ChannelInsert[] {
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
}): db.ChannelInsert {
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
}): db.GroupMemberInsert {
  return {
    contactId,
    groupId,
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
