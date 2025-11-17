import * as Sentry from '@sentry/react-native';
import { GIT_HASH, IGNORE_COSMOS, SENTRY_DSN } from '@tloncorp/app/constants';
import { loadConstants } from '@tloncorp/app/lib/constants';

Sentry.init({
  // Only enable Sentry in production builds
  dsn: __DEV__ ? undefined : SENTRY_DSN,

  // Don't send PII (IP address, cookies, etc.) for privacy compliance
  sendDefaultPii: false,

  // Disable logs in production
  enableLogs: false,

  // Set environment and release for better error tracking
  environment: __DEV__ ? 'development' : 'production',
  release: GIT_HASH,
});

loadConstants();

module.exports =
  (global as any).__DEV__ && !IGNORE_COSMOS
    ? require('./App.cosmos')
    : require('./App.main');
