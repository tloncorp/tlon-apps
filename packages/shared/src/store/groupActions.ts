import isEqual from 'lodash/isEqual';

import * as api from '../api';
import * as db from '../db';
import { GroupPrivacy } from '../db/schema';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';
import * as logic from '../logic';
import { getRandomId } from '../logic';
import { createSectionId } from '../urbit';
import { pinGroup } from './channelActions';

const logger = createDevLogger('groupActions', false);

interface CreateGroupParams {
  title?: string;
  image?: string;
  memberIds?: string[];
}

export async function scaffoldPersonalGroup() {
  const currentUserId = api.getCurrentUserId();
  const PersonalGroupKeys = logic.getPersonalGroupKeys(currentUserId);
  const groupIconUrl = logic.getRandomDefaultPersonalGroupIcon();

  logger.trackEvent('Personal Group Scaffold', {
    context: 'starting personal group scaffold',
    method: 'thread creation',
  });

  try {
    const personalGroup: db.Group = {
      id: PersonalGroupKeys.groupId,
      title: PersonalGroupKeys.groupName,
      iconImage: groupIconUrl,
      currentUserIsMember: true,
      isPersonalGroup: true,
      hostUserId: currentUserId,
      currentUserIsHost: true,
      privacy: 'secret',
    };

    const chatChannel: db.Channel = {
      id: PersonalGroupKeys.chatChannelId,
      groupId: PersonalGroupKeys.groupId,
      type: 'chat',
      title: PersonalGroupKeys.chatChannelName,
    };

    const collectionChannel: db.Channel = {
      id: PersonalGroupKeys.collectionChannelId,
      groupId: PersonalGroupKeys.groupId,
      type: 'gallery',
      title: PersonalGroupKeys.collectionChannelName,
    };

    const notebookChannel: db.Channel = {
      id: PersonalGroupKeys.notebookChannelId,
      groupId: PersonalGroupKeys.groupId,
      type: 'notebook',
      title: PersonalGroupKeys.notebookChannelName,
    };

    personalGroup.channels = [chatChannel, collectionChannel, notebookChannel];

    const createdGroup = await createGroup({ group: personalGroup });

    // Final consistency check
    const createdChat = createdGroup.channels?.find(
      (chan) => chan.id === PersonalGroupKeys.chatChannelId
    );
    const createdCollection = createdGroup.channels?.find(
      (chan) => chan.id === PersonalGroupKeys.collectionChannelId
    );
    const createdNotebook = createdGroup.channels?.find(
      (chan) => chan.id === PersonalGroupKeys.notebookChannelId
    );
    if (
      !createdGroup ||
      !createdChat ||
      !createdCollection ||
      !createdNotebook
    ) {
      logger.trackEvent('Personal Group Scaffold', {
        notes: 'Completed scaffold, but not all items are present',
        hasGroup: !!createdGroup,
        hasChatChannel: !!createdChat,
        hasCollectionChannel: !!createdCollection,
        hasNotesChannel: !!createdNotebook,
      });
      throw new Error('Something went wrong');
    } else {
      logger.trackEvent('Personal Group Scaffold', {
        note: 'Passed final consistency check',
      });
    }

    // attempt to pin it
    pinGroup(createdGroup);

    logger.trackEvent('Completed Personal Group Scaffold', {
      ...logic.getModelAnalytics({ group: { id: PersonalGroupKeys.groupId } }),
    });
  } catch (e) {
    logger.trackEvent('Error Personal Group Scaffold', {
      errorMessage: e.message,
      stack: e.stack,
    });
    throw new Error('Something went wrong');
  }
}

export async function createDefaultGroup(
  params: CreateGroupParams
): Promise<db.Group> {
  const currentUserId = api.getCurrentUserId();
  const groupSlug = getRandomId();
  const groupId = `${currentUserId}/${groupSlug}`;

  // build the group
  const newGroup: db.Group = {
    id: groupId,
    title: params.title ?? '',

    currentUserIsMember: true,
    currentUserIsHost: true,
    hostUserId: currentUserId,
    privacy: 'secret',
  };

  // build the default channel channel
  const channelSlug = getRandomId();
  const channelId = `chat/${currentUserId}/${channelSlug}`;
  const defaultChannel: db.Channel = {
    id: channelId,
    groupId,
    type: 'chat',
    title: 'General',
    currentUserIsMember: true,
  };
  newGroup.channels = [defaultChannel];

  return createGroup({ group: newGroup, memberIds: params.memberIds ?? [] });
}

export async function createGroup(params: {
  group: db.Group;
  memberIds?: string[];
}): Promise<db.Group> {
  const placeHolderTitle = await getPlaceholderTitle(params);

  // optimistic update
  await db.insertGroups({
    groups: [params.group],
  });

  try {
    const resultGroup = await api.createGroup({
      group: params.group,
      placeHolderTitle,
      memberIds: params.memberIds,
    });

    // insert the real one
    await db.insertGroups({ groups: [resultGroup] });

    logger.trackEvent(AnalyticsEvent.ActionCreateGroup, {
      ...logic.getModelAnalytics({ group: params.group }),
      initialMemberCount: params.memberIds?.length ?? 0,
    });

    return resultGroup;
  } catch (e) {
    // rollback optimistic update
    await db.deleteGroup(params.group.id);

    console.error(`${params.group.id}: failed to create group`, e);
    logger.trackEvent(AnalyticsEvent.ErrorCreateGroup, {
      errorMessage: e.message,
      stack: e.stack,
    });
    throw new Error('Something went wrong');
  }
}

async function getPlaceholderTitle({ memberIds, title }: CreateGroupParams) {
  // No need to set a placeholder title if the user has already set a title
  if (title) {
    return;
  }
  const currentUserId = api.getCurrentUserId();
  const contactIds = [...(memberIds ?? []), currentUserId];
  const memberContacts = await Promise.all(
    contactIds.map(
      async (id): Promise<db.Contact> => (await db.getContact({ id })) ?? { id }
    )
  );
  return memberContacts.map((c) => c?.nickname ?? c?.id).join(', ');
}

export async function acceptGroupInvitation(group: db.Group) {
  logger.log('accepting group invitation', group.id);
  logger.trackEvent(
    AnalyticsEvent.ActionAcceptGroupInvite,
    logic.getModelAnalytics({ group })
  );
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
  logger.trackEvent(
    AnalyticsEvent.ActionRejectGroupInvite,
    logic.getModelAnalytics({ group })
  );
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
  logger.trackEvent(
    AnalyticsEvent.ActionRequestGroupInvite,
    logic.getModelAnalytics({ group })
  );
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

export async function inviteGroupMembers({
  groupId,
  contactIds,
}: {
  groupId: string;
  contactIds: string[];
}) {
  logger.log('inviting group members', groupId, contactIds);

  const existingGroup = await db.getGroup({ id: groupId });

  if (!existingGroup) {
    console.error('Group not found', groupId);
    return;
  }

  // optimistic update
  await db.addChatMembers({
    chatId: groupId,
    type: 'group',
    contactIds,
    joinStatus: 'invited',
  });

  logger.trackEvent(AnalyticsEvent.OnNetworkInvite, {
    ...logic.getModelAnalytics({ group: existingGroup }),
    numInvitesSent: contactIds.length,
  });

  try {
    if (existingGroup.privacy === 'public') {
      await api.addGroupMembers({ groupId, contactIds });
    } else {
      await api.inviteGroupMembers({ groupId, contactIds });
    }
  } catch (e) {
    logger.trackError('Failed to invite group members', {
      errorMessage: e.message,
      errorStack: e.stack,
    });
    // rollback optimistic update
    await db.removeChatMembers({
      chatId: groupId,
      contactIds,
    });
  }
}

export async function cancelGroupJoin(group: db.Group) {
  logger.log('canceling group join', group.id);
  logger.trackEvent(
    AnalyticsEvent.ActionCancelGroupJoin,
    logic.getModelAnalytics({ group })
  );
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
  logger.trackEvent(
    AnalyticsEvent.ActionJoinGroup,
    logic.getModelAnalytics({ group })
  );
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

export async function markGroupVisited(groupId: string) {
  await db.updateGroup({ id: groupId, isNew: false });
}

export async function updateGroupPrivacy(
  group: db.Group,
  newPrivacy: GroupPrivacy
) {
  logger.log('updating group privacy', group.id, newPrivacy);
  logger.trackEvent(AnalyticsEvent.ActionUpdatedGroupPrivacy, {
    ...logic.getModelAnalytics({ group }),
    newPrivacy,
  });

  const oldPrivacy = group.privacy ?? 'public';

  if (oldPrivacy === newPrivacy) {
    return;
  }

  // optimistic update
  await db.updateGroup({
    id: group.id,
    privacy: newPrivacy,
  });

  try {
    await api.updateGroupPrivacy({
      groupId: group.id,
      oldPrivacy,
      newPrivacy,
    });
  } catch (e) {
    // rollback optimistic update
    await db.updateGroup({
      id: group.id,
      privacy: oldPrivacy,
    });
  }
}

export async function updateGroupMeta(group: db.Group) {
  logger.log('updating group', group.id);
  logger.trackEvent(AnalyticsEvent.ActionCustomizedGroup, {
    ...logic.getModelAnalytics({ group }),
    hasTitle: !!group.title,
    hasDescription: !!group.description,
    hasCoverImage: !!group.coverImage,
    hasIconImage: !!group.iconImage,
  });

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
    if (existingGroup) {
      await db.updateGroup(existingGroup);
    }
  }
}

export async function deleteGroup(group: db.Group) {
  logger.log('deleting group', group.id);
  logger.trackEvent(
    AnalyticsEvent.ActionDeleteGroup,
    logic.getModelAnalytics({ group })
  );

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
    if (existingGroup) {
      await db.updateGroup(existingGroup);
      await db.deleteNavSection(groupNavSectionId);
    }
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
    if (existingGroup) {
      await db.updateGroup(existingGroup);
    }
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
    id: group.id,
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
    if (existingGroup) {
      await db.updateGroup(existingGroup);
      navSections.forEach(async (section, index) => {
        await db.updateNavSection({
          ...section,
          sectionIndex: index,
        });
      });
    }
  }
}

export async function addChannelToNavSection({
  groupId,
  channelId,
  navSectionId,
}: {
  groupId: string;
  channelId: string;
  navSectionId: string;
}) {
  logger.log('adding channel to nav section', groupId, channelId, navSectionId);

  const existingGroup = await db.getGroup({ id: groupId });

  if (!existingGroup) {
    logger.error('Group not found', groupId);
    return;
  }

  const navSections = existingGroup.navSections ?? [];
  const navSection = navSections.find(
    (section) => section.sectionId === navSectionId
  );

  if (!navSection && navSectionId !== 'default') {
    console.error('Nav section not found', navSectionId);
    return;
  }

  const previousNavSection = navSections.find(
    (section) =>
      section.channels?.find((channel) => channel.channelId === channelId) !==
      undefined
  );

  if (previousNavSection) {
    // First make sure this channel isn't already in the section
    if (previousNavSection.sectionId === navSectionId) {
      logger.log('Channel already in section', channelId, navSectionId);
      return;
    }

    // Then remove from previous section if it exists
    await db.deleteChannelFromNavSection({
      channelId,
      groupNavSectionId: previousNavSection.id,
    });
  }

  // Then add to new section
  await db.addChannelToNavSection({
    channelId,
    groupNavSectionId: `${groupId}-${navSectionId}`,
    // The %groups agent only supports adding new channels to the start of a section.
    index: 0,
  });

  try {
    await api.addChannelToNavSection({
      groupId: groupId,
      channelId,
      navSectionId,
    });
    logger.log('added channel to nav section');
  } catch (e) {
    logger.log('failed to add channel to nav section', e);
    console.error('Failed to add channel', e);

    // rollback optimistic update - first remove from new section
    await db.deleteChannelFromNavSection({
      channelId,
      groupNavSectionId: navSectionId,
    });

    // then add back to previous section if it existed
    if (previousNavSection) {
      const prevIndex =
        previousNavSection.channels?.findIndex(
          (c) => c.channelId === channelId
        ) ?? 0;
      await db.addChannelToNavSection({
        channelId,
        groupNavSectionId: previousNavSection.sectionId,
        index: prevIndex,
      });
    }
  }
}

export async function updateChannelSections({
  groupId,
  navSectionId,
  channelId,
  index,
}: {
  groupId: string;
  navSectionId: string;
  channelId: string;
  index: number;
}): Promise<{
  sectionChannels: db.GroupNavSectionChannel[];
  group: db.Group;
} | null> {
  try {
    const group = await db.getGroup({ id: groupId });
    if (!group) {
      logger.error('Group not found');
      return null;
    }

    const navSections = group.navSections ?? [];
    const navSection = navSections.find(
      (section) => section.sectionId === navSectionId
    );

    if (!navSection && navSectionId !== 'default') {
      logger.error('Nav section not found');
      return null;
    }

    // Verify channel exists in this section
    const sectionChannels = navSection?.channels ?? [];
    const channelIndex =
      sectionChannels.find((c) => c.channelId === channelId)?.channelIndex ??
      -1;

    if (channelIndex === -1) {
      logger.error('Channel not found in this section');
      return null;
    }

    // Validate index bounds
    if (index < 0 || index > sectionChannels.length) {
      logger.error('Invalid index');
      return null;
    }

    const newNavSections = navSections.map((section) => {
      if (section.sectionId !== navSectionId) {
        logger.log('section', section.sectionId, 'not updated');
        return section;
      }

      logger.log(
        'section',
        section.sectionId,
        'updated',
        'channels',
        section.channels
      );

      const channels = [
        ...(section.channels?.sort((a, b) => {
          const aIndex = a.channelIndex ?? 0;
          const bIndex = b.channelIndex ?? 0;
          return aIndex - bIndex;
        }) ?? []),
      ];
      const [channel] = channels.splice(channelIndex, 1);
      channels.splice(index, 0, channel);

      // Update indices
      const updatedChannels = channels.map((c, idx) => ({
        ...c,
        channelIndex: idx,
      }));

      return {
        ...section,
        channels: updatedChannels,
      };
    });

    if (isEqual(newNavSections, navSections)) {
      logger.log('No change in channel order');
      return null;
    }

    // optimistic update
    await db.updateGroup({
      id: group.id,
      navSections: newNavSections,
    });

    // Update the channel indices in the groupNavSectionChannels table
    const updatedSection = newNavSections.find(
      (section) => section.sectionId === navSectionId
    );

    if (updatedSection && updatedSection.channels) {
      for (const channel of updatedSection.channels) {
        if (!channel.channelId) continue;
        logger.log(
          'updating channel index',
          channel.channelId,
          channel.channelIndex
        );
        await db.updateNavSectionChannel({
          channelId: channel.channelId,
          groupNavSectionId: updatedSection.id,
          channelIndex: channel.channelIndex ?? 0,
        });
      }
    }

    logger.trackEvent(AnalyticsEvent.ActionMoveChannel, {
      message: 'success',
    });
    return { sectionChannels, group };
  } catch (e) {
    logger.trackError('Error updating channel sections', e);
    return null;
  }
}

export async function moveChannel({
  groupId,
  channelId,
  navSectionId,
  index,
}: {
  groupId: string;
  channelId: string;
  navSectionId: string;
  index: number;
}): Promise<void> {
  logger.log('moving channel', groupId, channelId, navSectionId, index);
  const result = await updateChannelSections({
    groupId,
    navSectionId,
    channelId,
    index,
  });

  if (!result) {
    logger.error('Failed to update channel sections');
    return;
  }

  const { sectionChannels, group } = result;

  try {
    await api.moveChannel({
      groupId: groupId,
      channelId,
      navSectionId,
      index,
    });
  } catch (e) {
    logger.error('Failed to move channel', e);
    // rollback optimistic update
    if (group) {
      await db.updateGroup(group);

      // Rollback channel indices
      for (const channel of sectionChannels) {
        if (!channel.channelId) continue;
        await db.updateNavSectionChannel({
          channelId: channel.channelId,
          groupNavSectionId: navSectionId,
          channelIndex: channel.channelIndex ?? 0,
        });
      }
    }
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
    if (existingGroup) {
      await db.updateGroup(existingGroup);
      await db.updateNavSection({
        ...existingNavSection,
      });
    }
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

  logger.trackEvent(
    AnalyticsEvent.ActionKickUser,
    logic.getModelAnalytics({ group: existingGroup })
  );

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
      joinStatus: 'joined',
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

  logger.trackEvent(
    AnalyticsEvent.ActionBanUser,
    logic.getModelAnalytics({ group: existingGroup })
  );

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
      joinStatus: 'joined',
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

  logger.trackEvent(
    AnalyticsEvent.ActionUnbanUser,
    logic.getModelAnalytics({ group: existingGroup })
  );

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

export async function acceptUserJoin({
  groupId,
  contactId,
}: {
  groupId: string;
  contactId: string;
}) {
  logger.log('accepting user request to join group', groupId, contactId);

  const existingGroup = await db.getGroup({ id: groupId });

  if (!existingGroup) {
    console.error('Group not found', groupId);
    return;
  }

  logger.trackEvent(
    AnalyticsEvent.ActionAcceptJoinRequest,
    logic.getModelAnalytics({ group: existingGroup })
  );

  if (!existingGroup.members) {
    console.error('Group members not found', groupId);
    return;
  }

  if (
    existingGroup.members.find(
      (member) => member.contactId === contactId && member.status === 'joined'
    )
  ) {
    console.error('User already in group', groupId, contactId);
    return;
  }

  if (!existingGroup.joinRequests) {
    console.error('Group join requests not found', groupId);
    return;
  }

  if (
    !existingGroup.joinRequests.find((member) => member.contactId === contactId)
  ) {
    console.error('User not found in join requests', groupId, contactId);
    return;
  }

  if (existingGroup.privacy !== 'private') {
    console.error('Group is not private', groupId);
    return;
  }
  // optimistic update
  await db.addChatMembers({
    chatId: groupId,
    type: 'group',
    contactIds: [contactId],
    joinStatus: 'joined',
  });

  await db.deleteGroupJoinRequests({
    groupId,
    contactIds: [contactId],
  });

  try {
    await api.acceptGroupJoin({ groupId: groupId, contactIds: [contactId] });
  } catch (e) {
    console.error('Failed to accept user join request', e);
    // rollback optimistic update
    await db.removeChatMembers({
      chatId: groupId,
      contactIds: [contactId],
    });

    await db.addGroupJoinRequests({
      groupId,
      contactIds: [contactId],
    });
  }
}

export async function rejectUserJoin({
  groupId,
  contactId,
}: {
  groupId: string;
  contactId: string;
}) {
  logger.log('reject user request to join group', groupId, contactId);

  const existingGroup = await db.getGroup({ id: groupId });

  if (!existingGroup) {
    console.error('Group not found', groupId);
    return;
  }

  logger.trackEvent(
    AnalyticsEvent.ActionRejectJoinRequest,
    logic.getModelAnalytics({ group: existingGroup })
  );

  if (!existingGroup.joinRequests) {
    console.error('Group join requests not found', groupId);
    return;
  }

  if (
    !existingGroup.joinRequests.find((member) => member.contactId === contactId)
  ) {
    console.error('User not found in join requests', groupId, contactId);
    return;
  }

  if (existingGroup.privacy !== 'private') {
    console.error('Group is not private', groupId);
    return;
  }
  // optimistic update
  await db.deleteGroupJoinRequests({
    groupId,
    contactIds: [contactId],
  });

  try {
    await api.rejectGroupJoin({ groupId: groupId, contactIds: [contactId] });
  } catch (e) {
    console.error('Failed to accept user join request', e);
    // rollback optimistic update
    await db.addGroupJoinRequests({
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

  logger.trackEvent(
    AnalyticsEvent.ActionLeaveGroup,
    logic.getModelAnalytics({ group: existingGroup })
  );

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

export async function markGroupRead(groupId: string, deep: boolean = false) {
  const group = await db.getGroup({ id: groupId });
  if (!group) {
    logger.error('Group not found', groupId);
    return;
  }
  // optimistic update
  const existingUnread = await db.getGroupUnread({ groupId: group.id });
  if (existingUnread) {
    await db.clearGroupUnread(group.id);
  }

  try {
    await api.readGroup(group, deep);
  } catch (e) {
    console.error('Failed to read group', e);
    // rollback optimistic update
    if (existingUnread) {
      await db.insertGroupUnreads([existingUnread]);
    }
  }
}

export async function addGroupRole({
  groupId,
  roleId,
  meta,
}: {
  groupId: string;
  roleId: string;
  meta: db.ClientMeta;
}) {
  logger.log('adding group role', groupId, roleId);
  logger.trackEvent(
    AnalyticsEvent.ActionAddedRole,
    logic.getModelAnalytics({ group: { id: groupId } })
  );

  // optimistic update
  await db.addGroupRole({ groupId, roleId, meta });

  try {
    await api.addGroupRole({ groupId, roleId, meta });
  } catch (e) {
    console.error('Failed to add group role', e);
    // rollback optimistic update
    await db.deleteGroupRole({ groupId, roleId: roleId });
  }
}

export async function updateGroupRole({
  groupId,
  roleId,
  meta,
}: {
  groupId: string;
  roleId: string;
  meta: db.ClientMeta;
}) {
  logger.log('updating group role', groupId, roleId);
  logger.trackEvent(
    AnalyticsEvent.ActionUpdatedRole,
    logic.getModelAnalytics({ group: { id: groupId } })
  );

  const existingRole = await db.getGroupRole({ groupId, roleId });

  if (!existingRole) {
    console.error('Role not found', groupId, roleId);
    return;
  }

  // optimistic update
  await db.updateGroupRole({ groupId, roleId, meta });

  try {
    await api.updateGroupRole({ groupId, roleId, meta });
  } catch (e) {
    console.error('Failed to update group role', e);
    // rollback optimistic update
    await db.updateGroupRole({
      groupId,
      roleId,
      meta: {
        title: existingRole.title,
        description: existingRole.description,
      },
    });
  }
}

export async function deleteGroupRole({
  groupId,
  roleId,
}: {
  groupId: string;
  roleId: string;
}) {
  logger.log('deleting group role', groupId, roleId);
  logger.trackEvent(
    AnalyticsEvent.ActionRemovedRole,
    logic.getModelAnalytics({ group: { id: groupId } })
  );

  const existingRole = await db.getGroupRole({ groupId, roleId });

  if (!existingRole) {
    console.error('Role not found', groupId, roleId);
    return;
  }

  // optimistic update
  await db.deleteGroupRole({ groupId, roleId });

  try {
    await api.deleteGroupRole({ groupId, roleId });
  } catch (e) {
    console.error('Failed to delete group role', e);
    // rollback optimistic update
    await db.addGroupRole({ groupId, roleId, meta: existingRole });
  }
}

export async function addMembersToRole({
  groupId,
  roleId,
  contactIds,
}: {
  groupId: string;
  roleId: string;
  contactIds: string[];
}) {
  logger.log('adding members to role', groupId, roleId, contactIds);
  logger.trackEvent(AnalyticsEvent.ActionAddMemberRole, {
    ...logic.getModelAnalytics({ group: { id: groupId } }),
    numMembersModified: contactIds.length,
  });

  const existingRole = await db.getGroupRole({ groupId, roleId });

  if (!existingRole) {
    console.error('Role not found', groupId, roleId);
    return;
  }

  // optimistic update
  await db.addMembersToRole({ groupId, roleId, contactIds });

  try {
    await api.addMembersToRole({ groupId, roleId, ships: contactIds });
  } catch (e) {
    console.error('Failed to add members to role', e);
    // rollback optimistic update
    await db.removeMembersFromRole({ groupId, roleId, contactIds });
  }
}

export async function removeMembersFromRole({
  groupId,
  roleId,
  contactIds,
}: {
  groupId: string;
  roleId: string;
  contactIds: string[];
}) {
  logger.log('removing members from role', groupId, roleId, contactIds);
  logger.trackEvent(AnalyticsEvent.ActionRemoveMemberRole, {
    ...logic.getModelAnalytics({ group: { id: groupId } }),
    numMembersModified: contactIds.length,
  });

  const existingRole = await db.getGroupRole({ groupId, roleId });

  if (!existingRole) {
    console.error('Role not found', groupId, roleId);
    return;
  }

  // optimistic update
  await db.removeMembersFromRole({ groupId, roleId, contactIds });

  try {
    await api.removeMembersFromRole({ groupId, roleId, ships: contactIds });
  } catch (e) {
    console.error('Failed to remove members from role', e);
    // rollback optimistic update
    await db.addMembersToRole({ groupId, roleId, contactIds });
  }
}
