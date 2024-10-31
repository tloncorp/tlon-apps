import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import { StackActions, useNavigation } from '@react-navigation/native';
import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { useCallback, useState } from 'react';

import { RootStack } from '../RootStack';
import { ChannelListDrawerContent } from './ChannelListDrawerContent';
import { ChatListDrawerContent } from './ChatListDrawerContent';

const HomeDrawer = createDrawerNavigator();

export const HomeNavigator = () => {
  const [selectedGroup, setSelectedGroup] = useState<db.Group | null>(null);
  const [navGroupId, setNavGroupId] = useState<string | null>(null);
  const navigation = useNavigation();

  const handleChatItemPress = useCallback(
    (item: db.Group | db.Channel) => {
      if (logic.isGroup(item)) {
        // this is only used for handling group invite previews
        setSelectedGroup(item);
      } else if (
        item.group &&
        item.groupId &&
        // Should navigate to channel if it's pinned as a channel
        (!item.pin || item.pin.type === 'group')
      ) {
        setNavGroupId(item.groupId);
      } else {
        navigation.dispatch(
          StackActions.replace('Channel', {
            channel: item,
            selectedPostId: item.firstUnreadPostId,
          })
        );
      }
    },
    [navigation]
  );

  const DrawerContent = useCallback(
    (props: DrawerContentComponentProps) => {
      if (navGroupId) {
        return (
          <ChannelListDrawerContent
            {...props}
            groupId={navGroupId}
            onChannelPress={handleChatItemPress}
            onBack={() => setNavGroupId(null)}
          />
        );
      }
      return (
        <ChatListDrawerContent
          {...props}
          selectedGroup={selectedGroup}
          setSelectedGroup={setSelectedGroup}
          onPressItem={handleChatItemPress}
        />
      );
    },
    [navGroupId, handleChatItemPress, selectedGroup]
  );

  return (
    <HomeDrawer.Navigator
      drawerContent={DrawerContent}
      screenOptions={{
        drawerType: 'permanent',
        headerShown: false,
      }}
    >
      <HomeDrawer.Screen name="MainContent" component={RootStack} />
    </HomeDrawer.Navigator>
  );
};
