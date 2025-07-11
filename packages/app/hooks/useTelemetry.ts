import {
  AnalyticsEvent,
  createDevLogger,
  useCurrentSession,
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

const logger = createDevLogger('useTelemetry', false);

export function useClearTelemetryConfig() {
  const posthog = usePosthog();

  const clearConfig = useCallback(async () => {
    logger.log('Clearing telemetry config');
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
  const { data: settings, isLoading } = store.useTelemetrySettings();
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
  const telemetryEnabled = settings?.enableTelemetry;

  const getIsOptedOut = useCallback(() => {
    const isHosted = api.getCurrentUserIsHosted();
    const defaultToOptedOut = !isHosted;
    if (telemetryEnabled !== undefined && telemetryEnabled !== null) {
      return !telemetryEnabled;
    }

    // fallback for those without any telemetry setting
    return posthog?.getIsOptedOut() ?? defaultToOptedOut;
  }, [posthog, telemetryEnabled]);

  logger.log({
    ready,
    posthogOptedOut: posthog?.getIsOptedOut(),
    isLoading,
    telLoading: telemetryStorage.isLoading,
    shouldInitialize,
    telemetryInitialized,
    telemetryEnabled,
    settings,
    startTime: session?.startTime,
  });

  const setDisabled = useCallback(
    async (shouldDisable: boolean, updateSettings = true) => {
      const isHosted = api.getCurrentUserIsHosted();

      logger.log('Updating telemetry setting');
      if (shouldDisable) {
        logger.log('Disabling telemetry');
        posthog?.optIn();
        posthog?.capture('Telemetry disabled', {
          isHostedUser: isHostedUser(isHosted),
        });
        posthog?.capture('$set', { $set: { telemetryDisabled: true } });
        await posthog.flush();

        posthog?.optOut();
      } else {
        logger.log('Enabling telemetry');
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

      if (updateSettings) {
        // make sure we update settings to reflect, in case we're missing
        // the telemetry setting
        store.updateEnableTelemetry(!shouldDisable);
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
      logger.log(
        `Capturing mandatory event ${eventId} with properties:`,
        properties
      );
      const optedOut = getIsOptedOut();
      if (optedOut) {
        posthog?.optIn();
        posthog?.capture(eventId, properties);
        await posthog?.flush();
        posthog?.optOut();
      } else {
        posthog?.capture(eventId, properties);
      }
    },
    [posthog, getIsOptedOut]
  );

  const captureAppActive = useCallback(
    async (platform?: 'web' | 'mobile' | 'electron') => {
      const eventId =
        platform && platform === 'web'
          ? AnalyticsEvent.WebAppOpened
          : AnalyticsEvent.AppActive;
      logger.log(`Capturing app active event: ${eventId}`);
      const optedOut = getIsOptedOut();
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
    [posthog, getIsOptedOut, captureMandatoryEvent]
  );

  useEffect(() => {
    async function initializeTelemetry() {
      logger.log('Attempting to initialize telemetry');
      const isHosted = api.getCurrentUserIsHosted();

      // Reset bad telemetry config for web users who
      // were on pre-release TM-alpha
      if (isWeb) {
        const hasClearedLegacyConfig =
          await hasClearedLegacyWebTelemetry.getValue();
        if (!hasClearedLegacyConfig) {
          logger.log('Clearing legacy web telemetry config');
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
        logger.log('Telemetry already initialized, skipping');
        return;
      }

      logger.log('Initializing telemetry');
      posthog?.capture('Initializing telemetry');
      const optedOut = getIsOptedOut();
      setDisabled(optedOut);
      telemetryStorage.setValue(true);
    }

    if (shouldInitialize) {
      initializeTelemetry();
    }
  }, [
    posthog,
    getIsOptedOut,
    currentUserId,
    shouldInitialize,
    telemetryStorage,
    clearConfig,
    setDisabled,
    captureMandatoryEvent,
  ]);

  useEffect(() => {
    // explicitly set the enableTelemetry setting if it's not present
    if (
      settings &&
      (settings.enableTelemetry === undefined ||
        settings.enableTelemetry === null) &&
      ready
    ) {
      if (settings.logActivity !== undefined && settings.logActivity !== null) {
        logger.log('Updating telemetry setting from logActivity');
        store.updateEnableTelemetry(settings.logActivity);
      } else {
        logger.log('Updating telemetry setting from posthog');
        // if we don't have a logActivity setting, use posthog's default
        // value for enableTelemetry
        store.updateEnableTelemetry(!(posthog.getIsOptedOut() ?? true));
      }
    }
  }, [ready, settings, posthog]);

  useEffect(() => {
    if (!ready || !telemetryInitialized) {
      return;
    }

    // if we hear about a change to the enableTelemetry setting after
    // initializing and we're not synced, we should update the state of posthog
    const optedOut = getIsOptedOut();
    if (optedOut !== posthog.getIsOptedOut()) {
      setDisabled(optedOut, false);
    }
  }, [
    ready,
    telemetryEnabled,
    telemetryInitialized,
    setDisabled,
    posthog,
    getIsOptedOut,
  ]);

  return {
    getIsOptedOut,
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
