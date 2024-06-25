import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '@tloncorp/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupSettingsStackParamList } from '../../types';

type InvitesAndPrivacyScreenProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'InvitesAndPrivacy'
>;

export function InvitesAndPrivacyScreen(props: InvitesAndPrivacyScreenProps) {
  return (
    <SafeAreaView>
      <Text>InvitesAndPrivacy</Text>
    </SafeAreaView>
  );
}
