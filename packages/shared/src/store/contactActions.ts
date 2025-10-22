import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';
import * as logic from '../logic';
import * as GroupActions from './groupActions';
import { syncContacts, syncGroup } from './sync';

const logger = createDevLogger('ContactActions', false);

export async function addContact(contactId: string) {
  logger.trackEvent(AnalyticsEvent.ActionContactAdded, { count: 1 });
  // Optimistic update
  await db.upsertContact({
    id: contactId,
    isContact: true,
    isContactSuggestion: false,
  });

  try {
    await api.addContact(contactId);
  } catch (e) {
    console.error('Error adding contact', e);
    // Rollback the update
    await db.updateContact({ id: contactId, isContact: false });
  }
}

export async function addContacts(contacts: string[]) {
  logger.trackEvent(AnalyticsEvent.ActionContactAdded, {
    count: contacts.length,
  });

  const optimisticUpdates = contacts.map((contactId) =>
    db.updateContact({
      id: contactId,
      isContact: true,
      isContactSuggestion: false,
    })
  );
  await Promise.all(optimisticUpdates);
  logger.log('Optimistic updates complete', {
    optimisticUpdates,
    contacts,
  });

  try {
    // Backend will balk if we try to add the same contact twice, so filter out
    // any that are already contacts
    const existingContacts = await api.getContacts();
    const newContacts = contacts.filter(
      (contactId) =>
        !existingContacts.some((c) => c.id === contactId && c.isContact)
    );

    await api.addUserContacts(newContacts);
  } catch (e) {
    logger.trackError('Error adding contacts', {
      errorMessage: e.message,
      errorStack: e.stack,
    });
    // Rollback the update
    const rolbacks = contacts.map((contactId) =>
      db.updateContact({
        id: contactId,
        isContact: false,
      })
    );
    await Promise.all(rolbacks);
  }
}

export async function removeContact(contactId: string) {
  logger.trackEvent(AnalyticsEvent.ActionContactRemoved, { count: 1 });
  // Optimistic update
  await db.updateContact({ id: contactId, isContact: false });

  try {
    await api.removeContact(contactId);
  } catch (e) {
    console.error('Error removing contact', e);
    // Rollback the update
    await db.updateContact({ id: contactId, isContact: true });
  }
}

export async function removeContactSuggestion(contactId: string) {
  logger.trackEvent(AnalyticsEvent.ActionRemoveContactSuggestion, { count: 1 });
  // Optimistic update
  await db.updateContact({ id: contactId, isContactSuggestion: false });

  try {
    await api.removeContactSuggestion(contactId);
  } catch (e) {
    // Rollback the update
    console.error('Error removing contact suggestion', e);
    await db.updateContact({ id: contactId, isContactSuggestion: true });
  }
}

export async function addContactSuggestions(contactIds: string[]) {
  // optimistic update
  const contacts = await db.getContacts();
  const toUpdate = contacts.filter(
    (c) => contactIds.includes(c.id) && !c.isContact
  );
  const optimisticUpdates = toUpdate.map((contact) =>
    db.updateContact({ id: contact.id, isContactSuggestion: true })
  );
  await Promise.all(optimisticUpdates);

  try {
    await api.addContactSuggestions(contactIds);
  } catch (e) {
    // Intentionally unhandled, make a best effort to persist the suggestions
    // failure is acceptable
  }
}

export async function findContactSuggestions() {
  const runContext: Record<string, any> = {};
  const currentUserId = api.getCurrentUserId();
  const GROUP_SIZE_LIMIT = 14; // arbitrary smaller than trimmed member max
  const MAX_SUGGESTIONS = 6; // arbitrary

  try {
    // if we've already added suggestions recently, don't do it again
    const lastAddedSuggestionsAt = await db.lastAddedSuggestionsAt.getValue();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    if (lastAddedSuggestionsAt > oneDayAgo) {
      logger.log('Suggestions added recently, skipping');
      return;
    }

    // first see if we have any joined groups and seem to be a somewhat
    // new user
    const groups = await db.getGroups({ includeUnjoined: false });
    runContext.joinedGroups = groups.length;
    const hasFewGroups = groups.length < 4;
    runContext.hasFewGroups = hasFewGroups;

    if (groups.length > 0 && hasFewGroups) {
      logger.crumb('Found joined groups');
      // if yes, see if we have new groups and if some are small enough that
      // grabbing suggestions at random might be worthwhile
      const groupSyncs = groups.map((group) => syncGroup(group.id)); // sync member lists
      await Promise.all(groupSyncs);

      const groupchats =
        await db.getGroupsWithMemberThreshold(GROUP_SIZE_LIMIT);
      runContext.groupsWithinSizeLimit = groupchats.length;
      const groupsFromLastRun = await db.groupsUsedForSuggestions.getValue();
      const haveSomeNewGroups = groupchats.some(
        (gc) => !groupsFromLastRun.includes(gc.id)
      );
      runContext.haveSomeNewGroups = haveSomeNewGroups;
      if (groupchats.length > 0 && haveSomeNewGroups) {
        logger.crumb('Found groups under size limit');
        // if some are, load the profiles of all(?) members
        const allRelevantMembers = groupchats
          .reduce((acc, group) => {
            return acc.concat(group.members.map((mem) => mem.contactId));
          }, [] as string[])
          .filter((mem) => mem !== currentUserId);

        logger.crumb(`Found ${allRelevantMembers.length} relevant members`);

        await api.syncUserProfiles(allRelevantMembers);
        // hack: we don't track when the profiles actually populate, so wait a bit then resync
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await syncContacts();

        logger.crumb('Synced profiles and contacts');

        const contacts = await db.getContacts();
        const memberSet = new Set(allRelevantMembers);
        const memberContacts = contacts.filter(
          (c) =>
            memberSet.has(c.id) &&
            !c.isContact &&
            !c.isContactSuggestion &&
            c.nickname
        );
        runContext.relevantMembers = memberContacts.length;

        // welcome to my suggestion ranking algorithm
        const contactScores = memberContacts.map((contact) => {
          let score = 0;

          if (contact.avatarImage) {
            score += 20;
          }

          if (contact.pinnedGroups.length > 0) {
            score += 5;
          }

          if (contact.bio) {
            score += 2;
          }

          if (contact.status) {
            score += 1;
          }

          return { userId: contact.id, score };
        });

        contactScores
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score);
        logger.crumb('Scored relevant members');

        const suggestions = contactScores
          .slice(0, MAX_SUGGESTIONS)
          .map((s) => s.userId);
        runContext.suggestions = suggestions.length;

        logger.crumb(`Found ${suggestions.length} suggestions`);

        if (suggestions.length > 0) {
          addContactSuggestions(suggestions);
          db.groupsUsedForSuggestions.setValue(groupchats.map((g) => g.id));
          db.lastAddedSuggestionsAt.setValue(Date.now());
          logger.trackEvent('Client Contact Suggestions', {
            ...runContext,
            suggestionsFound: true,
          });
          return true;
        }
      }
    }
    logger.trackEvent('Client Contact Suggestions', {
      ...runContext,
      suggestionsFound: false,
    });
  } catch (e) {
    logger.trackError('Client Contact Suggestions Failure', {
      errorMessage: e.message,
      errorStack: e.stack,
    });
  }
  logger.log('No suggestions added');
  return false;
}

export async function updateContactMetadata(
  contactId: string,
  metadata: {
    nickname?: string | null;
    avatarImage?: string | null;
  }
) {
  logger.trackEvent(AnalyticsEvent.ActionContactEdited, {
    hasCustomNickname: !!metadata.nickname,
    hasCustomAvatar: !!metadata.avatarImage,
  });
  const { nickname, avatarImage } = metadata;

  const existingContact = await db.getContact({ id: contactId });

  // optimistic update
  await db.updateContact({
    id: contactId,
    customNickname: nickname,
    customAvatarImage: avatarImage,
  });

  try {
    await api.updateContactMetadata(contactId, {
      nickname: nickname ? nickname : nickname === null ? '' : undefined,
      avatarImage: avatarImage
        ? avatarImage
        : avatarImage === null
          ? ''
          : undefined,
    });
  } catch (e) {
    logger.trackError('Error updating contact metadata', {
      errorMessage: e.message,
      errorStack: e.stack,
    });
    // rollback the update
    await db.updateContact({
      id: contactId,
      customNickname: existingContact?.customNickname,
      customAvatarImage: existingContact?.customAvatarImage,
    });
  }
}

export async function updateCurrentUserProfile(update: api.ProfileUpdate) {
  const currentUserId = api.getCurrentUserId();
  const currentUserContact = await db.getContact({ id: currentUserId });

  const startFields: Partial<db.Contact> = {
    peerNickname: currentUserContact?.peerNickname,
    status: currentUserContact?.status,
    bio: currentUserContact?.bio,
    peerAvatarImage: currentUserContact?.peerAvatarImage,
  };

  const editedFields: Partial<db.Contact> = {
    peerNickname: update.nickname,
    status: update.status,
    bio: update.bio,
    peerAvatarImage: update.avatarImage,
  };

  logger.trackEvent(AnalyticsEvent.ActionUpdatedProfile, {
    editedNickname: !!update.nickname,
    editedStatus: !!update.status,
    editedBio: !!update.bio,
    editedAvatarImage: !!update.avatarImage,
    editedPinnedGroups: false,
  });

  // Optimistic update
  await db.updateContact({ id: currentUserId, ...editedFields });

  try {
    await api.updateCurrentUserProfile(update);

    // handle updating the personal group title if user sets their nickname
    const personalGroup = await db.getPersonalGroup();
    if (personalGroup) {
      const hasDefaultTitle = logic.personalGroupHasDefaultTitle(personalGroup);
      const changedNickname =
        currentUserContact?.peerNickname !== update.nickname;

      if (hasDefaultTitle && changedNickname) {
        const newTitle = logic.generatePersonalGroupTitle({
          id: currentUserId,
          nickname: update.nickname,
        });
        await GroupActions.updateGroupMeta({
          ...personalGroup,
          title: newTitle,
        });
      }
    }
  } catch (e) {
    console.error('Error updating profile', e);
    // Rollback the update
    await db.updateContact({ id: currentUserId, ...startFields });
  }
}

export async function addPinnedGroupToProfile(groupId: string) {
  // Optimistic update
  await db.addPinnedGroup({ groupId });

  try {
    await api.addPinnedGroup(groupId);
  } catch (e) {
    console.error('Error adding pinned group', e);
    // Rollback the update
    await db.removePinnedGroup({ groupId });
  }
}

export async function removePinnedGroupFromProfile(groupId: string) {
  // Optimistic update
  await db.removePinnedGroup({ groupId });

  try {
    await api.removePinnedGroup(groupId);
  } catch (e) {
    console.error('Error removing pinned group', e);
    // Rollback the update
    await db.addPinnedGroup({ groupId });
  }
}

export async function updateProfilePinnedGroups(newPinned: db.Group[]) {
  logger.trackEvent(AnalyticsEvent.ActionUpdatedProfile, {
    editedPinnedGroups: true,
    pinnedGroupsCount: newPinned.length,
  });

  const currentUserId = api.getCurrentUserId();
  const existingContact = await db.getContact({ id: currentUserId });
  const existingPinnedIds =
    existingContact?.pinnedGroups.map((pg) => pg.groupId) ?? [];
  const newPinnedIds = newPinned.map((g) => g.id);

  // Optimistic update TODO
  await db.setPinnedGroups({ groupIds: newPinnedIds });

  try {
    await api.setPinnedGroups(newPinnedIds);
  } catch (e) {
    // Rollback the update
    await db.setPinnedGroups({ groupIds: existingPinnedIds });
  }
}
