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
      params?: Omit<RootStackParamList['Channel'], 'channelId'>
    ) => {
      if (typeof channel === 'string') {
        navigation.navigate('Channel', { channelId: channel, ...params });
      } else {
        navigation.navigate('Channel', { channelId: channel.id, ...params });
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
