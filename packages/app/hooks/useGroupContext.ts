import { sync } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { assembleNewChannelIdAndName } from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
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
  const groupQuery = store.useGroup({
    id: groupId,
  });

  useEffect(() => {
    if (groupId) {
      sync.syncGroup(groupId, { priority: store.SyncPriority.High });
    }
  }, [groupId]);

  const group = groupQuery.data ?? null;

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
      channels: groupChannels.filter((channel) =>
        section.channels.map((c) => c.channelId).includes(channel.id)
      ),
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

  const { data: pendingChats } = store.usePendingChats({
    enabled: isFocused,
  });
  const { data: currentChatData } = store.useCurrentChats({
    enabled: isFocused,
  });

  const createChannel = useCallback(
    async ({
      title,
      description,
      channelType,
    }: {
      title: string;
      description: string;
      channelType: Omit<db.ChannelType, 'dm' | 'groupDm'>;
    }) => {
      const { name, id } = assembleNewChannelIdAndName({
        title,
        channelType,
        currentChatData,
        pendingChats,
        currentUserId,
      });

      if (group) {
        await store.createChannel({
          groupId: group.id,
          name,
          channelId: id,
          title,
          description,
          channelType,
        });
      }
    },
    [group, currentUserId, currentChatData, pendingChats]
  );

  const deleteChannel = useCallback(
    async (channelId: string) => {
      if (group) {
        store.deleteChannel({ groupId: group.id, channelId });
      }
    },
    [group]
  );

  const updateChannel = useCallback(
    async (channel: db.Channel) => {
      const navSection = groupNavSections.find((section) =>
        section.channels.map((c) => c.channelId).includes(channel.id)
      );

      if (!navSection || !group) {
        return;
      }

      await store.updateChannel({
        groupId: group.id,
        channel,
        sectionId: navSection.sectionId,
        readers: channel.readerRoles?.map((r) => r.roleId) ?? [],
        join: true,
      });
    },
    [group, groupNavSections]
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
          group,
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
      if (group) {
        await store.addChannelToNavSection({
          group,
          channelId,
          navSectionId,
        });
      }
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
        // await store.createRole(group.id, role);
      }
    },
    [group]
  );

  const updateGroupRole = useCallback(
    async (role: db.GroupRole) => {
      if (group) {
        // await store.updateRole(group.id, role);
      }
    },
    [group]
  );

  const deleteGroupRole = useCallback(
    async (roleId: string) => {
      if (group) {
        // await store.deleteRole(group.id, roleId);
      }
    },
    [group]
  );

  const togglePinned = useCallback(async () => {
    if (group && group.channels[0]) {
      group.pin ? store.unpinItem(group.pin) : store.pinItem(group.channels[0]);
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
    createChannel,
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
  };
};
