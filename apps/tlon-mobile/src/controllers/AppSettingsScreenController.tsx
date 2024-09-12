import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppSettingsScreen } from '@tloncorp/app/features/settings/AppSettingsScreen';
import { useCallback } from 'react';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AppSettings'>;

export function AppSettingsScreenController(props: Props) {
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
    <AppSettingsScreen
      onManageAccountPressed={onManageAccountPressed}
      onAppInfoPressed={onAppInfoPressed}
      onPushNotifPressed={onPushNotifPressed}
      onBlockedUsersPressed={onBlockedUsersPressed}
      onGoBack={() => props.navigation.goBack()}
    />
  );
}
