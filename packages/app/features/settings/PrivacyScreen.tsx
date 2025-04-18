import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useState } from 'react';
import { Alert, Switch } from 'react-native';

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
        {phoneAttest && (
          <XStack
            justifyContent="space-between"
            alignItems="center"
            padding="$l"
          >
            <SizableText flexShrink={1}>Discoverability</SizableText>
            <Switch
              style={{ flexShrink: 0 }}
              value={state.phoneDiscoverable}
              onValueChange={togglePhoneDiscoverable}
            ></Switch>
          </XStack>
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
    attest.discoverability === 'discoverable' ||
    attest.discoverability === 'public'
  );
}
