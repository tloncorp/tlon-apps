import { getCurrentUserIsHosted } from '@tloncorp/api';
import { BotHomeGroupSlugs } from '@tloncorp/api/types/wayfinding';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { Platform } from 'react-native';

import { useHasExpectedBotDm } from '../utils/botSettings';
import { useCurrentUserId } from './useCurrentUser';

export type HomeGroupTab =
  | { enabled: false }
  | { enabled: true; groupId: string; channelId: string };

/**
 * Whether the first bottom tab — the user's home group with their bot — should
 * be shown, and what it opens.
 *
 * The tab is only meaningful for a hosted user whose bot is enabled, and only
 * once the group's chat channel has actually synced; without a channel to open
 * the tab would land on an empty screen, so callers fall back to Workspaces as
 * the first tab.
 */
export function useHomeGroupTab(): HomeGroupTab {
  const currentUserId = useCurrentUserId();
  const isHostedUser = getCurrentUserIsHosted();
  const hostingBotEnabled = db.hostingBotEnabled.useValue();
  // Web has no hosting-settings store to read, so the bot's own DM stands in
  // for the enabled flag (mirrors SettingsScreen).
  const hasExpectedBotDm = useHasExpectedBotDm(
    currentUserId,
    Platform.OS === 'web' && isHostedUser
  );
  const botEnabled =
    Platform.OS === 'web'
      ? isHostedUser && hasExpectedBotDm
      : isHostedUser && hostingBotEnabled;

  const groupId = `${currentUserId}/${BotHomeGroupSlugs.slug}`;
  const { data: group } = store.useGroup({ id: botEnabled ? groupId : '' });
  const chatChannelId = group?.channels?.find((channel) =>
    logic.isBotHomeGroupChatChannel(currentUserId, channel.id)
  )?.id;

  if (!botEnabled || !chatChannelId) {
    return { enabled: false };
  }

  return { enabled: true, groupId, channelId: chatChannelId };
}
