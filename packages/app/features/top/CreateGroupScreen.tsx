import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type * as db from '@tloncorp/shared/dist/db';
import { CreateGroupView } from '@tloncorp/ui';
import { useCallback } from 'react';

import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

export function CreateGroupScreen(props: Props) {
  const handleGoToChannel = useCallback(
    (channel: db.Channel) => {
      props.navigation.reset({
        index: 1,
        routes: [
          { name: 'ChatList' },
          { name: 'Channel', params: { channel } },
        ],
      });
    },
    [props.navigation]
  );

  return (
    <CreateGroupView
      goBack={() => props.navigation.goBack()}
      navigateToChannel={handleGoToChannel}
    />
  );
}
