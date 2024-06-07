import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useScreenOptions } from '../hooks/useScreenOptions';
import ChannelScreen from '../screens/ChannelScreen';
import ChannelSearch from '../screens/ChannelSearchScreen';
import ChatListScreen from '../screens/ChatListScreen';
import { GroupChannelsScreen } from '../screens/GroupChannelsScreen';
import PostScreen from '../screens/PostScreen';
import type { HomeStackParamList, TabParamList } from '../types';

type Props = BottomTabScreenProps<TabParamList, 'Groups'>;
const Stack = createNativeStackNavigator<HomeStackParamList>();

export const HomeStack = ({ navigation }: Props) => {
  const screenOptions = useScreenOptions({
    overrides: {
      headerShown: false,
    },
  });

  return (
    <Stack.Navigator initialRouteName="ChatList" screenOptions={screenOptions}>
      <Stack.Screen name="ChatList" component={ChatListScreen} />
      <Stack.Screen name="Channel" component={ChannelScreen} />
      <Stack.Screen name="ChannelSearch" component={ChannelSearch} />
      <Stack.Screen name="Post" component={PostScreen} />
      <Stack.Screen name="GroupChannels" component={GroupChannelsScreen} />
    </Stack.Navigator>
  );
};
