import { AppInfoScreen } from '@tloncorp/app/features/settings/AppInfoScreen';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

export function AppInfoScreenController() {
  const navigate = useNavigate();
  const onPressPreviewFeatures = useCallback(() => {
    navigate('/settings/feature-flags');
  }, [navigate]);

  return (
    <AppInfoScreen
      onPressPreviewFeatures={onPressPreviewFeatures}
      onGoBack={() => navigate(-1)}
    />
  );
}
