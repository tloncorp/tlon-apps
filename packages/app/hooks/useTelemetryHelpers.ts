import { AnalyticsEvent } from '@tloncorp/shared';
import {
  didInitializeTelemetry,
  lastAnonymousAppOpenAt,
} from '@tloncorp/shared/db';
import { useCallback, useEffect, useMemo } from 'react';

import { useShip } from '../contexts/ship';
import { useCurrentUserId } from './useCurrentUser.native';
import { useTelemetry } from './useTelemetry';

export function useClearTelemetryConfig() {
  const telemetry = useTelemetry();

  const clearTelemetryConfig = useCallback(async () => {
    await telemetry.flush();
    telemetry?.reset();
    didInitializeTelemetry.resetValue();
    lastAnonymousAppOpenAt.resetValue();
  }, [telemetry]);

  return clearTelemetryConfig;
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

export function useTelemetryDisabler() {
  const telemetry = useTelemetry();
  const handleSetDisabled = useSetTelemetryDisabled('telemetryDisablerHook');

  return {
    startedDisabled: telemetry?.optedOut,
    setDisabled: handleSetDisabled,
  };
}

export function useSetTelemetryDisabled(methodId?: string) {
  const currentUserId = useCurrentUserId();
  const telemetry = useTelemetry();
  const isHosted = useIsHosted();
  const isHostedUser = useMemo(() => (isHosted ? 'true' : 'false'), [isHosted]);
  const handleSetDisabled = useCallback(
    async (shouldDisable: boolean) => {
      if (shouldDisable) {
        telemetry?.optIn();
        telemetry?.capture('Telemetry disabled', {
          isHostedUser,
          detectionMethod: methodId ?? 'useSetTelemetryDisabled',
        });
        await telemetry.flush();

        telemetry?.optOut();
      } else {
        telemetry?.optIn();
        if (isHosted) {
          telemetry?.identify(currentUserId, { ishostedUser: true });
        }
        telemetry?.capture('Telemetry enabled', { isHostedUser });
      }
    },
    [currentUserId, isHosted, isHostedUser, methodId, telemetry]
  );

  return handleSetDisabled;
}

export function useInitializeUserTelemetry() {
  const isHosted = useIsHosted();
  const currentUserId = useCurrentUserId();
  const telemetry = useTelemetry();
  const setTelemetryDisabled = useSetTelemetryDisabled('initialization');
  const telemtryInitialized = didInitializeTelemetry.useStorageItem();

  useEffect(() => {
    async function initializeTelemetry() {
      if (isHosted) {
        telemetry?.identify(currentUserId, { isHostedUser: true });
      }

      if (telemetry?.optedOut) {
        setTelemetryDisabled(true);
      }

      telemtryInitialized.setValue(true);
    }

    if (telemetry) {
      if (!telemtryInitialized.value) {
        initializeTelemetry();
      }
    }
  }, [
    currentUserId,
    isHosted,
    setTelemetryDisabled,
    telemetry,
    telemtryInitialized,
  ]);
}

// Used for bare minimum telemetry events that cannot be opted out of
export function useMandatoryTelemetry() {
  const telemetry = useTelemetry();

  const trackMandatoryEvent = useCallback(
    async ({
      eventId,
      properties,
    }: {
      eventId: string;
      properties?: Record<string, string>;
    }) => {
      if (telemetry?.optedOut) {
        telemetry?.optIn();
        telemetry?.capture(eventId, properties);
        await telemetry?.flush();
        telemetry?.optOut();
      } else {
        telemetry?.capture(eventId, properties);
      }
    },
    [telemetry]
  );

  return trackMandatoryEvent;
}

export function useTrackAppActive() {
  const telemetry = useTelemetry();
  const isHosted = useIsHosted();
  const isHostedUser = useMemo(() => (isHosted ? 'true' : 'false'), [isHosted]);
  const trackMandatoryEvent = useMandatoryTelemetry();

  const trackAppOpen = useCallback(async () => {
    if (!telemetry.optedOut) {
      telemetry.capture(AnalyticsEvent.AppActive, { isHostedUser });
    } else {
      const lastAnonymousOpen = await lastAnonymousAppOpenAt.getValue();
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      if (!lastAnonymousOpen || oneDayAgo > lastAnonymousOpen) {
        lastAnonymousAppOpenAt.setValue(Date.now());
        trackMandatoryEvent({
          eventId: AnalyticsEvent.AppActive,
          properties: { isHostedUser },
        });
      }
    }
  }, [isHostedUser, telemetry, trackMandatoryEvent]);

  return trackAppOpen;
}
