import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EditChannelScreen } from '@tloncorp/app/features/groups/EditChannelScreen';

import { GroupSettingsStackParamList } from '../types';

type ManageChannelsScreenProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'EditChannel'
>;

export function EditChannelScreenController(props: ManageChannelsScreenProps) {
  const { groupId, channelId } = props.route.params;

  return (
    <EditChannelScreen
      groupId={groupId}
      channelId={channelId}
      onGoBack={() => props.navigation.goBack()}
    />
  );
}
