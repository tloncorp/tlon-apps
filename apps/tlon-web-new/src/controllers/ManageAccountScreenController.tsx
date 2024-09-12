import { ManageAccountScreen } from '@tloncorp/app/features/settings/ManageAccountScreen';
import { useNavigate } from 'react-router';

import { resetDb } from '@/lib/webDb';

export function ManageAccountScreenController() {
  const navigate = useNavigate();

  return (
    <ManageAccountScreen resetDb={resetDb} onGoBack={() => navigate(-1)} />
  );
}
