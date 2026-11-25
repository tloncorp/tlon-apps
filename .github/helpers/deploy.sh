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
# Only deploy-harness.yml sets these; with none set this deploys as before.
# DESK_JUSTFILE: the justfile to build with, from the repository root.
# DESK_REF_SHA=1: $ref is a full commit SHA, which git clone --branch refuses.
# DESK_TARBALL: the tarball's name in the VM's /tmp, so that two desks deployed
# to one ship do not share it.
# DESK_VERIFY=1: stamp the commit into commit.txt, and fail unless the ship
# mounts the desk and ends up holding that commit.
justfile=${DESK_JUSTFILE:-justfile}
tarball=/tmp/${DESK_TARBALL:-janeway-desk.tgz}

echo "Deploying $desk from $ref of $repo to $ship in $zone of $project"
set -e
set -o pipefail

# --- Assemble the desk in the runner ---------------------------------------
workdir=$(mktemp -d "${TMPDIR:-/tmp/}janeway.XXXXXXXXX")
trap 'rm -rf "$workdir"' EXIT

if [ "${DESK_REF_SHA:-}" = 1 ]; then
  git init --quiet "$workdir/src"
  git -C "$workdir/src" fetch --depth 1 "https://github.com/$repo.git" "$ref"
  git -C "$workdir/src" checkout --quiet --detach FETCH_HEAD
else
  git clone --depth 1 --branch "$ref" "https://github.com/$repo.git" "$workdir/src"
fi
# The fallback below assembles the %groups desk.
if [ -n "${DESK_JUSTFILE:-}" ] && [ ! -f "$workdir/src/$justfile" ]; then
  echo "$ref has no $justfile" >&2
  exit 1
fi

# Assemble desk-deps/ (vendored) + desk/ (our source) into a staging dir.
if [ -f "$workdir/src/$justfile" ]; then
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
  just --justfile "$workdir/src/$justfile" out="$workdir/assembled" build
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
if [ "${DESK_VERIFY:-}" = 1 ]; then
  commit=$(git -C "$workdir/src" rev-parse --short HEAD)
  echo "$commit" > "$workdir/assembled/commit.txt"
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
  "$workdir/desk.tgz" urb@"$ship":"$tarball"

# --- Remote: mount, unpack into clay, commit --------------------------------
# $desk and $folder are expanded here (in the runner); \$staging is deferred to
# the remote. No clones / base-dev rsync on the ship.
cmdfile=$(mktemp "${TMPDIR:-/tmp/}janeway.XXXXXXXXX")
# Mounting a desk the ship lacks makes no directory, and rsync would make a
# plain one. Clay hands the runtime the files in the event lens answers in;
# the wait covers the runtime writing them after it answers.
# The remote shell does not stop on errors, and a partial copy that kept
# commit.txt would pass the read-back, so a failed unpack or copy stops there.
mount_check=
untar_check=
rsync_check=
if [ "${DESK_VERIFY:-}" = 1 ]; then
  untar_check=" || { echo 'unpacking $tarball failed'; exit 1; }"
  rsync_check=" || { echo 'copying into $folder failed'; exit 1; }"
  mount_check="i=0
until [ -d $folder ]; do
  i=\$((i + 1))
  if [ \$i -ge 30 ]; then
    echo \"%$desk is not mounted on ~$ship; create it there with |new-desk %$desk\"
    exit 1
  fi
  sleep 2
done
"
fi
cat > "$cmdfile" <<EOF
staging=\$(mktemp -d)
tar xzf $tarball -C \$staging${untar_check}
cd /urbit || exit 1
curl -s --data '{"source":{"dojo":"+hood/unmount %$desk"},"sink":{"app":"hood"}}' http://localhost:12321
curl -s --data '{"source":{"dojo":"+hood/mount %$desk"},"sink":{"app":"hood"}}' http://localhost:12321
${mount_check}rsync -avL --delete \$staging/assembled/ $folder${rsync_check}
curl -s --data '{"source":{"dojo":"+hood/commit %$desk"},"sink":{"app":"hood"}}' http://localhost:12321
rm -rf \$staging $tarball
EOF
if [ "${DESK_VERIFY:-}" = 1 ]; then
  # Read commit.txt back from the desk through lens, whose stdout sink answers
  # with the printed value: a cord prints as 'abc1234'. +hood/commit only asks
  # the runtime for the mount's files (%dirk); Clay commits them in a later
  # event (%into), so this waits for that, up to ten minutes.
  cat >> "$cmdfile" <<EOF
deadline=\$((\$(date +%s) + 600))
while :; do
  body=\$(curl -s --max-time 20 --data '{"source":{"dojo":"(snag 0 .^(wain %cx /=$desk=/commit/txt))"},"sink":{"stdout":null}}' http://localhost:12321)
  case \$body in *"'$commit'"*) break ;; esac
  if [ "\$(date +%s)" -ge "\$deadline" ]; then
    echo "%$desk on ~$ship does not hold $commit; it last answered: \$body"
    exit 1
  fi
  sleep 5
done
echo "%$desk on ~$ship holds $commit"
EOF
fi
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
