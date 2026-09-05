import * as Sentry from '@sentry/react';
import {
  analyticsClient,
  EVENT_PRIVACY_MASK,
} from '@tloncorp/app/utils/posthog.web';
import { createCompositeLogger, useDebugStore } from '@tloncorp/shared';
import { Properties } from 'posthog-js';

import { createSentryErrorLogger } from '../sentry';
import { log } from './utils';

export { analyticsClient, EVENT_PRIVACY_MASK };

const sentryLogger = createSentryErrorLogger();
useDebugStore.getState().initializeErrorLogger(
  createCompositeLogger({
    posthog: (event, data) =>
      analyticsClient.capture(event, { ...data, ...EVENT_PRIVACY_MASK }),
    sentry: sentryLogger.capture,
  })
);

// One stable anonymous id per browser profile; never the ship.
const deviceId = analyticsClient.get_property('$device_id');
if (typeof deviceId === 'string' && deviceId) {
  Sentry.setUser({ id: deviceId });
}

// Once someone is opted in this will fire no matter what so we need
// additional guarding here to prevent accidentally capturing data.
export const captureAnalyticsEvent = (
  name: string,
  properties?: Properties
) => {
  log('Attempting to capture analytics event', name);
  const captureProperties: Properties = {
    ...(properties || {}),
    ...EVENT_PRIVACY_MASK,
  };

  analyticsClient.capture(name, captureProperties, {
    $set_once: {
      $host: null,
      $referrer: null,
      $current_url: null,
      $pathname: null,
      $initial_current_url: null,
      $initial_referrer_url: null,
      $referring_domain: null,
      $initial_referring_domain: null,
    },
  });
};

export function captureError(source: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  captureAnalyticsEvent('error', {
    source,
    message,
    stack,
  });
}
