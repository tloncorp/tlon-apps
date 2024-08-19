import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as featureFlags from '@tloncorp/app/lib/featureFlags';
import { FeatureFlagScreenView } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import type { RootStackParamList } from '../types';

type FeatureFlagScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'FeatureFlags'
>;

export function FeatureFlagScreen({ navigation }: FeatureFlagScreenProps) {
  const handleGoBackPressed = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

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
