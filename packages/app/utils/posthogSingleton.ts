import PostHog from 'posthog-react-native';

import { POST_HOG_API_KEY } from '../constants';

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
});
