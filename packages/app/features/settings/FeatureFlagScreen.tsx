import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FeatureFlagScreenView } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import * as featureFlags from '../../lib/featureFlags';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FeatureFlags'>;

export function FeatureFlagScreen({ navigation }: Props) {
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
