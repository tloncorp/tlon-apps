import { PostHogProvider } from 'posthog-react-native';
import { PropsWithChildren } from 'react';

import { posthog } from '../utils/posthog';

export function TelemetryProvider({ children }: PropsWithChildren) {
  return (
    <PostHogProvider
      client={posthog}
      options={{
        disabled:
          process.env.NODE_ENV === 'test' && !process.env.POST_HOG_IN_DEV,
      }}
      autocapture={{
        captureTouches: false,
        captureScreens: false,
      }}
    >
      {children}
    </PostHogProvider>
  );
}
