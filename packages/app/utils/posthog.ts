import crashlytics from '@react-native-firebase/crashlytics';
import * as Sentry from '@sentry/react-native';
import { useDebugStore } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import PostHog from 'posthog-react-native';
import { Platform, TurboModuleRegistry } from 'react-native';

import { GIT_HASH, POST_HOG_API_KEY } from '../constants';
import {
  applyRemoteOverrides,
  FeatureName,
  FeatureState,
  getRemoteControlledFlags,
} from '../lib/featureFlags';
import { createSentryErrorLogger } from './sentry';
import { UrbitModuleSpec } from './urbitModule';

export type OnboardingProperties = {
  actionName: string;
  lure?: string;
  inviteId?: string;
  inviterUserId?: string;
  inviterNickname?: string;
  invitedGroupId?: string;
  invitedGroupTitle?: string;
  email?: string;
  phoneNumber?: string;
  ship?: string;
  telemetryEnabled?: boolean;
  inviteType?: 'user' | 'group';
};

export let posthog: PostHog | undefined;

export const posthogAsync =
  process.env.NODE_ENV === 'test' && !process.env.POST_HOG_IN_DEV
    ? undefined
    : PostHog.initAsync(POST_HOG_API_KEY, {
        host: 'https://data-bridge-v1.vercel.app/ingest',
        enable: true,
      });

posthogAsync?.then((client) => {
  posthog = client;
  const distinctId = client.getDistinctId();

  crashlytics().setAttribute('analyticsId', distinctId);

  // Create composite error logger that sends to both PostHog and Sentry
  const sentryLogger = createSentryErrorLogger();
  const compositeLogger = {
    capture: (event: string, data: Record<string, unknown>) => {
      // Always send to PostHog (analytics + errors)
      client.capture(event, data);

      // Only send errors to Sentry (not general analytics events)
      // Until logging is refactored to consistently use 'app_error',
      // we also pass along any event with "error" in the name (case-insensitive)
      if (
        event === 'app_error' ||
        event === 'Debug Logs' ||
        /error/i.test(event)
      ) {
        sentryLogger.capture(event, data);
      }
    },
  };

  useDebugStore.getState().initializeErrorLogger(compositeLogger);
  posthog?.register({
    gitHash: GIT_HASH,
  });

  // Set Sentry user context with PostHog analytics ID
  Sentry.setUser({
    id: distinctId,
  });

  // Write PostHog API key to UserDefaults for iOS native access
  if (Platform.OS === 'ios' && POST_HOG_API_KEY) {
    const UrbitModule = TurboModuleRegistry.get('UrbitModule');
    (UrbitModule as UrbitModuleSpec)?.setPostHogApiKey(POST_HOG_API_KEY);
  }

  // Fetch and apply remote feature flags from PostHog
  fetchAndApplyRemoteFeatureFlags(client);
});

/**
 * Fetch feature flags from PostHog and apply them to the local feature flag store.
 * Only flags marked as `remoteControlled` in featureMeta will be affected.
 */
async function fetchAndApplyRemoteFeatureFlags(client: PostHog) {
  try {
    // Reload feature flags from PostHog server
    await client.reloadFeatureFlagsAsync();

    const remoteControlledFlags = getRemoteControlledFlags();
    const overrides: Partial<FeatureState> = {};

    for (const flagName of remoteControlledFlags) {
      const remoteValue = client.getFeatureFlag(flagName);
      // PostHog returns undefined if flag doesn't exist, boolean if it does
      if (typeof remoteValue === 'boolean') {
        overrides[flagName as FeatureName] = remoteValue;
        console.log(`[PostHog] Remote flag ${flagName} = ${remoteValue}`);
      }
    }

    if (Object.keys(overrides).length > 0) {
      applyRemoteOverrides(overrides);
      console.log('[PostHog] Applied remote feature flag overrides:', overrides);
    }
  } catch (error) {
    console.warn('[PostHog] Failed to fetch remote feature flags:', error);
    // Non-fatal - local flags will be used as defaults
  }
}

const capture = (event: string, properties?: { [key: string]: any }) => {
  if (!posthog) {
    console.debug('Capturing event before PostHog is initialized:', {
      event,
      properties,
    });
    return;
  }

  try {
    posthog.capture(event, properties);
  } catch (error) {
    console.error('Error tracking onboarding action', error);
  }
};

export const trackOnboardingAction = (properties: OnboardingProperties) =>
  capture('Onboarding Action', properties);

export const identifyTlonEmployee = () => {
  db.isTlonEmployee.setValue(true);
  if (!posthog) {
    console.debug('Identifying as Tlon employee before PostHog is initialized');
    return;
  }

  const UUID = posthog.getDistinctId();
  // Import at top of function to avoid circular dependency
  const { identifyUser } = require('./identifyUser');
  identifyUser(UUID, { isTlonEmployee: true });
};
