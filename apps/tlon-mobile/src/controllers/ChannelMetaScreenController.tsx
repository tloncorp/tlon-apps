import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChannelMetaScreen } from '@tloncorp/app/features/channels/ChannelMetaScreen';

import { RootStackParamList } from '../types';

type ChannelMetaScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ChannelMeta'
>;

export function ChannelMetaScreenController(props: ChannelMetaScreenProps) {
  const { channelId } = props.route.params;

  return (
    <ChannelMetaScreen
      channelId={channelId}
      onGoBack={() => props.navigation.goBack()}
    />
  );
}
