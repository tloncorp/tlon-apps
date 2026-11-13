#!/usr/bin/env bash
# Call one Harness ACP method on a running ship and print its JSON result.
#
#   scripts/harness/acp-call.sh PIER METHOD < params.json
#
# Parameters come from stdin so credentials stay out of this script's arguments.
# The connection is dropped afterwards, which removes the request from %acp.
set -euo pipefail

[[ $# -eq 2 ]] || { echo "usage: acp-call.sh PIER METHOD < params.json" >&2; exit 2; }
pier=$1 method=$2
read -ra click <<<"${CLICK:-$(dirname "$0")/../click}"

source "$(dirname "$0")/../ship-lib.sh"
check_socket "$pier"
socket=$pier/.urb/conn.sock
[[ -S $socket ]] || { echo "no running ship at $pier" >&2; exit 1; }

# Hex keeps arbitrary JSON from being parsed as Hoon, or closing click's cord.
request=$(jq -c --arg method "$method" \
  '{jsonrpc: "2.0", id: 1, method: $method, params: .}' | od -An -v -tx1 | tr -d ' \n')
connection=harness-cli-$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')

# click exits zero even when the thread fails, so check what it printed.
# It joins these lines into one, so each must end in a two-space gap.
output=$("${click[@]}" -t 120 -i - -kp "$pier" <<EOF | tr -d '[:space:]'
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
=/  conn=@t  ~.$connection  
=/  request=@t  (swp 3 (rash ~.$request hex))  
;<  ~  bind:m  (poke [our.bowl %acp] acp-action-1+!>([%open conn]))  
;<  ~  bind:m  (poke [our.bowl %acp] acp-action-1+!>([%send conn %agent request]))  
=/  tries=@ud  0  
|-  ^-  form:m  
;<  ~  bind:m  (sleep ~s0..4000)  
;<  queue=[%messages @t @t messages=(list [@ud @da payload=@t])]  bind:m  
  (scry ,[%messages @t @t messages=(list [@ud @da payload=@t])] /gx/acp/v1/[conn]/client/acp-update-1)  
=/  replies  
  %+  skim  messages.queue  
  |=  [@ud @da payload=@t]  
  =/  frame  (de:json:html payload)  
  ?~  frame  |  
  ?.  ?=(%o -.u.frame)  |  
  (~(has by p.u.frame) 'id')  
?:  &(=(~ replies) (lth tries 75))  
  \$(tries +(tries))  
;<  ~  bind:m  (poke [our.bowl %acp] acp-action-1+!>([%close conn 'done']))  
?~  replies  
  (pure:m !>(%harness-acp-timeout))  
=/  through  (roll (turn messages.queue |=([seq=@ud @da @t] seq)) max)  
;<  ~  bind:m  (poke [our.bowl %acp] acp-action-1+!>([%ack conn %client through]))  
;<  ~  bind:m  (poke [our.bowl %acp] acp-action-1+!>([%drop conn]))  
(pure:m !>((en:base16:mimes:html (as-octs:mimes:html (swp 3 payload.i.replies)))))  
EOF
)
hex=$(sed -nE "s/.*\[0%avow0%noun'([0-9a-f]+)'\].*/\1/p" <<<"$output")
if [[ -z $hex ]]; then
  [[ $output == *harness-acp-timeout* ]] && echo "$method: the ship did not reply" >&2 ||
    echo "$method: thread failed: $output" >&2
  exit 1
fi

reply=$(printf '%b' "$(sed 's/../\\x&/g' <<<"$hex")")
if jq -e 'has("error")' <<<"$reply" >/dev/null; then
  echo "$method: $(jq -r '.error.message' <<<"$reply")" >&2
  exit 1
fi
jq -c '.result' <<<"$reply"
