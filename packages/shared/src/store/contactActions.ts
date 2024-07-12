import * as api from '../api';
import * as db from '../db';

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
