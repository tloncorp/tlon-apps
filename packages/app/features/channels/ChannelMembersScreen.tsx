import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/dist/store';
import { ChannelMembersScreenView } from '@tloncorp/ui';

import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChannelMembers'>;

export function ChannelMembersScreen(props: Props) {
  const { channelId } = props.route.params;
  const channelQuery = store.useChannelWithRelations({
    id: channelId,
  });

  return (
    <ChannelMembersScreenView
      channel={channelQuery.data ?? undefined}
      goBack={() => props.navigation.goBack()}
    />
  );
}
