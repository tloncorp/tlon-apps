import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GenericHeader, IconType, ListItem, View, YStack } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView } from 'react-native-gesture-handler';

import { RootStackParamList } from '../types';
import { getHostingToken, getHostingUserId } from '../utils/hosting';

type Props = NativeStackScreenProps<RootStackParamList, 'AppSettings'>;

export function AppSettingsScreen(props: Props) {
  const [hasHostedAuth, setHasHostedAuth] = useState(false);

  useEffect(() => {
    async function getHostingInfo() {
      const [cookie, userId] = await Promise.all([
        getHostingToken(),
        getHostingUserId(),
      ]);
      if (cookie && userId) {
        setHasHostedAuth(true);
      }
    }
    getHostingInfo();
  }, []);

  const onManageAccountPressed = useCallback(() => {
    props.navigation.navigate('ManageAccount');
  }, [props.navigation]);

  const onAppInfoPressed = useCallback(() => {
    props.navigation.navigate('AppInfo');
  }, [props.navigation]);

  const onPushNotifPressed = useCallback(() => {
    props.navigation.navigate('PushNotificationSettings');
  }, [props.navigation]);

  const onBlockedUsersPressed = useCallback(() => {
    props.navigation.navigate('BlockedUsers');
  }, [props.navigation]);

  return (
    <View flex={1}>
      <GenericHeader
        title="App Settings"
        goBack={() => props.navigation.goBack()}
      />
      <ScrollView>
        <YStack marginTop="$xl" marginHorizontal="$2xl" gap="$s">
          <AppInfoListItem
            title="App Info"
            icon="Settings"
            onPress={onAppInfoPressed}
          />
          <AppInfoListItem
            title="Push Notifications"
            icon="Notifications"
            onPress={onPushNotifPressed} // TODO
          />
          <AppInfoListItem
            title="Blocked Users"
            icon="Placeholder"
            onPress={onBlockedUsersPressed}
          />
          {hasHostedAuth && (
            <AppInfoListItem
              title="Manage Account"
              icon="Profile"
              onPress={onManageAccountPressed}
            />
          )}
        </YStack>
      </ScrollView>
    </View>
  );
}

function AppInfoListItem({
  onPress,
  title,
  icon,
}: {
  onPress: () => void;
  title: string;
  icon: IconType;
}) {
  return (
    <ListItem onPress={onPress}>
      <ListItem.SystemIcon icon={icon} rounded />
      <ListItem.MainContent>
        <ListItem.Title>{title}</ListItem.Title>
      </ListItem.MainContent>

      <ListItem.SystemIcon
        icon="ChevronRight"
        backgroundColor={'transparent'}
      />
    </ListItem>
  );
}
