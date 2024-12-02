import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';

const logger = createDevLogger('ContactActions', false);

export async function addContact(contactId: string) {
  // Optimistic update
  await db.updateContact({
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
  const optimisticUpdates = contacts.map((contactId) =>
    db.updateContact({
      id: contactId,
      isContact: true,
      isContactSuggestion: false,
    })
  );
  await Promise.all(optimisticUpdates);

  try {
    await api.addUserContacts(contacts);
  } catch (e) {
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

export async function updateContactMetadata(
  contactId: string,
  metadata: {
    nickname?: string | null;
    avatarImage?: string | null;
  }
) {
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

  // Optimistic update
  await db.updateContact({ id: currentUserId, ...editedFields });

  try {
    await api.updateCurrentUserProfile(update);
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
