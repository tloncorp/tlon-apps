import ProfileScreen from '@tloncorp/app/features/settings/ProfileScreen';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

export function ProfileScreenController() {
  const navigate = useNavigate();
  const onManageAccountPressed = useCallback(() => {
    navigate('/settings/manage-account');
  }, [navigate]);

  const onAppInfoPressed = useCallback(() => {
    navigate('/settings/app-info');
  }, [navigate]);

  const onPushNotifPressed = useCallback(() => {
    navigate('/settings/push-notifications');
  }, [navigate]);

  const onBlockedUsersPressed = useCallback(() => {
    navigate('/settings/blocked-users');
  }, [navigate]);

  return (
    <ProfileScreen
      navigateToEditProfile={() => navigate('/profile/edit')}
      navigateToErrorReport={() => navigate('/bug-report')}
      navigateToContactProfile={(userId: string) =>
        navigate(`/profile/${userId}`)
      }
      navigateToHome={() => navigate('/')}
      navigateToNotifications={() => navigate('/activity')}
      navigateToProfileSettings={() => navigate('/profile')}
      navigateToManageAccount={onManageAccountPressed}
      navigateToAppInfo={onAppInfoPressed}
      navigateToNotificationSettings={onPushNotifPressed}
      navigateToBlockedUsers={onBlockedUsersPressed}
    />
  );
}
