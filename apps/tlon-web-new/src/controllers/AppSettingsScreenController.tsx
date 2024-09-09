import { AppSettingsScreen } from '@tloncorp/app/features/settings/AppSettingsScreen';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

export function AppSettingsScreenController() {
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
    <AppSettingsScreen
      onManageAccountPressed={onManageAccountPressed}
      onAppInfoPressed={onAppInfoPressed}
      onPushNotifPressed={onPushNotifPressed}
      onBlockedUsersPressed={onBlockedUsersPressed}
      onGoBack={() => navigate(-1)}
    />
  );
}
