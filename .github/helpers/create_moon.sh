#!/usr/bin/env bash

# this script creates a moon for an ephemeral deployment on a ship.
# assumes gcloud credentials are loaded and gcloud installed.

ship=$1
zone=$2
project=$3

echo "Creating a moon under $ship in $zone of $project"
set -e
set -o pipefail
cmdfile=$(mktemp "${TMPDIR:-/tmp/}moonspawn.XXXXXXXXX")
moondir=$(mktemp "${TMPDIR:-/urbit/}moondir.XXXXXXXXX")
# mktemp only used for generating a random folder name below
cmds='
click -kp /urbit/natmud-mogzod \
(our hoon thread to make a moon here) > $moondir/details ## need to provide actual hoon thread to extract moon name and keys + write to file
moon_name =$(cat $moondir/details | grep "some pattern for getting moon name")
moon_key =$(cat $moondir/details | grep "some pattern for getting moon key")
mkdir $moondir/$moon_name
urbit -w $moondir/$moon_name -k $moon_key ## we need to run this in a detached way
curl ... #some check to see if the moon is up
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

echo "moon created"