import { useDebugStore } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import posthog, { Properties } from 'posthog-js';

import { POST_HOG_API_KEY } from '../constants';

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

// Configure PostHog with all auto-capturing settings disabled,
// as we will only be tracking specific interactions.
posthog.init(POST_HOG_API_KEY, {
  api_host: 'https://data-bridge-v1.vercel.app/ingest',
  ui_host: 'https://eu.posthog.com',
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  disable_session_recording: true,
  mask_all_text: true,
  mask_all_element_attributes: true,
});

export const analyticsClient = posthog;

const wrappedErrorLogger = {
  capture: (event: string, data: Record<string, unknown>) => {
    analyticsClient.capture(event, { ...data, ...EVENT_PRIVACY_MASK });
  },
};

// hand off the instance to our dev loggers
useDebugStore.getState().initializeErrorLogger(wrappedErrorLogger);

export const identifyTlonEmployee = () => {
  db.isTlonEmployee.setValue(true);
  if (!posthog) {
    console.debug('Identifying as Tlon employee before PostHog is initialized');
    return;
  }

  const UUID = posthog.get_distinct_id();
  // Import at top of function to avoid circular dependency
  const { identifyUser } = require('./identifyUser.web');
  identifyUser(UUID, { isTlonEmployee: true });
};
