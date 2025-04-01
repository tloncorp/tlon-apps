import { AnalyticsEvent, useCurrentSession } from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import {
  didInitializeTelemetry,
  lastAnonymousAppOpenAt,
} from '@tloncorp/shared/db';
import { useCallback, useEffect } from 'react';

import { TelemetryClient } from '../types/telemetry';
import { useCurrentUserId } from './useCurrentUser';
import { usePosthog } from './usePosthog';

export function useClearTelemetryConfig() {
  const posthog = usePosthog();

  const clearConfig = useCallback(async () => {
    await posthog.flush();
    posthog?.reset();
    didInitializeTelemetry.resetValue();
    lastAnonymousAppOpenAt.resetValue();
  }, [posthog]);

  return clearConfig;
}

export function useTelemetry(): TelemetryClient {
  const posthog = usePosthog();
  const session = useCurrentSession();
  const currentUserId = useCurrentUserId();
  const telemetryInitialized = didInitializeTelemetry.useStorageItem();

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
        if (isHosted) {
          posthog?.identify(currentUserId, { isHostedUser: true });
        }
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
      if (posthog?.optedOut) {
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
      if (!posthog.optedOut) {
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
      const isInitialized = await didInitializeTelemetry.getValue();
      if (isInitialized) {
        return;
      }

      if (isHosted) {
        posthog?.identify(currentUserId, { isHostedUser: true });
      } else {
        captureMandatoryEvent({
          eventId: '$set',
          properties: { $set: { isHostedUser: false } },
        });
      }
      setDisabled(posthog.optedOut);
      telemetryInitialized.setValue(true);
    }

    if (posthog && session?.startTime) {
      initializeTelemetry();
    }
  }, [
    captureMandatoryEvent,
    currentUserId,
    posthog,
    session?.startTime,
    setDisabled,
    telemetryInitialized,
  ]);

  return {
    optedOut: posthog.optedOut,
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
