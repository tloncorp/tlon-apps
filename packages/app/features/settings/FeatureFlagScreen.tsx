import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import { useCallback, useMemo } from 'react';

import * as featureFlags from '../../lib/featureFlags';
import type { RootStackParamList } from '../../navigation/types';
import { FeatureFlagScreenView } from '../../ui';

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

  const isTlonEmployee = db.isTlonEmployee.useValue();
  const features = useMemo(
    () =>
      Object.entries(featureFlags.featureMeta)
        .filter(([_name, meta]) => {
          if (meta.onlyTlon) {
            return isTlonEmployee;
          }
          return true;
        })
        .map(([name, meta]) => ({
          name,
          label: meta.label,
          enabled: flags[name as featureFlags.FeatureName],
        })),
    [flags, isTlonEmployee]
  );

  return (
    <FeatureFlagScreenView
      features={features}
      onBackPressed={handleGoBackPressed}
      onFlagToggled={handleFeatureFlagToggled}
    />
  );
}
