import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ChannelSearchScreen from '@tloncorp/app/features/top/ChannelSearchScreen';

import type { RootStackParamList } from '../types';

type ChannelSearchScreenControllerProps = NativeStackScreenProps<
  RootStackParamList,
  'ChannelSearch'
>;

export function ChannelSearchScreenController({
  navigation,
  route,
}: ChannelSearchScreenControllerProps) {
  return (
    <ChannelSearchScreen
      channel={route.params.channel}
      navigateToChannel={({ channel, selectedPostId }) => {
        navigation.navigate('Channel', {
          channel,
          selectedPostId,
        });
      }}
      navigateToReply={({ id, authorId, channelId }) => {
        navigation.replace('Post', {
          post: {
            id,
            channelId,
            authorId,
          },
        });
      }}
      cancelSearch={() => {
        navigation.pop();
      }}
    />
  );
}
