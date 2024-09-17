import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ChatListScreen from '@tloncorp/app/features/top/ChatListScreen';

import type { RootStackParamList } from '../types';

type ChatListControllerProps = NativeStackScreenProps<
  RootStackParamList,
  'ChatList'
>;

export function ChatListScreenController({
  navigation,
}: ChatListControllerProps) {
  return (
    <ChatListScreen
      navigateToChannel={(channel) => {
        navigation.push('Channel', { channel });
      }}
      navigateToGroupChannels={(group) => {
        navigation.navigate('GroupChannels', { group });
      }}
      navigateToSelectedPost={(channel, postId) => {
        navigation.navigate('Channel', { channel, selectedPostId: postId });
      }}
      navigateToHome={() => {
        navigation.navigate('ChatList');
      }}
      navigateToNotifications={() => {
        navigation.navigate('Activity');
      }}
      navigateToProfile={() => {
        navigation.navigate('Profile');
      }}
      navigateToFindGroups={() => {
        navigation.navigate('FindGroups');
      }}
    />
  );
}
