import * as db from '@tloncorp/shared/db';
import {
  getBotUserIdForUser,
  isMoonOfUser,
} from '@tloncorp/api/client/apiUtils';
import { isBotHomeGroupChatChannel } from '@tloncorp/api/client/wayfinding';
import {
  findPostBlobEntry,
  parsePostBlob,
  postHasBlobEntry,
} from '@tloncorp/api';

// Provisioned by ylem before the conversational onboarding begins. Keep the
// exact full copy here so a later bot message that builds on it remains visible.
export const TLAWN_HOME_GROUP_WELCOME_MESSAGE =
  'Welcome! This is your private group with me, your Tlonbot. You can @ me ' +
  'here anytime and I will respond. Invite some friends, and they can @ me ' +
  'too—we can all chat together.';

// Posted into the bot DM before the conversational onboarding begins
// (`INTRO_MESSAGE` in tlonbot's `entrypoint/tlawn.py`). It interpolates the
// ship into its middle, so unlike the home-group welcome it cannot be held
// here whole. Anchor on the head and tail it never varies in: together they
// identify this message without swallowing a later one that quotes part of it.
const TLONBOT_DM_INTRO_HEAD = "Howdy, I'm your Tlonbot";
const TLONBOT_DM_INTRO_TAIL =
  "Just say the word and I'll be there every day. \u{1F305}";

function isTlonbotDmIntro(text: string): boolean {
  return (
    text.startsWith(TLONBOT_DM_INTRO_HEAD) &&
    text.endsWith(TLONBOT_DM_INTRO_TAIL)
  );
}

/**
 * Typed coordinator requests are durable transport receipts, not chat copy.
 * Keep them in channel history so onboarding can replay safely, but omit them
 * from the presented timeline.
 */
export function isVisibleChannelPost(
  post: Pick<db.Post, 'blob' | 'authorId' | 'isBot' | 'textContent'> & {
    deliveryStatus?: db.Post['deliveryStatus'];
  },
  currentUserId: string,
  channelId?: string
): boolean {
  if (
    channelId &&
    isBotHomeGroupChatChannel(currentUserId, channelId) &&
    (post.isBot === true || isMoonOfUser(post.authorId, currentUserId)) &&
    post.textContent?.trim() === TLAWN_HOME_GROUP_WELCOME_MESSAGE
  ) {
    return false;
  }
  // A DM channel is addressed by the other party, so the bot's own DM is the
  // only place this can match, and only for a post the bot itself authored.
  if (
    channelId &&
    channelId === getBotUserIdForUser(currentUserId) &&
    post.authorId === channelId &&
    isTlonbotDmIntro(post.textContent?.trim() ?? '')
  ) {
    return false;
  }
  if (!post.blob) return true;
  if (post.authorId !== currentUserId) return true;
  if (post.deliveryStatus === 'failed') return true;

  return !postHasBlobEntry(post.blob, 'tlon-agent-intro-request');
}

export function isAgentOnboardingOrientationCompletePost(
  post: Pick<db.Post, 'blob'>
): boolean {
  if (!post.blob) return false;

  return parsePostBlob(post.blob).some(
    (entry) =>
      entry.type === 'tlon-agent-post-marker' &&
      entry.key === 'orientation-complete'
  );
}

export function findAgentOnboardingOrientationCompletePostId(
  posts: Array<Pick<db.Post, 'id' | 'authorId' | 'blob'>> | null | undefined,
  agentId: string | undefined
): string | null {
  if (!agentId) return null;
  return (
    posts?.find(
      (post) =>
        post.authorId === agentId &&
        isAgentOnboardingOrientationCompletePost(post)
    )?.id ?? null
  );
}

export function isAgentGroupSetupRequestPost(
  post: Pick<db.Post, 'blob'>
): boolean {
  if (!post.blob) return false;

  return postHasBlobEntry(post.blob, 'tlon-agent-intro-request');
}

export function isAgentOnboardingFirstGroupRequestPost(
  post: Pick<db.Post, 'blob'>
): boolean {
  if (!post.blob) return false;

  return (
    findPostBlobEntry(post.blob, 'tlon-agent-intro-request')?.isFirstGroup ===
    true
  );
}

export function isAgentGroupSetupCompletePost(
  post: Pick<db.Post, 'blob'>
): boolean {
  if (!post.blob) return false;

  return parsePostBlob(post.blob).some(
    (entry) =>
      entry.type === 'tlon-agent-post-marker' &&
      (entry.key === 'orientation-complete' ||
        entry.key === 'group-setup-complete' ||
        entry.key === 'first-entry-failed')
  );
}

export function isAgentGroupSetupActive(
  posts:
    | Array<
        Pick<db.Post, 'authorId' | 'blob'> & {
          deliveryStatus?: db.Post['deliveryStatus'];
        }
      >
    | null
    | undefined,
  currentUserId: string,
  agentShipId: string | undefined,
  hasLocalMarker: boolean
): boolean {
  if (hasLocalMarker) return true;
  if (
    !posts?.some(
      (post) =>
        post.authorId === currentUserId &&
        post.deliveryStatus !== 'failed' &&
        isAgentGroupSetupRequestPost(post)
    )
  ) {
    return false;
  }
  return !posts.some(
    (post) =>
      post.authorId === agentShipId && isAgentGroupSetupCompletePost(post)
  );
}
