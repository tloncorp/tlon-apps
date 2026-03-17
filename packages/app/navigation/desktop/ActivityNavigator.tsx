import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import { useIsFocused } from '@react-navigation/native';
import { getVariableValue, useTheme } from '@tamagui/core';
import type { Channel, Post, Group } from '@tloncorp/shared/db';
import { useInfiniteBucketedActivity, resetActivity, markGroupRead } from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';

import { EditProfileScreen } from '../../features/settings/EditProfileScreen';
import { ActivityEmptyState } from '../../features/top/DesktopEmptyStates';
import { UserProfileScreen } from '../../features/top/UserProfileScreen';
import { useGroupActions } from '../../hooks/useGroupActions';
import { GroupSettingsStack } from '../../navigation/GroupSettingsStack';
import { ActivityScreenView, DESKTOP_SIDEBAR_WIDTH } from '../../ui';
import { useRootNavigation } from '../utils';

const ActivityDrawer = createDrawerNavigator();

function DrawerContent(props: DrawerContentComponentProps) {
  const isFocused = useIsFocused();
  const { performGroupAction } = useGroupActions();
  const { navigateToChannel, navigateToPost } = useRootNavigation();

  const allFetcher = useInfiniteBucketedActivity('all');
  const mentionsFetcher = useInfiniteBucketedActivity('mentions');
  const repliesFetcher = useInfiniteBucketedActivity('replies');
  const bucketedActivity = useMemo(() => {
    return {
      all: allFetcher,
      replies: repliesFetcher,
      mentions: mentionsFetcher,
    };
  }, [allFetcher, mentionsFetcher, repliesFetcher]);

  const handleRefreshActivity = useCallback(async () => {
    return resetActivity();
  }, []);

  const handleGoToChannel = useCallback(
    (channel: Channel, selectedPostId?: string) => {
      navigateToChannel(channel, selectedPostId);
    },
    [navigateToChannel]
  );

  // TODO: if diary or gallery, figure out a way to pop open the comment
  // sheet
  const handleGoToThread = useCallback(
    (post: Post) => {
      // TODO: we have no way to route to specific thread message rn
      navigateToPost(post);
    },
    [navigateToPost]
  );

  const handleGoToGroup = useCallback(
    (group: Group) => {
      markGroupRead(group.id);
      props.navigation.navigate('GroupSettings', {
        screen: 'GroupMembers',
        params: { groupId: group.id },
      });
    },
    [props.navigation]
  );

  const handleGoToUserProfile = useCallback(
    (userId: string) => {
      props.navigation.navigate('UserProfile', { userId });
    },
    [props.navigation]
  );

  const handleInviteFriends = useCallback(() => {
    props.navigation.navigate('InviteSystemContacts' as any);
  }, [props.navigation]);

  return (
    <ActivityScreenView
      bucketFetchers={bucketedActivity}
      isFocused={isFocused}
      goToChannel={handleGoToChannel}
      goToThread={handleGoToThread}
      goToGroup={handleGoToGroup}
      goToUserProfile={handleGoToUserProfile}
      refresh={handleRefreshActivity}
      onGroupAction={performGroupAction}
      onInviteFriends={handleInviteFriends}
    />
  );
}

export const ActivityNavigator = () => {
  return (
    <ActivityDrawer.Navigator
      initialRouteName="ActivityEmpty"
      drawerContent={DrawerContent}
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        drawerType: 'permanent',
        drawerStyle: {
          width: DESKTOP_SIDEBAR_WIDTH,
          backgroundColor: getVariableValue(useTheme().background),
          borderRightColor: getVariableValue(useTheme().border),
        },
      }}
    >
      <ActivityDrawer.Screen
        name="ActivityEmpty"
        component={EmptyActivityScreen}
      />
      <ActivityDrawer.Screen
        name="GroupSettings"
        component={GroupSettingsStack}
      />
      <ActivityDrawer.Screen name="UserProfile" component={UserProfileScreen} />
      <ActivityDrawer.Screen name="EditProfile" component={EditProfileScreen} />
    </ActivityDrawer.Navigator>
  );
};

function EmptyActivityScreen() {
  return <ActivityEmptyState />;
}
