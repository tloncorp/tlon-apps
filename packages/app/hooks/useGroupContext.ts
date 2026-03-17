import { sync, useUpdateChannel } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  useGroup,
  SyncPriority,
  updateGroupMeta,
  deleteGroup as deleteGroupFn,
  deleteChannel as deleteChannelFn,
  addNavSection,
  deleteNavSection as deleteNavSectionFn,
  updateNavSection as updateNavSectionFn,
  updateGroupNavigationBatch,
  addGroupRole,
  updateGroupRole as updateGroupRoleFn,
  deleteGroupRole as deleteGroupRoleFn,
  addMembersToRole,
  removeMembersFromRole,
  unpinItem,
  pinGroup,
  acceptUserJoin as acceptUserJoinFn,
  rejectUserJoin as rejectUserJoinFn,
  banUserFromGroup,
  unbanUserFromGroup,
  revokeGroupMemberInvites,
  kickUserFromGroup,
  leaveGroup as leaveGroupFn,
} from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo } from 'react';

import { useCurrentUserId } from './useCurrentUser';

export const useGroupContext = ({ groupId }: { groupId: string }) => {
  const currentUserId = useCurrentUserId();

  const groupQuery = useGroup({
    id: groupId,
  });

  useEffect(() => {
    if (groupId) {
      sync.syncGroup(groupId, { priority: SyncPriority.High });
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
      channels: groupChannels
        .filter((channel) =>
          section.channels.map((c) => c.channelId).includes(channel.id)
        )
        .map((c) => ({
          ...c,
          index:
            section.channels.find((ch) => ch.channelId === c.id)
              ?.channelIndex ?? 0,
        }))
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
        await updateGroupMeta({
          ...group,
          ...metadata,
        });
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
      await deleteGroupFn(group);
    }
  }, [group]);

  const deleteChannel = useCallback(
    async (channelId: string) => {
      if (group) {
        deleteChannelFn({ groupId: group.id, channelId });
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
        await addNavSection(group, { title });
      }
    },
    [group]
  );

  const deleteNavSection = useCallback(
    async (navSectionId: string) => {
      if (group) {
        await deleteNavSectionFn(group, navSectionId);
      }
    },
    [group]
  );

  const updateNavSection = useCallback(
    async (navSection: db.GroupNavSection) => {
      if (group) {
        await updateNavSectionFn({
          navSection,
          group,
        });
      }
    },
    [group]
  );

  const updateGroupNavigation = useCallback(
    async (
      navSections: Array<{
        sectionId: string;
        sectionIndex: number;
        channels: Array<{ channelId: string; channelIndex: number }>;
      }>
    ) => {
      if (!group) {
        return;
      }

      // Preserve existing section metadata while applying new structure
      const updatedNavSections: (db.GroupNavSection | null)[] = navSections.map(
        (newSection) => {
          const existingSection = group.navSections?.find(
            (s) => s.sectionId === newSection.sectionId
          );

          if (!existingSection) {
            console.error(
              `Section ${newSection.sectionId} not found in group navSections`
            );
            return null;
          }

          return {
            ...existingSection,
            sectionIndex: newSection.sectionIndex,
            channels: newSection.channels.map((chan) => ({
              channelId: chan.channelId,
              groupNavSectionId: existingSection.id,
              channelIndex: chan.channelIndex,
            })),
          } as db.GroupNavSection;
        }
      );

      const validNavSections = updatedNavSections.filter(
        (s): s is db.GroupNavSection => s !== null
      );

      await updateGroupNavigationBatch({
        group: {
          ...group,
          navSections: validNavSections,
        },
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
        addGroupRole({
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
        updateGroupRoleFn({
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
        deleteGroupRoleFn({
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
        await addMembersToRole({
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
        await removeMembersFromRole({
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
        await unpinItem(groupWithPin.pin);
      } else {
        await pinGroup(group);
      }
    }
  }, [group]);

  const acceptUserJoin = useCallback(
    async (contactId: string) => {
      if (group) {
        await acceptUserJoinFn({ groupId: group.id, contactId });
      }
    },
    [group]
  );

  const rejectUserJoin = useCallback(
    async (contactId: string) => {
      if (group) {
        await rejectUserJoinFn({ groupId: group.id, contactId });
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
        await banUserFromGroup({
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
        await unbanUserFromGroup({
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

  const revokeInvite = useCallback(
    async (contactId: string) => {
      if (group) {
        await revokeGroupMemberInvites({
          groupId: group.id,
          contactIds: [contactId],
        });
      }
    },
    [group]
  );

  const kickUser = useCallback(
    async (contactId: string) => {
      if (group) {
        await kickUserFromGroup({ groupId: group.id, contactId });
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
      await leaveGroupFn(group.id);
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
    updateGroupNavigation,
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
    revokeInvite,
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
