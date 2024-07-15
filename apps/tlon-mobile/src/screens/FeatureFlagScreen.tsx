import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FeatureFlagScreenView } from '@tloncorp/ui';
import { useCallback, useState } from 'react';

import * as featureFlags from '../lib/featureFlags';
import type { RootStackParamList } from '../types';

type FeatureFlagScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'FeatureFlags'
>;

const getFlagState = () => {
  return Object.entries(featureFlags.featureMeta).map(([name, meta]) => {
    return {
      name,
      label: meta.label,
      enabled: featureFlags.isEnabled(name as featureFlags.FeatureName),
    };
  });
};

export function FeatureFlagScreen({
  route,
  navigation,
}: FeatureFlagScreenProps) {
  const handleGoBackPressed = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const [flagState, setFlagState] = useState(() => getFlagState());

  const handleFeatureFlagToggled = useCallback(
    (name: string, enabled: boolean) => {
      console.log('set enabled', name, enabled);
      featureFlags.setEnabled(name as featureFlags.FeatureName, enabled);
      console.log('next flags', getFlagState());
      setFlagState(getFlagState());
    },
    []
  );

  return (
    <FeatureFlagScreenView
      features={flagState}
      onBackPressed={handleGoBackPressed}
      onFlagToggled={handleFeatureFlagToggled}
    />
  );
}
