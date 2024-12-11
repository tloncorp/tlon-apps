import { getCurrentUserId } from '../api';
import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import {
  createDeepLink,
  extractNormalizedInviteLink,
  withRetry,
} from '../logic';

const logger = createDevLogger('inviteActions', true);

export async function verifyUserInviteLink() {
  try {
    const cachedInviteLink = await db.personalInviteLink.getValue();
    if (cachedInviteLink) {
      console.log('have cached invite link', cachedInviteLink);
      return;
    }

    let inviteLink = await api.checkExistingUserInviteLink();
    if (!inviteLink) {
      inviteLink = await withRetry(() => createUserInviteLink());
      logger.trackEvent('Created personal invite link');
    } else {
      inviteLink = extractNormalizedInviteLink(inviteLink);
    }

    if (inviteLink) {
      await db.personalInviteLink.setValue(inviteLink);
    }
  } catch (e) {
    logger.trackError('Failed to verify personal invite link', {
      errorMessage: e.message,
      errorStack: e.stack,
    });
  }
}

export async function createUserInviteLink(): Promise<string> {
  const currentUserId = getCurrentUserId();
  const user = await db.getContact({ id: currentUserId });

  const tlonNetworkUrl = await api.createPersonalInviteLink(user);

  // create on branch
  const inviteLink = await createDeepLink({
    fallbackUrl: tlonNetworkUrl,
    type: 'lure',
    path: 'stub', // doesn't matter in this case
    metadata: {
      inviterUserId: currentUserId,
      inviterNickname: user?.nickname ?? '',
      inviterAvatarImage: user?.avatarImage ?? '',
      inviterColor: user?.color ?? '',
      inviteType: 'user',
      invitedGroupId: '',
    },
  });

  if (!inviteLink) {
    throw new Error('Failed to wrap self invite deep link');
  }

  return inviteLink;
}
