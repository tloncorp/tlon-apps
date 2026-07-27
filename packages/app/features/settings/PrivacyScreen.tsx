import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Text, useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
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
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacySettings'>;

interface PrivacyState {
  telemetryDisabled: boolean;
  phoneDiscoverable: boolean;
  disableNicknames: boolean;
  disableAvatars: boolean;
  disableTlonInfraEnhancement: boolean;
}

export function PrivacySettingsScreen(props: Props) {
  const phoneAttest = store.useCurrentUserPhoneAttestation();
  const telemetry = useTelemetry();
  const { data: settings } = store.useSettings();

  const [state, setState] = useState<PrivacyState>({
    phoneDiscoverable: parsePhoneDiscoverability(phoneAttest),
    telemetryDisabled: !(settings?.enableTelemetry ?? false),
    disableNicknames: settings?.disableNicknames ?? false,
    disableAvatars: settings?.disableAvatars ?? false,
    disableTlonInfraEnhancement: settings?.disableTlonInfraEnhancement ?? false,
  });

  // Update state when settings change
  useEffect(() => {
    if (settings) {
      setState((prev) => ({
        ...prev,
        disableNicknames: settings.disableNicknames ?? false,
        disableAvatars: settings.disableAvatars ?? false,
        disableTlonInfraEnhancement:
          settings.disableTlonInfraEnhancement ?? false,
        telemetryDisabled: !(settings.enableTelemetry ?? false),
      }));
    }
  }, [settings]);

  useEffect(() => {
    if (phoneAttest) {
      setState((prev) => ({
        ...prev,
        phoneDiscoverable: parsePhoneDiscoverability(phoneAttest),
      }));
    }
  }, [phoneAttest]);

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
      const didUpdate = await store.updateAttestationDiscoverability({
        attestation: phoneAttest,
        discoverability: nextDiscoveryValue,
      });
      if (!didUpdate) {
        triggerHaptic('error');
        setState((prev) => ({
          ...prev,
          phoneDiscoverable: !nextDiscoveryState,
        }));
        return;
      }
      trackEvent(AnalyticsEvent.PrivacyPreferenceChanged, {
        enabled: nextDiscoveryState,
        setting: 'phone_discovery',
      });
    } catch (e) {
      triggerHaptic('error');
      setState((prev) => ({ ...prev, phoneDiscoverable: !nextDiscoveryState }));
    }
  }, [phoneAttest, state.phoneDiscoverable]);

  const toggleSetTelemetry = useCallback(async () => {
    const nextDisabledState = !state.telemetryDisabled;
    setState((prev) => ({ ...prev, telemetryDisabled: nextDisabledState }));

    const didUpdate = await store.updateEnableTelemetry(!nextDisabledState);
    if (!didUpdate) {
      triggerHaptic('error');
      setState((prev) => ({
        ...prev,
        telemetryDisabled: !nextDisabledState,
      }));
      return;
    }

    // Ensure capture is enabled before recording the preference change.
    if (!nextDisabledState) {
      await telemetry.setDisabled(false, false);
    } else {
      // The optimistic setting observer may already have opted PostHog out.
      // Re-enable it for this explicit change, then restore the opt-out below.
      telemetry.optIn();
    }
    trackEvent(AnalyticsEvent.PrivacyPreferenceChanged, {
      enabled: !nextDisabledState,
      setting: 'usage_statistics',
    });
    if (nextDisabledState) {
      await telemetry.setDisabled(true, false);
    }
  }, [state.telemetryDisabled, telemetry]);

  const toggleDisableNicknames = useCallback(async () => {
    const nextValue = !state.disableNicknames;
    setState((prev) => ({ ...prev, disableNicknames: nextValue }));
    try {
      await store.updateCalmSetting('disableNicknames', nextValue);
      trackEvent(AnalyticsEvent.PrivacyPreferenceChanged, {
        enabled: !nextValue,
        setting: 'nicknames',
      });
    } catch (e) {
      triggerHaptic('error');
      setState((prev) => ({ ...prev, disableNicknames: !nextValue }));
    }
  }, [state.disableNicknames]);

  const toggleDisableAvatars = useCallback(async () => {
    const nextValue = !state.disableAvatars;
    setState((prev) => ({ ...prev, disableAvatars: nextValue }));
    try {
      await store.updateCalmSetting('disableAvatars', nextValue);
      trackEvent(AnalyticsEvent.PrivacyPreferenceChanged, {
        enabled: !nextValue,
        setting: 'avatars',
      });
    } catch (e) {
      triggerHaptic('error');
      setState((prev) => ({ ...prev, disableAvatars: !nextValue }));
    }
  }, [state.disableAvatars]);

  const toggleDisableTlonInfraEnhancement = useCallback(async () => {
    const nextValue = !state.disableTlonInfraEnhancement;
    setState((prev) => ({ ...prev, disableTlonInfraEnhancement: nextValue }));
    try {
      await store.updateDisableTlonInfraEnhancement(nextValue);
      trackEvent(AnalyticsEvent.PrivacyPreferenceChanged, {
        enabled: !nextValue,
        setting: 'tlon_helpers',
      });
    } catch (e) {
      triggerHaptic('error');
      setState((prev) => ({
        ...prev,
        disableTlonInfraEnhancement: !nextValue,
      }));
    }
  }, [state.disableTlonInfraEnhancement]);

  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader
        borderBottom
        backAction={
          isWindowNarrow ? () => props.navigation.goBack() : undefined
        }
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

        <YStack paddingHorizontal="$l" paddingTop="$2xl" gap="$xl">
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText flexShrink={1}>Disable Tlon helpers</SizableText>
            <Switch
              style={{ flexShrink: 0 }}
              value={state.disableTlonInfraEnhancement}
              onValueChange={toggleDisableTlonInfraEnhancement}
            ></Switch>
          </XStack>
          <Text size="$label/s" color="$secondaryText">
            Your ship will always attempt to generate rich link previews
            locally. If disabled, the app will avoid making backup requests to
            Tlon's service if local generation fails.
          </Text>
        </YStack>

        <YStack paddingHorizontal="$l" paddingTop="$2xl" gap="$xl">
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText flexShrink={1}>Hide Nicknames</SizableText>
            <Switch
              style={{ flexShrink: 0 }}
              value={state.disableNicknames}
              onValueChange={toggleDisableNicknames}
            ></Switch>
          </XStack>
          <Text size="$label/s" color="$secondaryText">
            If enabled, real ship names will be displayed instead of nicknames.
          </Text>
        </YStack>

        <YStack paddingHorizontal="$l" paddingTop="$2xl" gap="$xl">
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText flexShrink={1}>Hide Avatars</SizableText>
            <Switch
              style={{ flexShrink: 0 }}
              value={state.disableAvatars}
              onValueChange={toggleDisableAvatars}
            ></Switch>
          </XStack>
          <Text size="$label/s" color="$secondaryText">
            If enabled, avatar images will be hidden throughout the app.
          </Text>
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
    attest.discoverability === 'verified' || attest.discoverability === 'public'
  );
}
