import crashlytics from '@react-native-firebase/crashlytics';
import * as Sentry from '@sentry/react-native';
import { createCompositeLogger, useDebugStore } from '@tloncorp/shared';
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

const sentryLogger = createSentryErrorLogger();
useDebugStore.getState().initializeErrorLogger(
  createCompositeLogger({
    posthog: posthogEnabled
      ? (event, data) => posthog.capture(event, data as Record<string, any>)
      : undefined,
    sentry: sentryLogger.capture,
    flush: async () => {
      if (posthogEnabled) {
        await posthog.flush();
      }
    },
  })
);

if (posthogEnabled) {
  crashlytics().setAttribute('analyticsId', posthog.getDistinctId());
  posthog.register({ gitHash: GIT_HASH });

  // One stable anonymous id per install; never the ship. The persisted id is
  // empty until PostHog has loaded its storage.
  void posthog
    .ready()
    .then(() => {
      const anonymousId = posthog.getAnonymousId();
      if (anonymousId) {
        Sentry.setUser({ id: anonymousId });
      }
    })
    .catch(() => {
      /* persistence failed to load; leave Sentry identity unset */
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
