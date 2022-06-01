#!/usr/bin/env bash

echo "$2" | base64 -d > /service-account
echo "$3" | base64 -d > /id_ssh
echo "$4" | base64 -d > /id_ssh.pub

chmod 600 /service-account
chmod 600 /id_ssh
chmod 600 /id_ssh.pub

# janeway release glob homestead \
#     --credentials /service-account \
#     --ssh-key /id_ssh \
#     --ci \
#   | bash

janeway release ota homestead "$1" \
    --verbose \
    --no-commit \
    --credentials /service-account \
    --ci \
  | bash
