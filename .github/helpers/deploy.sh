#!/usr/bin/env bash

# this script deploys a desk to a ship from a github repository
# assumes gcloud credentials are loaded and gcloud installed.

repo=$1
desk=$2
ship=$3
zone=$4
project=$5
ref=${6:-"develop"}
[ "$desk" == "talk" ] && from="talk" || from="desk"
folder=$ship/$desk

echo "Deploying $desk from $ref of $repo to $ship in $zone of $project"
set -e
set -o pipefail
cmdfile=$(mktemp "${TMPDIR:-/tmp/}janeway.XXXXXXXXX")
# mktemp only used for generating a random folder name below
cmds='
source_repo=$(mktemp --dry-run /tmp/repo.janeway.XXXXXXXXX)
git clone --depth 1 --branch '$ref' https://github.com/'$repo'.git $source_repo
urbit_repo=$(mktemp --dry-run /tmp/repo.urbit.XXXXXXXXX)
git clone --depth 1 https://github.com/urbit/urbit.git $urbit_repo -b '$URBIT_REPO_TAG' --single-branch
landscape_repo=$(mktemp --dry-run /tmp/repo.landscape.XXXXXXXXX)
git clone --depth 1 --branch master https://github.com/tloncorp/landscape.git $landscape_repo
cd $source_repo
cd /urbit || return
curl -s --data '\''{"source":{"dojo":"+hood/mount %'$desk'"},"sink":{"app":"hood"}}'\'' http://localhost:12321
rsync -avL --delete $source_repo/'$from'/ '$folder'
rsync -avL $source_repo/landscape-dev/ '$folder'
rsync -avL $urbit_repo/pkg/base-dev/ '$folder'
rsync -avL $landscape_repo/desk-dev/ '$folder'
curl -s --data '\''{"source":{"dojo":"+hood/commit %'$desk'"},"sink":{"app":"hood"}}'\'' http://localhost:12321
rm -rf $source_repo
rm -rf $urbit_repo
rm -rf $landscape_repo
'
echo "$cmds"
echo "$cmds" >> "$cmdfile"
sshpriv=$(mktemp "${TMPDIR:-/tmp/}ssh.XXXXXXXXX")
sshpub=$sshpriv.pub
echo "$SSH_PUB_KEY" >> "$sshpub"
echo "$SSH_SEC_KEY" >> "$sshpriv"
chmod 600 $sshpub
chmod 600 $sshpriv

gcloud compute \
  --project "$project" \
  ssh \
  --tunnel-through-iap \
  --ssh-key-file "$sshpriv" \
  --ssh-flag="-T" \
  --zone "$zone" --verbosity info \
  urb@"$ship" < "$cmdfile"

echo "OTA performed for $desk on $ship"