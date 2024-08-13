import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ChannelScreen from '@tloncorp/app/features/top/ChannelScreen';
import * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';

import type { RootStackParamList } from '../types';

type ChannelScreenControllerProps = NativeStackScreenProps<
  RootStackParamList,
  'Channel'
>;

export function ChannelScreenController(props: ChannelScreenControllerProps) {
  const handleGoToDm = useCallback(
    async (dmChannel: db.Channel) => {
      props.navigation.push('Channel', { channel: dmChannel });
    },
    [props.navigation]
  );

  const handleGoToUserProfile = useCallback(
    (userId: string) => {
      props.navigation.push('UserProfile', { userId });
    },
    [props.navigation]
  );

  return (
    <ChannelScreen
      channelFromParams={props.route.params.channel}
      selectedPostId={props.route.params.selectedPostId}
      groupFromParams={props.route.params.channel.group}
      navigateToDm={handleGoToDm}
      goBack={props.navigation.goBack}
      navigateToUserProfile={handleGoToUserProfile}
    />
  );
}
