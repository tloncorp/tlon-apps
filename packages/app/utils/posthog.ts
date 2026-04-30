import crashlytics from '@react-native-firebase/crashlytics';
import * as Sentry from '@sentry/react-native';
import { useDebugStore } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import PostHog from 'posthog-react-native';
import { Platform, TurboModuleRegistry } from 'react-native';

import { GIT_HASH, POST_HOG_API_KEY, POST_HOG_IN_DEV } from '../constants';
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

export const posthogEnabled = (() => {
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.NODE_ENV === 'development') {
    return POST_HOG_IN_DEV;
  }
  return true;
})();

export const posthog: PostHog = new PostHog(
  // PostHog complains on passing an empty string. Allow omitting PostHog key
  // when PostHog is disabled by passing a dummy key and then disabling the client.
  // (If PostHog is enabled, pass the empty string to get a nice error message.)
  POST_HOG_API_KEY !== ''
    ? POST_HOG_API_KEY
    : posthogEnabled
      ? ''
      : 'dummy-key',
  {
    host: 'https://data-bridge-v1.vercel.app/ingest',
    disabled: !posthogEnabled,
  }
);

if (posthog) {
  const distinctId = posthog.getDistinctId();

  crashlytics().setAttribute('analyticsId', distinctId);

  // Create composite error logger that sends to both PostHog and Sentry
  const sentryLogger = createSentryErrorLogger();
  const compositeLogger = {
    capture: (event: string, data: Record<string, unknown>) => {
      // Always send to PostHog (analytics + errors)
      posthog.capture(event, data as Record<string, any>);

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
    flush: async () => posthog.flush(),
  };

  useDebugStore.getState().initializeErrorLogger(compositeLogger);
  posthog.register({
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
