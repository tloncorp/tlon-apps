import { NativeStackScreenProps } from '@react-navigation/native-stack';
import ProfileScreen from '@tloncorp/app/features/settings/ProfileScreen';
import { useHandleLogout } from '@tloncorp/app/hooks/useHandleLogout';
import { resetDb } from '@tloncorp/app/lib/nativeDb';
import { useCallback } from 'react';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreenController(props: Props) {
  const handleLogout = useHandleLogout({ resetDb });

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
    <ProfileScreen
      navigateToEditProfile={() => props.navigation.navigate('EditProfile')}
      navigateToErrorReport={() => props.navigation.navigate('WompWomp')}
      navigateToContactProfile={(userId: string) =>
        props.navigation.navigate('UserProfile', { userId })
      }
      navigateToProfileSettings={() => {
        console.log('profile');
        props.navigation.navigate('Profile');
      }}
      navigateToHome={() => props.navigation.navigate('ChatList')}
      navigateToNotifications={() => props.navigation.navigate('Activity')}
      navigateToManageAccount={onManageAccountPressed}
      navigateToAppInfo={onAppInfoPressed}
      navigateToNotificationSettings={onPushNotifPressed}
      navigateToBlockedUsers={onBlockedUsersPressed}
      handleLogout={handleLogout}
    />
  );
}
