import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutableRef } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback } from 'react';

import { RootStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/utils';

export const useGroupNavigation = () => {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, 'Channel' | 'Post'>
    >();
  const navigationRef = useMutableRef(navigation);
  const { resetToGroup } = useRootNavigation();

  const goToChannel = useCallback(
    async (
      channel: db.Channel | string,
      params?: Omit<RootStackParamList['Channel'], 'channelId'>
    ) => {
      if (typeof channel === 'string') {
        navigationRef.current.navigate('Channel', {
          channelId: channel,
          ...params,
        });
      } else {
        navigationRef.current.navigate('Channel', {
          channelId: channel.id,
          ...params,
        });
      }
    },
    [navigationRef]
  );

  const goToGroup = useCallback(
    async (groupId: string) => {
      resetToGroup(groupId);
    },
    [resetToGroup]
  );

  const goToHome = useCallback(() => {
    navigationRef.current.navigate('ChatList');
  }, [navigationRef]);

  return {
    goToChannel,
    goToHome,
    goToGroup,
  };
};
