import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { Switch } from 'react-native';
import { YStack } from 'tamagui';

import { useTelemetry } from '../../hooks/useTelemetry';
import { RootStackParamList } from '../../navigation/types';
import {
  ScreenHeader,
  SizableText,
  View,
  XStack,
  triggerHaptic,
  useStore,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacySettings'>;

interface PrivacyState {
  telemetryDisabled: boolean;
  phoneDiscoverable: boolean;
}

export function PrivacySettingsScreen(props: Props) {
  const store = useStore();
  const phoneAttest = store.useCurrentUserPhoneAttestation();
  const telemetry = useTelemetry();

  const [state, setState] = useState<PrivacyState>({
    phoneDiscoverable: parsePhoneDiscoverability(phoneAttest),
    telemetryDisabled: telemetry.getIsOptedOut(),
  });

  const togglePhoneDiscoverable = useCallback(async () => {
    if (!phoneAttest) {
      return;
    }
    const nextDiscoveryState = !state.phoneDiscoverable;
    const nextDiscoveryValue: db.AttestationDiscoverability = nextDiscoveryState
      ? 'verified'
      : 'hidden';
    setState((prev) => ({ ...prev, phoneDiscoverable: nextDiscoveryState }));
    try {
      await store.updateAttestationDiscoverability({
        attestation: phoneAttest,
        discoverability: nextDiscoveryValue,
      });
    } catch (e) {
      triggerHaptic('error');
      setState((prev) => ({ ...prev, phoneDiscoverable: !nextDiscoveryState }));
    }
  }, [phoneAttest, state.phoneDiscoverable, store]);

  const toggleSetTelemetry = useCallback(() => {
    const nextDisabledState = !state.telemetryDisabled;
    setState((prev) => ({ ...prev, telemetryDisabled: nextDisabledState }));
    telemetry.setDisabled(nextDisabledState);
  }, [state.telemetryDisabled, telemetry]);

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader
        backAction={() => props.navigation.goBack()}
        title="Privacy Settings"
      />
      <View
        flex={1}
        width="100%"
        maxWidth={600}
        marginHorizontal="auto"
        paddingHorizontal="$xl"
      >
        <YStack paddingHorizontal="$l" paddingTop="$2xl" gap="$xl">
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText flexShrink={1}>Share Usage Statistics</SizableText>
            <Switch
              style={{ flexShrink: 0 }}
              value={!state.telemetryDisabled}
              onValueChange={toggleSetTelemetry}
            ></Switch>
          </XStack>
          <Text size="$label/s" color="$secondaryText">
            By sharing, you help us improve the app for everyone.
          </Text>
        </YStack>
        {phoneAttest && (
          <YStack paddingHorizontal="$l" paddingTop="$2xl" gap="$xl">
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText flexShrink={1}>Phone number discovery</SizableText>
              <Switch
                style={{ flexShrink: 0 }}
                value={state.phoneDiscoverable}
                onValueChange={togglePhoneDiscoverable}
              ></Switch>
            </XStack>
            <Text size="$label/s" color="$secondaryText">
              If enabled, friends who already have your phone number will be
              able to find you on Tlon.
            </Text>
          </YStack>
        )}
      </View>
    </View>
  );
}

function parsePhoneDiscoverability(attest: db.Attestation | null): boolean {
  if (!attest) {
    return false;
  }

  return (
    attest.discoverability === 'verified' || attest.discoverability === 'public'
  );
}
