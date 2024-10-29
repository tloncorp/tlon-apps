import { useNavigation } from '@react-navigation/native';
import * as db from '@tloncorp/shared/db';
import { useCallback } from 'react';

import { RootStackParamList } from '../navigation/types';

export const useGroupNavigation = () => {
  const navigation = useNavigation<
    // @ts-expect-error - TODO: pass navigation handlers into context
    NativeStackNavigationProp<RootStackParamList, 'Channel' | 'Post'>
  >();

  const goToChannel = useCallback(
    async (
      channel: db.Channel | string,
      params?: Omit<RootStackParamList['Channel'], 'channel'>
    ) => {
      if (typeof channel === 'string') {
        const channelObj = await db.getChannel({ id: channel });
        navigation.navigate('Channel', { channel: channelObj, ...params });
      } else {
        navigation.navigate('Channel', { channel, ...params });
      }
    },
    [navigation]
  );

  const goToHome = useCallback(() => {
    navigation.navigate('ChatList');
  }, [navigation]);

  const goToContactHostedGroups = useCallback(
    ({ contactId }: { contactId: string }) => {
      navigation.navigate('ContactHostedGroups', { contactId });
    },
    [navigation]
  );

  return {
    goToChannel,
    goToHome,
    goToContactHostedGroups,
  };
};
