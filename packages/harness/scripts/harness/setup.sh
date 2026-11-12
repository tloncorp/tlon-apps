#!/usr/bin/env bash
# Make an installed Harness reachable from Tlon: set the owner, turn on the
# Tlon hand and send Context Lens records to the owner. Safe to run again.
#
#   scripts/harness/setup.sh PIER OWNER
set -euo pipefail

[[ $# -eq 2 ]] || { echo "usage: setup.sh PIER OWNER" >&2; exit 2; }
pier=$1 owner=$2
[[ $owner =~ ^~[a-z-]+$ ]] || { echo "owner must be a ship name such as ~zod, got '$owner'" >&2; exit 1; }
call() { "$(dirname "$0")/acp-call.sh" "$pier" "$1"; }

status=$(echo '{}' | call harness/tlon)

jq -c --arg owner "$owner" '{
  owner: $owner,
  expectedOwner: .policy.owner,
  siblingMoonOwners: .siblingMoonOwners,
  expectedSiblingMoonOwners: .siblingMoonOwners
}' <<<"$status" | call harness/tlon/owner/set >/dev/null
echo "owner set to $owner"

status=$(echo '{}' | call harness/tlon)
jq -c '.policy + {enabled: true, expectedOwner: .policy.owner, expectedRevision: .revision}' <<<"$status" |
  call harness/tlon/configure >/dev/null
echo "Tlon hand enabled"

jq -cn --arg owner "$owner" '{enabled: true, expectedOwner: $owner}' |
  call harness/tlon/lens/configure >/dev/null
echo "Context Lens sync enabled"

status=$(echo '{}' | call harness/tlon)
ship=$(jq -r '.ship' <<<"$status")
echo "replies in channels: $(jq -r '.policy.response' <<<"$status")"
if [[ $ship != "$owner" ]]; then
  echo
  echo "To see this bot's runs in Tlon's Context Lens, run this on $owner:"
  echo "  :steward &steward-action-1 [%trust-bot $ship]"
fi
