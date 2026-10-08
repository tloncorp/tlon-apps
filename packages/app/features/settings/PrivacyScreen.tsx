import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTelemetry } from '../../hooks/useTelemetry';
import { RootStackParamList } from '../../navigation/types';
import { triggerHaptic } from '../../ui';
import {
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';

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

  // Each setting is its own group, its explanation beneath it, the way
  // platform settings present standalone switches.
  const sections = useMemo<SettingsSectionModel[]>(() => {
    const toggleSection = (
      key: string,
      title: string,
      value: boolean,
      onValueChange: () => void,
      footer: string
    ): SettingsSectionModel => ({
      key,
      footer,
      rows: [{ key, title, toggle: { value, onValueChange } }],
    });

    return [
      toggleSection(
        'telemetry',
        'Share Usage Statistics',
        !state.telemetryDisabled,
        toggleSetTelemetry,
        'By sharing, you help us improve the app for everyone.'
      ),
      ...(phoneAttest
        ? [
            toggleSection(
              'phone-discovery',
              'Phone number discovery',
              state.phoneDiscoverable,
              togglePhoneDiscoverable,
              'If enabled, friends who already have your phone number will be able to find you on Tlon.'
            ),
          ]
        : []),
      toggleSection(
        'tlon-helpers',
        'Disable Tlon helpers',
        state.disableTlonInfraEnhancement,
        toggleDisableTlonInfraEnhancement,
        "Your ship will always attempt to generate rich link previews locally. If disabled, the app will avoid making backup requests to Tlon's service if local generation fails."
      ),
      toggleSection(
        'nicknames',
        'Hide Nicknames',
        state.disableNicknames,
        toggleDisableNicknames,
        'If enabled, real ship names will be displayed instead of nicknames.'
      ),
      toggleSection(
        'avatars',
        'Hide Avatars',
        state.disableAvatars,
        toggleDisableAvatars,
        'If enabled, avatar images will be hidden throughout the app.'
      ),
    ];
  }, [
    phoneAttest,
    state,
    toggleDisableAvatars,
    toggleDisableNicknames,
    toggleDisableTlonInfraEnhancement,
    togglePhoneDiscoverable,
    toggleSetTelemetry,
  ]);

  return (
    <SettingsListScreenView
      title="Privacy Settings"
      sections={sections}
      onBackPressed={() => props.navigation.goBack()}
    />
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
