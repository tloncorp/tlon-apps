import { PushNotificationSettingsScreen } from '@tloncorp/app/features/settings/PushNotificationSettingsScreen';
import { useNavigate } from 'react-router';

export function PushNotificationSettingsScreenController() {
  const navigate = useNavigate();
  return <PushNotificationSettingsScreen onGoBack={() => navigate(-1)} />;
}
