import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Text } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { Alert, Switch } from 'react-native';
import { YStack } from 'tamagui';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { RootStackParamList } from '../../navigation/types';
import {
  BlockedContactsWidget,
  ScreenHeader,
  SizableText,
  View,
  XStack,
  triggerHaptic,
  useStore,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacySettings'>;

interface PrivacyState {
  phoneDiscoverable: boolean;
}

export function PrivacySettingsScreen(props: Props) {
  const store = useStore();
  const phoneAttest = store.useCurrentUserPhoneAttestation();

  const [state, setState] = useState<PrivacyState>({
    phoneDiscoverable: parsePhoneDiscoverability(phoneAttest),
  });

  const togglePhoneDiscoverable = useCallback(async () => {
    if (!phoneAttest) {
      return;
    }
    const nextDiscoveryState = !state.phoneDiscoverable;
    const nextDiscoveryValue: db.AttestationDiscoverability = nextDiscoveryState
      ? 'discoverable'
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
          <Text size="$label/l" color="$secondaryText">
            Phone Number
          </Text>
          {phoneAttest ? (
            <YStack gap="$l">
              <XStack justifyContent="space-between" alignItems="center">
                <SizableText flexShrink={1}>Allow phone discovery</SizableText>
                <Switch
                  style={{ flexShrink: 0 }}
                  value={state.phoneDiscoverable}
                  onValueChange={togglePhoneDiscoverable}
                ></Switch>
              </XStack>
              <Text size="$label/s" color="$secondaryText">
                If enabled, others who already have your phone number will be
                able to find you on Tlon.
              </Text>
            </YStack>
          ) : (
            <Text textAlign="center">
              No phone number associated with your account.
            </Text>
          )}
        </YStack>
      </View>
    </View>
  );
}

function parsePhoneDiscoverability(attest: db.Attestation | null): boolean {
  if (!attest) {
    return false;
  }

  return (
    attest.discoverability === 'discoverable' ||
    attest.discoverability === 'public'
  );
}
