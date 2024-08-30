import { CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { UserProfileScreen } from '@tloncorp/app/features/top/UserProfileScreen';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback } from 'react';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

export default function UserProfileScreenController(props: Props) {
  const handleGoToDm = useCallback(
    async (participants: string[]) => {
      const dmChannel = await store.upsertDmChannel({
        participants,
      });
      props.navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: 'ChatList' },
            { name: 'Channel', params: { channel: dmChannel } },
          ],
        })
      );
    },
    [props.navigation]
  );

  return (
    <UserProfileScreen
      userId={props.route.params.userId}
      onGoBack={() => props.navigation.goBack()}
      onPressGoToDm={handleGoToDm}
    />
  );
}
