import PostHog from 'posthog-react-native';

import { POST_HOG_API_KEY, POST_HOG_IN_DEV } from '../constants';

export const posthogEnabled = (() => {
  if (POST_HOG_API_KEY === '') return false;
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.NODE_ENV === 'development') {
    return POST_HOG_IN_DEV;
  }
  return true;
})();

export const posthog: PostHog = new PostHog(
  // PostHog rejects an empty key even when disabled, so use an inert placeholder
  // when telemetry is unavailable.
  POST_HOG_API_KEY || 'dummy-key',
  {
    host: 'https://data-bridge-v1.vercel.app/ingest',
    disabled: !posthogEnabled,
  }
);
