import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationState } from '@react-navigation/routers';
import { isEqual } from 'lodash';
import { memo, useEffect } from 'react';
import { getVariableValue, useTheme } from 'tamagui';

import { ChannelMembersScreen } from '../../features/channels/ChannelMembersScreen';
import { ChannelMetaScreen } from '../../features/channels/ChannelMetaScreen';
import { EditProfileScreen } from '../../features/settings/EditProfileScreen';
import ChannelScreen from '../../features/top/ChannelScreen';
import ChannelSearchScreen from '../../features/top/ChannelSearchScreen';
import { ChatDetailsScreen } from '../../features/top/ChatDetailsScreen';
import { ChatVolumeScreen } from '../../features/top/ChatVolumeScreen';
import { HomeEmptyState } from '../../features/top/DesktopEmptyStates';
import { GroupChannelsScreenContent } from '../../features/top/GroupChannelsScreen';
import MediaViewerScreen from '../../features/top/MediaViewerScreen';
import { NotesDetailScreen } from '../../features/top/NotesDetailScreen';
import { NotesFolderScreen } from '../../features/top/NotesFolderScreen';
import PostScreen from '../../features/top/PostScreen';
import { UserProfileScreen } from '../../features/top/UserProfileScreen';
import { GroupSettingsStack } from '../../navigation/GroupSettingsStack';
import { DESKTOP_SIDEBAR_WIDTH, useGlobalSearch } from '../../ui';
import { NotebookSidebarProvider } from '../../ui/contexts/notebookSidebar';
import { getDesktopGroupInvitePreviewProps } from '../routeHelpers';
import { HomeDrawerParamList } from '../types';
import { mediaViewerScreenOptions } from '../utils';
import { HomeSidebar } from './HomeSidebar';

const HomeDrawer = createDrawerNavigator();

export const HomeNavigator = () => {
  const theme = useTheme();
  const { setLastOpenTab } = useGlobalSearch();
  const backgroundColor = getVariableValue(theme.background);
  const borderColor = getVariableValue(theme.border);

  useEffect(() => {
    setLastOpenTab('Home');
  }, [setLastOpenTab]);

  return (
    <NotebookSidebarProvider>
      <HomeDrawer.Navigator
        drawerContent={(props) => <DrawerContent {...props} />}
        initialRouteName="ChatList"
        screenOptions={() => {
          return {
            drawerType: 'permanent',
            headerShown: false,
            drawerStyle: {
              width: DESKTOP_SIDEBAR_WIDTH,
              backgroundColor,
              borderRightColor: borderColor,
            },
          };
        }}
      >
        <HomeDrawer.Screen name="ChatList" component={MainStack} />
        <HomeDrawer.Screen name="GroupChannels" component={Empty} />
        {/* @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships */}
        <HomeDrawer.Screen name="Channel" component={ChannelStack} />
        {/* @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships */}
        <HomeDrawer.Screen name="DM" component={ChannelStack} />
        {/* @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships */}
        <HomeDrawer.Screen name="GroupDM" component={ChannelStack} />
        {/* @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships */}
        <HomeDrawer.Screen name="ChatVolume" component={ChatVolumeScreen} />
        {/* @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships */}
        <HomeDrawer.Screen name="ChatDetails" component={ChatDetailsScreen} />
      </HomeDrawer.Navigator>
    </NotebookSidebarProvider>
  );
};

const DrawerContent = memo((props: DrawerContentComponentProps) => {
  const state = props.state as NavigationState<HomeDrawerParamList>;
  const focusedRoute = state.routes[props.state.index];
  const focusedRouteParams = focusedRoute.params;
  const groupInvitePreviewProps =
    getDesktopGroupInvitePreviewProps(focusedRouteParams);
  // @ts-expect-error - nested params is not in the type
  const nestedFocusedRouteParams = focusedRouteParams?.params;
  if (
    focusedRouteParams &&
    'groupId' in focusedRouteParams &&
    focusedRouteParams.groupId
  ) {
    if ('channelId' in focusedRouteParams) {
      return (
        <GroupChannelsScreenContent
          groupId={focusedRouteParams.groupId}
          focusedChannelId={focusedRouteParams.channelId}
        />
      );
    }
    return <GroupChannelsScreenContent groupId={focusedRouteParams.groupId} />;
  } else if (
    focusedRouteParams &&
    nestedFocusedRouteParams &&
    'groupId' in nestedFocusedRouteParams
  ) {
    if ('channelId' in nestedFocusedRouteParams) {
      return (
        <GroupChannelsScreenContent
          groupId={nestedFocusedRouteParams.groupId}
          focusedChannelId={nestedFocusedRouteParams.channelId}
        />
      );
    }
    return (
      <GroupChannelsScreenContent groupId={nestedFocusedRouteParams.groupId} />
    );
  } else if (
    focusedRouteParams &&
    focusedRoute.name === 'ChatDetails' &&
    'chatId' in focusedRouteParams &&
    'chatType' in focusedRouteParams
  ) {
    if (focusedRouteParams.chatType === 'channel') {
      // If groupId is provided, show the group's channel list in the sidebar
      if ('groupId' in focusedRouteParams && focusedRouteParams.groupId) {
        return (
          <GroupChannelsScreenContent
            groupId={focusedRouteParams.groupId as string}
            focusedChannelId={focusedRouteParams.chatId as string}
          />
        );
      }
      return (
        <HomeSidebar focusedChannelId={focusedRouteParams.chatId as string} />
      );
    } else if (focusedRouteParams.chatType === 'group') {
      return <GroupChannelsScreenContent groupId={focusedRouteParams.chatId} />;
    }
  } else if (focusedRoute.params && 'channelId' in focusedRoute.params) {
    return <HomeSidebar focusedChannelId={focusedRoute.params.channelId} />;
  } else if (groupInvitePreviewProps) {
    return <HomeSidebar {...groupInvitePreviewProps} />;
  } else {
    return <HomeSidebar />;
  }
}, isEqual);

DrawerContent.displayName = 'HomeSidebarDrawerContent';

const MainStackNavigator = createNativeStackNavigator();

function MainStack() {
  return (
    <MainStackNavigator.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="Home"
    >
      <MainStackNavigator.Screen name="Home" component={Empty} />
    </MainStackNavigator.Navigator>
  );
}

const ChannelStackNavigator = createNativeStackNavigator();

function ChannelStack(
  props: NativeStackScreenProps<HomeDrawerParamList, 'Channel'>
) {
  const navKey = () => {
    let channelId = 'none';
    let selectedPostId = '';
    const params = props.route.params;
    if (params && 'channelId' in params) {
      channelId = String(params.channelId ?? 'none');
      if ('selectedPostId' in params && params.selectedPostId) {
        selectedPostId = String(params.selectedPostId);
      }
    } else if (params?.params && 'channelId' in params.params) {
      channelId = String(params.params.channelId ?? 'none');
      if ('selectedPostId' in params.params && params.params.selectedPostId) {
        selectedPostId = String(params.params.selectedPostId);
      }
    }
    return selectedPostId ? `${channelId}:${selectedPostId}` : channelId;
  };

  return (
    <ChannelStackNavigator.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="ChannelRoot"
    >
      <ChannelStackNavigator.Group navigationKey={navKey()}>
        <ChannelStackNavigator.Screen
          // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
          name="ChannelRoot"
          // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
          component={ChannelScreen}
          initialParams={props.route.params}
        />
        <ChannelStackNavigator.Screen
          name="GroupSettings"
          component={GroupSettingsStack}
        />
        <ChannelStackNavigator.Screen
          name="ChannelSearch"
          // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
          component={ChannelSearchScreen}
        />
        <ChannelStackNavigator.Screen
          name="Post"
          // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
          component={PostScreen}
          initialParams={props.route.params}
        />
        <ChannelStackNavigator.Screen
          name="NotesDetail"
          // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
          component={NotesDetailScreen}
          initialParams={props.route.params}
        />
        <ChannelStackNavigator.Screen
          name="NotesFolder"
          // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
          component={NotesFolderScreen}
          initialParams={props.route.params}
        />
        <ChannelStackNavigator.Screen
          name="MediaViewer"
          // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
          component={MediaViewerScreen}
          options={mediaViewerScreenOptions}
        />
        <ChannelStackNavigator.Screen
          name="UserProfile"
          // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
          component={UserProfileScreen}
        />
        <ChannelStackNavigator.Screen
          name="EditProfile"
          // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
          component={EditProfileScreen}
        />
        <ChannelStackNavigator.Screen
          name="ChannelMembers"
          // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
          component={ChannelMembersScreen}
        />
        <ChannelStackNavigator.Screen
          name="ChannelMeta"
          // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
          component={ChannelMetaScreen}
        />
      </ChannelStackNavigator.Group>
    </ChannelStackNavigator.Navigator>
  );
}

function Empty() {
  return <HomeEmptyState />;
}
