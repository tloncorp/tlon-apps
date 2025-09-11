import crashlytics from '@react-native-firebase/crashlytics';
import { useDebugStore } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import PostHog from 'posthog-react-native';
import { NativeModules, Platform } from 'react-native';

import { GIT_HASH, POST_HOG_API_KEY } from '../constants';

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
  crashlytics().setAttribute('analyticsId', client.getDistinctId());
  useDebugStore.getState().initializeErrorLogger(client);
  posthog?.register({
    gitHash: GIT_HASH,
  });
});

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

export const trackError = (
  {
    message,
    properties,
  }: {
    message: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties?: { [key: string]: any };
  },
  event = 'app_error'
) => capture(event, { message, properties });

export const identifyTlonEmployee = () => {
  db.isTlonEmployee.setValue(true);
  if (!posthog) {
    console.debug('Identifying as Tlon employee before PostHog is initialized');
    return;
  }

  const UUID = posthog.getDistinctId();
  posthog.identify(UUID, { isTlonEmployee: true });
};
