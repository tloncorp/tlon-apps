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

  queryClient.invalidateQueries({
    predicate: (query) => 
      query.queryKey.includes('contacts')
  });
}

export function getConfirmationMessage(isBlocking: boolean): string {
  return isBlocking
    ? 'Are you sure you want to block this user?'
    : 'Are you sure you want to unblock this user?';
}
