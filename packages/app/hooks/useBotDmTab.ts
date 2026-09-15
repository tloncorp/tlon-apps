import { getBotUserIdForUser, getCurrentUserIsHosted } from '@tloncorp/api';

import { useHasExpectedBotDm } from '../utils/botSettings';
import { useCurrentUserId } from './useCurrentUser';

export type BotDmTab =
  | { enabled: false }
  | { enabled: true; channelId: string };

/**
 * Whether the first bottom tab — the user's conversation with their bot —
 * should be shown, and what it opens.
 *
 * The tab is only meaningful for a hosted user whose bot DM has been
 * provisioned; until then there is nothing to open, so callers fall back to
 * Workspaces as the first tab. A DM's channel id is the other party's id, so
 * the bot's user id addresses the conversation directly.
 */
export function useBotDmTab(): BotDmTab {
  const currentUserId = useCurrentUserId();
  const isHostedUser = getCurrentUserIsHosted();
  const hasBotDm = useHasExpectedBotDm(currentUserId, isHostedUser);
  const channelId = getBotUserIdForUser(currentUserId);

  if (!isHostedUser || !hasBotDm || !channelId) {
    return { enabled: false };
  }

  return { enabled: true, channelId };
}
