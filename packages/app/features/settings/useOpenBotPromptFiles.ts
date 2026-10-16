import { StackActions } from '@react-navigation/native';
import { useCallback } from 'react';

import { useNavigation } from '../../navigation/utils';
import { useIsWindowNarrow } from '../../ui';

/**
 * Opens a bot's prompt files from its profile, in the stack the profile is
 * in, so going back returns to it.
 */
export function useOpenBotPromptFiles() {
  const navigation = useNavigation();
  const isWindowNarrow = useIsWindowNarrow();
  return useCallback(
    (botShip: string) => {
      if (isWindowNarrow) {
        navigation.dispatch(StackActions.push('BotPromptFiles', { botShip }));
        return;
      }
      navigation.navigate('BotPromptFiles', { botShip });
    },
    [isWindowNarrow, navigation]
  );
}
