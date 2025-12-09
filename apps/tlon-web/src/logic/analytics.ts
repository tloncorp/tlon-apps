import { POST_HOG_API_KEY } from '@tloncorp/app/constants';
import { useDebugStore } from '@tloncorp/shared';
import posthog, { Properties } from 'posthog-js';

import { createSentryErrorLogger } from '../sentry';
import { log } from './utils';

// Configure PostHog with all auto-capturing settings disabled,
// as we will only be tracking specific interactions.
posthog.init(POST_HOG_API_KEY, {
  api_host: 'https://eu.posthog.com',
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  disable_session_recording: true,
  mask_all_text: true,
  mask_all_element_attributes: true,
});

export const analyticsClient = posthog;

// Create composite logger that sends to both PostHog and Sentry
const sentryLogger = createSentryErrorLogger();
const compositeLogger = {
  capture: (event: string, data: Record<string, unknown>) => {
    // Always send to PostHog (analytics + errors)
    analyticsClient.capture(event, { ...data, ...EVENT_PRIVACY_MASK });

    // Only send errors to Sentry (not general analytics events)
    // Until logging is refactored to consistently use 'app_error',
    // we also pass along any event with "error" in the name (case-insensitive)
    if (
      event === 'app_error' ||
      event === 'Debug Logs' ||
      /error/i.test(event)
    ) {
      sentryLogger.capture(event, data);
    }
  },
};

// hand off the instance to our dev loggers
useDebugStore.getState().initializeErrorLogger(compositeLogger);

export const EVENT_PRIVACY_MASK: Properties = {
  // The following default properties stop PostHog from auto-logging the URL,
  // which can inadvertently reveal private info on Urbit
  $current_url: null,
  $pathname: null,
  $set_once: null,
  $host: null,
  $referrer: null,
  $initial_current_url: null,
  $initial_referrer_url: null,
  $referring_domain: null,
  $initial_referring_domain: null,
  $unset: [
    'initial_referrer_url',
    'initial_referring_domain',
    'initial_current_url',
    'current_url',
    'pathname',
    'host',
    'referrer',
    'referring_domain',
  ],
};

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

  posthog.capture(name, captureProperties, {
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
