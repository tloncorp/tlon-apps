import crashlytics from '@react-native-firebase/crashlytics';
import * as db from '@tloncorp/shared/dist/db';
import PostHog from 'posthog-react-native';

import { POST_HOG_API_KEY } from '../constants';

export type OnboardingProperties = {
  actionName: string;
  lure?: string;
  email?: string;
  ship?: string;
};

export let posthog: PostHog | undefined;

export const posthogAsync = PostHog.initAsync(POST_HOG_API_KEY, {
  host: 'https://eu.posthog.com',
  enable: true,
});

posthogAsync.then((client) => {
  posthog = client;
  crashlytics().setAttribute('analyticsId', client.getDistinctId());
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
  { message }: { message: string },
  event = 'app_error'
) => capture(event, { message });

export const identifyTlonEmployee = () => {
  if (!posthog) {
    console.debug('Identifying as Tlon employee before PostHog is initialized');
    return;
  }

  const UUID = posthog.getDistinctId();
  posthog.identify(UUID, { isTlonEmployee: true });
  db.setIsTlonEmployee(true);
};
