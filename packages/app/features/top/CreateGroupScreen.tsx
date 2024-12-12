import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type * as db from '@tloncorp/shared/db';
import { CreateGroupView } from '@tloncorp/ui';
import { useCallback } from 'react';

import type { RootStackParamList } from '../../navigation/types';
import { useNavigateToChannel } from '../../navigation/utils';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

export function CreateGroupScreen(props: Props) {
  const navigateToChannel = useNavigateToChannel();
  const handleGoToChannel = useCallback(
    (channel: db.Channel) => {
      navigateToChannel(channel);
    },
    [navigateToChannel]
  );

  return (
    <CreateGroupView
      goBack={() => props.navigation.goBack()}
      navigateToChannel={handleGoToChannel}
    />
  );
}
