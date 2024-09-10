import { UserBugReportScreen } from '@tloncorp/app/features/settings/UserBugReportScreen';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

export function UserBugReportScreenController() {
  const navigate = useNavigate();
  const onGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return <UserBugReportScreen onGoBack={onGoBack} />;
}
