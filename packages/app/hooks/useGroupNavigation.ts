import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutableRef } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { getTopLevelTabRoute } from '../navigation/topLevelTabs';
import { HomeDrawerParamList, RootStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/utils';

type GroupNavigationParamList = RootStackParamList &
  Pick<HomeDrawerParamList, 'ChatList'>;

export const useGroupNavigation = () => {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<GroupNavigationParamList, 'Channel' | 'Post'>
    >();
  const navigationRef = useMutableRef(navigation);
  const { resetToGroup } = useRootNavigation();
  const isWindowNarrow = useIsWindowNarrow();

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
    if (Platform.OS !== 'web' || isWindowNarrow) {
      const route = getTopLevelTabRoute('ChatList');
      navigationRef.current.navigate(route.name, route.params, { pop: true });
    } else {
      navigationRef.current.navigate('ChatList', undefined, { pop: true });
    }
  }, [isWindowNarrow, navigationRef]);

  return {
    goToChannel,
    goToHome,
    goToGroup,
  };
};
