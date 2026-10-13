import * as api from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Linking, Platform } from 'react-native';

import { useCurrentUserId } from '../hooks/useCurrentUser';

export const BOT_SETTINGS_URL = 'https://tlon.network/tlonbot';

export function useHasExpectedBotDm(currentUserId: string, enabled: boolean) {
  const expectedBotId = enabled ? api.getBotUserIdForUser(currentUserId) : '';
  const { data: botDm } = store.useChannel({ id: expectedBotId });

  return (
    botDm?.type === 'dm' &&
    botDm.isPendingChannel !== true &&
    botDm.isDmInvite !== true
  );
}

/**
 * Whether hosting says this account's bot is turned on. Web has no hosting
 * session to ask, so there an accepted DM with the bot stands in for it.
 * False until that is known, and for an account that is not hosted.
 */
export function useBotEnabled() {
  const currentUserId = useCurrentUserId();
  const hostingBotEnabled = db.hostingBotEnabled.useValue();
  const isHostedUser = api.getCurrentUserIsHosted();
  const hasExpectedBotDm = useHasExpectedBotDm(
    currentUserId,
    Platform.OS === 'web' && isHostedUser
  );
  return Platform.OS === 'web'
    ? isHostedUser && hasExpectedBotDm
    : isHostedUser && hostingBotEnabled;
}

export function openExternalBotSettings() {
  if (Platform.OS === 'web') {
    window.open(BOT_SETTINGS_URL, '_blank', 'noopener,noreferrer');
    return;
  }

  Linking.openURL(BOT_SETTINGS_URL);
}
