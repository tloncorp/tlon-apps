import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FindGroupsScreen } from '@tloncorp/app/features/top/FindGroupsScreen';

import type { RootStackParamList } from '../types';

type ChatListControllerProps = NativeStackScreenProps<
  RootStackParamList,
  'ChatList'
>;

export function FindGroupsScreenController({
  navigation,
}: ChatListControllerProps) {
  return (
    <FindGroupsScreen
      goBack={() => navigation.goBack()}
      goToUserGroups={(params) =>
        navigation.navigate('ContactHostedGroups', params)
      }
    />
  );
}
