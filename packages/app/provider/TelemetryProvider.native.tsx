import { PostHogProvider } from 'posthog-react-native';
import { PropsWithChildren } from 'react';

import { posthog } from '../utils/posthog';

export function TelemetryProvider({ children }: PropsWithChildren) {
  // If PostHog is not initialized (e.g., in tests), just render children
  if (!posthog) {
    return <>{children}</>;
  }

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
