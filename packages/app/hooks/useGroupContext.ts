import { sync, useUpdateChannel } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo } from 'react';

import { useCurrentUserId } from './useCurrentUser';

export const useGroupContext = ({
  groupId,
  isFocused,
}: {
  groupId: string;
  isFocused?: boolean;
}) => {
  const currentUserId = useCurrentUserId();
  const groupQuery = store.useGroupWithAllModels({
    id: groupId,
  });

  useEffect(() => {
    if (groupId) {
      sync.syncGroup(groupId, { priority: store.SyncPriority.High });
    }
  }, [groupId]);

  const group = groupQuery.data ?? null;
  console.log('Group context', { groupId, group, isFocused });

  const currentUserIsAdmin = useMemo(() => {
    return group?.members.some(
      (member) =>
        member.contactId === currentUserId &&
        member.roles.some((role) => role.roleId === 'admin')
    );
  }, [group?.members, currentUserId]);

  const groupMembers = useMemo(() => {
    return group?.members ?? [];
  }, [group?.members]);

  const groupRoles = useMemo(() => {
    return group?.roles ?? [];
  }, [group?.roles]);

  const groupChannels = useMemo(() => {
    return group?.channels ?? [];
  }, [group?.channels]);

  const groupNavSections = useMemo(() => {
    return group?.navSections ?? [];
  }, [group?.navSections]);

  const groupInvites = useMemo(() => {
    return group?.members.filter((m) => m.status === 'invited') ?? [];
  }, [group?.members]);

  const groupNavSectionsWithChannels = useMemo(() => {
    return groupNavSections.map((section) => ({
      ...section,
      channels: groupChannels
        .filter((channel) =>
          section.channels.map((c) => c.channelId).includes(channel.id)
        )
        .sort((a, b) => {
          const aIndex =
            section.channels.find((c) => c.channelId === a.id)?.channelIndex ??
            0;
          const bIndex =
            section.channels.find((c) => c.channelId === b.id)?.channelIndex ??
            0;

          return aIndex - bIndex;
        }),
    }));
  }, [groupNavSections, groupChannels]);

  const setGroupMetadata = useCallback(
    async (metadata: db.ClientMeta) => {
      if (group) {
        await store.updateGroupMeta({
          ...group,
          ...metadata,
        });
      }
    },
    [group]
  );

  const moveNavSection = useCallback(
    async (navSectionId: string, newIndex: number) => {
      if (group) {
        await store.moveNavSection(group, navSectionId, newIndex);
      }
    },
    [group]
  );

  const setGroupPrivacy = useCallback(
    // need a db type for privacy
    async () => {
      if (group) {
        // await store.updateGroupPrivacy(group.id, privacy);
      }
    },
    [group]
  );

  const deleteGroup = useCallback(async () => {
    if (group) {
      await store.deleteGroup(group);
    }
  }, [group]);

  const deleteChannel = useCallback(
    async (channelId: string) => {
      if (group) {
        store.deleteChannel({ groupId: group.id, channelId });
      }
    },
    [group]
  );

  const _updateChannel = useUpdateChannel();
  const updateChannel = useCallback(
    async (channel: db.Channel, readers?: string[], writers?: string[]) => {
      if (group == null) {
        throw new Error('Group is null');
      }
      return _updateChannel({ channel, group, readers, writers });
    },
    [group, _updateChannel]
  );

  const createNavSection = useCallback(
    async ({ title }: { title: string }) => {
      if (group) {
        await store.addNavSection(group, { title });
      }
    },
    [group]
  );

  const deleteNavSection = useCallback(
    async (navSectionId: string) => {
      if (group) {
        await store.deleteNavSection(group, navSectionId);
      }
    },
    [group]
  );

  const updateNavSection = useCallback(
    async (navSection: db.GroupNavSection) => {
      if (group) {
        await store.updateNavSection({
          navSection,
          group,
        });
      }
    },
    [group]
  );

  const moveChannel = useCallback(
    async (channelId: string, navSectionId: string, index: number) => {
      if (group) {
        await store.moveChannel({
          groupId: group.id,
          channelId,
          navSectionId,
          index,
        });
      }
    },
    [group]
  );

  const moveChannelToNavSection = useCallback(
    async (channelId: string, navSectionId: string) => {
      if (!group) return;

      // Find current section for the channel
      const currentSection = group.navSections?.find((section) =>
        section.channels?.some((channel) => channel.channelId === channelId)
      );

      if (!currentSection) {
        console.error('Channel not found in any section');
        return;
      }

      // Use addChannelToNavSection which handles both adding to new section
      // and removing from the previous section
      await store.addChannelToNavSection({
        groupId: group.id,
        channelId,
        navSectionId,
      });
    },
    [group]
  );

  const inviteUsers = useCallback(
    async (contactId: string[]) => {
      if (group) {
        // await store.inviteUser(group.id, contactId);
      }
    },
    [group]
  );

  const getPublicInviteUrl = useCallback(async () => {
    if (group) {
      // return store.getPublicInviteUrl(group.id);
    }
  }, [group]);

  const createGroupRole = useCallback(
    async (role: db.GroupRole) => {
      if (group) {
        if (!role.id) {
          console.error('Role ID is required');
          return;
        }
        store.addGroupRole({
          groupId: group.id,
          roleId: role.id,
          meta: {
            title: role.title,
            description: role.description,
          },
        });
      }
    },
    [group]
  );

  const updateGroupRole = useCallback(
    async (role: db.GroupRole) => {
      if (group) {
        if (!role.id) {
          console.error('Role ID is required');
          return;
        }
        store.updateGroupRole({
          groupId: group.id,
          roleId: role.id,
          meta: {
            title: role.title,
            description: role.description,
          },
        });
      }
    },
    [group]
  );

  const deleteGroupRole = useCallback(
    async (roleId: string) => {
      if (group) {
        store.deleteGroupRole({
          groupId: group.id,
          roleId,
        });
      }
    },
    [group]
  );

  const addUserToRole = useCallback(
    async (contactId: string, roleId: string) => {
      if (group) {
        await store.addMembersToRole({
          groupId: group.id,
          roleId,
          contactIds: [contactId],
        });
      }
    },
    [group]
  );

  const removeUserFromRole = useCallback(
    async (contactId: string, roleId: string) => {
      if (group) {
        await store.removeMembersFromRole({
          groupId: group.id,
          roleId,
          contactIds: [contactId],
        });
      }
    },
    [group]
  );

  const togglePinned = useCallback(async () => {
    if (group) {
      const groupWithPin = await db.getGroup({ id: group.id });
      if (!groupWithPin) {
        console.warn(`Group ${group.id} not found`);
        return;
      }

      if (groupWithPin.pin) {
        await store.unpinItem(groupWithPin.pin);
      } else {
        await store.pinGroup(group);
      }
    }
  }, [group]);

  const acceptUserJoin = useCallback(
    async (contactId: string) => {
      if (group) {
        await store.acceptUserJoin({ groupId: group.id, contactId });
      }
    },
    [group]
  );

  const rejectUserJoin = useCallback(
    async (contactId: string) => {
      if (group) {
        await store.rejectUserJoin({ groupId: group.id, contactId });
      }
    },
    [group]
  );

  const joinRequests = useMemo(() => {
    if (!group) {
      return [];
    }

    return group.joinRequests ?? [];
  }, [group]);

  const banUser = useCallback(
    async (contactId: string) => {
      if (group) {
        await store.banUserFromGroup({
          groupId: group.id,
          contactId,
        });
      }
    },
    [group]
  );

  const unbanUser = useCallback(
    async (contactId: string) => {
      if (group) {
        await store.unbanUserFromGroup({
          groupId: group.id,
          contactId,
        });
      }
    },
    [group]
  );

  const bannedUsers = useMemo(() => {
    if (!group) {
      return [];
    }

    return group.bannedMembers ?? [];
  }, [group]);

  const kickUser = useCallback(
    async (contactId: string) => {
      if (group) {
        await store.kickUserFromGroup({ groupId: group.id, contactId });
      }
    },
    [group]
  );

  const groupPrivacyType = useMemo(() => {
    return group?.privacy ?? 'public';
  }, [group]);

  const setUserRoles = useCallback(
    async (contactId: string, roleIds: string[]) => {
      if (group) {
        // await store.setUserRoles(group.id, contactId, roleIds);
      }
    },
    [group]
  );

  const leaveGroup = useCallback(async () => {
    if (group) {
      await store.leaveGroup(group.id);
    }
  }, [group]);

  return {
    group,
    groupMembers,
    groupRoles,
    groupInvites,
    groupChannels,
    groupNavSections,
    groupNavSectionsWithChannels,
    currentUserId,
    currentUserIsAdmin,
    setGroupMetadata,
    setGroupPrivacy,
    deleteGroup,
    deleteChannel,
    updateChannel,
    createNavSection,
    deleteNavSection,
    updateNavSection,
    moveNavSection,
    moveChannel,
    moveChannelToNavSection,
    inviteUsers,
    getPublicInviteUrl,
    createGroupRole,
    updateGroupRole,
    deleteGroupRole,
    togglePinned,
    banUser,
    unbanUser,
    bannedUsers,
    kickUser,
    setUserRoles,
    acceptUserJoin,
    rejectUserJoin,
    joinRequests,
    leaveGroup,
    groupPrivacyType,
    addUserToRole,
    removeUserFromRole,
  };
};
