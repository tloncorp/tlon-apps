#!/usr/bin/env bash
set -euo pipefail
start=$SECONDS
dist="$PWD/apps/tlon-web/rube/dist"
# Stop only Rube's two parent ship processes. Let Vere flush state before
# Rube's broader cleanup, which is unsuitable for saving a reusable pier.
pids=()
for ship in zod ten; do
  pid=$(ps -eo pid=,args= | awk -v pier="$dist/$ship/$ship" '$3 == pier && $2 ~ /\/urbit$/ {print $1}')
  [[ "$pid" =~ ^[0-9]+$ ]]
  pids+=("$pid")
  kill -TERM "$pid"
done
for pid in "${pids[@]}"; do
  while kill -0 "$pid" 2>/dev/null; do
    ((SECONDS-start < 60)) || { echo 'Unclean shutdown; snapshot not saved.'; exit 1; }
    sleep 1
  done
done
for ship in zod ten; do
  grep -Fq "[Urbit EXIT ($ship)]: code=0 signal=null" "$PROOF_OUTPUT/rube.log"
  test ! -e "$dist/$ship/$ship/.vere.lock"
done
tmux kill-session -t proof-rube
mkdir -p .proof-snapshot
mv "$dist/zod" "$dist/ten" .proof-snapshot/
cp -a "$dist/urbit_extracted/urbit" .proof-snapshot/urbit
mv .peru/cache .proof-snapshot/peru-cache
# The ready receipt identifies the fixture even if a later UI check failed.
receipt="$PROOF_OUTPUT/peer-result.json"
[ -f "$receipt" ] || receipt="$PROOF_OUTPUT/peer-ready.json"
cp "$receipt" .proof-snapshot/peer-result.json
du -sh .proof-snapshot
printf '{"snapshotSeconds":%s}\n' "$((SECONDS-start))" > "$PROOF_OUTPUT/snapshot.json"
