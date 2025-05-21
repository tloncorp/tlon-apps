import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';

import { RootStackParamList } from '../../navigation/types';
import { getChannelId } from '../../navigation/utils';
import { ChannelMembersScreenView } from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'ChannelMembers'>;

export function ChannelMembersScreen(props: Props) {
  const channelId = getChannelId(props.route) ?? '';

  const channelQuery = store.useChannel({
    id: channelId,
  });

  return (
    <ChannelMembersScreenView
      channel={channelQuery.data ?? undefined}
      goBack={() => props.navigation.goBack()}
    />
  );
}
