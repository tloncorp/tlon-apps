import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { createSectionId } from '../urbit';
import * as sync from './sync';

const logger = createDevLogger('groupActions', false);

export async function createGroup({
  title,
  shortCode,
}: {
  title: string;
  shortCode: string;
}): Promise<{ group: db.Group; channel: db.Channel }> {
  logger.log(`${shortCode}: creating group`);
  const currentUserId = api.getCurrentUserId();
  try {
    await api.createGroup({
      title,
      shortCode,
    });

    const groupId = `${currentUserId}/${shortCode}`;

    await api.createNewGroupDefaultChannel({
      groupId,
      currentUserId,
    });

    await sync.syncGroup(groupId);
    await sync.syncUnreads(); // ensure current user gets registered as a member of the channel
    const group = await db.getGroup({ id: groupId });

    if (group && group.channels.length) {
      const channel = group.channels[0];
      return { group, channel };
    }

    // TODO: should we have a UserFacingError type?
    throw new Error('Something went wrong');
  } catch (e) {
    console.error(`${shortCode}: failed to create group`, e);
    throw new Error('Something went wrong');
  }
}

export async function acceptGroupInvitation(group: db.Group) {
  logger.log('accepting group invitation', group.id);
  await db.updateGroup({ id: group.id, joinStatus: 'joining' });

  try {
    await api.joinGroup(group.id);
  } catch (e) {
    console.error('Failed to accept group invitation', e);
    await db.updateGroup({ id: group.id, joinStatus: 'errored' });
  }
}

export async function rejectGroupInvitation(group: db.Group) {
  logger.log('rejecting group invitation', group.id);
  // optimistic update
  await db.deleteGroup(group.id);

  try {
    await api.rejectGroupInvitation(group.id);
  } catch (e) {
    console.error('Failed to reject group invitation', e);
    // rollback optimistic update
    await db.insertGroups({ groups: [group] });
  }
}

export async function requestGroupInvitation(group: db.Group) {
  logger.log('requesting group invitation', group.id);
  // optimistic update
  await db.updateGroup({ id: group.id, haveRequestedInvite: true });
  try {
    await api.requestGroupInvitation(group.id);
  } catch (e) {
    console.error('Failed to request group invitation', e);
    await db.updateGroup({ id: group.id, haveRequestedInvite: false });
  }
}

export async function rescindGroupInvitationRequest(group: db.Group) {
  logger.log('rejecting group invitation', group.id);
  // optimistic update
  await db.updateGroup({ id: group.id, haveRequestedInvite: false });

  try {
    await api.rescindGroupInvitationRequest(group.id);
  } catch (e) {
    console.error('Failed to rescind group invitation request', e);
    // rollback optimistic update
    await db.updateGroup({ id: group.id, haveRequestedInvite: true });
  }
}

export async function cancelGroupJoin(group: db.Group) {
  logger.log('canceling group join', group.id);
  // optimistic update
  await db.updateGroup({
    id: group.id,
    joinStatus: null,
  });

  try {
    await api.cancelGroupJoin(group.id);
  } catch (e) {
    console.error('Failed to cancel group join', e);
    // rollback optimistic update
    await db.updateGroup({
      id: group.id,
      joinStatus: 'joining',
    });
  }
}

export async function joinGroup(group: db.Group) {
  logger.log('joining group', group.id);
  // optimistic update
  await db.updateGroup({ id: group.id, joinStatus: 'joining' });

  try {
    await api.joinGroup(group.id);
  } catch (e) {
    console.error('Failed to join group', e);
    // rollback optimistic update
    await db.updateGroup({ id: group.id, joinStatus: null });
  }
}

export async function markGroupNew(group: db.Group) {
  logger.log('marking new group', group.id);
  await db.updateGroup({ id: group.id, isNew: true });
}

export async function markGroupVisited(group: db.Group) {
  logger.log('marking new group as visited', group.id);
  await db.updateGroup({ id: group.id, isNew: false });
}

export async function updateGroupMeta(group: db.Group) {
  logger.log('updating group', group.id);

  const existingGroup = await db.getGroup({ id: group.id });

  // optimistic update
  await db.updateGroup(group);

  try {
    await api.updateGroupMeta({
      groupId: group.id,
      meta: {
        title: group.title ?? '',
        description: group.description ?? '',
        cover: group.coverImage ?? group.coverImageColor ?? '',
        image: group.iconImage ?? group.iconImageColor ?? '',
      },
    });
  } catch (e) {
    console.error('Failed to update group', e);
    // rollback optimistic update
    await db.updateGroup({
      id: group.id,
      ...existingGroup,
    });
  }
}

export async function deleteGroup(group: db.Group) {
  logger.log('deleting group', group.id);

  // optimistic update
  await db.deleteGroup(group.id);

  try {
    await api.deleteGroup(group.id);
  } catch (e) {
    console.error('Failed to delete group', e);
    // rollback optimistic update
    await db.insertGroups({ groups: [group] });
  }
}

export async function addNavSection(
  group: db.Group,
  navSectionMeta: db.ClientMeta
) {
  const newSectionId = createSectionId();
  const groupNavSectionId = `${group.id}-${newSectionId}`;

  logger.log('adding nav section', group.id, groupNavSectionId);

  const newNavSection: db.GroupNavSection = {
    id: groupNavSectionId,
    sectionId: newSectionId,
    title: navSectionMeta.title,
  };

  const existingGroup = await db.getGroup({ id: group.id });

  // optimistic update
  await db.updateGroup({
    ...group,
    navSections: [...(group.navSections ?? []), newNavSection],
  });

  await db.addNavSectionToGroup({
    id: groupNavSectionId,
    sectionId: newSectionId,
    groupId: group.id,
    meta: navSectionMeta,
  });

  try {
    await api.addNavSection({
      groupId: group.id,
      navSection: newNavSection,
    });
  } catch (e) {
    console.error('Failed to add nav section', e);
    // rollback optimistic update
    await db.updateGroup({
      id: group.id,
      ...existingGroup,
    });

    await db.deleteNavSection(groupNavSectionId);
  }
}

export async function updateNavSectionMeta(
  group: db.Group,
  navSection: db.GroupNavSection
) {
  logger.log('updating nav section', group.id, navSection.id);

  const existingGroup = await db.getGroup({ id: group.id });

  // optimistic update
  await db.updateGroup({
    ...group,
    navSections: (group.navSections ?? []).map((section) =>
      section.id === navSection.id ? navSection : section
    ),
  });

  try {
    await api.updateNavSection({
      groupId: group.id,
      navSection,
    });
  } catch (e) {
    console.error('Failed to update nav section', e);
    // rollback optimistic update
    await db.updateGroup({
      id: group.id,
      ...existingGroup,
    });
  }
}

export async function moveNavSection(
  group: db.Group,
  navSectionId: string,
  newIndex: number
) {
  logger.log('moving nav section', group.id, navSectionId, newIndex);

  const existingGroup = await db.getGroup({ id: group.id });

  const navSections = group.navSections ?? [];
  const sectionIndex = navSections.findIndex(
    (section) => section.sectionId === navSectionId
  );

  if (sectionIndex === -1) {
    console.error('Section not found', navSectionId);
    return;
  }

  // we need to update sectionIndex on all sections
  const newNavSections = navSections.map((section, index) => {
    if (index === sectionIndex) {
      return section;
    }

    if (index < newIndex && index >= sectionIndex) {
      if (!section.sectionIndex) {
        console.error('sectionIndex not found', section);
        return section;
      }

      return {
        ...section,
        index: section.sectionIndex - 1,
      };
    }

    if (index > newIndex && index <= sectionIndex) {
      if (!section.sectionIndex) {
        console.error('sectionIndex not found', section);
        return section;
      }

      return {
        ...section,
        index: section.sectionIndex + 1,
      };
    }

    return section;
  });

  // optimistic update
  await db.updateGroup({
    ...group,
    navSections: newNavSections,
  });

  newNavSections.forEach(async (section, index) => {
    await db.updateNavSection({
      ...section,
      sectionIndex: index,
    });
  });

  try {
    await api.moveNavSection({
      groupId: group.id,
      navSectionId,
      index: newIndex,
    });
  } catch (e) {
    console.error('Failed to move nav section', e);
    // rollback optimistic update
    await db.updateGroup({
      id: group.id,
      ...existingGroup,
    });

    navSections.forEach(async (section, index) => {
      await db.updateNavSection({
        ...section,
        sectionIndex: index,
      });
    });
  }
}

export async function addChannelToNavSection({
  group,
  channelId,
  navSectionId,
}: {
  group: db.Group;
  channelId: string;
  navSectionId: string;
}) {
  logger.log(
    'adding channel to nav section',
    group.id,
    channelId,
    navSectionId
  );

  const existingGroup = await db.getGroup({ id: group.id });

  const navSections = group.navSections ?? [];
  const navSection = navSections.find(
    (section) => section.sectionId === navSectionId
  );

  if (!navSection && navSectionId !== 'default') {
    console.error('Nav section not found', navSectionId);
    return;
  }

  const newNavSections = navSections.map((section) => {
    if (section.sectionId !== navSectionId) {
      return section;
    }

    return {
      ...section,
      channels: [
        ...(section.channels ?? []),
        {
          channelId,
          index: (section.channels?.length ?? 0) + 1,
        },
      ],
    };
  });

  logger.log('newNavSections', newNavSections);

  const previousNavSection = navSections.find(
    (section) =>
      section.channels?.find((channel) => channel.channelId === channelId) !==
      undefined
  );

  await db.addChannelToNavSection({
    channelId,
    groupNavSectionId: navSectionId,
    index: (navSection?.channels?.length ?? 0) + 1,
  });

  if (previousNavSection) {
    await db.deleteChannelFromNavSection({
      channelId,
      groupNavSectionId: previousNavSection.id,
    });
  }

  try {
    await api.addChannelToNavSection({
      groupId: group.id,
      channelId,
      navSectionId,
    });
    logger.log('added channel to nav section');
  } catch (e) {
    logger.log('failed to add channel to nav section', e);
    console.error('Failed to add channel', e);
    // rollback optimistic update
    await db.deleteChannelFromNavSection({
      channelId,
      groupNavSectionId: navSectionId,
    });

    if (previousNavSection) {
      await db.addChannelToNavSection({
        channelId,
        groupNavSectionId: previousNavSection.sectionId,
        index: (previousNavSection.channels?.length ?? 0) + 1,
      });
    }
  }
}

export async function moveChannel({
  group,
  channelId,
  navSectionId,
  index,
}: {
  group: db.Group;
  channelId: string;
  navSectionId: string;
  index: number;
}) {
  logger.log('moving channel', group.id, channelId, navSectionId, index);

  const existingGroup = await db.getGroup({ id: group.id });

  const navSections = group.navSections ?? [];
  const navSection = navSections.find(
    (section) => section.sectionId === navSectionId
  );

  if (!navSection && navSectionId !== 'default') {
    console.error('Nav section not found', navSectionId);
    return;
  }

  const newNavSections = navSections.map((section) => {
    if (section.sectionId !== navSectionId) {
      return section;
    }

    const newChannels =
      section.channels?.filter((channel) => channel.channelId !== channelId) ??
      [];
    const [channel] =
      section.channels?.filter((channel) => channel.channelId === channelId) ??
      [];
    newChannels.splice(index, 0, channel);

    return {
      ...section,
      channels: newChannels,
    };
  });

  // optimistic update
  await db.updateGroup({
    ...group,
    navSections: newNavSections,
  });

  try {
    await api.moveChannel({
      groupId: group.id,
      channelId,
      navSectionId,
      index,
    });
  } catch (e) {
    console.error('Failed to move channel', e);
    // rollback optimistic update
    await db.updateGroup({
      id: group.id,
      ...existingGroup,
    });
  }
}

export async function updateNavSection({
  group,
  navSection,
}: {
  group: db.Group;
  navSection: db.GroupNavSection;
}) {
  logger.log('updating nav section', group.id, navSection.id);

  const existingGroup = await db.getGroup({ id: group.id });
  const existingNavSection = group.navSections?.find(
    (section) => section.id === navSection.id
  );

  if (!existingNavSection) {
    console.error('Nav section not found', navSection.id);
    return;
  }

  const newNavSections = (group.navSections ?? []).map((section) =>
    section.id === navSection.id ? navSection : section
  );

  logger.log('newNavSections', newNavSections);

  // optimistic update
  await db.updateGroup({
    ...group,
    navSections: newNavSections,
  });

  await db.updateNavSection({
    ...navSection,
  });

  try {
    await api.updateNavSection({
      groupId: group.id,
      navSection,
    });
  } catch (e) {
    console.error('Failed to update nav section', e);
    // rollback optimistic update
    await db.updateGroup({
      id: group.id,
      ...existingGroup,
    });

    await db.updateNavSection({
      ...existingNavSection,
    });
  }
}

export async function deleteNavSection(group: db.Group, navSectionId: string) {
  logger.log('deleting nav section', group.id, navSectionId);

  const existingGroup = await db.getGroup({ id: group.id });
  const existingNavSection = group.navSections?.find(
    (section) => section.id === navSectionId
  );

  if (!existingNavSection) {
    console.error('Nav section not found', navSectionId);
    return;
  }

  // optimistic update
  await db.updateGroup({
    ...group,
    navSections: (group.navSections ?? []).filter(
      (section) => section.id !== navSectionId
    ),
  });

  await db.deleteNavSection(existingNavSection.id);

  try {
    await api.deleteNavSection({
      groupId: group.id,
      sectionId: existingNavSection.sectionId,
    });
  } catch (e) {
    console.error('Failed to delete nav section', e);
    // rollback optimistic update
    await db.updateGroup({
      id: group.id,
      ...existingGroup,
    });

    await db.addNavSectionToGroup({
      id: existingNavSection.id,
      sectionId: existingNavSection.sectionId,
      groupId: group.id,
      meta: {
        title: existingNavSection.title,
      },
    });
  }
}

export async function kickUserFromGroup({
  groupId,
  contactId,
}: {
  groupId: string;
  contactId: string;
}) {
  logger.log('kicking user from group', groupId, contactId);

  const existingGroup = await db.getGroup({ id: groupId });

  if (!existingGroup) {
    console.error('Group not found', groupId);
    return;
  }

  if (!existingGroup.members) {
    console.error('Group members not found', groupId);
    return;
  }

  if (!existingGroup.members.find((member) => member.contactId === contactId)) {
    console.error('User not found in group', groupId, contactId);
    return;
  }
  // optimistic update
  await db.removeChatMembers({
    chatId: groupId,
    contactIds: [contactId],
  });

  try {
    await api.kickUsersFromGroup({
      groupId,
      contactIds: [contactId],
    });
  } catch (e) {
    console.error('Failed to kick user from group', e);
    // rollback optimistic update
    await db.addChatMembers({
      chatId: groupId,
      type: 'group',
      contactIds: [contactId],
    });
  }
}

export async function banUserFromGroup({
  groupId,
  contactId,
}: {
  groupId: string;
  contactId: string;
}) {
  logger.log('banning user from group', groupId, contactId);

  const existingGroup = await db.getGroup({ id: groupId });

  if (!existingGroup) {
    console.error('Group not found', groupId);
    return;
  }

  if (!existingGroup.members) {
    console.error('Group members not found', groupId);
    return;
  }

  if (!existingGroup.members.find((member) => member.contactId === contactId)) {
    console.error('User not found in group', groupId, contactId);
    return;
  }

  if (existingGroup.privacy !== 'public') {
    console.error('Group is not public', groupId);
    return;
  }
  // optimistic update
  await db.addGroupMemberBans({
    groupId,
    contactIds: [contactId],
  });

  await db.removeChatMembers({
    chatId: groupId,
    contactIds: [contactId],
  });

  try {
    await api.kickUsersFromGroup({
      groupId,
      contactIds: [contactId],
    });

    await api.banUsersFromGroup({ groupId: groupId, contactIds: [contactId] });
  } catch (e) {
    console.error('Failed to ban user from group', e);
    // rollback optimistic update
    await db.addChatMembers({
      chatId: groupId,
      type: 'group',
      contactIds: [contactId],
    });

    await db.deleteGroupMemberBans({
      groupId,
      contactIds: [contactId],
    });
  }
}

export async function unbanUserFromGroup({
  groupId,
  contactId,
}: {
  groupId: string;
  contactId: string;
}) {
  logger.log('unbanning user from group', groupId, contactId);

  const existingGroup = await db.getGroup({ id: groupId });

  if (!existingGroup) {
    console.error('Group not found', groupId);
    return;
  }

  if (!existingGroup.members) {
    console.error('Group members not found', groupId);
    return;
  }

  if (existingGroup.members.find((member) => member.contactId === contactId)) {
    console.error('User is still in group', groupId, contactId);
    return;
  }
  // optimistic update
  await db.deleteGroupMemberBans({
    groupId,
    contactIds: [contactId],
  });

  try {
    await api.unbanUsersFromGroup({ groupId, contactIds: [contactId] });
  } catch (e) {
    console.error('Failed to unban user from group', e);
    // rollback optimistic update
    await db.addGroupMemberBans({
      groupId,
      contactIds: [contactId],
    });
  }
}

export async function leaveGroup(groupId: string) {
  logger.log('leaving group', groupId);

  const existingGroup = await db.getGroup({ id: groupId });

  if (!existingGroup) {
    console.error('Group not found', groupId);
    return;
  }

  // optimistic update
  await db.deleteGroup(groupId);

  try {
    await api.leaveGroup(groupId);
  } catch (e) {
    console.error('Failed to leave group', e);
    // rollback optimistic update
    await db.insertGroups({ groups: [existingGroup] });
  }
}
