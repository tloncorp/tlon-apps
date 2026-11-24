#!/usr/bin/env bash

# this script deploys a desk to a ship from a github repository
# assumes gcloud credentials are loaded and gcloud installed.
#
# The desk is assembled HERE (in the runner): we clone the repo at $ref, vendor
# its desk dependencies (see desk-deps.yaml — base-dev + landscape picks), and
# ship the assembled desk down to the ship VM. The remote only unpacks it and
# commits — it needs no git and no urbit/landscape clones.

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

# Assemble desk-deps/ (vendored) + desk/ (our source) into a staging dir.
if [ -f "$workdir/src/justfile" ]; then
  mkdir -p "$HOME/.local/bin"
  export PATH="$HOME/.local/bin:$PATH"
  if ! command -v just >/dev/null 2>&1; then
    echo "Installing just..."
    curl -fsSL "https://github.com/casey/just/releases/download/1.59.0/just-1.59.0-$(uname -m)-unknown-linux-musl.tar.gz" \
      | tar xz -C "$HOME/.local/bin" just
  fi
  # fetch-deps.sh needs the Go yq, v4; another tool is also called yq.
  if ! yq --version 2>/dev/null | grep -q mikefarah; then
    echo "Installing yq..."
    curl -fsSL "https://github.com/mikefarah/yq/releases/download/v4.54.1/yq_linux_amd64" -o "$HOME/.local/bin/yq"
    chmod +x "$HOME/.local/bin/yq"
  fi
  just --justfile "$workdir/src/justfile" out="$workdir/assembled" build
else
  # A ref from before the justfile assembles with its own script, which
  # vendors with peru.
  if ! command -v peru >/dev/null 2>&1; then
    echo "Installing peru..."
    pipx install peru \
      || pip install --user peru \
      || pip3 install --user --break-system-packages peru
    export PATH="$HOME/.local/bin:$PATH"
  fi
  "$workdir/src/scripts/assemble-desk.sh" "$workdir/assembled"
fi

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
# the remote. No clones / base-dev rsync on the ship.
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
