import * as Sentry from '@sentry/react-native';
import {
  APP_VARIANT,
  GIT_HASH,
  IGNORE_COSMOS,
  SENTRY_DSN,
} from '@tloncorp/app/constants';
import { loadConstants } from '@tloncorp/app/lib/constants';
import {
  SENTRY_IGNORE_ERRORS,
  scrubBreadcrumb,
  scrubSentryEvent,
  setDebugBuildInfo,
  type SentryBreadcrumbLike,
  type SentryEventLike,
} from '@tloncorp/shared';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

setDebugBuildInfo(
  `${Platform.OS}:${Application.nativeBuildVersion ?? 'unknown'}`
);

Sentry.init({
  // Only enable Sentry in production builds
  dsn: __DEV__ ? undefined : SENTRY_DSN,

  // Don't send PII (IP address, cookies, etc.) for privacy compliance
  sendDefaultPii: false,

  // Disable logs in production
  enableLogs: false,

  // Set environment and release for better error tracking. In release builds
  // the EAS profile decides `production` vs `preview`.
  environment: __DEV__ ? 'development' : APP_VARIANT,
  release: GIT_HASH,

  ignoreErrors: SENTRY_IGNORE_ERRORS,
  beforeSend: (event) =>
    scrubSentryEvent(
      event as unknown as SentryEventLike
    ) as unknown as typeof event,
  beforeBreadcrumb: (crumb) =>
    scrubBreadcrumb(crumb as unknown as SentryBreadcrumbLike) as typeof crumb,

  // Tag errors with build variant for filtering in Sentry UI
  initialScope: {
    tags: {
      buildVariant: APP_VARIANT,
    },
  },
});

loadConstants();

export default __DEV__ && !IGNORE_COSMOS
  ? require('./App.cosmos').default
  : require('./App.main').default;
