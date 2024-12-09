import * as db from '../db';
import { DeepLinkMetadata } from '../domain/invite.types';
import { GroupMeta } from '../urbit';
import { getCurrentUserId, poke, subscribeOnce } from './urbit';

const ID_LINK_TIMEOUT = 3 * 1000;
const SELF_INVITE_KEY = 'personal-invite-link'; // needed to allow processing on %grouper without corresponding group entry

function groupsDescribe(meta: GroupMeta & DeepLinkMetadata) {
  return {
    tag: 'groups-0',
    fields: { ...meta }, // makes typescript happy
  };
}

export async function checkExistingUserInviteLink(): Promise<string | null> {
  const tlonNetworkUrl = await subscribeOnce<string>(
    { app: 'reel', path: `/v1/id-link/${SELF_INVITE_KEY}` },
    ID_LINK_TIMEOUT
  );

  if (!tlonNetworkUrl) {
    return null;
  }

  return tlonNetworkUrl;
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
  await poke({
    app: 'reel',
    mark: 'reel-describe',
    json: {
      token: SELF_INVITE_KEY,
      metadata: groupsDescribe({
        // legacy keys
        title: 'Personal Invite',
        description: '',
        cover: '',
        image: '',

        // new-style metadata keys
        inviterUserId: currentUserId,
        inviterNickname: currentUser?.nickname ?? '',
        inviterAvatarImage: currentUser?.avatarImage ?? '',
        inviterColor: currentUser?.color ?? '',
        inviteType: 'user',
        invitedGroupId: '',
      }),
    },
  });

  const tlonNetworkUrl = await checkExistingUserInviteLink();
  if (!tlonNetworkUrl) {
    throw new Error('Failed to get invite link from reel');
  }

  return tlonNetworkUrl;
}
