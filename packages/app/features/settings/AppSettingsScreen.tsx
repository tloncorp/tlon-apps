import { GenericHeader, IconType, ListItem, View, YStack } from '@tloncorp/ui';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native-gesture-handler';

import { getHostingToken, getHostingUserId } from '../../utils/hosting';

export function AppSettingsScreen({
  onManageAccountPressed,
  onAppInfoPressed,
  onPushNotifPressed,
  onBlockedUsersPressed,
  onGoBack,
}: {
  onManageAccountPressed: () => void;
  onAppInfoPressed: () => void;
  onPushNotifPressed: () => void;
  onBlockedUsersPressed: () => void;
  onGoBack: () => void;
}) {
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

  return (
    <View flex={1}>
      <GenericHeader title="App Settings" goBack={onGoBack} />
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
