import * as db from '../db';
import type * as ub from '../urbit';
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
      coverImage: role.meta.cover,
      iconImage: role.meta.image,
      title: role.meta.title,
      description: role.meta.description,
    };
    rolesById[roleId] = data;
    return data;
  });
  return {
    id,
    isJoined,
    ...toClientGroupMetadata(group),
    roles,
    navSections: group['zone-ord']
      ?.map((zoneId, i) => {
        const zone = group.zones?.[zoneId];
        if (!zone) {
          return;
        }
        const data: db.GroupNavSection = {
          id: zoneId,
          groupId: id,
          iconImage: omitEmpty(zone.meta.image),
          title: omitEmpty(zone.meta.title),
          description: omitEmpty(zone.meta.description),
          coverImage: omitEmpty(zone.meta.cover),
          index: i,
        };
        return data;
      })
      .filter((s): s is db.GroupNavSection => !!s),
    members: Object.entries(group.fleet).map(([userId, vessel]) => {
      return toClientGroupMember({
        groupId: id,
        contactId: userId,
        vessel: vessel,
        groupRoles: rolesById,
      });
    }),
    channels: group.channels
      ? toClientChannels({ channels: group.channels, groupId: id })
      : [],
  };
}

function toClientGroupMetadata(group: ub.Group | ub.GroupPreview) {
  const iconImage = group.meta.image;
  const iconImageData = iconImage
    ? isColor(iconImage)
      ? { iconImageColor: iconImage }
      : { iconImage: iconImage }
    : {};
  const coverImage = group.meta.cover;
  const coverImageData = coverImage
    ? isColor(coverImage)
      ? { coverImageColor: coverImage }
      : { coverImage: coverImage }
    : {};
  return {
    isSecret: group.secret,
    title: group.meta.title,
    ...iconImageData,
    ...coverImageData,
    description: group.meta.description,
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
    iconImage: omitEmpty(channel.meta.image),
    title: omitEmpty(channel.meta.title),
    coverImage: omitEmpty(channel.meta.cover),
    description: omitEmpty(channel.meta.description),
    currentUserIsMember: channel.join,
  };
}

function toClientGroupMember({
  groupId,
  contactId,
  vessel,
  groupRoles,
}: {
  groupId: string;
  contactId: string;
  vessel: { sects: string[]; joined: number };
  groupRoles: Record<string, db.GroupRoleInsert>;
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

function isColor(value: string) {
  return value[0] === '#';
}
