import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChannelMembersScreen } from '@tloncorp/app/features/channels/ChannelMembersScreen';

import { RootStackParamList } from '../types';

type ChannelMembersScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ChannelMembers'
>;

export function ChannelMembersScreenController(
  props: ChannelMembersScreenProps
) {
  const { channelId } = props.route.params;

  return (
    <ChannelMembersScreen
      channelId={channelId}
      onGoBack={() => props.navigation.goBack()}
    />
  );
}
