import { Poke } from '@urbit/http-api';

import * as db from '../db';
import { GroupPrivacy } from '../db/schema';
import { createDevLogger } from '../debug';
import * as domain from '../domain';
import { AnalyticsEvent, AnalyticsSeverity } from '../domain';
import type * as ub from '../urbit';
import {
  FlaggedContent,
  GroupChannel,
  Rank,
  extractGroupPrivacy,
  getChannelType,
  getJoinStatusFromGang,
} from '../urbit';
import { parseGroupChannelId, parseGroupId, toClientMeta } from './apiUtils';
import { StructuredChannelDescriptionPayload } from './channelContentConfig';
import {
  BadResponseError,
  getCurrentUserId,
  poke,
  scry,
  subscribe,
  subscribeOnce,
  thread,
  trackedPoke,
} from './urbit';

const logger = createDevLogger('groupsApi', false);

function groupAction(flag: string, diff: ub.GroupDiff): Poke<ub.GroupAction> {
  return {
    app: 'groups',
    mark: 'group-action-3',
    json: {
      flag,
      update: {
        time: '',
        diff,
      },
    },
  };
}

function groupAction4(action: ub.GroupActionV4) {
  return {
    app: 'groups',
    mark: 'group-action-4',
    json: action,
  };
}

function groupNavigationBatchUpdate(
  flag: string,
  navigation: ub.GroupNavigationUpdate
): Poke<ub.GroupNavigationBatchUpdate> {
  return {
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag,
        'a-group': {
          navigation,
        },
      },
    },
  };
}

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

export function acceptGroupJoin({
  groupId,
  contactIds,
}: {
  groupId: string;
  contactIds: string[];
}) {
  return poke(
    groupAction(groupId, {
      cordon: {
        shut: {
          'add-ships': {
            ships: contactIds,
            kind: 'pending',
          },
        },
      },
    })
  );
}

export function rejectGroupJoin({
  groupId,
  contactIds,
}: {
  groupId: string;
  contactIds: string[];
}) {
  return poke(
    groupAction(groupId, {
      cordon: {
        shut: {
          'del-ships': {
            ships: contactIds,
            kind: 'ask',
          },
        },
      },
    })
  );
}

export function cancelGroupJoin(groupId: string) {
  return poke({
    app: 'groups',
    mark: 'group-cancel',
    json: groupId,
  });
}

export function inviteGroupMembers({
  groupId,
  contactIds,
}: {
  groupId: string;
  contactIds: string[];
}) {
  return poke(
    groupAction4({
      invite: {
        flag: groupId,
        ships: contactIds,
        'a-invite': {
          token: null,
          note: null,
        },
      },
    })
  );
}

export function rescindGroupInvitationRequest(groupId: string) {
  logger.log('api rescinding', groupId);
  return poke({
    app: 'groups',
    mark: 'group-rescind',
    json: groupId,
  });
}

export async function kickUsersFromGroup({
  groupId,
  contactIds,
}: {
  groupId: string;
  contactIds: string[];
}) {
  return poke(
    groupAction(groupId, {
      fleet: {
        ships: contactIds,
        diff: {
          del: null,
        },
      },
    })
  );
}

export async function banUsersFromGroup({
  groupId,
  contactIds,
}: {
  groupId: string;
  contactIds: string[];
}) {
  return poke(
    groupAction(groupId, {
      cordon: {
        open: {
          'add-ships': contactIds,
        },
      },
    })
  );
}

export async function unbanUsersFromGroup({
  groupId,
  contactIds,
}: {
  groupId: string;
  contactIds: string[];
}) {
  return poke(
    groupAction(groupId, {
      cordon: {
        open: {
          'del-ships': contactIds,
        },
      },
    })
  );
}

export async function leaveGroup(groupId: string) {
  return poke({
    app: 'groups',
    mark: 'group-leave',
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

export async function updateGroupPrivacy(params: {
  groupId: string;
  oldPrivacy: GroupPrivacy;
  newPrivacy: GroupPrivacy;
}) {
  if (params.newPrivacy === 'public') {
    const action = groupAction(params.groupId, {
      cordon: {
        swap: {
          open: {
            ships: [],
            ranks: [],
          },
        },
      },
    });
    await poke(action);
  } else {
    // Only swap if it's currently public. If moving between secret and private, we keep
    // the existing cordon to avoid losing pending requests.
    if (params.oldPrivacy === 'public') {
      const cordonSwapAction = groupAction(params.groupId, {
        cordon: {
          swap: {
            shut: {
              pending: [],
              ask: [],
            },
          },
        },
      });
      await poke(cordonSwapAction);
    }
  }

  const secretAction = groupAction(params.groupId, {
    secret: params.newPrivacy === 'secret',
  });
  await poke(secretAction);
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

export const getChannelPreview = async (
  channelId: string
): Promise<db.Channel | null> => {
  const channelPreview = await subscribeOnce<ub.ChannelPreview>(
    {
      app: 'groups',
      path: `/chan/${channelId}`,
    },
    undefined,
    undefined,
    { tag: 'getChannelPreview' }
  );

  if (!channelPreview) {
    return null;
  }

  return toClientChannelFromPreview({
    id: channelId,
    channel: channelPreview,
    groupId: channelPreview.group.flag,
  });
};

export const getGroupPreview = async (groupId: string) => {
  const result = await subscribeOnce<ub.GroupPreview>(
    {
      app: 'groups',
      path: `/gangs/${groupId}/preview`,
    },
    undefined,
    undefined,
    { tag: 'getGroupPreview' }
  );

  return toClientGroupFromPreview(groupId, result);
};

export const findGroupsHostedBy = async (userId: string) => {
  const result = await subscribeOnce<ub.GroupIndex>(
    {
      app: 'groups',
      path: `/gangs/index/${userId}`,
    },
    30_000,
    undefined,
    { tag: 'findGroupsHostedBy' }
  );

  logger.log('findGroupsHostedBy result', result);

  return toClientGroupsFromPreview(result);
};

const GENERATED_GROUP_TITLE_END_CHAR = '\u2060';

export const createGroup = async ({
  group,
  placeHolderTitle,
  memberIds,
}: {
  group: db.Group;
  memberIds?: string[];
  placeHolderTitle?: string;
}): Promise<db.Group> => {
  const payload: ub.GroupCreateThreadInput = {
    groupId: group.id,
    meta: {
      title: group.title
        ? group.title
        : placeHolderTitle + GENERATED_GROUP_TITLE_END_CHAR,
      description: '',
      image: group.iconImage ?? '',
      cover: '',
    },
    guestList: memberIds ?? [],
    channels: (group.channels ?? []).map((channel) => ({
      channelId: channel.id,
      meta: {
        title: channel.title ?? '',
        description: channel.description ?? '',
        image: '',
        cover: '',
      },
    })),
  };

  try {
    const result = await thread<ub.GroupCreateThreadInput, ub.Group>({
      desk: 'groups',
      inputMark: 'group-create-thread',
      threadName: 'group-create',
      outputMark: 'group-ui-1',
      body: payload,
    });
    logger.trackEvent(AnalyticsEvent.DebugGroupCreate, {
      context: 'group-create-thread request succeeded',
    });

    return toClientGroup(group.id, result, true);
  } catch (err) {
    if (err instanceof BadResponseError) {
      logger.trackEvent('Create Group Error', {
        severity: AnalyticsSeverity.Critical,
        status: err.status,
        error: err.toString(),
        context: 'group-create-thread request failed',
      });
    } else {
      logger.trackEvent('Create Group Error', {
        severity: AnalyticsSeverity.Critical,
        errorMessage: err.message,
        errorStack: err.stack,
        context: 'group-create-thread unexpected error',
      });
    }
    throw err;
  }
};

export const getGroup = async (groupId: string) => {
  const path = `/v2/ui/groups/${groupId}`;

  const groupData = await scry<ub.GroupV7>({ app: 'groups', path });
  return toClientGroupV7(groupId, groupData, true);
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

export const updateGroupMeta = async ({
  groupId,
  meta,
}: {
  groupId: string;
  meta: ub.GroupMeta;
}) => {
  return await trackedPoke<ub.GroupAction>(
    groupAction(groupId, {
      meta,
    }),
    { app: 'groups', path: '/groups/ui' },
    (event) => {
      if (!('update' in event)) {
        return false;
      }

      const { update } = event;
      return 'meta' in update.diff && event.flag === groupId;
    },
    { tag: 'updateGroupMeta' }
  );
};

export const deleteGroup = async (groupId: string) => {
  return await trackedPoke<ub.GroupAction>(
    groupAction(groupId, {
      del: null,
    }),
    { app: 'groups', path: '/groups/ui' },
    (event) => {
      if (!('update' in event)) {
        return false;
      }

      const { update } = event;
      return 'del' in update.diff && event.flag === groupId;
    },
    { tag: 'deleteGroup' }
  );
};

export const addNavSection = async ({
  groupId,
  navSection,
}: {
  groupId: string;
  navSection: db.GroupNavSection;
}) => {
  return await trackedPoke<ub.GroupAction>(
    groupAction(groupId, {
      zone: {
        zone: navSection.sectionId,
        delta: {
          add: {
            title: navSection.title ?? '',
            description: navSection.description ?? '',
            image: navSection.iconImage ?? navSection.coverImageColor ?? '',
            cover: navSection.coverImage ?? navSection.coverImageColor ?? '',
          },
        },
      },
    }),
    { app: 'groups', path: '/groups/ui' },
    (event) => {
      if (!('update' in event)) {
        return false;
      }

      const { update } = event;
      return 'zone' in update.diff && event.flag === groupId;
    },
    { tag: 'addNavSection' }
  );
};

export const deleteNavSection = async ({
  sectionId,
  groupId,
}: {
  sectionId: string;
  groupId: string;
}) => {
  return await poke(
    groupAction(groupId, {
      zone: {
        zone: sectionId,
        delta: {
          del: null,
        },
      },
    })
  );
};

export const updateNavSection = async ({
  groupId,
  navSection,
}: {
  groupId: string;
  navSection: db.GroupNavSection;
}) => {
  return await poke(
    groupAction(groupId, {
      zone: {
        zone: navSection.sectionId,
        delta: {
          edit: {
            title: navSection.title ?? '',
            description: navSection.description ?? '',
            image: navSection.iconImage ?? navSection.coverImageColor ?? '',
            cover: navSection.coverImage ?? navSection.coverImageColor ?? '',
          },
        },
      },
    })
  );
};

export const addChannelToNavSection = async ({
  groupId,
  navSectionId,
  channelId,
}: {
  groupId: string;
  navSectionId: string;
  channelId: string;
}) => {
  logger.log('addChannelToNavSection', { groupId, navSectionId, channelId });
  return await trackedPoke<ub.GroupAction>(
    groupAction(groupId, {
      channel: {
        nest: channelId,
        diff: {
          zone: navSectionId,
        },
      },
    }),
    { app: 'groups', path: '/groups/ui' },
    (event) => {
      if (!('update' in event)) {
        return false;
      }

      const { update } = event;
      return 'channel' in update.diff && update.diff.channel.nest === channelId;
    },
    { tag: 'addChannelToNavSection' }
  );
};

export const addChannelToGroup = async ({
  channelId,
  groupId,
  sectionId,
}: {
  channelId: string;
  groupId: string;
  sectionId: string;
}) => {
  return await trackedPoke<ub.GroupAction>(
    groupAction(groupId, {
      channel: {
        nest: channelId,
        diff: {
          zone: sectionId,
        },
      },
    }),
    { app: 'groups', path: '/groups/ui' },
    (event) => {
      if (!('update' in event)) {
        return false;
      }

      const { update } = event;
      return 'channel' in update.diff && update.diff.channel.nest === channelId;
    },
    { tag: 'addChannelToGroup' }
  );
};

export const updateChannel = async ({
  groupId,
  channelId,
  channel,
}: {
  groupId: string;
  channelId: string;
  channel: GroupChannel;
}) => {
  return await poke(
    groupAction(groupId, {
      channel: {
        nest: channelId,
        diff: {
          edit: channel,
        },
      },
    })
  );
};

export const deleteChannel = async ({
  groupId,
  channelId,
}: {
  groupId: string;
  channelId: string;
}) => {
  return await poke(
    groupAction(groupId, {
      channel: {
        nest: channelId,
        diff: {
          del: null,
        },
      },
    })
  );
};

export const updateGroupNavigation = async ({
  groupId,
  navSections,
}: {
  groupId: string;
  navSections: db.GroupNavSection[];
}) => {
  const sections: Record<string, ub.GroupNavigationSectionData> = {};

  for (const section of navSections) {
    sections[section.sectionId] = {
      meta: {
        title: section.title ?? '',
        description: section.description ?? '',
        image: section.iconImage ?? section.coverImageColor ?? '',
        cover: section.coverImage ?? section.coverImageColor ?? '',
      },
      order: (section.channels ?? [])
        .sort((a, b) => (a.channelIndex ?? 0) - (b.channelIndex ?? 0))
        .map((c) => c.channelId)
        .filter((id): id is string => !!id),
    };
  }

  const navigation: ub.GroupNavigationUpdate = {
    sections,
    order: navSections
      .sort((a, b) => (a.sectionIndex ?? 0) - (b.sectionIndex ?? 0))
      .map((s) => s.sectionId),
  };

  return await poke(groupNavigationBatchUpdate(groupId, navigation));
};

export const addGroupRole = async ({
  groupId,
  roleId,
  meta,
}: {
  groupId: string;
  roleId: string;
  meta: db.ClientMeta;
}) => {
  return await poke(
    groupAction(groupId, {
      cabal: {
        sect: roleId,
        diff: {
          add: {
            title: meta.title ?? '',
            description: meta.description ?? '',
            image: '',
            cover: '',
          },
        },
      },
    })
  );
};

export const deleteGroupRole = async ({
  groupId,
  roleId,
}: {
  groupId: string;
  roleId: string;
}) => {
  return await poke(
    groupAction(groupId, {
      cabal: {
        sect: roleId,
        diff: {
          del: null,
        },
      },
    })
  );
};

export const updateGroupRole = async ({
  groupId,
  roleId,
  meta,
}: {
  groupId: string;
  roleId: string;
  meta: db.ClientMeta;
}) => {
  return await poke(
    groupAction(groupId, {
      cabal: {
        sect: roleId,
        diff: {
          edit: {
            title: meta.title ?? '',
            description: meta.description ?? '',
            image: '',
            cover: '',
          },
        },
      },
    })
  );
};

export const addMembersToRole = async ({
  groupId,
  roleId,
  ships,
}: {
  groupId: string;
  roleId: string;
  ships: string[];
}) => {
  return await poke(
    groupAction(groupId, {
      fleet: {
        ships,
        diff: {
          'add-sects': [roleId],
        },
      },
    })
  );
};

export const removeMembersFromRole = async ({
  groupId,
  roleId,
  ships,
}: {
  groupId: string;
  roleId: string;
  ships: string[];
}) => {
  return await poke(
    groupAction(groupId, {
      fleet: {
        ships,
        diff: {
          'del-sects': [roleId],
        },
      },
    })
  );
};

export const removeAllRolesFromMembers = async ({
  groupId,
  contactIds,
  roleIds,
}: {
  groupId: string;
  contactIds: string[];
  roleIds: string[];
}) => {
  return await poke(
    groupAction(groupId, {
      fleet: {
        ships: contactIds,
        diff: {
          'del-sects': roleIds,
        },
      },
    })
  );
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
  groupId: string;
  navSectionId: string;
  sectionId: string;
};

export type GroupNavSectionAdd = {
  type: 'addNavSection';
  navSectionId: string;
  sectionId: string;
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
  sectionId: string;
  clientMeta: db.ClientMeta;
};

export type GroupNavSectionMove = {
  type: 'moveNavSection';
  navSectionId: string;
  sectionId: string;
  index: number;
};

export type GroupnavSectionMoveChannel = {
  type: 'moveChannel';
  navSectionId: string;
  sectionId: string;
  groupId: string;
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

export type GroupJoinRequest = {
  type: 'groupJoinRequest';
  request: db.GroupJoinRequest;
};

export type GroupRevokeJoinRequests = {
  type: 'revokeGroupJoinRequests';
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

export type GroupSetAsOpen = {
  type: 'setGroupAsOpen';
  groupId: string;
};

export type GroupSetAsShut = {
  type: 'setGroupAsShut';
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

export type SetUnjoinedGroups = {
  type: 'setUnjoinedGroups';
  groups: db.Group[];
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
  | GroupJoinRequest
  | GroupRevokeJoinRequests
  | GroupInviteMembers
  | GroupRevokeMemberInvites
  | GroupBanMembers
  | GroupUnbanMembers
  | GroupBanAzimuthRanks
  | GroupUnbanAzimuthRanks
  | GroupSetAsOpen
  | GroupSetAsShut
  | GroupSetAsSecret
  | GroupSetAsNotSecret
  | GroupFlagContent
  | SetUnjoinedGroups
  | GroupUpdateUnknown;

export const subscribeGroups = async (
  eventHandler: (update: GroupUpdate) => void
) => {
  subscribe<ub.GroupAction>(
    { app: 'groups', path: '/groups/ui' },
    (groupUpdateEvent) => {
      logger.log('groupUpdateEvent', groupUpdateEvent);
      const update = toGroupUpdate(groupUpdateEvent);
      if (update) {
        eventHandler(update);
      }
    }
  );

  subscribe<ub.V1GroupResponse>(
    { app: 'groups', path: '/v1/groups' },
    (rawEvent) => {
      const update = toV1GroupsUpdate(rawEvent);
      if (update) {
        eventHandler(update);
      }
    }
  );

  subscribe(
    { app: 'groups', path: '/v1/foreigns' },
    (rawEvent: ub.Foreigns) => {
      logger.log('foreignsUpdateEvent', rawEvent);
      eventHandler(toForeignsGroupsUpdate(rawEvent));
    }
  );
};

export const toV1GroupsUpdate = (
  rawEvent: ub.V1GroupResponse
): GroupUpdate | null => {
  const groupId = rawEvent.flag;
  const event = rawEvent['r-group'];

  if ('entry' in event) {
    if ('ask' in event.entry) {
      const askData = event.entry.ask;
      if ('add' in askData) {
        const joinRequestData = askData.add;
        return {
          type: 'groupJoinRequest',
          request: {
            groupId,
            requestedAt: joinRequestData.requestedAt,
            contactId: joinRequestData.ship,
          },
        };
      }
    }
  }

  return null;
};

export const toGroupUpdate = (
  groupUpdateEvent: ub.GroupAction
): GroupUpdate | null => {
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
        } else {
          // no-op, requests to join a private group are handled by the new /v1/groups subscription
          return null;
        }
      }

      if ('del-ships' in updateDiff.cordon.shut) {
        return {
          type:
            updateDiff.cordon.shut['del-ships'].kind === 'pending'
              ? 'revokeGroupMemberInvites'
              : 'revokeGroupJoinRequests',
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
          type: 'setGroupAsOpen',
          groupId,
        };
      }

      if ('shut' in updateDiff.cordon.swap) {
        return {
          type: 'setGroupAsShut',
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
      postId: updateDiff['flag-content']['post-key']?.reply
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
    const sectionId = updateDiff.zone.zone;
    const navSectionId = `${groupId}-${sectionId}`;

    if ('add' in zoneDelta) {
      return {
        type: 'addNavSection',
        navSectionId,
        sectionId,
        groupId,
        clientMeta: toClientMeta(zoneDelta.add),
      };
    }

    if ('del' in zoneDelta) {
      return { type: 'deleteNavSection', navSectionId };
    }

    if ('edit' in zoneDelta) {
      return {
        type: 'editNavSection',
        navSectionId,
        sectionId,
        clientMeta: toClientMeta(zoneDelta.edit),
      };
    }

    if ('mov' in zoneDelta) {
      return {
        type: 'moveNavSection',
        navSectionId,
        sectionId,
        index: zoneDelta.mov,
      };
    }

    if ('mov-nest' in zoneDelta) {
      return {
        type: 'moveChannel',
        navSectionId,
        sectionId,
        groupId,
        channelId: zoneDelta['mov-nest'].nest,
        index: zoneDelta['mov-nest'].idx,
      };
    }
  }

  if ('channel' in updateDiff) {
    const channelDiff = updateDiff.channel.diff;
    const channelId = updateDiff.channel.nest;

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
        groupId,
        navSectionId: `${groupId}-${zoneId}`,
        sectionId: zoneId,
      };
    }
  }

  return { type: 'unknown' };
};

export const extractChannelReaders = (groups: ub.Groups) => {
  const channelReaders: Record<string, string[]> = {};

  Object.entries(groups).forEach(([_groupId, group]) => {
    Object.entries(group.channels).forEach(([channelId, channel]) => {
      channelReaders[channelId] = channel.readers ?? [];
    });
  });

  return channelReaders;
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

export function toClientGroupsV7(
  groups: Record<string, ub.GroupV7>,
  isJoined: boolean
) {
  if (!groups) {
    return [];
  }
  return Object.entries(groups).map(([id, group]) => {
    return toClientGroupV7(id, group, isJoined);
  });
}

export function toClientGroup(
  id: string,
  group: ub.Group,
  isJoined: boolean
): db.Group {
  const currentUserId = getCurrentUserId();
  const { host: hostUserId } = parseGroupId(id);
  const rolesById: Record<string, db.GroupRole> = {};
  const flaggedPosts: db.GroupFlaggedPosts[] = extractFlaggedPosts(
    id,
    group['flagged-content']
  );

  logger.log('cordon', group.cordon);

  const bannedMembers: db.GroupMemberBan[] =
    'open' in group.cordon
      ? group.cordon?.open.ships.map((ship) => ({
          contactId: ship,
          groupId: id,
        }))
      : [];

  logger.log('bannedMembers', bannedMembers);

  const joinRequests: db.GroupJoinRequest[] =
    group.cordon && 'shut' in group.cordon
      ? group.cordon.shut.ask.map((ask) => ({
          contactId: ask,
          groupId: id,
        }))
      : [];

  const invitedMembers: db.ChatMember[] =
    group.cordon && 'shut' in group.cordon
      ? group.cordon.shut.pending
          // filter out members who have already joined
          // for some reason, joined members can get stuck in the pending list on the server
          .filter((pending) => !group.fleet[pending])
          .map((pending) => ({
            membershipType: 'group',
            contactId: pending,
            chatId: id,
            roles: [],
            status: 'invited',
            joinedAt: null,
          }))
      : [];

  const members: db.ChatMember[] = Object.entries(group.fleet)
    .map(([userId, vessel]) => {
      return toClientGroupMember({
        groupId: id,
        contactId: userId,
        vessel: vessel,
        status: 'joined',
      });
    })
    .concat(
      invitedMembers.map((m) => {
        return toClientGroupMember({
          groupId: id,
          contactId: m.contactId,
          vessel: {
            sects: [],
            joined: 0,
          },
          status: 'invited',
        });
      })
    );

  logger.log('joinRequests', joinRequests);

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
    ...toClientGroupMeta(group.meta),
    haveInvite: isJoined ? false : undefined,
    haveRequestedInvite: isJoined ? false : undefined,
    currentUserIsMember: isJoined,
    currentUserIsHost: hostUserId === currentUserId,
    isPersonalGroup:
      id === `${currentUserId}/${domain.PersonalGroupSlugs.slug}`,
    joinStatus: groupIsSyncing(group) ? 'joining' : undefined,
    hostUserId,
    flaggedPosts,
    navSections: group['zone-ord']
      ?.map((zoneId, i) => {
        const zone = group.zones?.[zoneId];
        if (!zone) {
          return;
        }
        const data: db.GroupNavSection = {
          id: `${id}-${zoneId}`,
          sectionId: zoneId,
          groupId: id,
          ...toClientMeta(zone.meta),
          sectionIndex: i,
          channels: zone.idx.map((channelId, ci) => {
            const data: db.GroupNavSectionChannel = {
              channelIndex: ci,
              channelId: channelId,
              groupNavSectionId: `${id}-${zoneId}`,
            };
            return data;
          }),
        };
        return data;
      })
      .filter((s): s is db.GroupNavSection => !!s),
    members,
    bannedMembers,
    joinRequests,
    channels: group.channels
      ? toClientChannels({ channels: group.channels, groupId: id })
      : [],
  };
}

export function toClientGroupV7(
  id: string,
  group: ub.GroupV7,
  isJoined: boolean
): db.Group {
  const currentUserId = getCurrentUserId();
  const { host: hostUserId } = parseGroupId(id);
  const rolesById: Record<string, db.GroupRole> = {};
  const flaggedPosts: db.GroupFlaggedPosts[] = extractFlaggedPosts(
    id,
    group['flagged-content']
  );

  logger.log('admissions', group.admissions);

  // v7 uses admissions.banned instead of cordon.open
  const bannedMembers: db.GroupMemberBan[] =
    group.admissions?.banned?.ships?.map((ship) => ({
      contactId: ship,
      groupId: id,
    })) ?? [];

  logger.log('bannedMembers', bannedMembers);

  // v7 uses admissions.requests instead of cordon.shut.ask
  const joinRequests: db.GroupJoinRequest[] = group.admissions?.requests
    ? Object.entries(group.admissions.requests).map(([ship, request]) => ({
        contactId: ship,
        groupId: id,
        requestedAt: request.requestedAt || null,
      }))
    : [];

  // v7 uses admissions.invited instead of cordon.shut.pending
  const invitedMembers: db.ChatMember[] = group.admissions?.invited
    ? Object.entries(group.admissions.invited)
        // filter out members who have already joined
        .filter(([ship]) => !group.seats?.[ship])
        .map(([ship]) => ({
          membershipType: 'group' as const,
          contactId: ship,
          chatId: id,
          roles: [],
          status: 'invited' as const,
          joinedAt: null,
        }))
    : [];

  // v7 uses seats instead of fleet (and seats use 'roles' not 'sects')
  const members: db.ChatMember[] = (
    group.seats ? Object.entries(group.seats) : []
  )
    .map(([userId, seat]) => {
      return toClientGroupMember({
        groupId: id,
        contactId: userId,
        vessel: {
          sects: seat.roles, // v7 uses 'roles', v6 used 'sects'
          joined: seat.joined,
        },
        status: 'joined',
      });
    })
    .concat(
      invitedMembers.map((m) => {
        return toClientGroupMember({
          groupId: id,
          contactId: m.contactId,
          vessel: {
            sects: [],
            joined: 0,
          },
          status: 'invited',
        });
      })
    );

  logger.log('joinRequests', joinRequests);

  // v7 uses roles instead of cabals (and role IS the meta, no nested .meta property)
  const roles = (group.roles ? Object.entries(group.roles) : []).map(
    ([roleId, role]) => {
      const data: db.GroupRole = {
        id: roleId,
        groupId: id,
        ...toClientMeta(role), // v7 role IS the meta object
      };
      rolesById[roleId] = data;
      return data;
    }
  );

  return {
    id,
    roles,
    privacy: group.admissions.privacy,
    ...toClientGroupMeta(group.meta),
    haveInvite: isJoined ? false : undefined,
    haveRequestedInvite: isJoined ? false : undefined,
    currentUserIsMember: isJoined,
    currentUserIsHost: hostUserId === currentUserId,
    isPersonalGroup:
      id === `${currentUserId}/${domain.PersonalGroupSlugs.slug}`,
    joinStatus: undefined, // v7 groups from init are already joined
    hostUserId,
    flaggedPosts,
    navSections: (group['section-order'] ?? [])
      .map((zoneId, i) => {
        const zone = group.sections?.[zoneId];
        if (!zone) {
          return;
        }
        const data: db.GroupNavSection = {
          id: `${id}-${zoneId}`,
          sectionId: zoneId,
          groupId: id,
          ...toClientMeta(zone.meta),
          sectionIndex: i,
          channels: (zone.idx ?? []).map((channelId, ci) => {
            const data: db.GroupNavSectionChannel = {
              channelIndex: ci,
              channelId: channelId,
              groupNavSectionId: `${id}-${zoneId}`,
            };
            return data;
          }),
        };
        return data;
      })
      .filter((s): s is db.GroupNavSection => !!s),
    members,
    bannedMembers,
    joinRequests,
    channels: group.channels
      ? toClientChannels({ channels: group.channels, groupId: id })
      : [],
  };
}

export function groupIsSyncing(group: ub.Group) {
  // if group host is slow, there's a transitional state during group join
  // where the group exists on the user's ship, but has not yet synced
  // channels, meta, etc. there's no perfect way to handle this, so we attempt
  // to use a few different heuristics to detect it. example responses here:
  // https://gist.github.com/dnbrwstr/747c3beaa216bc235880c77d55e06448

  // Check for completely empty group (initial join state)
  const isCompletelyEmpty =
    !group['zone-ord'].length &&
    !group.bloc.length &&
    group.meta?.title === '' &&
    group.meta?.description === '' &&
    group.meta?.cover === '' &&
    group.meta?.image === '' &&
    Object.keys(group.channels).length === 0;

  // Check for partially synced state where we have metadata but no channels
  // This can happen when metadata syncs before channels
  const hasMetadataButNoChannels =
    (group.meta?.title !== '' ||
      group.meta?.description !== '' ||
      group['zone-ord'].length > 0 ||
      group.bloc.length > 0) &&
    Object.keys(group.channels).length === 0;

  // Check if nav sections reference channels that don't exist yet
  // This indicates channels haven't finished syncing
  const hasNavSectionsButMissingChannels =
    group['zone-ord'].length > 0 &&
    group.zones &&
    Object.values(group.zones).some(
      (zone) => zone.idx && zone.idx.length > 0
    ) &&
    Object.keys(group.channels).length === 0;

  // Additional check: if group has nav sections but all are empty,
  // and there are no channels, it's likely legitimately empty, not syncing
  const hasEmptyNavSections =
    group['zone-ord'].length > 0 &&
    group.zones &&
    Object.values(group.zones).every(
      (zone) => !zone.idx || zone.idx.length === 0
    );

  // If all nav sections are empty and there are no channels,
  // this is likely a legitimate state, not a sync issue
  if (hasEmptyNavSections && Object.keys(group.channels).length === 0) {
    return false;
  }

  return (
    isCompletelyEmpty ||
    hasMetadataButNoChannels ||
    hasNavSectionsButMissingChannels
  );
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
  const currentUserId = getCurrentUserId();
  const { host: hostUserId } = parseGroupId(id);

  return {
    id,
    hostUserId,
    currentUserIsMember: false,
    currentUserIsHost: hostUserId === currentUserId, // should always be false
    privacy: extractGroupPrivacy(preview),
    ...toClientMeta(preview.meta),
  };
}

export function toClientGroupsFromGangs(gangs: Record<string, ub.Gang>) {
  return Object.entries(gangs).map(([id, gang]) => {
    return toClientGroupFromGang(id, gang);
  });
}

const toForeignsGroupsUpdate = (foreignsEvent: ub.Foreigns): GroupUpdate => {
  const groups = toClientGroupsFromForeigns(foreignsEvent);
  return { type: 'setUnjoinedGroups', groups };
};

export function toClientGroupFromGang(id: string, gang: ub.Gang): db.Group {
  const currentUserId = getCurrentUserId();
  const { host: hostUserId } = parseGroupId(id);
  const privacy = extractGroupPrivacy(gang.preview, gang.claim ?? undefined);
  const joinStatus = getJoinStatusFromGang(gang);
  return {
    id,
    hostUserId,
    privacy,
    currentUserIsMember: false,
    currentUserIsHost: hostUserId === currentUserId, // should always be false
    haveInvite: !!gang.invite,
    haveRequestedInvite: gang.claim?.progress === 'knocking',
    joinStatus,
    ...(gang.preview ? toClientGroupMeta(gang.preview.meta) : {}),
  };
}

export function toClientGroupFromForeign(
  id: string,
  foreign: ub.Foreign
): db.Group {
  const currentUserId = getCurrentUserId();
  const { host: hostUserId } = parseGroupId(id);
  const privacy = extractGroupPrivacy(foreign.preview);
  const joinStatus = getJoinStatusFromForeign(foreign);

  // Filter out invalid (revoked) invites
  const validInvites = foreign.invites?.filter((inv) => inv.valid) ?? [];

  return {
    id,
    hostUserId,
    privacy,
    currentUserIsMember: false,
    currentUserIsHost: hostUserId === currentUserId, // should always be false
    haveInvite: validInvites.length > 0, // Only count valid invites
    haveRequestedInvite: foreign.progress === 'ask',
    joinStatus,
    ...(foreign.preview ? toClientGroupMeta(foreign.preview.meta) : {}),
  };
}

export function toClientGroupsFromForeigns(
  foreigns: Record<string, ub.Foreign>
) {
  if (!foreigns) return [];
  return Object.entries(foreigns).map(([id, foreign]) =>
    toClientGroupFromForeign(id, foreign)
  );
}

function getJoinStatusFromForeign(foreign: ub.Foreign): db.Group['joinStatus'] {
  if (!foreign.progress) {
    return undefined;
  }
  switch (foreign.progress) {
    case 'join':
    case 'watch':
      return 'joining';
    case 'done':
      return undefined;
    case 'error':
      return 'errored';
    default:
      return undefined;
  }
}

function toClientGroupMeta(meta: ub.GroupMeta) {
  return {
    ...toClientMeta(meta),
    title: toClientGroupTitle(meta.title),
  };
}

function toClientGroupTitle(title: string) {
  if (title.at(-1) === GENERATED_GROUP_TITLE_END_CHAR) {
    return '';
  } else {
    return title;
  }
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
  const { description, channelContentConfiguration } =
    StructuredChannelDescriptionPayload.decode(channel.meta.description);

  const readerRoles = (channel.readers ?? []).map((roleId) => ({
    channelId: id,
    roleId,
  }));

  const currentUserId = getCurrentUserId();
  const { host: hostUserId } = parseGroupChannelId(id);

  return {
    id,
    groupId,
    type: getChannelType(id),
    iconImage: omitEmpty(channel.meta.image),
    title: omitEmpty(channel.meta.title),
    coverImage: omitEmpty(channel.meta.cover),
    description,
    contentConfiguration: channelContentConfiguration,
    currentUserIsHost: hostUserId === currentUserId,
    readerRoles,
  };
}

function toClientChannelFromPreview({
  id,
  channel,
  groupId,
}: {
  id: string;
  channel: ub.ChannelPreview;
  groupId: string;
}): db.Channel {
  const { description, channelContentConfiguration } =
    StructuredChannelDescriptionPayload.decode(channel.meta.description);

  return {
    id,
    groupId,
    type: getChannelType(id),
    iconImage: omitEmpty(channel.meta.image),
    title: omitEmpty(channel.meta.title),
    coverImage: omitEmpty(channel.meta.cover),
    description,
    contentConfiguration: channelContentConfiguration,
  };
}

function toClientGroupMember({
  groupId,
  contactId,
  vessel,
  status,
}: {
  groupId: string;
  contactId: string;
  vessel: { sects: string[]; joined: number };
  status: 'invited' | 'joined';
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
    status,
    joinedAt: vessel.joined,
  };
}

function omitEmpty(val: string) {
  return val === '' ? null : val;
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
