import { getBotUserIdForUser, getCurrentUserIsHosted } from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';

import { useCurrentUserId } from './useCurrentUser';

export type BotDmTab =
  | { enabled: false }
  | { enabled: true; channelId: string };

/**
 * Whether the first bottom tab — the user's conversation with their bot —
 * should be shown, and what it opens.
 *
 * The tab exists for a hosted user whose bot is enabled. It must not wait for
 * the DM's channel row: the tab renders the DM by id, and onboarding lands in
 * it before the row has synced — a tab registered only once the row arrives
 * would leave that landing with no screen to reach. A DM's channel id is the
 * other party's id, so the bot's user id addresses the conversation directly.
 */
export function useBotDmTab(): BotDmTab {
  const currentUserId = useCurrentUserId();
  const isHostedUser = getCurrentUserIsHosted();
  const { value: botEnabled } = db.hostingBotEnabled.useStorageItem();
  const channelId = getBotUserIdForUser(currentUserId);

  if (!isHostedUser || !botEnabled || !channelId) {
    return { enabled: false };
  }

  return { enabled: true, channelId };
}
