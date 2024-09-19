import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CreateGroupScreen } from '@tloncorp/app/features/top/CreateGroupScreen';

import type { RootStackParamList } from '../types';

type ChatListControllerProps = NativeStackScreenProps<
  RootStackParamList,
  'ChatList'
>;

export function CreateGroupScreenController({
  navigation,
}: ChatListControllerProps) {
  return <CreateGroupScreen goBack={() => navigation.goBack()} />;
}
