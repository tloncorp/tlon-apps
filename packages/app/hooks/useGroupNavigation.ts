import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutableRef } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback } from 'react';

import { getTopLevelTabRoute } from '../navigation/topLevelTabs';
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
          groupId: channel.groupId ?? undefined,
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
    const route = getTopLevelTabRoute('ChatList');
    navigationRef.current.navigate(route.name, route.params, { pop: true });
  }, [navigationRef]);

  return {
    goToChannel,
    goToHome,
    goToGroup,
  };
};
