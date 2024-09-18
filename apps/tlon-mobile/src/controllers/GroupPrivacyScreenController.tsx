import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GroupPrivacyScreen } from '@tloncorp/app/features/groups/GroupPrivacyScreen';

import { GroupSettingsStackParamList } from '../types';

type InvitesAndPrivacyScreenProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'Privacy'
>;

export function GroupPrivacyScreenController(
  props: InvitesAndPrivacyScreenProps
) {
  const { groupId } = props.route.params;

  return (
    <GroupPrivacyScreen
      groupId={groupId}
      onGoBack={() => props.navigation.goBack()}
    />
  );
}
