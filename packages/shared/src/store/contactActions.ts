import * as api from '@tloncorp/api';

import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';
import * as logic from '../logic';
import * as GroupActions from './groupActions';
import * as LocalCache from './cachedData';
import { syncContactSuggestions, syncContacts } from './sync/syncContacts';
import { syncGroup } from './sync/syncGroup';
import { getSystemContacts } from './systemContactsApi';
import { captureContactIntent, recordContactIntent } from './contactIntent';

const logger = createDevLogger('ContactActions', false);

export async function addContact(contactId: string) {
  const wasCurrent = captureContactIntent(contactId);
  const previous = await db.getContact({ id: contactId });
  if (!wasCurrent() || previous?.isContact) return;
  recordContactIntent(contactId);
  const isCurrent = captureContactIntent(contactId);
  logger.trackEvent(AnalyticsEvent.ActionContactAdded, { count: 1 });
  const update = {
    id: contactId,
    isContact: true,
    isContactSuggestion: false,
  };
  await db.applyContactMembership({ contact: update, isCurrent });
  if (!isCurrent()) return;
  try {
    await api.addContact(contactId);
    if (!isCurrent()) return;
    await db.updateContact(update);
    if (!isCurrent()) return;
    const cached = await db.getContacts();
    if (isCurrent()) LocalCache.cacheContacts(cached);
  } catch (e) {
    if (!isCurrent()) return;
    logger.trackError('Error adding contact', e);
    await db.updateContact({
      id: contactId,
      isContact: previous?.isContact ?? false,
      isContactSuggestion: previous?.isContactSuggestion ?? false,
    });
  }
}

export type AddContactsResult = {
  addedContactIds: string[];
  failedContactIds: string[];
};

export async function addContacts(
  contactIds: string[],
  {
    source = 'manual',
    contactState,
  }: { source?: 'manual' | 'discovery'; contactState?: api.ContactState } = {}
): Promise<AddContactsResult> {
  const contacts = [...new Set(contactIds)];
  const intents = new Map(
    contacts.map((id) => [
      id,
      captureContactIntent(id, {
        includeObservedRemovals: source === 'discovery',
      }),
    ])
  );
  const isCurrent = (id: string) => intents.get(id)!();
  if (source === 'manual') {
    logger.trackEvent(AnalyticsEvent.ActionContactAdded, {
      count: contacts.length,
    });
  }
  const previousContacts = await db.getContactsBatch({ contactIds: contacts });
  if (!contacts.some(isCurrent))
    return { addedContactIds: [], failedContactIds: [] };
  const previousById = new Map(previousContacts.map((c) => [c.id, c]));
  const needsAdd = (id: string) =>
    isCurrent(id) && (source !== 'manual' || !previousById.get(id)?.isContact);
  if (source === 'manual') {
    for (const id of contacts) {
      if (!needsAdd(id)) continue;
      recordContactIntent(id);
      intents.set(id, captureContactIntent(id));
    }
  }
  if (!contacts.some(needsAdd))
    return {
      addedContactIds: contacts.filter(isCurrent),
      failedContactIds: [],
    };
  const rollback = (contactIds: string[]) =>
    Promise.all(
      contactIds.filter(needsAdd).map((id) =>
        db.updateContact({
          id,
          isContact: previousById.get(id)?.isContact ?? false,
          isContactSuggestion:
            previousById.get(id)?.isContactSuggestion ?? false,
        })
      )
    );

  const guardedDiscovery =
    source === 'discovery' && api.getDeskSupportsContactRemovalState() === true;
  let existingContacts: db.Contact[] = [];
  let removedContactIds = new Set<string>();
  if (guardedDiscovery) {
    try {
      const state = contactState ?? (await api.getContactState());
      existingContacts = state.contacts;
      removedContactIds = new Set(state.removedContactIds);
    } catch (error) {
      logger.trackError('Error reading discovery contact state', error);
      return { addedContactIds: [], failedContactIds: contacts };
    }
  }
  if (!contacts.some(isCurrent))
    return { addedContactIds: [], failedContactIds: [] };
  await Promise.all(
    contacts
      .filter((id) => needsAdd(id) && !removedContactIds.has(id))
      .map((id) =>
        db.applyContactMembership({
          contact: { id, isContact: true, isContactSuggestion: false },
          isCurrent: () => isCurrent(id),
        })
      )
  );
  if (!guardedDiscovery) {
    try {
      existingContacts = await api.getContacts();
    } catch (error) {
      logger.trackError('Error adding contacts', error);
      await rollback(contacts);
      return { addedContactIds: [], failedContactIds: contacts };
    }
  }

  const existingIds = new Set(
    existingContacts.filter((c) => c.isContact).map((c) => c.id)
  );
  const newContacts = contacts.filter(
    (id) => needsAdd(id) && !existingIds.has(id)
  );
  const results = await Promise.allSettled(
    newContacts.map((id) =>
      guardedDiscovery ? api.discoverContact(id) : api.addContact(id)
    )
  );
  const failedContactIds = results.flatMap((result, index) => {
    if (result.status === 'fulfilled' || !isCurrent(newContacts[index]))
      return [];
    logger.trackError('Error adding contact', result.reason);
    return [newContacts[index]];
  });
  if (failedContactIds.length > 0) {
    await rollback(failedContactIds);
  }
  const failedIds = new Set(failedContactIds);
  let addedContactIds = contacts.filter(
    (id) => isCurrent(id) && !failedIds.has(id)
  );
  if (addedContactIds.length === 0)
    return {
      addedContactIds,
      failedContactIds: failedContactIds.filter(isCurrent),
    };
  if (guardedDiscovery) {
    try {
      const state = await api.getContactState();
      const confirmed = new Map(
        state.contacts.map((contact) => [contact.id, contact])
      );
      for (const id of addedContactIds) {
        if (!isCurrent(id)) continue;
        const contact = confirmed.get(id);
        await db.applyContactMembership({
          contact: {
            id,
            isContact: contact?.isContact ?? false,
            isContactSuggestion: contact?.isContactSuggestion ?? false,
          },
          isCurrent: () => isCurrent(id),
        });
      }
      const savedIds = new Set(
        state.contacts.filter((c) => c.isContact).map((c) => c.id)
      );
      addedContactIds = addedContactIds.filter(
        (id) => isCurrent(id) && savedIds.has(id)
      );
    } catch (e) {
      if (addedContactIds.some(isCurrent))
        logger.trackError('Error confirming discovered contacts', e);
      await rollback(addedContactIds);
      failedContactIds.push(...addedContactIds.filter(isCurrent));
      addedContactIds = [];
    }
  } else {
    await Promise.all(
      addedContactIds.filter(needsAdd).map((id) =>
        db.updateContact({
          id,
          isContact: true,
          isContactSuggestion: false,
        })
      )
    );
  }
  const currentContacts = await db.getContactsBatch({
    contactIds: addedContactIds,
  });
  const currentlySaved = new Set(
    currentContacts.filter((c) => c.isContact).map((c) => c.id)
  );
  addedContactIds = addedContactIds.filter(
    (id) => isCurrent(id) && currentlySaved.has(id)
  );
  if (source === 'discovery' && addedContactIds.length > 0) {
    logger.trackEvent(AnalyticsEvent.ActionContactAdded, {
      count: addedContactIds.length,
    });
  }
  return {
    addedContactIds,
    failedContactIds: failedContactIds.filter(isCurrent),
  };
}

export async function removeContact(contactId: string) {
  recordContactIntent(contactId);
  const isCurrent = captureContactIntent(contactId);
  logger.trackEvent(AnalyticsEvent.ActionContactRemoved, { count: 1 });
  const previous = await db.getContact({ id: contactId });
  if (!isCurrent()) return;
  let suggest = false;
  try {
    const linked = await db.getSystemContactsBatchByContactId([contactId]);
    if (!isCurrent()) return;
    const liveBook = await getSystemContacts();
    if (!isCurrent()) return;
    const liveNumbers = new Set(
      liveBook.map((c) => c.phoneNumber).filter(Boolean)
    );
    suggest = linked.some(
      (c) => !!c.phoneNumber && liveNumbers.has(c.phoneNumber)
    );
  } catch (e) {
    if (!isCurrent()) return;
    logger.trackError('Error looking up removed contact in address book', e);
  }
  if (!isCurrent()) return;
  await db.updateContact({
    id: contactId,
    isContact: false,
    isContactSuggestion: false,
  });
  if (!isCurrent()) return;
  try {
    await api.removeContact(contactId, suggest);
  } catch (e) {
    if (!isCurrent()) return;
    logger.trackError('Error removing contact', e);
    await db.updateContact({
      id: contactId,
      isContact: previous?.isContact ?? false,
      isContactSuggestion: previous?.isContactSuggestion ?? false,
      customNickname: previous?.customNickname,
      customAvatarImage: previous?.customAvatarImage,
    });
    return;
  }
  if (!isCurrent()) return;
  await db.updateContact({
    id: contactId,
    isContact: false,
  });
  if (!isCurrent()) return;
  if (suggest) {
    try {
      await syncContactSuggestions([contactId]);
    } catch (e) {
      if (!isCurrent()) return;
      logger.trackError('Error refreshing removed contact suggestion', e);
    }
  }
  if (!isCurrent()) return;
  const contacts = await db.getContacts();
  if (isCurrent()) LocalCache.cacheContacts(contacts);
}

export async function removeContactSuggestion(contactId: string) {
  recordContactIntent(contactId);
  const isCurrent = captureContactIntent(contactId);
  logger.trackEvent(AnalyticsEvent.ActionRemoveContactSuggestion, { count: 1 });
  // Optimistic update
  await db.updateContact({ id: contactId, isContactSuggestion: false });

  if (!isCurrent()) return;
  try {
    await api.removeContactSuggestion(contactId);
  } catch (e) {
    if (!isCurrent()) return;
    // Rollback the update
    console.error('Error removing contact suggestion', e);
    await db.updateContact({ id: contactId, isContactSuggestion: true });
  }
}

export async function addContactSuggestions(contactIds: string[]) {
  try {
    await api.addContactSuggestions(contactIds);
    await syncContactSuggestions(contactIds);
  } catch (e) {
    logger.trackError('Error adding contact suggestions', e);
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

    const numExistingSuggestions = await db.getSuggestedContacts();
    if (numExistingSuggestions.length >= 6) {
      logger.log('Sufficient suggestions already exist, skipping');
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
    logger.trackError('Client Contact Suggestions Failure', e);
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
    return true;
  } catch (e) {
    logger.trackError('Error updating contact metadata', e);
    // rollback the update
    await db.updateContact({
      id: contactId,
      customNickname: existingContact?.customNickname,
      customAvatarImage: existingContact?.customAvatarImage,
    });
    return false;
  }
}

export async function updateCurrentUserProfile(
  update: api.ProfileUpdate,
  config?: { shouldThrow?: boolean }
) {
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
  const hasNicknameUpdate = update.nickname !== undefined;
  const changedNickname =
    hasNicknameUpdate && currentUserContact?.peerNickname !== update.nickname;

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

      if (hasDefaultTitle && changedNickname) {
        const newTitle = logic.generatePersonalGroupTitle({
          id: currentUserId,
          nickname: update.nickname,
        });
        await GroupActions.updateGroupMeta(
          {
            ...personalGroup,
            title: newTitle,
          },
          config
        );
      }
    }
  } catch (e) {
    console.error('Error updating profile', e);
    // Rollback the update
    await db.updateContact({ id: currentUserId, ...startFields });
    if (config?.shouldThrow) {
      throw e;
    }
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

export async function updateSigilColor(color: string | null) {
  logger.trackEvent(AnalyticsEvent.ActionUpdatedProfile, {
    editedSigilColor: true,
  });
  const currentUserId = api.getCurrentUserId();
  const existingContact = await db.getContact({ id: currentUserId });
  const existingColor = existingContact?.color ?? null;
  await db.updateContact({ id: currentUserId, color });
  try {
    await api.updateSigilColor(color);
  } catch (e) {
    logger.trackError('Error updating sigil color', e);
    await db.updateContact({ id: currentUserId, color: existingColor });
  }
}
