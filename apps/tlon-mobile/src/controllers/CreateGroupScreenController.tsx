import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CreateGroupScreen } from '@tloncorp/app/features/top/CreateGroupScreen';
import type * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';

import type { RootStackParamList } from '../types';

type ChatListControllerProps = NativeStackScreenProps<
  RootStackParamList,
  'ChatList'
>;

export function CreateGroupScreenController({
  navigation,
}: ChatListControllerProps) {
  const handleGoToChannel = useCallback(
    (channel: db.Channel) => {
      navigation.reset({
        index: 1,
        routes: [
          { name: 'ChatList' },
          { name: 'Channel', params: { channel } },
        ],
      });
    },
    [navigation]
  );

  return (
    <CreateGroupScreen
      goBack={() => navigation.goBack()}
      goToChannel={handleGoToChannel}
    />
  );
}
