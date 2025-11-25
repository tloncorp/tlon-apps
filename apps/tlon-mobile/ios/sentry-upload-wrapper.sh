#!/bin/bash
# Wrapper script to dynamically find @sentry/react-native in pnpm workspace
# This resolves the package location regardless of workspace structure

# Dynamically find @sentry/react-native package location
SENTRY_SCRIPT=$(node --print "require.resolve('@sentry/react-native/package.json').replace('package.json', 'scripts/sentry-xcode-debug-files.sh')")

# Execute the Sentry debug files upload script
/bin/sh "$SENTRY_SCRIPT"
