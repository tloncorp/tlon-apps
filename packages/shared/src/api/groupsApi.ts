import * as db from '../db';
import { createDevLogger } from '../debug';
import type * as ub from '../urbit';
import { getChannelType } from '../urbit';
import { toClientMeta } from './converters';
import { poke, scry, subscribe } from './urbit';

const logger = createDevLogger('groupsSub', false);

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
    roles,
    isSecret: group.secret,
    joinStatus: isJoined ? 'joined' : undefined,
    ...toClientMeta(group.meta),
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

export function toClientInvitedGroups(gangs: Record<string, ub.Gang>) {
  if (!gangs) {
    return [];
  }

  return Object.entries(gangs)
    .filter(
      ([_, gang]) =>
        gang.invite && gang.preview && 'shut' in gang.preview.cordon
    )
    .map(([id, gang]) => toClientInvitedGroup(id, gang));
}

export function toClientInvitedGroup(id: string, gang: ub.Gang): db.Group {
  return {
    id,
    isSecret: !!gang.preview?.secret,
    joinStatus: 'invited',
    ...(gang.preview ? toClientMeta(gang.preview.meta) : {}),
    // Create placeholder Channel to show in chat list
    channels: [
      {
        id,
        groupId: id,
        type: 'chat',
        iconImage: omitEmpty(gang.preview?.meta.image ?? ''),
        title: omitEmpty(gang.preview?.meta.title ?? ''),
        coverImage: omitEmpty(gang.preview?.meta.cover ?? ''),
        description: omitEmpty(gang.preview?.meta.description ?? ''),
      },
    ],
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

export const joinGroup = async (id: string) =>
  poke({
    app: 'groups',
    mark: 'group-join',
    json: {
      flag: id,
      'join-all': true,
    },
  });

export const rejectGroupInvitation = async (id: string) =>
  poke({
    app: 'groups',
    mark: 'invite-decline',
    json: id,
  });

export type GroupsUpdate =
  | { type: 'unknown' }
  | { type: 'addGroups'; groups: db.Group[] }
  | { type: 'deleteGroup'; group: db.Group };

const toGroupsUpdate = (groupEvent: ub.GroupAction): GroupsUpdate => {
  if ('create' in groupEvent.update.diff) {
    return {
      type: 'addGroups',
      groups: [
        toClientGroup(groupEvent.flag, groupEvent.update.diff.create, true),
      ],
    };
  }

  if ('del' in groupEvent.update.diff) {
    return {
      type: 'deleteGroup',
      group: { id: groupEvent.flag },
    };
  }

  logger.log('Skipping unknown group event:', groupEvent);
  return { type: 'unknown' };
};

const toGangsGroupsUpdate = (gangsEvent: ub.Gangs): GroupsUpdate => {
  const invitedGangs = Object.values(gangsEvent).filter(
    ({ invite, preview }) =>
      invite && preview?.cordon && 'shut' in preview.cordon
  );
  if (invitedGangs.length > 0) {
    return {
      type: 'addGroups',
      groups: invitedGangs.map((gang) =>
        toClientInvitedGroup(gang.invite!.flag, gang)
      ),
    };
  }

  logger.log('Skipping unknown gangs event:', gangsEvent);
  return { type: 'unknown' };
};

export const subscribeToGroupsUpdates = async (
  eventHandler: (update: GroupsUpdate) => void
) => {
  subscribe(
    { app: 'groups', path: '/groups/ui' },
    (rawEvent: ub.GroupAction) => {
      logger.debug('Received groups update:', rawEvent);

      // Sometimes this event is fired with a string instead
      if (typeof rawEvent !== 'object') {
        return;
      }

      eventHandler(toGroupsUpdate(rawEvent));
    }
  );

  subscribe({ app: 'groups', path: '/gangs/updates' }, (rawEvent: ub.Gangs) => {
    logger.debug('Received gangs update:', rawEvent);
    eventHandler(toGangsGroupsUpdate(rawEvent));
  });
};
