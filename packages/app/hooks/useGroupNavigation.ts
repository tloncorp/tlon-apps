import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import { useCallback } from 'react';

import { RootStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/utils';

export const useGroupNavigation = () => {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, 'Channel' | 'Post'>
    >();
  const { resetToGroup } = useRootNavigation();

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

  const goToGroup = useCallback(
    async (groupId: string) => {
      resetToGroup(groupId);
    },
    [resetToGroup]
  );

  const goToHome = useCallback(() => {
    navigation.navigate('ChatList');
  }, [navigation]);

  return {
    goToChannel,
    goToHome,
    goToGroup,
  };
};
