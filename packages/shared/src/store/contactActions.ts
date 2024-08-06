import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';

const logger = createDevLogger('ContactActions', true);

export async function updateCurrentUserProfile(update: api.ProfileUpdate) {
  const currentUserId = api.getCurrentUserId();
  const currentUserContact = await db.getContact({ id: currentUserId });
  const startingValues: Partial<db.Contact> = {};
  if (currentUserContact) {
    for (const key in update) {
      if (key in currentUserContact) {
        startingValues[key as keyof api.ProfileUpdate] =
          currentUserContact[key as keyof api.ProfileUpdate];
      }
    }
  }

  // Optimistic update
  await db.updateContact({ id: currentUserId, ...update });

  try {
    await api.updateCurrentUserProfile(update);
  } catch (e) {
    console.error('Error updating profile', e);
    // Rollback the update
    await db.updateContact({ id: currentUserId, ...startingValues });
  }
}

export async function addCurrentUserPinnedGroup(groupId: string) {
  // Optimistic update
  await db.addCurrentUserPinnedGroup({ groupId });

  try {
    await api.addCurrentUserPinnedGroup(groupId);
  } catch (e) {
    console.error('Error adding pinned group', e);
    // Rollback the update
    await db.removeCurrentUserPinnedGroup({ groupId });
  }
}

export async function removeCurrentUserPinnedGroup(groupId: string) {
  // Optimistic update
  await db.removeCurrentUserPinnedGroup({ groupId });

  try {
    await api.removeCurrentUserPinnedGroup(groupId);
  } catch (e) {
    console.error('Error removing pinned group', e);
    // Rollback the update
    await db.addCurrentUserPinnedGroup({ groupId });
  }
}

export async function updateCurrentUserPinnedGroups(newPinned: db.Group[]) {
  const currentUserId = api.getCurrentUserId();
  const currentUserContact = await db.getContact({ id: currentUserId });
  const startingPinnedIds =
    currentUserContact?.pinnedGroups.map((pg) => pg.groupId) ?? [];

  const additions = [];
  const deletions = [];

  for (const group of newPinned) {
    if (!startingPinnedIds.includes(group.id)) {
      additions.push(group.id);
    }
  }

  for (const groupId of startingPinnedIds) {
    if (!newPinned.find((g) => g.id === groupId)) {
      deletions.push(groupId);
    }
  }

  logger.log(
    'Updating pinned groups [additions, deletions]',
    additions,
    deletions
  );

  const additionPromises = additions.map((groupId) =>
    addCurrentUserPinnedGroup(groupId)
  );
  const deletionPromises = deletions.map((groupId) =>
    removeCurrentUserPinnedGroup(groupId)
  );

  return Promise.all([...additionPromises, ...deletionPromises]);
}
