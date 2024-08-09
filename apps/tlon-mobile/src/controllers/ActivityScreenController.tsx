import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityScreen } from '@tloncorp/app/features/top/ActivityScreen';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback } from 'react';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Activity'>;

export function ActivityScreenController(props: Props) {
  const handleGoToChannel = useCallback(
    (channel: db.Channel, selectedPostId?: string) => {
      props.navigation.navigate('Channel', { channel, selectedPostId });
    },
    [props.navigation]
  );

  // TODO: if diary or gallery, figure out a way to pop open the comment
  // sheet
  const handleGoToThread = useCallback(
    (post: db.Post) => {
      // TODO: we have no way to route to specific thread message rn
      props.navigation.navigate('Post', { post });
    },
    [props.navigation]
  );

  const handleGoToGroup = useCallback(
    (group: db.Group) => {
      store.markGroupRead(group);
      props.navigation.navigate('GroupSettings', {
        // @ts-expect-error TODO fix nested navigator types
        screen: 'GroupMembers',
        params: { groupId: group.id },
      });
    },
    [props.navigation]
  );

  return (
    <ActivityScreen
      navigateToChannel={handleGoToChannel}
      navigateToThread={handleGoToThread}
      navigateToGroup={handleGoToGroup}
      navigateToChatList={() => props.navigation.navigate('ChatList')}
      navigateToActivity={() => props.navigation.navigate('Activity')}
      navigateToProfile={() => props.navigation.navigate('Profile')}
    />
  );
}
