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

export async function verifyUserInviteLink({
  branchDomain,
  inviteServiceEndpoint,
  inviteServiceIsDev,
}: {
  branchDomain: string;
  inviteServiceEndpoint: string;
  inviteServiceIsDev: boolean;
}) {
  console.log('verifying user invite link');
  try {
    const cachedInviteLink = await db.personalInviteLink.getValue();
    if (cachedInviteLink) {
      console.log('have cached invite link', cachedInviteLink);
      return;
    }

    let inviteLink = await api.checkExistingUserInviteLink();
    console.log(`checked for existing invite link`, inviteLink);
    if (!inviteLink) {
      inviteLink = await withRetry(() =>
        createUserInviteLink({
          inviteServiceEndpoint,
          inviteServiceIsDev,
        })
      );
      logger.trackEvent('Created personal invite link');
    } else {
      inviteLink = extractNormalizedInviteLink(inviteLink, branchDomain);
    }

    if (inviteLink) {
      await db.personalInviteLink.setValue(inviteLink);
    }
  } catch (e) {
    logger.trackError('Failed to verify user invite link', {
      errorMessage: e.message,
      errorStack: e.stack,
    });
  }
}

export async function createUserInviteLink({
  inviteServiceEndpoint,
  inviteServiceIsDev,
}: {
  inviteServiceEndpoint: string;
  inviteServiceIsDev: boolean;
}): Promise<string> {
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
    inviteServiceEndpoint,
    inviteServiceIsDev,
  });

  if (!inviteLink) {
    throw new Error('Failed to wrap self invite deep link');
  }

  return inviteLink;
}
