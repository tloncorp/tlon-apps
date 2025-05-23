import { PostHogProvider } from 'posthog-react-native';
import { PropsWithChildren } from 'react';

import { posthogAsync } from '../utils/posthog';

export function TelemetryProvider({ children }: PropsWithChildren) {
  return (
    <PostHogProvider
      client={posthogAsync}
      autocapture={{
        captureTouches: false,
      }}
      options={{
        enable:
          process.env.NODE_ENV !== 'test' || !!process.env.POST_HOG_IN_DEV,
      }}
    >
      {children}
    </PostHogProvider>
  );
}
