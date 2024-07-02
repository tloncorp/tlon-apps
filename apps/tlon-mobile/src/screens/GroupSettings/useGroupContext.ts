import { sync } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useEffect, useMemo } from 'react';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useImageUpload } from '../../hooks/useImageUpload';

export const useGroupContext = ({ groupId }: { groupId: string }) => {
  const currentUserId = useCurrentUserId();
  const groupQuery = store.useGroup({
    id: groupId,
  });

  const group = groupQuery.data;

  const uploadInfo = useImageUpload({
    uploaderKey: `group-${groupId}`,
  });

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

  const groupChannels = useMemo(() => {
    return group?.channels ?? [];
  }, [group?.channels]);

  const groupNavSections = useMemo(() => {
    console.log('group?.navSections', group?.navSections);
    return group?.navSections ?? [];
  }, [group?.navSections]);

  const groupInvites = useMemo(() => {
    return group?.members.filter((m) => m.status === 'invited') ?? [];
  }, [group?.members]);

  const groupNavSectionsWithChannels = useMemo(() => {
    console.log('groupNavSections', groupNavSections);
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

  const createChannel = useCallback(
    async (channel: db.Channel) => {
      if (group) {
        // await store.createChannel(group.id, channel);
      }
    },
    [group]
  );

  const deleteChannel = useCallback(
    async (channelId: string) => {
      if (group) {
        // await store.deleteChannel(group.id, channelId);
      }
    },
    [group]
  );

  const updateChannel = useCallback(
    async (channel: db.Channel) => {
      if (group) {
        // await store.updateChannel(group.id, channel);
      }
    },
    [group]
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
        // await store.deleteNavSection(group.id, navSectionId);
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

  const setChannelOrder = useCallback(
    async (channelIds: string[], navSectionId: string) => {
      if (group) {
        // await store.setChannelOrder(group.id, channelIds);
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

  const addChannelToNavSection = useCallback(
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

  const moveChannelToNavSection = useCallback(
    async (channelId: string, navSectionId: string) => {
      if (group) {
        await store.addChannelToNavSection({
          group,
          channelId,
          navSectionId,
        });
        await store.moveChannel({
          group,
          channelId,
          navSectionId,
          index: 0,
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

  const banUser = useCallback(
    async (contactId: string) => {
      if (group) {
        // await store.banUser(group.id, contactId);
      }
    },
    [group]
  );

  const unbanUser = useCallback(
    async (contactId: string) => {
      if (group) {
        // await store.unbanUser(group.id, contactId);
      }
    },
    [group]
  );

  const kickUser = useCallback(
    async (contactId: string) => {
      if (group) {
        // await store.kickUser(group.id, contactId);
      }
    },
    [group]
  );

  const setUserRoles = useCallback(
    async (contactId: string, roleIds: string[]) => {
      if (group) {
        // await store.setUserRoles(group.id, contactId, roleIds);
      }
    },
    [group]
  );

  useEffect(() => {
    if (group) {
      sync.syncGroup(group.id);
    }
  }, [group, group?.id]);

  return {
    group,
    uploadInfo,
    groupMembers,
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
    setChannelOrder,
    addChannelToNavSection,
    moveChannel,
    moveChannelToNavSection,
    inviteUsers,
    getPublicInviteUrl,
    createGroupRole,
    updateGroupRole,
    deleteGroupRole,
    banUser,
    unbanUser,
    kickUser,
    setUserRoles,
  };
};
