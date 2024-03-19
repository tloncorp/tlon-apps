import type { ClientTypes as Client } from '@tloncorp/shared';
import type * as ub from '@tloncorp/shared/dist/urbit/groups';

import { scry } from './api';

export const getPinnedGroupsAndDms = async () => {
  const pinnedGroups = await scry<ub.PinnedGroupsResponse>({
    app: 'groups-ui',
    path: '/pins',
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
  const path = includeMembers ? '/groups' : '/groups/light';
  const groupData = await scry<ub.Groups>({ app: 'groups', path });
  return toClientGroups(groupData);
};

export function toClientGroups(groups: Record<string, ub.Group>) {
  return Object.entries(groups).map(([id, group]) => {
    return toClientGroup(id, group);
  });
}

export function toClientGroup(id: string, group: ub.Group): Client.Group {
  return {
    id,
    ...toClientGroupMetadata(group),
    roles: Object.entries(group.cabals ?? {}).map(([name, role]) => {
      const data: Client.GroupRole = {
        name,
        ...role.meta,
      };
      return data as Client.GroupRole;
    }),
    navSections: group['zone-ord']
      ?.map((zoneId) => {
        const zone = group.zones?.[zoneId];
        if (!zone) {
          return;
        }
        const data: Client.GroupNavSection = {
          id: zoneId,
          channelIds: zone.idx,
          image: omitEmpty(zone.meta.image),
          title: omitEmpty(zone.meta.title),
          description: omitEmpty(zone.meta.description),
          cover: omitEmpty(zone.meta.cover),
        };
        return data;
      })
      .filter((s): s is Client.GroupNavSection => !!s),
    members: Object.entries(group.fleet).map(([userId, vessel]) => {
      return toClientGroupMember(userId, vessel);
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
): Client.Channel[] {
  return Object.entries(channels).map(([id, channel]) =>
    toClientChannel(id, channel)
  );
}

function toClientChannel(id: string, channel: ub.GroupChannel): Client.Channel {
  return {
    id,
    image: omitEmpty(channel.meta.image),
    title: omitEmpty(channel.meta.title),
    cover: omitEmpty(channel.meta.cover),
    description: omitEmpty(channel.meta.description),
    currentUserIsMember: channel.join,
  };
}

function toClientGroupMember(id: string, vessel: ub.Vessel) {
  return {
    id,
    roles: vessel.sects,
    joinedAt: vessel.joined,
  };
}

function omitEmpty(val: string) {
  return val === '' ? undefined : val;
}

function isColor(value: string) {
  return value[0] === '#';
}
