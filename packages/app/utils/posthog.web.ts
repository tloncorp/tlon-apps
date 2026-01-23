import { useDebugStore } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import posthog, { Properties } from 'posthog-js';

import { POST_HOG_API_KEY } from '../constants';
import {
  applyRemoteOverrides,
  FeatureName,
  FeatureState,
  getRemoteControlledFlags,
} from '../lib/featureFlags';

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
  // Inline identifyUser call to avoid circular dependency
  analyticsClient?.identify(UUID, { isTlonEmployee: true });
};

/**
 * Fetch feature flags from PostHog and apply them to the local feature flag store.
 * Only flags marked as `remoteControlled` in featureMeta will be affected.
 */
function fetchAndApplyRemoteFeatureFlags() {
  try {
    // posthog-js loads feature flags automatically on init, but we can reload them
    posthog.reloadFeatureFlags();

    // PostHog web SDK loads flags asynchronously, so we need to wait for them
    posthog.onFeatureFlags(() => {
      const remoteControlledFlags = getRemoteControlledFlags();
      const overrides: Partial<FeatureState> = {};

      for (const flagName of remoteControlledFlags) {
        const remoteValue = posthog.isFeatureEnabled(flagName);
        // PostHog returns undefined if flag doesn't exist, boolean if it does
        if (typeof remoteValue === 'boolean') {
          overrides[flagName as FeatureName] = remoteValue;
          console.log(`[PostHog] Remote flag ${flagName} = ${remoteValue}`);
        }
      }

      if (Object.keys(overrides).length > 0) {
        applyRemoteOverrides(overrides);
        console.log(
          '[PostHog] Applied remote feature flag overrides:',
          overrides
        );
      }
    });
  } catch (error) {
    console.warn('[PostHog] Failed to fetch remote feature flags:', error);
    // Non-fatal - local flags will be used as defaults
  }
}

// Fetch remote feature flags after PostHog is initialized
fetchAndApplyRemoteFeatureFlags();
