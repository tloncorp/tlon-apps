import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChannel } from '@tloncorp/shared/store';

import { RootStackParamList } from '../../navigation/types';
import { ChannelMembersScreenView } from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'ChannelMembers'>;

export function ChannelMembersScreen(props: Props) {
  const { channelId } = props.route.params;
  const channelQuery = useChannel({
    id: channelId,
  });

  return (
    <ChannelMembersScreenView
      channel={channelQuery.data ?? undefined}
      goBack={() => props.navigation.goBack()}
    />
  );
}
