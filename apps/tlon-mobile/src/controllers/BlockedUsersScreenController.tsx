import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BlockedUsersScreen } from '@tloncorp/app/features/settings/BlockedUsersScreen';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BlockedUsers'>;

export function BlockedUsersScreenController(props: Props) {
  return <BlockedUsersScreen onGoBack={() => props.navigation.goBack()} />;
}
