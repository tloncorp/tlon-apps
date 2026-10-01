#!/bin/bash
set -euo pipefail
mobile_dir="$(cd "$(dirname "$0")/.." && pwd)"
build_dir="$(mktemp -d "${TMPDIR:-/tmp}/tlon-native-cache.XXXXXX")"
trap 'rm -rf "$build_dir"' EXIT
swiftc -swift-version 5 -module-cache-path "$build_dir/modules" \
  "$mobile_dir/ios/Shared/Models/Changes.swift" \
  "$mobile_dir/ios/Shared/Storage/ChangesLoader.swift" \
  "$mobile_dir/ios/Shared/Extensions/Date+javascriptTimestamp.swift" \
  "$mobile_dir/ios/Shared/Models/NotificationLogging.swift" \
  "$mobile_dir/scripts/native-cache-tests/Support.swift" \
  "$mobile_dir/scripts/native-cache-tests/Tests.swift" \
  -o "$build_dir/tests"
"$build_dir/tests"
