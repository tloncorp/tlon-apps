import { FeatureFlagScreen } from '@tloncorp/app/features/settings/FeatureFlagScreen';
import { useNavigate } from 'react-router';

export function FeatureFlagScreenController() {
  const navigate = useNavigate();
  return <FeatureFlagScreen onGoBack={() => navigate(-1)} />;
}
