import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '@tloncorp/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupSettingsStackParamList } from '../../types';

type GroupRolesScreenProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'GroupRoles'
>;

export function GroupRolesScreen(props: GroupRolesScreenProps) {
  return (
    <SafeAreaView>
      <Text>GroupRoles</Text>
    </SafeAreaView>
  );
}
