// Bootstrap-only module: runs before the app graph evaluates. Nothing heavier
// than the imports below may be imported here — no @tloncorp/shared barrel, no
// app modules — or those graphs would load before Sentry.init.
import * as Sentry from '@sentry/react';
import { SENTRY_DSN, SENTRY_ENVIRONMENT } from '@tloncorp/app/lib/envVars';
import {
  hostingFromHostname,
  scrubBreadcrumb,
  scrubSentryEvent,
  SENTRY_DENY_URLS_WEB,
  SENTRY_IGNORE_ERRORS,
} from '@tloncorp/shared/errorReporting';
import type {
  SentryBreadcrumbLike,
  SentryEventLike,
} from '@tloncorp/shared/errorReporting';

const isDev = import.meta.env.DEV;
// Read GIT_HASH directly from import.meta.env instead of importing from
// @tloncorp/app/constants. That package is pre-built before VITE_GIT_HASH
// is set, so the import would always be undefined.
const GIT_HASH = import.meta.env.VITE_GIT_HASH ?? 'unknown';

export function resolveEnvironment(isDev: boolean, configured: string): string {
  return isDev ? 'development' : configured || 'production';
}

export function currentHosting() {
  return typeof window === 'undefined'
    ? 'local'
    : hostingFromHostname(window.location.hostname);
}

/**
 * Initialize Sentry for web error tracking.
 * Should be called early in the app bootstrap, before React renders.
 */
export function initSentry() {
  Sentry.init({
    // Only enable Sentry in production builds
    dsn: isDev ? undefined : SENTRY_DSN,

    // Don't send PII (IP address, cookies, etc.) for privacy compliance
    sendDefaultPii: false,

    // Set environment and release for better error tracking
    environment: resolveEnvironment(isDev, SENTRY_ENVIRONMENT),
    // Release must match release.name in vite.config.mts sentryVitePlugin
    // for source map resolution. Both use VITE_GIT_HASH set in CI workflows.
    release: GIT_HASH,

    // Tag errors with platform for filtering in Sentry UI
    initialScope: {
      tags: {
        platform: 'web',
        hosting: currentHosting(),
      },
    },

    ignoreErrors: SENTRY_IGNORE_ERRORS,
    denyUrls: SENTRY_DENY_URLS_WEB,

    beforeSend: (event) =>
      scrubSentryEvent(
        event as unknown as SentryEventLike
      ) as unknown as typeof event,
    beforeBreadcrumb: (crumb) =>
      scrubBreadcrumb(crumb as unknown as SentryBreadcrumbLike) as unknown as
        | typeof crumb
        | null,
  });
}
