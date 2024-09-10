import { NativeStackScreenProps } from '@react-navigation/native-stack';
import ProfileScreen from '@tloncorp/app/features/settings/ProfileScreen';
import { useHandleLogout } from '@tloncorp/app/hooks/useHandleLogout';
import { resetDb } from '@tloncorp/app/lib/nativeDb';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreenController(props: Props) {
  const handleLogout = useHandleLogout({ resetDb });

  return (
    <ProfileScreen
      navigateToAppSettings={() => props.navigation.navigate('AppSettings')}
      navigateToEditProfile={() => props.navigation.navigate('EditProfile')}
      navigateToErrorReport={() => props.navigation.navigate('WompWomp')}
      navigateToProfile={(userId: string) =>
        props.navigation.navigate('UserProfile', { userId })
      }
      navigateToHome={() => props.navigation.navigate('ChatList')}
      navigateToNotifications={() => props.navigation.navigate('Activity')}
      navigateToSettings={() => props.navigation.navigate('Profile')}
      handleLogout={handleLogout}
    />
  );
}
