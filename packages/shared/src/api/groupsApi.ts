import type * as Client from "../db/schemas";
import type * as ub from "../urbit/groups";
import { scry } from "./urbit";
import * as db from "../db";

export const getPinnedGroupsAndDms = async () => {
  const pinnedGroups = await scry<ub.PinnedGroupsResponse>({
    app: "groups-ui",
    path: "/pins",
  });
  return pinnedGroups;
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
  const path = includeMembers ? "/groups" : "/groups/light";
  const groupData = await scry<ub.Groups>({ app: "groups", path });
  return toClientGroups(groupData);
};

export function toClientGroups(groups: Record<string, ub.Group>) {
  return Object.entries(groups).map(([id, group]) => {
    return toClientGroup(id, group);
  });
}

export function toClientGroup(id: string, group: ub.Group): db.GroupInsert {
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
    ...toClientGroupMetadata(group),
    roles,
    navSections: group["zone-ord"]
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
      return toClientGroupMember(id, userId, vessel, rolesById);
    }),
    channels: group.channels ? toClientChannels(group.channels) : [],
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

function toClientChannels(
  channels: Record<string, ub.GroupChannel>
): db.ChannelInsert[] {
  return Object.entries(channels).map(([id, channel]) =>
    toClientChannel(id, channel)
  );
}

function toClientChannel(
  id: string,
  channel: ub.GroupChannel
): db.ChannelInsert {
  return {
    id,
    iconImage: omitEmpty(channel.meta.image),
    title: omitEmpty(channel.meta.title),
    coverImage: omitEmpty(channel.meta.cover),
    description: omitEmpty(channel.meta.description),
    currentUserIsMember: channel.join,
  };
}

function toClientGroupMember(
  groupId: string,
  contactId: string,
  vessel: { sects: string[]; joined: number },
  groupRoles: Record<string, db.GroupRoleInsert>
): db.GroupMemberInsert {
  return {
    contactId,
    groupId,
    roles: vessel.sects
      .map((roleId) => groupRoles[roleId])
      .filter((r): r is db.GroupRoleInsert => !!r),
    joinedAt: vessel.joined,
  };
}

function omitEmpty(val: string) {
  return val === "" ? undefined : val;
}

function isColor(value: string) {
  return value[0] === "#";
}
