import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ChannelMembersScreen } from '../../features/channels/ChannelMembersScreen';
import { ChannelMetaScreen } from '../../features/channels/ChannelMetaScreen';
import { EditProfileScreen } from '../../features/settings/EditProfileScreen';
import ChannelScreen from '../../features/top/ChannelScreen';
import ChannelSearchScreen from '../../features/top/ChannelSearchScreen';
import ImageViewerScreen from '../../features/top/ImageViewerScreen';
import PostScreen from '../../features/top/PostScreen';
import { UserProfileScreen } from '../../features/top/UserProfileScreen';
import { GroupSettingsStack } from '../GroupSettingsStack';
import { HomeDrawerParamList } from '../types';

const ChannelStackNavigator = createNativeStackNavigator();

/**
 * Shared ChannelStack component used by both HomeNavigator and MessagesNavigator.
 * Handles navigation between different channel types (Channel, DM, GroupDM).
 */
export function ChannelStack(
  props: NativeStackScreenProps<HomeDrawerParamList, 'Channel'>
) {
  // Extract channelId from route params
  const getChannelId = (): string => {
    if (props.route.params && 'channelId' in props.route.params) {
      return props.route.params.channelId;
    }
    if (
      props.route.params?.params &&
      'channelId' in props.route.params.params
    ) {
      return props.route.params.params.channelId;
    }
    return 'none';
  };

  const channelId = getChannelId();

  return (
    <ChannelStackNavigator.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="ChannelRoot"
    >
      <ChannelStackNavigator.Group navigationKey={channelId}>
        <ChannelStackNavigator.Screen
          name="ChannelRoot"
          component={ChannelScreen}
          initialParams={props.route.params}
        />
        <ChannelStackNavigator.Screen
          name="GroupSettings"
          component={GroupSettingsStack}
        />
        <ChannelStackNavigator.Screen
          name="ChannelSearch"
          component={ChannelSearchScreen}
        />
        <ChannelStackNavigator.Screen
          name="Post"
          component={PostScreen}
          initialParams={props.route.params}
        />
        <ChannelStackNavigator.Screen
          name="ImageViewer"
          component={ImageViewerScreen}
        />
        <ChannelStackNavigator.Screen
          name="UserProfile"
          component={UserProfileScreen}
        />
        <ChannelStackNavigator.Screen
          name="EditProfile"
          component={EditProfileScreen}
        />
        <ChannelStackNavigator.Screen
          name="ChannelMembers"
          component={ChannelMembersScreen}
        />
        <ChannelStackNavigator.Screen
          name="ChannelMeta"
          component={ChannelMetaScreen}
        />
      </ChannelStackNavigator.Group>
    </ChannelStackNavigator.Navigator>
  );
}
