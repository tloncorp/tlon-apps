import { PostHogProvider } from 'posthog-react-native';
import { PropsWithChildren } from 'react';

import { posthog } from '../utils/posthog';

export function TelemetryProvider({ children }: PropsWithChildren) {
  return (
    <PostHogProvider
      client={posthog}
      autocapture={{
        captureTouches: false,
        captureScreens: false,
      }}
    >
      {children}
    </PostHogProvider>
  );
}
