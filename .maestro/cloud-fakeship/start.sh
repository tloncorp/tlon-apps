#!/usr/bin/env bash
set -euo pipefail
: "${NGROK_AUTHTOKEN:?Tunnel credential missing}"
mkdir -p "$PROOF_OUTPUT"
start=$SECONDS
runner_ip=$(curl -fsS https://api.ipify.org)
[[ "$runner_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]

# ngrok appends the actual source IP; nginx trusts only the loopback agent
# and uses that last value (real_ip_recursive off). Do not trust client values.
cat > "$RUNNER_TEMP/proof-nginx.conf" <<EOF
pid $RUNNER_TEMP/proof-nginx.pid;
error_log $PROOF_OUTPUT/proxy.log;
events { worker_connections 1024; }
http {
client_body_temp_path $RUNNER_TEMP/proof-nginx-body;
proxy_temp_path $RUNNER_TEMP/proof-nginx-temp;
server {
  listen 127.0.0.1:49379;
  set_real_ip_from 127.0.0.1;
  real_ip_header X-Forwarded-For;
  real_ip_recursive off;
  allow 207.254.42.234;
  allow 34.127.79.8;
  allow 35.247.62.137;
  allow 34.83.16.33;
  allow $runner_ip;
  deny all;
  access_log off;
  location / {
    proxy_pass http://127.0.0.1:35453;
    proxy_http_version 1.1;
    proxy_set_header Host \$http_host;
    proxy_buffering off;
    proxy_read_timeout 300s;
  }
}
}
EOF
nginx -t -c "$RUNNER_TEMP/proof-nginx.conf"
nginx -c "$RUNNER_TEMP/proof-nginx.conf"
status=$(curl -s -o /dev/null -w '%{http_code}' -H 'X-Forwarded-For: 207.254.42.234, 192.0.2.1' http://127.0.0.1:49379)
test "$status" = 403
echo 'Proxy rejected a spoofed allowlisted address.'
ngrok http 127.0.0.1:49379 --inspect=false --log stdout --log-format json > "$PROOF_OUTPUT/ngrok.log" 2>&1 &
echo $! > "$PROOF_OUTPUT/ngrok.pid"
url=''
for attempt in $(seq 1 10); do
  url=$(curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null | jq -r '.tunnels[]? | select(.proto == "https") | .public_url' || true)
  [ -n "$url" ] && break
  kill -0 "$(cat "$PROOF_OUTPUT/ngrok.pid")" || { cat "$PROOF_OUTPUT/ngrok.log"; exit 1; }
  sleep 1
done
[[ "$url" == https://* ]]
echo "Tunnel connected after $((SECONDS-start)) seconds."

# Rube owns preparation, desk commit/readiness and ship process cleanup.
tmux new-session -d -s proof-rube "cd '$PWD/apps/tlon-web' && SKIP_TESTS=true INCLUDE_OPTIONAL_SHIPS=false pnpm rube > '$PROOF_OUTPUT/rube.log' 2>&1"
deadline=$((SECONDS+1200))
last_progress=$SECONDS
until grep -q SHIP_SETUP_COMPLETE "$PROOF_OUTPUT/rube.log" 2>/dev/null; do
  tmux has-session -t proof-rube || { tail -60 "$PROOF_OUTPUT/rube.log"; exit 1; }
  if ((SECONDS > deadline)); then tail -60 "$PROOF_OUTPUT/rube.log"; exit 1; fi
  if ((SECONDS-last_progress >= 30)); then tail -4 "$PROOF_OUTPUT/rube.log"; last_progress=$SECONDS; fi
  sleep 5
done
echo "Ships prepared after $((SECONDS-start)) seconds."

# Capture checkout and the actual assembled desk, including vendored files.
git rev-parse HEAD > "$PROOF_OUTPUT/source.txt"
find apps/tlon-web/rube/dist/desk-staging -type f -print0 | sort -z | xargs -0 sha256sum > "$PROOF_OUTPUT/desk-manifest.txt"
NODE_OPTIONS=--conditions=tlon-source pnpm --filter @tloncorp/tlon-bot-e2e exec tsx "$PWD/.maestro/cloud-fakeship/peer.ts" > "$PROOF_OUTPUT/peer.log" 2>&1 &
echo $! > "$PROOF_OUTPUT/peer.pid"
deadline=$((SECONDS+120))
until [ -f "$PROOF_OUTPUT/peer-ready.json" ]; do
  kill -0 "$(cat "$PROOF_OUTPUT/peer.pid")" || { cat "$PROOF_OUTPUT/peer.log"; exit 1; }
  if ((SECONDS > deadline)); then cat "$PROOF_OUTPUT/peer.log"; exit 1; fi
  sleep 1
done
cat "$PROOF_OUTPUT/peer-ready.json"
code=$(jq -r '."~zod".code' apps/tlon-web/e2e/shipManifest.json)
echo "::add-mask::$code"
# Verify authentication over the same public HTTPS route the device will use.
curl -fsS -c "$RUNNER_TEMP/proof-cookie" --data-urlencode "password=$code" "$url/~/login" >/dev/null
curl -fsS -b "$RUNNER_TEMP/proof-cookie" "$url/~/scry/groups/groups/light.json" | jq -e 'type == "object"' >/dev/null
rm "$RUNNER_TEMP/proof-cookie"
echo "url=$url" >> "$GITHUB_OUTPUT"
echo "code=$code" >> "$GITHUB_OUTPUT"
mkdir -p proof-flows
cp -R .maestro/reliability .maestro/cloud-fakeship proof-flows/
printf 'flows:\n  - cloud-fakeship/exchange.yaml\n' > proof-flows/config.yaml
printf '{"readySeconds":%s}\n' "$((SECONDS-start))" > "$PROOF_OUTPUT/preparation.json"
