#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/mobile-fast-start.sh [options]

Starts the shared-cache Metro fast path and opens an installed iOS development
client. By default it deliberately does not invoke Xcode or rebuild native code.

Options:
  --device UDID       Use this booted simulator (required if several are booted)
  --port PORT         Metro port (default: 8081)
  --app-id ID         Installed bundle identifier (default: io.tlon.groups)
  --scheme SCHEME     App URL scheme (default: io.tlon.groups)
  --build-native      Build and install the development client before Metro
  --skip-eas-cache    Skip the EAS native-cache lookup during --build-native
  --allow-concurrent-native-build
                      Start even if another native build is using the machine
  --keep-compilers    Enable the normal React and Tamagui compiler transforms
  --no-launch         Start Metro without opening the app
  -h, --help          Show this help

The fast compiler mode is for iteration. Before handing off a change, run once
with --keep-compilers and complete the normal validation for the changed code.
EOF
}

device_udid=""
port="8081"
app_id="io.tlon.groups"
app_scheme="io.tlon.groups"
keep_compilers=0
launch_app=1
build_native=0
skip_eas_cache=0
allow_concurrent_native_build="${TLON_MOBILE_ALLOW_CONCURRENT_NATIVE_BUILD:-0}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --device)
      device_udid="${2:-}"
      shift 2
      ;;
    --port)
      port="${2:-}"
      shift 2
      ;;
    --app-id)
      app_id="${2:-}"
      shift 2
      ;;
    --scheme)
      app_scheme="${2:-}"
      shift 2
      ;;
    --build-native)
      build_native=1
      shift
      ;;
    --skip-eas-cache)
      skip_eas_cache=1
      shift
      ;;
    --allow-concurrent-native-build)
      allow_concurrent_native_build=1
      shift
      ;;
    --keep-compilers)
      keep_compilers=1
      shift
      ;;
    --no-launch)
      launch_app=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! [[ "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
  echo "Port must be a number between 1 and 65535." >&2
  exit 2
fi

if [[ "$skip_eas_cache" -eq 1 && "$build_native" -ne 1 ]]; then
  echo "--skip-eas-cache is only valid with --build-native." >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
if [[ ! -e "$repo_root/node_modules/expo" ]]; then
  echo "Dependencies are not installed. Bootstrap or install this worktree first." >&2
  exit 1
fi

for generated_file in \
  "$repo_root/packages/editor/dist/index.html" \
  "$repo_root/apps/tlon-mobile/tailwind.css" \
  "$repo_root/apps/tlon-mobile/tailwind.json"; do
  if [[ ! -f "$generated_file" ]]; then
    echo "Missing generated file: ${generated_file#"$repo_root"/}" >&2
    echo "Run the mobile bootstrap or the corresponding generation step first." >&2
    exit 1
  fi
done

if [[ -z "$device_udid" ]]; then
  device_udid="$(xcrun simctl list devices booted -j | node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      const devices = Object.values(JSON.parse(input).devices).flat();
      const booted = devices.filter(device => device.state === "Booted");
      if (booted.length === 1) process.stdout.write(booted[0].udid);
      else {
        console.error(`Expected one booted simulator; found ${booted.length}. Pass --device UDID.`);
        process.exit(1);
      }
    });
  ')"
fi

if ! xcrun simctl list devices booted | rg -q "$device_udid"; then
  echo "Simulator $device_udid is not booted." >&2
  exit 1
fi

if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $port is already in use." >&2
  exit 1
fi

active_native_builds() {
  ps -axo pid=,command= | awk -v own_pid="$$" '
    $1 != own_pid && ($0 ~ /[x]codebuild .* (-workspace|-project|-scheme|archive|build)/ || $0 ~ /[e]xpo (run:ios|run:android)/ || $0 ~ /[e]as (build|build:run).*--local/) { print }
  '
}

native_builds="$(active_native_builds)"
if [[ -n "$native_builds" && "$allow_concurrent_native_build" != "1" ]]; then
  cat >&2 <<EOF
Another native build is already using this machine:
$native_builds

Wait for it to finish so the native build and JavaScript loop do not starve each
other, or pass --allow-concurrent-native-build to override.
EOF
  exit 1
fi

lease_dir="${TMPDIR:-/tmp}/tlon-mobile-simulator-${device_udid}.lease"
native_lease_dir="${TMPDIR:-/tmp}/tlon-mobile-native-build.lease"
native_lease_acquired=0
if ! mkdir "$lease_dir" 2>/dev/null; then
  lease_pid="$(sed -n '1p' "$lease_dir/pid" 2>/dev/null || true)"
  if [[ -n "$lease_pid" ]] && kill -0 "$lease_pid" 2>/dev/null; then
    echo "Simulator $device_udid is already owned by mobile loop process $lease_pid." >&2
    exit 1
  fi
  rm -f "$lease_dir/pid"
  if ! rmdir "$lease_dir" 2>/dev/null || ! mkdir "$lease_dir" 2>/dev/null; then
    echo "Could not recover stale simulator lease $lease_dir." >&2
    exit 1
  fi
fi
printf '%s\n' "$$" > "$lease_dir/pid"

if [[ "$build_native" -eq 1 ]]; then
  if ! mkdir "$native_lease_dir" 2>/dev/null; then
    native_lease_pid="$(sed -n '1p' "$native_lease_dir/pid" 2>/dev/null || true)"
    if [[ -n "$native_lease_pid" ]] && kill -0 "$native_lease_pid" 2>/dev/null; then
      echo "A mobile native build is already running as process $native_lease_pid." >&2
      rm -f "$lease_dir/pid"
      rmdir "$lease_dir" 2>/dev/null || true
      exit 1
    fi
    rm -f "$native_lease_dir/pid"
    if ! rmdir "$native_lease_dir" 2>/dev/null \
      || ! mkdir "$native_lease_dir" 2>/dev/null; then
      echo "Could not recover stale native-build lease $native_lease_dir." >&2
      rm -f "$lease_dir/pid"
      rmdir "$lease_dir" 2>/dev/null || true
      exit 1
    fi
  fi
  printf '%s\n' "$$" > "$native_lease_dir/pid"
  native_lease_acquired=1
fi

metro_pid=""
cleanup() {
  if [[ -n "$metro_pid" ]] && kill -0 "$metro_pid" 2>/dev/null; then
    kill "$metro_pid" 2>/dev/null || true
    wait "$metro_pid" 2>/dev/null || true
  fi
  rm -f "$lease_dir/pid"
  rmdir "$lease_dir" 2>/dev/null || true
  if [[ "$native_lease_acquired" -eq 1 ]]; then
    rm -f "$native_lease_dir/pid"
    rmdir "$native_lease_dir" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [[ "$build_native" -eq 1 ]]; then
  native_environment=()
  if [[ "$skip_eas_cache" -eq 1 ]]; then
    native_environment+=("TLON_EAS_CACHE_DISABLED=1")
  fi

  echo "Building and installing the development client while holding the machine and simulator leases..."
  (
    cd "$repo_root"
    env "${native_environment[@]}" \
      corepack pnpm --filter tlon-mobile exec expo run:ios \
        --no-bundler --device "$device_udid"
  )
fi

app_container="$(xcrun simctl get_app_container "$device_udid" "$app_id" app 2>/dev/null || true)"
if [[ -z "$app_container" ]]; then
  echo "$app_id is not installed on simulator $device_udid." >&2
  echo "Run again with --build-native from a fully prepared worktree." >&2
  exit 1
fi

if ! find "$app_container" -maxdepth 5 \
  \( -iname '*DevLauncher*' -o -iname 'EXDevMenu*' \) -print -quit | rg -q .; then
  cat >&2 <<EOF
The installed $app_id app is not an Expo development client.

Build it once from a prepared worktree, then use the default JavaScript-only
path for subsequent iterations:
  corepack pnpm mobile:fast:start --build-native --device $device_udid
EOF
  exit 1
fi

shared_cache_base="${TLON_METRO_SHARED_CACHE_DIR:-$HOME/.cache/tlon-metro-shared}"
metro_environment=(
  "NODE_OPTIONS=--dns-result-order=ipv4first"
  "TLON_METRO_SHARED_CACHE_ENABLED=1"
)
if [[ "$keep_compilers" -eq 0 ]]; then
  metro_environment+=(
    "TLON_METRO_SHARED_CACHE_DIR=$shared_cache_base/fast-compilers-off"
    "TLON_REACT_COMPILER_DISABLED=1"
    "TLON_TAMAGUI_COMPILER_DISABLED=1"
  )
else
  metro_environment+=("TLON_METRO_SHARED_CACHE_DIR=$shared_cache_base")
fi

started_at=$SECONDS
echo "Starting Metro for simulator $device_udid on port $port..."
(
  cd "$repo_root"
  env "${metro_environment[@]}" \
    corepack pnpm --filter tlon-mobile exec expo start \
      --dev-client --host localhost --port "$port"
) &
metro_pid=$!

ready=0
for _ in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:$port/status" 2>/dev/null | rg -q 'packager-status:running'; then
    ready=1
    break
  fi
  if ! kill -0 "$metro_pid" 2>/dev/null; then
    echo "Metro exited before becoming ready." >&2
    wait "$metro_pid"
    exit 1
  fi
  sleep 1
done

if [[ "$ready" -ne 1 ]]; then
  echo "Metro did not become ready within 120 seconds." >&2
  exit 1
fi

dev_client_url="${app_scheme}://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A${port}"
echo "Metro ready in $((SECONDS - started_at))s."

if [[ "$launch_app" -eq 1 ]]; then
  xcrun simctl openurl "$device_udid" "$dev_client_url"
  echo "Opened the development client. Press Ctrl-C to stop Metro."
else
  echo "Development client URL: $dev_client_url"
  echo "Press Ctrl-C to stop Metro."
fi

wait "$metro_pid"
