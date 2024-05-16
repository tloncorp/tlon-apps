import * as db from '../db';
import { createDevLogger } from '../debug';
import type * as ub from '../urbit';
import {
  extractGroupPrivacy,
  getChannelType,
  getJoinStatusFromGang,
} from '../urbit';
import { toClientMeta } from './converters';
import { poke, scry, subscribe, subscribeOnce, trackedPoke } from './urbit';

const logger = createDevLogger('groupsApi', true);

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

// export function useGroupKnockMutation() {
//   return useGroupMutation(async (variables: { flag: string }) => {
//     await api.poke({
//       app: 'groups',
//       mark: 'group-knock',
//       json: variables.flag,
//     });
//   });
// }

// export function useGroupRescindMutation() {
//   return useGroupMutation(async (variables: { flag: string }) => {
//     await api.poke({
//       app: 'groups',
//       mark: 'group-rescind',
//       json: variables.flag,
//     });
//   });
// }

// export function useGroupCancelMutation() {
//   return useGroupMutation(async (variables: { flag: string }) => {
//     await api.poke({
//       app: 'groups',
//       mark: 'group-cancel',
//       json: variables.flag,
//     });
//   });
// }

export function cancelGroupJoin(groupId: string) {
  return poke({
    app: 'groups',
    mark: 'group-cancel',
    json: groupId,
  });
}

export function rescindGroupInvitationRequest(groupId: string) {
  logger.log('api rescinding', groupId);
  return poke({
    app: 'groups',
    mark: 'group-rescind',
    json: groupId,
  });
}

export function requestGroupInvitation(groupId: string) {
  logger.log('api knocking', groupId);
  return poke({
    app: 'groups',
    mark: 'group-knock',
    json: groupId,
  });
}

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

export const findGroupsHostedBy = async (userId: string) => {
  const result = await subscribeOnce<ub.GroupIndex>({
    app: 'groups',
    path: `/gangs/index/${userId}`,
  });

  logger.log('findGroupsHostedBy result', result);

  return result;
};

export const createGroup = async ({
  title,
  shortCode,
}: {
  title: string;
  shortCode: string;
}) => {
  const createGroupPayload: ub.GroupCreate = {
    title,
    description: '',
    image: '#999999',
    cover: '#D9D9D9',
    name: shortCode,
    members: {},
    cordon: {
      open: {
        ships: [],
        ranks: [],
      },
    },
    secret: false,
  };

  return trackedPoke<ub.GroupAction>(
    {
      app: 'groups',
      mark: 'group-create',
      json: createGroupPayload,
    },
    { app: 'groups', path: '/groups/ui' },
    (event) => {
      if (!('update' in event)) {
        return false;
      }

      const { update } = event;
      return (
        'create' in update.diff &&
        createGroupPayload.title === update.diff.create.meta.title
      );
    }
  );
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
    privacy: extractGroupPrivacy(group),
    ...toClientMeta(group.meta),
    haveInvite: false,
    currentUserIsMember: isJoined,
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

export function toClientGroupsFromPreview(
  groups: Record<string, ub.GroupPreview>
) {
  return Object.entries(groups).map(([id, preview]) => {
    return toClientGroupFromPreview(id, preview);
  });
}

export function toClientGroupFromPreview(
  id: string,
  preview: ub.GroupPreview
): db.Group {
  return {
    id,
    currentUserIsMember: false,
    privacy: extractGroupPrivacy(preview),
    ...toClientMeta(preview.meta),
  };
}

export function toClientGroupsFromGangs(gangs: Record<string, ub.Gang>) {
  return Object.entries(gangs).map(([id, gang]) => {
    return toClientGroupFromGang(id, gang);
  });
}

export function toClientGroupFromGang(id: string, gang: ub.Gang): db.Group {
  const privacy = extractGroupPrivacy(gang.preview);
  const joinStatus = getJoinStatusFromGang(gang);
  return {
    id,
    privacy,
    currentUserIsMember: false,
    haveInvite: !!gang.invite,
    haveRequestedInvite: gang.claim?.progress === 'knocking',
    joinStatus,
    ...(gang.preview ? toClientMeta(gang.preview.meta) : {}),
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
  | { type: 'deleteGroup'; groupId: string }
  | { type: 'setUnjoinedGroups'; groups: db.Group[] };

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
      groupId: groupEvent.flag,
    };
  }

  logger.log('Skipping unknown group event:', groupEvent);
  return { type: 'unknown' };
};

const toGangsGroupsUpdate = (gangsEvent: ub.Gangs): GroupsUpdate => {
  const groups = toClientGroupsFromGangs(gangsEvent);
  return { type: 'setUnjoinedGroups', groups };
};

export const subscribeToGroupsUpdates = async (
  eventHandler: (update: GroupsUpdate) => void
) => {
  subscribe(
    { app: 'groups', path: '/groups/ui' },
    (rawEvent: ub.GroupAction) => {
      logger.log('Received groups update:', rawEvent);

      // Sometimes this event is fired with a string instead
      if (typeof rawEvent !== 'object') {
        return;
      }

      eventHandler(toGroupsUpdate(rawEvent));
    }
  );

  subscribe({ app: 'groups', path: '/gangs/updates' }, (rawEvent: ub.Gangs) => {
    logger.log('Received gangs update:', rawEvent);
    eventHandler(toGangsGroupsUpdate(rawEvent));
  });
};
