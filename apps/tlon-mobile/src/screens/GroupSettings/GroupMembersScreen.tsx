import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '@tloncorp/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupSettingsStackParamList } from '../../types';

type GroupMembersScreenProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'GroupMembers'
>;

export function GroupMembersScreen(props: GroupMembersScreenProps) {
  return (
    <SafeAreaView>
      <Text>GroupMembers</Text>
    </SafeAreaView>
  );
}
