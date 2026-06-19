import PostHog from 'posthog-react-native';

import { POST_HOG_API_KEY, POST_HOG_IN_DEV } from '../constants';

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
