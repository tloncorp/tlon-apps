import * as api from '@tloncorp/api';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as domain from '../domain';
import { AnalyticsEvent } from '../domain';
import * as logic from '../logic';
import * as GroupActions from './groupActions';
import { getSession } from './session';
import { syncContacts } from './sync/syncContacts';
import { syncGroup } from './sync/syncGroup';

const logger = createDevLogger('ContactActions', false);

// First-contact backfill for bot identity claims. Bulk sync (`/v1/directory`)
// carries the claim, but the directory only exports peers whose profile the
// ship already holds — a bot this ship has never met has no entry, and waiting
// for the bot's next republish could take weeks. %meet and fetch the ship's
// full v1 profile on demand instead.
const BOT_INFO_BACKFILL_MAX_ATTEMPTS = 3;
// Process-lifetime bookkeeping, keyed by `${currentUserId}:${ship}` so a
// switched account starts fresh. Nothing else resets it: a ship that burns
// the cap (e.g. three fetches while offline) stays parked on the default
// list until the next app start — accepted over resetting on some session
// boundary, which is machinery for a self-healing cosmetic.
const botInfoBackfillInFlight = new Set<string>();
const botInfoBackfillAttempts = new Map<string, number>();

export async function ensureBotInfoSynced(ship: string): Promise<void> {
  let reservedKey: string | null = null;
  try {
    const currentUserId = api.getCurrentUserId();
    const key = `${currentUserId}:${ship}`;
    // Dedupe in-flight attempts; the %meet poke and scry are otherwise
    // repeated on every hook evaluation while the query is settled.
    if (botInfoBackfillInFlight.has(key)) {
      return;
    }
    const attempts = botInfoBackfillAttempts.get(key) ?? 0;
    if (attempts >= BOT_INFO_BACKFILL_MAX_ATTEMPTS) {
      return;
    }
    // Reserved before the first await: two callers that both got past the
    // check above would otherwise both reach the network and share one
    // attempt count.
    botInfoBackfillInFlight.add(key);
    reservedKey = key;

    const contact = await db.getContact({ id: ship });
    // Only a *usable* claim means there is nothing to fetch: a stale,
    // malformed or wrong-version value reads as no claim everywhere else (the
    // hook falls back to the default list), so it must not pin the backfill
    // off either.
    if (domain.parseBotInfo(contact?.botInfo)) {
      return;
    }
    // A row we hold is backfillable only when it is known to be a
    // non-contact (`isContact === false`, not merely null — the column is
    // nullable and partial rows really occur, e.g. blocked-contact
    // inserts). Anything less proves nothing about which writer made the
    // row, and the bot may still be a contact-book entry, whose per-ship
    // scry merges the user's own `mod` overlay and must never become the
    // claim's source. Contact-book bots also already arrive lossless via
    // the v1 /book sync.
    if (contact && contact.isContact !== false) {
      return;
    }
    if (getSession()?.phase !== 'ready') {
      // Both ways of missing a claim need the initial contacts sync first. No
      // row at all is the never-met bot this backfill exists for: the bulk
      // source (`/v1/directory`) omits peers whose profile the ship does not
      // hold, so such a bot never gets a row from sync. Absence only proves
      // "not in the contact book" once the initial contacts sync has run,
      // though — before that everything is absent, and a present row's
      // `isContact === false` is just as unverified, since it can come from
      // the stale localStorage snapshot. The session phase is the
      // completion signal the store already keeps, and it covers both write
      // paths: contacts land in the high-priority phase, or (when a
      // localStorage snapshot deferred them) among the low-priority promises,
      // and both have finished by `ready`. Using it beats adding a
      // sync-progress mechanism; the residue it leaves — a sync that failed
      // outright still reaches `ready` — is bounded by the attempt cap below.
      // No dedicated "contacts written" signal was added for that residue:
      // contaminating a claim needs the user's own overlay to carry a
      // `bot-info` key (no client writes one) *and* a partial sync failure,
      // and `contact-uni` passes the base claim through whenever the overlay
      // lacks the key — a cost the attempt cap already bounds.
      return;
    }

    // Counted before the network work, so a failure mid-flight still burns an
    // attempt; success or empty results are never cached as done, so later
    // hook evaluations retry up to the cap.
    botInfoBackfillAttempts.set(key, attempts + 1);
    // Ensure we are subscribed to the ship's profile updates (%meet). The
    // first scry can race the remote watch and miss; when it does, the
    // subscription delivers the profile later and failures stay retryable.
    await api.syncUserProfiles([ship]);
    const profile = await api.getContactProfile(ship);
    if (profile) {
      await db.upsertContact(profile);
    }
  } catch (e) {
    // Silent by design — the popup degrades to the default list.
    logger.log('ensureBotInfoSynced failed', e);
  } finally {
    if (reservedKey !== null) {
      botInfoBackfillInFlight.delete(reservedKey);
    }
  }
}

/** Test-only: clear the process-lifetime backfill bookkeeping. */
export function resetBotInfoBackfillState() {
  botInfoBackfillInFlight.clear();
  botInfoBackfillAttempts.clear();
}

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

  // Use upsert (matching the singular addContact) so a contact row is
  // created locally if one doesn't exist yet. Otherwise downstream
  // writes that target an existing row by id (e.g. markContactsAsMatched
  // for the lanyard match flow) silently no-op until %contacts pushes
  // a subscription event back, by which point the matchedAt window
  // has already passed.
  const optimisticUpdates = contacts.map((contactId) =>
    db.upsertContact({
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
    logger.trackError('Error adding contacts', e);
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
  } catch (e) {
    logger.trackError('Error updating contact metadata', e);
    // rollback the update
    await db.updateContact({
      id: contactId,
      customNickname: existingContact?.customNickname,
      customAvatarImage: existingContact?.customAvatarImage,
    });
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

    // handle updating the home group title if user sets their nickname
    const homeGroup = await db.getBotHomeGroup();
    if (homeGroup) {
      const hasDefaultTitle = logic.botHomeGroupHasDefaultTitle(homeGroup);

      if (hasDefaultTitle && hasNicknameUpdate) {
        const newTitle = logic.generateBotHomeGroupTitle({
          id: currentUserId,
          nickname: update.nickname,
        });
        if (homeGroup.title !== newTitle) {
          await GroupActions.updateGroupMeta(
            {
              ...homeGroup,
              title: newTitle,
            },
            config
          );
        }
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
