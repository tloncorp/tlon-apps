import { AnalyticsEvent, useCurrentSession } from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import {
  didInitializeTelemetry,
  hasClearedLegacyWebTelemetry,
  lastAnonymousAppOpenAt,
} from '@tloncorp/shared/db';
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
  const telemetryInitialized = didInitializeTelemetry.useStorageItem();
  const clearConfig = useClearTelemetryConfig();

  const setDisabled = useCallback(
    async (shouldDisable: boolean) => {
      const isHosted = api.getCurrentUserIsHosted();
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
        posthog?.identify(currentUserId, { isHostedUser: isHosted });
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
      if (posthog?.getIsOptedOut()) {
        posthog?.optIn();
        posthog?.capture(eventId, properties);
        await posthog?.flush();
        posthog?.optOut();
      } else {
        posthog?.capture(eventId, properties);
      }
    },
    [posthog]
  );

  const captureAppActive = useCallback(
    async (platform?: 'web' | 'mobile' | 'electron') => {
      const eventId =
        platform && platform === 'web'
          ? AnalyticsEvent.WebAppOpened
          : AnalyticsEvent.AppActive;
      if (!posthog.getIsOptedOut()) {
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
    [posthog, captureMandatoryEvent]
  );

  useEffect(() => {
    async function initializeTelemetry() {
      const isHosted = api.getCurrentUserIsHosted();

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
      } else {
        posthog?.capture('Initializing telemetry');
      }

      posthog?.identify(currentUserId, { isHostedUser: isHosted });
      setDisabled(posthog.getIsOptedOut());
      telemetryInitialized.setValue(true);
    }

    if (posthog && session?.startTime) {
      initializeTelemetry();
    }
  }, [
    captureMandatoryEvent,
    clearConfig,
    currentUserId,
    posthog,
    session?.startTime,
    setDisabled,
    telemetryInitialized,
  ]);

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
