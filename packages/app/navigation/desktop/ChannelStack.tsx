import type { NavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef } from 'react';

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

// Type for ChannelStack navigation - used for programmatic navigation
type ChannelStackNavigationProp = NavigationProp<{
  ChannelRoot: Record<string, unknown>;
  GroupSettings: undefined;
  ChannelSearch: undefined;
  Post: Record<string, unknown>;
  ImageViewer: undefined;
  UserProfile: undefined;
  EditProfile: undefined;
  ChannelMembers: undefined;
  ChannelMeta: undefined;
}>;

/**
 * Shared ChannelStack component used by both HomeNavigator and MessagesNavigator.
 * Handles navigation between different channel types (Channel, DM, GroupDM).
 */
export function ChannelStack(
  props: NativeStackScreenProps<HomeDrawerParamList, 'Channel'>
) {
  const navigation = useNavigation<ChannelStackNavigationProp>();

  // Extract channelId from route params - memoized for stable reference
  const channelId = useMemo(() => {
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
  }, [props.route.params]);

  // Extract the params to pass to ChannelRoot
  const channelParams = useMemo(() => {
    const params = props.route.params as Record<string, unknown> | undefined;
    if (
      params?.params &&
      typeof params.params === 'object' &&
      params.params !== null &&
      'channelId' in params.params
    ) {
      return params.params;
    }
    return props.route.params;
  }, [props.route.params]);

  const prevChannelIdRef = useRef(channelId);

  // When channelId changes, programmatically navigate to ChannelRoot with new params.
  // This fixes a bug where nested navigation params weren't propagating when
  // navigating between channels of the same type (e.g., DM to DM).
  useEffect(() => {
    if (channelId !== prevChannelIdRef.current && channelId !== 'none') {
      navigation.navigate(
        'ChannelRoot',
        channelParams as Record<string, unknown>
      );
      prevChannelIdRef.current = channelId;
    }
  }, [channelId, navigation, channelParams]);

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
