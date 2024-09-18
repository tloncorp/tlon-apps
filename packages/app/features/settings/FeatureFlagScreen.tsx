import { FeatureFlagScreenView } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import * as featureFlags from '../../lib/featureFlags';

export function FeatureFlagScreen({ onGoBack }: { onGoBack: () => void }) {
  const handleGoBackPressed = useCallback(() => {
    onGoBack();
  }, [onGoBack]);

  const { flags, setEnabled } = featureFlags.useFeatureFlagStore();

  const handleFeatureFlagToggled = useCallback(
    (name: string, enabled: boolean) => {
      console.log('set enabled', name, enabled);
      setEnabled(name as featureFlags.FeatureName, enabled);
    },
    [setEnabled]
  );

  const features = useMemo(
    () =>
      Object.entries(featureFlags.featureMeta).map(([name, meta]) => ({
        name,
        label: meta.label,
        enabled: flags[name as featureFlags.FeatureName],
      })),
    [flags]
  );

  return (
    <FeatureFlagScreenView
      features={features}
      onBackPressed={handleGoBackPressed}
      onFlagToggled={handleFeatureFlagToggled}
    />
  );
}
