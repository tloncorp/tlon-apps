import { EditProfileScreen } from '@tloncorp/app/features/settings/EditProfileScreen';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

export function EditProfileScreenController() {
  const navigate = useNavigate();
  const onGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return <EditProfileScreen onGoBack={onGoBack} />;
}
