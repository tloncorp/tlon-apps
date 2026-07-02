import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';

import * as featureFlags from '../../lib/featureFlags';
import type { RootStackParamList } from '../../navigation/types';
import { FeatureFlagScreenView } from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'FeatureFlags'>;

// The context lens toggle lives in the synced settings store (so it persists
// across devices) rather than the client-local feature flag store, but it is
// still surfaced alongside the experimental flags here.
const CONTEXT_LENS_FLAG = 'contextLens';
const CONTEXT_LENS_LABEL = 'Enable bot context lens panel';

export function FeatureFlagScreen({ navigation }: Props) {
  const handleGoBackPressed = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const { flags, setEnabled } = featureFlags.useFeatureFlagStore();
  const { data: contextLensEnabled = false } = store.useContextLensEnabled();

  const handleFeatureFlagToggled = useCallback(
    (name: string, enabled: boolean) => {
      if (name === CONTEXT_LENS_FLAG) {
        store.updateContextLensEnabled(enabled);
        return;
      }
      setEnabled(name as featureFlags.FeatureName, enabled);
    },
    [setEnabled]
  );

  const contextLensGatewayUrl = db.contextLensGatewayUrl.useValue();
  const contextLensGatewayToken = db.contextLensGatewayToken.useValue();
  const textSettings = useMemo(() => {
    if (!contextLensEnabled) {
      return undefined;
    }
    return [
      {
        key: 'contextLensGatewayUrl',
        label: 'Context lens gateway URL',
        value: contextLensGatewayUrl ?? '',
        placeholder: 'http://localhost:18789',
        onChange: (value: string) =>
          db.contextLensGatewayUrl.setValue(value.trim() || null),
      },
      {
        key: 'contextLensGatewayToken',
        label: 'Context lens gateway token',
        value: contextLensGatewayToken ?? '',
        secure: true,
        onChange: (value: string) =>
          db.contextLensGatewayToken.setValue(value.trim() || null),
      },
    ];
  }, [contextLensEnabled, contextLensGatewayUrl, contextLensGatewayToken]);

  const isTlonEmployee = db.isTlonEmployee.useValue();
  const features = useMemo(
    () => [
      ...Object.entries(featureFlags.featureMeta)
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
      {
        name: CONTEXT_LENS_FLAG,
        label: CONTEXT_LENS_LABEL,
        enabled: contextLensEnabled,
      },
    ],
    [flags, isTlonEmployee, contextLensEnabled]
  );

  return (
    <FeatureFlagScreenView
      features={features}
      textSettings={textSettings}
      onBackPressed={handleGoBackPressed}
      onFlagToggled={handleFeatureFlagToggled}
    />
  );
}
