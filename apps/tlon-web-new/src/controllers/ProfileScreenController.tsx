import ProfileScreen from '@tloncorp/app/features/settings/ProfileScreen';
import { useNavigate } from 'react-router';

export function ProfileScreenController() {
  const navigate = useNavigate();

  return (
    <ProfileScreen
      navigateToAppSettings={() => navigate('/settings')}
      navigateToEditProfile={() => navigate('/profile/edit')}
      navigateToErrorReport={() => navigate('/bug-report')}
      navigateToProfile={(userId: string) => navigate(`/profile/${userId}`)}
      navigateToHome={() => navigate('/')}
      navigateToNotifications={() => navigate('/activity')}
      navigateToSettings={() => navigate('/profile')}
    />
  );
}
