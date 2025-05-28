import { blockUser, unblockUser } from './dmActions';
import { queryClient } from './reactQuery';

export async function handleBlockingAction(
  userId: string,
  isCurrentlyBlocked: boolean
): Promise<void> {
  if (isCurrentlyBlocked) {
    await unblockUser(userId);
  } else {
    await blockUser(userId);
  }

  // Invalidate queries to refresh UI
  queryClient.invalidateQueries({
    queryKey: ['blockedContacts'],
  });
  queryClient.invalidateQueries({
    queryKey: [['contact', userId]],
  });
}

export function getConfirmationMessage(isBlocking: boolean): string {
  return isBlocking
    ? 'Are you sure you want to block this user?'
    : 'Are you sure you want to unblock this user?';
}
