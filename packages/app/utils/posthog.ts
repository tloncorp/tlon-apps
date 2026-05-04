import crashlytics from '@react-native-firebase/crashlytics';
import * as Sentry from '@sentry/react-native';
import { useDebugStore } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Platform, TurboModuleRegistry } from 'react-native';

import { GIT_HASH, POST_HOG_API_KEY } from '../constants';
import { identifyUser } from './identifyUser';
import { posthog, posthogEnabled } from './posthogSingleton';
import { createSentryErrorLogger } from './sentry';
import { UrbitModuleSpec } from './urbitModule';

export { posthog, posthogEnabled } from './posthogSingleton';

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
  botProvider?: string;
  botModel?: string;
  telemetryEnabled?: boolean;
  inviteType?: 'user' | 'group';
};

if (posthogEnabled) {
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
  const UUID = posthog.getDistinctId();
  identifyUser(UUID, { isTlonEmployee: true });
};
