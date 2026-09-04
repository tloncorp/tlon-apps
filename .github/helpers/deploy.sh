#!/usr/bin/env bash

# this script deploys a desk to a ship from a github repository
# assumes gcloud credentials are loaded and gcloud installed.
#
# The desk is assembled HERE (in the runner): we clone the repo at $ref, vendor
# its desk dependencies with peru (see peru.yaml — base-dev + landscape picks),
# and ship the finished desk/ down to the ship VM. The remote only unpacks it
# and commits — it needs no peru, no git, and no urbit/landscape clones.

repo=$1
desk=$2
ship=$3
zone=$4
project=$5
ref=${6:-"develop"}
# The GCE instance name ($ship) and the pier folder on that instance usually
# match, but can diverge (e.g. a moon whose folder is its full patp while the
# instance is a truncated name). Optional 7th arg overrides the folder name;
# defaults to $ship to keep existing callers unchanged.
pier=${7:-$ship}
folder=$pier/$desk

echo "Deploying $desk from $ref of $repo to $ship in $zone of $project"
set -e
set -o pipefail

# --- Assemble the desk in the runner ---------------------------------------
workdir=$(mktemp -d "${TMPDIR:-/tmp/}janeway.XXXXXXXXX")
trap 'rm -rf "$workdir"' EXIT

git clone --depth 1 --branch "$ref" "https://github.com/$repo.git" "$workdir/src"

# Install peru if it isn't already available (assemble-desk.sh runs peru sync).
if ! command -v peru >/dev/null 2>&1; then
  echo "Installing peru..."
  pipx install peru \
    || pip install --user peru \
    || pip3 install --user --break-system-packages peru
  export PATH="$HOME/.local/bin:$PATH"
fi

# Assemble desk-deps/ (peru-vendored) + desk/ (our source) into a staging dir.
"$workdir/src/scripts/assemble-desk.sh" "$workdir/assembled"

# Package the assembled, self-contained desk.
tar czf "$workdir/desk.tgz" -C "$workdir" assembled

# --- Speed up the IAP tunnel ------------------------------------------------
# gcloud's IAP TCP forwarding is a single-threaded Python websocket proxy. With
# NumPy available its upload path is dramatically faster (gcloud prints a
# warning recommending this). The whole assembled desk is shipped UP through
# this tunnel, so without NumPy the scp below takes ~4 min. CLOUDSDK_PYTHON_-
# SITEPACKAGES lets gcloud's bundled interpreter see the system-installed numpy.
export CLOUDSDK_PYTHON_SITEPACKAGES=1
if ! python3 -c 'import numpy' >/dev/null 2>&1; then
  echo "Installing NumPy to speed up the IAP tunnel..."
  pip3 install --user numpy \
    || pip3 install --user --break-system-packages numpy \
    || echo "WARNING: NumPy install failed; tunnel upload will be slow."
fi

# --- SSH key setup ----------------------------------------------------------
sshpriv=$(mktemp "${TMPDIR:-/tmp/}ssh.XXXXXXXXX")
sshpub=$sshpriv.pub
echo "$SSH_PUB_KEY" >> "$sshpub"
echo "$SSH_SEC_KEY" >> "$sshpriv"
chmod 600 "$sshpub"
chmod 600 "$sshpriv"

# --- Ship the assembled desk to the remote over the IAP tunnel --------------
gcloud compute scp \
  --project "$project" \
  --tunnel-through-iap \
  --ssh-key-file "$sshpriv" \
  --zone "$zone" --verbosity info \
  "$workdir/desk.tgz" urb@"$ship":/tmp/janeway-desk.tgz

# --- Remote: mount, unpack into clay, commit --------------------------------
# $desk and $folder are expanded here (in the runner); \$staging is deferred to
# the remote. No clones / peru / base-dev rsync on the ship.
cmdfile=$(mktemp "${TMPDIR:-/tmp/}janeway.XXXXXXXXX")
cat > "$cmdfile" <<EOF
staging=\$(mktemp -d)
tar xzf /tmp/janeway-desk.tgz -C \$staging
cd /urbit || exit 1
set -euo pipefail
pikes_json=''
refresh_pikes() {
  pikes_json=\$(curl -fsS http://localhost:12321/~/scry/hood/kiln/pikes.json) \
    || { echo 'Unable to read Hood kiln pikes' >&2; exit 1; }
}
has_desk() {
  local target="\$1"
  grep -Eq '"\$target"[[:space:]]*:' <<<"\$pikes_json"
}
hood_command() {
  local command="\$1"
  curl -fsS --header 'Content-Type: application/json' \
    --data "{\"source\":{\"dojo\":\"+hood/\$command\"},\"sink\":{\"app\":\"hood\"}}" \
    http://localhost:12321
}
refresh_pikes
if ! has_desk "$desk"; then
  echo "Creating %$desk from %base"
  hood_command "merge %$desk our %base"
  for attempt in \$(seq 1 30); do
    refresh_pikes
    if has_desk "$desk"; then
      break
    fi
    sleep 1
  done
  has_desk "$desk" || { echo "Timed out waiting for %$desk" >&2; exit 1; }
fi
hood_command "unmount %$desk"
hood_command "mount %$desk"
rsync -avL --delete \$staging/assembled/ $folder
hood_command "commit %$desk"
if [ "$desk" = tlon ]; then
  refresh_pikes
  if has_desk groups; then
    hood_command 'suspend %groups'
    # Hood acknowledges suspension before Gall has necessarily stopped every
    # legacy agent. Give that transition time to release the agent names.
    sleep 3
  fi
  hood_command 'install our %tlon'
  # Gall startup can outlive a Hood request. Dispatch it independently, then
  # verify the actual application rather than leaving the deploy job blocked.
  nohup curl -fsS --header 'Content-Type: application/json' \
    --data '{"source":{"dojo":"+hood/revive %tlon"},"sink":{"app":"hood"}}' \
    http://localhost:12321 >/tmp/tlon-revive.log 2>&1 &
  for attempt in \$(seq 1 90); do
    if curl -fsS http://localhost:12321/~/scry/groups/groups/light.json >/dev/null; then
      break
    fi
    sleep 2
  done
  curl -fsS http://localhost:12321/~/scry/groups/groups/light.json >/dev/null \
    || { echo '%tlon agents did not become healthy' >&2; exit 1; }
fi
rm -rf \$staging /tmp/janeway-desk.tgz
EOF
echo "Remote commands:"
cat "$cmdfile"

gcloud compute \
  --project "$project" \
  ssh \
  --tunnel-through-iap \
  --ssh-key-file "$sshpriv" \
  --ssh-flag="-T" \
  --zone "$zone" --verbosity info \
  urb@"$ship" < "$cmdfile"

echo "OTA performed for $desk on $ship"
