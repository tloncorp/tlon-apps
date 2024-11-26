import { AnalyticsEvent } from '@tloncorp/shared';
import {
  didInitializeTelemetry,
  lastAnonymousAppOpenAt,
} from '@tloncorp/shared/db';
import { useCallback, useEffect, useMemo } from 'react';

import { useShip } from '../contexts/ship';
import { TelemetryClient } from '../types/telemetry';
import { useCurrentUserId } from './useCurrentUser.native';
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

export function useIsHosted() {
  const ship = useShip();
  // We use different heuristics for determining whether a user is hosted across the app.
  // Aggregate all methods here to ensure we don't miss something.
  const isHostedUser = useMemo(() => {
    const hasHostedAuth = ship.authType === 'hosted';
    const hasHostedShipUrl = ship.shipUrl?.includes('.tlon.network');

    return hasHostedAuth || hasHostedShipUrl;
  }, [ship.authType, ship.shipUrl]);

  return isHostedUser;
}

export function useTelemetry(): TelemetryClient {
  const posthog = usePosthog();
  const isHosted = useIsHosted();
  const currentUserId = useCurrentUserId();
  const isHostedUser = useMemo(() => (isHosted ? 'true' : 'false'), [isHosted]);
  const telemetryInitialized = didInitializeTelemetry.useStorageItem();

  const setDisabled = useCallback(
    async (shouldDisable: boolean) => {
      if (shouldDisable) {
        posthog?.optIn();
        posthog?.capture('Telemetry disabled', {
          isHostedUser,
        });
        posthog?.capture('$set', { $set: { telemetryDisabled: true } });
        await posthog.flush();

        posthog?.optOut();
      } else {
        posthog?.optIn();
        if (isHosted) {
          posthog?.identify(currentUserId, { isHostedUser: true });
        }
        posthog?.capture('Telemetry enabled', { isHostedUser });
        posthog?.capture('$set', { $set: { telemetryDisabled: false } });
      }
    },
    [currentUserId, isHosted, isHostedUser, posthog]
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

  const captureAppActive = useCallback(async () => {
    if (!posthog.optedOut) {
      posthog.capture(AnalyticsEvent.AppActive, { isHostedUser });
    } else {
      const lastAnonymousOpen = await lastAnonymousAppOpenAt.getValue();
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      if (!lastAnonymousOpen || oneDayAgo > lastAnonymousOpen) {
        lastAnonymousAppOpenAt.setValue(Date.now());
        captureMandatoryEvent({
          eventId: AnalyticsEvent.AppActive,
          properties: { isHostedUser },
        });
      }
    }
  }, [isHostedUser, posthog, captureMandatoryEvent]);

  useEffect(() => {
    async function initializeTelemetry() {
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

    if (posthog) {
      initializeTelemetry();
    }
  }, [
    captureMandatoryEvent,
    currentUserId,
    isHosted,
    isHostedUser,
    posthog,
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
