import { didInitializeTelemetry } from '@tloncorp/shared/db';
import { useCallback, useEffect, useMemo } from 'react';

import { useShip } from '../contexts/ship';
import { useCurrentUserId } from './useCurrentUser.native';
import { useTelemetry } from './useTelemetry';

export function useCanDisableTelemetry() {
  const ship = useShip();
  // We use different heuristics for determining whether a user is hosted across the app.
  // Aggregate all methods here to ensure we don't miss something.
  const isHostedUser = useMemo(() => {
    const hasHostedAuth = ship.authType === 'hosted';
    const hasHostedShipUrl = ship.shipUrl?.includes('.tlon.network');

    return hasHostedAuth || hasHostedShipUrl;
  }, [ship.authType, ship.shipUrl]);

  return !isHostedUser;
}

export function useTelemetryDisabler() {
  const canDisableTelemetry = useCanDisableTelemetry();
  const telemetry = useTelemetry();

  const handleSetDisabled = useCallback(
    async (shouldDisable: boolean) => {
      if (canDisableTelemetry) {
        if (shouldDisable) {
          telemetry?.optIn();
          telemetry?.capture('Telemetry opt out', {
            selfHosted: true,
            detectionMethod: 'useTelemetryDisabler',
          });
          await telemetry.flush();

          telemetry?.optOut();
        } else {
          telemetry?.optIn();
        }
      }
    },
    [canDisableTelemetry, telemetry]
  );

  return {
    canDisable: canDisableTelemetry,
    startedDisabled: telemetry?.optedOut,
    setDisabled: handleSetDisabled,
  };
}

export function useInitializeUserTelemetry() {
  const canDisableTelemetry = useCanDisableTelemetry();
  const currentUserId = useCurrentUserId();
  const telemetry = useTelemetry();
  const telemtryInitialized = didInitializeTelemetry.useStorageItem();
  // const telemetryIsDisabled = hasDisabledTelemetry.useStorageItem();

  useEffect(() => {
    async function initializeTelemetry() {
      if (!canDisableTelemetry) {
        // for hosted users,
        telemetry?.optIn();
        telemetry?.identify(currentUserId);
      } else {
        // for self hosted users, if oppted out of analytics we need to signal
        // that's what they selected before disabling
        if (telemetry?.optedOut) {
          telemetry?.optIn();
          telemetry?.capture('Telemetry opt out', {
            selfHosted: true,
            detectionMethod: 'useInitializeAnalytics',
          });
          await telemetry.flush();

          telemetry?.optOut();
        }
      }

      telemtryInitialized.setValue(true);
    }

    if (telemetry) {
      if (!telemtryInitialized.value) {
        initializeTelemetry();
      }
    }
  }, [currentUserId, canDisableTelemetry, telemetry, telemtryInitialized]);
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
