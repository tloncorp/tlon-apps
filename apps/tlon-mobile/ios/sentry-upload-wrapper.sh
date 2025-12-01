#!/bin/bash
# Wrapper script to dynamically find @sentry/react-native in pnpm workspace
# This resolves the package location regardless of workspace structure

# Skip symbol upload if Sentry is not configured (local development)
if [ -z "$SENTRY_AUTH_TOKEN" ] && [ ! -f "../sentry.properties" ] && [ ! -f "sentry.properties" ]; then
  echo "Skipping Sentry symbol upload (no auth token or sentry.properties found)"
  echo "This is expected for local development builds"
  exit 0
fi

# Dynamically find @sentry/react-native package location
SENTRY_SCRIPT=$(node --print "require.resolve('@sentry/react-native/package.json').replace('package.json', 'scripts/sentry-xcode-debug-files.sh')")

# Execute the Sentry debug files upload script
/bin/sh "$SENTRY_SCRIPT"
