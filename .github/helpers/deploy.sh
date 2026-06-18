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
folder=$ship/$desk

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
curl -s --data '{"source":{"dojo":"+hood/unmount %$desk"},"sink":{"app":"hood"}}' http://localhost:12321
curl -s --data '{"source":{"dojo":"+hood/mount %$desk"},"sink":{"app":"hood"}}' http://localhost:12321
rsync -avL --delete \$staging/assembled/ $folder
curl -s --data '{"source":{"dojo":"+hood/commit %$desk"},"sink":{"app":"hood"}}' http://localhost:12321
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
