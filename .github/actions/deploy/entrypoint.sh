#!/usr/bin/env bash

echo "$3" | base64 -d > /service-account
echo "$4" | base64 -d > /id_ssh
echo "$5" | base64 -d > /id_ssh.pub

chmod 600 /service-account
chmod 600 /id_ssh
chmod 600 /id_ssh.pub

janeway \
    --ci \
    --credentials /service-account \
    --ssh-key /id_ssh \
    release glob \
    "$1" \
  | bash

janeway \
    --ci \
    --verbose \
    --credentials /service-account \
    --ssh-key /id_ssh \
    release ota \
    "$1" "$2" \
    ${6:+"--ref"} ${6:+"$6"} \
  | bash
