import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '@tloncorp/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupSettingsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<GroupSettingsStackParamList, 'GroupRoles'>;

export function GroupRolesScreen(props: Props) {
  return (
    <SafeAreaView>
      <Text>GroupRoles</Text>
    </SafeAreaView>
  );
}
