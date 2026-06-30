#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f ../.env ]; then
  echo "ERROR: packages/hermes-tlon-adapter/.env is missing."
  echo "Copy .env.example to .env and fill in TLON_* credentials for the bot and owner."
  exit 1
fi

REPO_ROOT="$(cd ../../.. && pwd)"
FAKE_MODEL_PORT="${FAKE_MODEL_PORT:-4000}"
FAKE_MODEL_HOST_URL="http://127.0.0.1:${FAKE_MODEL_PORT}"
SHARED_FAKE_MODEL_SERVER="$REPO_ROOT/packages/tlon-bot-e2e/src/fake-model/server.mjs"
OPENCLAW_FAKE_MODEL_SERVER="$REPO_ROOT/packages/openclaw/test/support/fake-model/server.mjs"
if [ -z "${FAKE_MODEL_SERVER:-}" ]; then
  if [ -f "$SHARED_FAKE_MODEL_SERVER" ]; then
    FAKE_MODEL_SERVER="$SHARED_FAKE_MODEL_SERVER"
  else
    FAKE_MODEL_SERVER="$OPENCLAW_FAKE_MODEL_SERVER"
  fi
fi
SCRIPT_KEY="${HERMES_FAKE_MODEL_SPIKE_KEY:-hermes-spike}"
FINAL_REPLY="${HERMES_FAKE_MODEL_SPIKE_REPLY:-Hermes fake-model spike final reply for [tlon-test:${SCRIPT_KEY}].}"

if [ ! -f "$FAKE_MODEL_SERVER" ]; then
  echo "ERROR: fake-model server not found at $FAKE_MODEL_SERVER"
  exit 1
fi

fake_model_pid=""
cleanup() {
  status=$?
  received_file="$(mktemp)"
  echo
  echo "==> Fake-model received calls for key \"$SCRIPT_KEY\""
  if curl -fsS "$FAKE_MODEL_HOST_URL/v1/_received?key=$SCRIPT_KEY" -o "$received_file"; then
    cat "$received_file"
    echo
    python3 - "$received_file" <<'PY' || true
import json
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    data = json.load(handle)

calls = data.get("calls") if isinstance(data, dict) else []
calls = calls if isinstance(calls, list) else []
streaming_calls = [call for call in calls if call.get("stream") is True]
tlon_calls = [
    call
    for call in streaming_calls
    if "tlon" in (call.get("toolNames") or [])
]

if tlon_calls:
    print("ASSERTION PASSED: fake model received a streaming Chat Completions request with tlon advertised.")
elif calls and all("toolNames" not in call for call in calls):
    print("ASSERTION PENDING: this fake-model server did not expose toolNames in received-call records.")
else:
    print("ASSERTION PENDING: no streaming received-call record advertised tlon yet.")
PY
  else
    echo "(could not read fake-model received calls)"
  fi
  rm -f "$received_file"
  echo
  if [ -n "$fake_model_pid" ]; then
    kill "$fake_model_pid" 2>/dev/null || true
  fi
  exit "$status"
}
trap cleanup EXIT

if curl -fsS "$FAKE_MODEL_HOST_URL/health" >/dev/null 2>&1; then
  echo "==> Reusing fake model at $FAKE_MODEL_HOST_URL"
else
  echo "==> Starting fake model on $FAKE_MODEL_HOST_URL"
  (trap '' INT; PORT="$FAKE_MODEL_PORT" node "$FAKE_MODEL_SERVER") &
  fake_model_pid="$!"
  for _ in $(seq 1 50); do
    if curl -fsS "$FAKE_MODEL_HOST_URL/health" >/dev/null 2>&1; then
      break
    fi
    sleep 0.2
  done
  curl -fsS "$FAKE_MODEL_HOST_URL/health" >/dev/null
fi

curl -fsS -X DELETE "$FAKE_MODEL_HOST_URL/v1/_scripts" >/dev/null
script_json="$(
  python3 - "$SCRIPT_KEY" "$FINAL_REPLY" <<'PY'
import json
import sys

key, final_reply = sys.argv[1], sys.argv[2]
json.dump(
    {
        "key": key,
        "steps": [
            {"kind": "tool_call", "name": "tlon", "args": {"command": "version"}},
            {"kind": "text", "content": final_reply},
        ],
    },
    sys.stdout,
)
PY
)"
curl -fsS \
  -H "content-type: application/json" \
  -d "$script_json" \
  "$FAKE_MODEL_HOST_URL/v1/_scripts" >/dev/null

export HERMES_MODEL_PROVIDER=custom
export HERMES_MODEL=tlon-test-scripted
export HERMES_MODEL_BASE_URL="${HERMES_MODEL_BASE_URL:-http://host.docker.internal:${FAKE_MODEL_PORT}/v1}"
export HERMES_MODEL_API_KEY="${HERMES_MODEL_API_KEY:-no-key-required}"
export HERMES_MODEL_API_MODE=chat_completions
export HERMES_GATEWAY_ARGS="${HERMES_GATEWAY_ARGS:---replace -v}"

cat <<EOF
==> Registered fake-model script "$SCRIPT_KEY"
    Fake-model server: $FAKE_MODEL_SERVER
    Step 1: streamed tlon tool call: {"command":"version"}
    Step 2: final assistant text: $FINAL_REPLY

==> Starting Hermes with:
    HERMES_MODEL_PROVIDER=$HERMES_MODEL_PROVIDER
    HERMES_MODEL=$HERMES_MODEL
    HERMES_MODEL_BASE_URL=$HERMES_MODEL_BASE_URL
    HERMES_MODEL_API_MODE=$HERMES_MODEL_API_MODE

Send this prompt from the configured owner DM to the bot:

[tlon-test:$SCRIPT_KEY] Please run tlon version, then reply normally with the spike result.

After Hermes replies in Tlon, stop this script. The cleanup output will show
the fake-model received-call record for the script key.
EOF

./run.sh
