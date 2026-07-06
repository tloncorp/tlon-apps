import * as api from '@tloncorp/api';
import * as store from '@tloncorp/shared/store';
import { Linking, Platform } from 'react-native';

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

export function openExternalBotSettings() {
  if (Platform.OS === 'web') {
    window.open(BOT_SETTINGS_URL, '_blank', 'noopener,noreferrer');
    return;
  }

  Linking.openURL(BOT_SETTINGS_URL);
}
