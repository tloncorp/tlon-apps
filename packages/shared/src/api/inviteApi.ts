import * as db from '../db';
import { InviteLinkMetadata } from '../domain/invite.types';
import { GroupMeta } from '../urbit';
import { getCurrentUserId, poke, subscribeOnce } from './urbit';

const ID_LINK_TIMEOUT = 3 * 1000;

// Note: Ideally we could avoid "faking" a groupId for these invites, but for now:
// 1. Must be present for %reel to make any sense of it
// 2. Must be flag shaped for %grouper not to crash
const SELF_INVITE_KEY = '~zod/personal-invite-link';

export function groupsDescribe(meta: InviteLinkMetadata) {
  return {
    tag: 'groups-0',
    fields: { ...meta }, // makes typescript happy
  };
}

export async function createInviteLink(
  token: string,
  metadata: { tag: string; fields: Record<string, string | undefined> }
) {
  return poke({
    app: 'reel',
    mark: 'reel-describe',
    json: {
      token,
      metadata,
    },
  });
}

export async function enableGroup(name: string) {
  return await poke({
    app: 'grouper',
    mark: 'grouper-enable',
    json: name,
  });
}

export async function checkExistingUserInviteLink(): Promise<string | null> {
  try {
    const tlonNetworkUrl = await subscribeOnce<string>(
      { app: 'reel', path: `/v1/id-link/${SELF_INVITE_KEY}` },
      ID_LINK_TIMEOUT,
      undefined,
      { tag: 'checkExistingUserInviteLink' }
    );

    if (!tlonNetworkUrl) {
      return null;
    }

    return tlonNetworkUrl;
  } catch (e) {
    // expected to throw if it times out. Could harden this handling, but for
    // now just assume that means it's not there
    return null;
  }
}

export async function createPersonalInviteLink(
  currentUser?: db.Contact | null
): Promise<string> {
  const currentUserId = getCurrentUserId();

  // first tell grouper our fake group exists so it can process the bite
  // correctly
  await poke({
    app: 'grouper',
    mark: 'grouper-enable',
    json: SELF_INVITE_KEY,
  });

  // then create the invite link entry on the providers
  await createInviteLink(
    SELF_INVITE_KEY,
    groupsDescribe({
      inviterUserId: currentUserId,
      inviterNickname: currentUser?.nickname ?? '',
      inviterAvatarImage: currentUser?.avatarImage ?? '',
      inviterColor: currentUser?.color ?? '',
      inviteType: 'user',
      invitedGroupId: '',
    })
  );

  const tlonNetworkUrl = await checkExistingUserInviteLink();
  if (!tlonNetworkUrl) {
    throw new Error('Failed to get invite link from reel');
  }

  return tlonNetworkUrl;
}
