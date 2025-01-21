import {
  createInviteLink,
  enableGroup,
  getCurrentUserId,
  groupsDescribe,
} from '../api';
import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import {
  AnalyticsEvent,
  checkInviteServiceLinkExists,
  createDeepLink,
  extractNormalizedInviteLink,
  extractTokenFromInviteLink,
  getFlagParts,
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

    let finalInviteLink = '';
    const inviteLink = await api.checkExistingUserInviteLink();

    if (!inviteLink) {
      // if we don't have one on the provider, create it
      finalInviteLink = await withRetry(() => createUserInviteLink());
      logger.trackEvent('Created personal invite link');
    } else {
      // otherwise, make sure we have the corresponding link on the invite service
      const inviteId = extractTokenFromInviteLink(inviteLink);
      if (!inviteId) {
        throw new Error(`Provider returned invalid link ${inviteLink}`);
      }
      const serviceInviteLinkExists =
        await checkInviteServiceLinkExists(inviteId);
      if (!serviceInviteLinkExists) {
        await withRetry(() => createPersonalInviteLinkOnService(inviteLink!));
      }
      finalInviteLink = extractNormalizedInviteLink(inviteLink) ?? '';
    }

    if (finalInviteLink) {
      await db.personalInviteLink.setValue(finalInviteLink);
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
  const inviteLink = await createPersonalInviteLinkOnService(tlonNetworkUrl);
  return inviteLink;
}

export async function createPersonalInviteLinkOnService(
  tlonNetworkUrl: string
) {
  const currentUserId = getCurrentUserId();
  const user = await db.getContact({ id: currentUserId });
  if (!tlonNetworkUrl) {
    throw new Error(
      'upsertExistingPersonalInviteDeeplink: Failed to get invite link from reel'
    );
  }

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
    throw new Error(
      'upsertExistingPersonalInviteDeeplink: Failed to wrap self invite deep link'
    );
  }

  return inviteLink;
}

export async function enableGroupLinks(groupId: string) {
  const { name } = getFlagParts(groupId);
  return enableGroup(name);
}

export async function createGroupInviteLink(groupId: string) {
  const currentUserId = getCurrentUserId();
  const group = await db.getGroup({ id: groupId });
  const user = await db.getContact({ id: currentUserId });

  if (!group || !user) {
    logger.trackError('[describe] Error looking up group or user', {
      groupId,
      group,
      user,
    });
  }

  try {
    await createInviteLink(
      groupId,
      groupsDescribe({
        // legacy keys
        title: group?.title ?? '',
        description: group?.description ?? '',
        cover: group?.coverImage ?? '',
        image: group?.iconImage ?? '',

        // new-style metadata keys
        inviterUserId: currentUserId,
        inviterNickname: user?.nickname ?? '',
        inviterAvatarImage: user?.avatarImage ?? '',
        invitedGroupId: groupId,
        invitedGroupTitle: group?.title ?? '',
        invitedGroupDescription: group?.description ?? '',
        invitedGroupIconImageUrl: group?.iconImage ?? '',
      })
    );
  } catch (e) {
    logger.trackError(AnalyticsEvent.InviteError, {
      context: 'reel describe failed',
      errorMessage: e.message,
      errorStack: e.stack,
    });
  }
}
