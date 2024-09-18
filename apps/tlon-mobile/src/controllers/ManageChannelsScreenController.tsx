import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ManageChannelsScreen } from '@tloncorp/app/features/groups/ManageChannelsScreen';

import { GroupSettingsStackParamList } from '../types';

type ManageChannelsScreenProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'ManageChannels'
>;

export function ManageChannelsScreenController(
  props: ManageChannelsScreenProps
) {
  const { groupId } = props.route.params;

  return (
    <ManageChannelsScreen
      groupId={groupId}
      onGoBack={() => props.navigation.goBack()}
      onGoToEditChannel={(channelId) => {
        props.navigation.navigate('EditChannel', { groupId, channelId });
      }}
    />
  );
}
