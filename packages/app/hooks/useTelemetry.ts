import {
  AnalyticsEvent,
  useCurrentSession,
  useLogActivity,
} from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import {
  didInitializeTelemetry,
  hasClearedLegacyWebTelemetry,
  lastAnonymousAppOpenAt,
} from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect } from 'react';
import { isWeb } from 'tamagui';

import { TelemetryClient } from '../types/telemetry';
import { useCurrentUserId } from './useCurrentUser';
import { usePosthog } from './usePosthog';

export function useClearTelemetryConfig() {
  const posthog = usePosthog();

  const clearConfig = useCallback(async () => {
    await posthog.flush();
    posthog?.reset();
    await didInitializeTelemetry.resetValue();
    await lastAnonymousAppOpenAt.resetValue();
  }, [posthog]);

  return clearConfig;
}

export function useTelemetry(): TelemetryClient {
  const posthog = usePosthog();
  const session = useCurrentSession();
  const currentUserId = useCurrentUserId();
  const { data: logActivity, isLoading } = useLogActivity();
  const telemetryStorage = didInitializeTelemetry.useStorageItem();
  const telemetryInitialized =
    telemetryStorage.value && !telemetryStorage.isLoading;
  const ready =
    posthog &&
    !isLoading &&
    !telemetryStorage.isLoading &&
    session?.phase === 'ready';
  const shouldInitialize = ready && !telemetryInitialized;
  const clearConfig = useClearTelemetryConfig();
  const optedOut =
    (typeof logActivity !== 'undefined' && !logActivity) ||
    posthog?.getIsOptedOut();

  console.log({
    ready,
    isLoading,
    telLoading: telemetryStorage.isLoading,
    shouldInitialize,
    telemetryInitialized,
    optedOut,
    logActivity,
    startTime: session?.startTime,
  });

  const setDisabled = useCallback(
    async (shouldDisable: boolean) => {
      const isHosted = api.getCurrentUserIsHosted();
      debugger;

      // make sure we update settings to reflect, in case we're missing
      // the logActivity setting
      store.updateLogActivity(!shouldDisable);

      if (shouldDisable) {
        posthog?.optIn();
        posthog?.capture('Telemetry disabled', {
          isHostedUser: isHostedUser(isHosted),
        });
        posthog?.capture('$set', { $set: { telemetryDisabled: true } });
        await posthog.flush();

        posthog?.optOut();
      } else {
        posthog?.optIn();
        posthog?.identify(currentUserId, {
          isHostedUser: isHosted,
          userId: currentUserId,
        });
        posthog?.capture('Telemetry enabled', {
          isHostedUser: isHostedUser(isHosted),
        });
        posthog?.capture('$set', { $set: { telemetryDisabled: false } });
      }
    },
    [currentUserId, posthog]
  );

  const captureMandatoryEvent = useCallback(
    async ({
      eventId,
      properties,
    }: {
      eventId: string;
      properties?: Record<string, any>;
    }) => {
      if (optedOut) {
        posthog?.optIn();
        posthog?.capture(eventId, properties);
        await posthog?.flush();
        posthog?.optOut();
      } else {
        posthog?.capture(eventId, properties);
      }
    },
    [posthog, optedOut]
  );

  const captureAppActive = useCallback(
    async (platform?: 'web' | 'mobile' | 'electron') => {
      const eventId =
        platform && platform === 'web'
          ? AnalyticsEvent.WebAppOpened
          : AnalyticsEvent.AppActive;
      if (!optedOut) {
        posthog.capture(eventId, { isHostedUser });
      } else {
        const lastAnonymousOpen = await lastAnonymousAppOpenAt.getValue();
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        if (!lastAnonymousOpen || oneDayAgo > lastAnonymousOpen) {
          lastAnonymousAppOpenAt.setValue(Date.now());
          captureMandatoryEvent({
            eventId,
            properties: { isHostedUser },
          });
        }
      }
    },
    [posthog, optedOut, captureMandatoryEvent]
  );

  useEffect(() => {
    async function initializeTelemetry() {
      const isHosted = api.getCurrentUserIsHosted();
      debugger;

      // Reset bad telemetry config for web users who
      // were on pre-release TM-alpha
      if (isWeb) {
        const hasClearedLegacyConfig =
          await hasClearedLegacyWebTelemetry.getValue();
        if (!hasClearedLegacyConfig) {
          await clearConfig();
          posthog?.capture('Reset web telemetry config', {
            isHosted,
            userId: isHosted ? currentUserId : 'redacted',
          });
          await hasClearedLegacyWebTelemetry.setValue(true);
        }
      }

      const isInitialized = await didInitializeTelemetry.getValue();
      if (isInitialized) {
        return;
      }

      posthog?.capture('Initializing telemetry');
      setDisabled(optedOut);
      telemetryStorage.setValue(true);
    }

    if (shouldInitialize) {
      initializeTelemetry();
    }
  }, [
    posthog,
    optedOut,
    currentUserId,
    shouldInitialize,
    telemetryStorage,
    clearConfig,
    setDisabled,
    captureMandatoryEvent,
  ]);

  useEffect(() => {
    // if we hear about a change to the logActivity setting after
    // initializing, we should update the state of posthog
    if (telemetryInitialized && ready) {
      setDisabled(optedOut);
    }
  }, [ready, optedOut, telemetryInitialized, setDisabled]);

  return {
    getIsOptedOut: posthog.getIsOptedOut,
    optIn: posthog.optIn,
    optOut: posthog.optOut,
    identify: posthog.identify,
    capture: posthog.capture,
    flush: posthog.flush,

    setDisabled,
    captureMandatoryEvent,
    captureAppActive,
  };
}

// maintain legacy string value consistency for easier aggregation
function isHostedUser(isHosted: boolean) {
  return isHosted ? 'true' : 'false';
}
