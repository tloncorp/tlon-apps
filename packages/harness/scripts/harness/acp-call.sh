#!/usr/bin/env bash
# Call one Harness ACP method on a running ship and print its JSON result.
#
#   scripts/harness/acp-call.sh SHIP METHOD < params.json
#
# SHIP is the ship as $CLICK takes it: a fake ship, as ~zod, for
# scripts/ship-click, the default, or a pier for scripts/click.
#
# Parameters come from stdin so credentials stay out of this script's arguments.
# The connection is dropped afterwards, which removes the request from %acp.
set -euo pipefail

[[ $# -eq 2 ]] || { echo "usage: acp-call.sh SHIP METHOD < params.json" >&2; exit 2; }
pier=$1 method=$2
read -ra click <<<"${CLICK:-$(dirname "$0")/../ship-click}"

# Hex keeps arbitrary JSON from being parsed as Hoon, or closing click's cord.
request=$(jq -c --arg method "$method" \
  '{jsonrpc: "2.0", id: 1, method: $method, params: .}' | od -An -v -tx1 | tr -d ' \n')
connection=harness-cli-$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')

# click exits zero even when the thread fails, so check what it printed.
# It joins the thread's lines into one, so each must end in a two-space gap.
# The ship closes click's socket as soon as it has written the result, which
# discards what the socket's buffer did not take: 8 KiB on macOS. So each call
# returns at most 4,000 bytes of the reply, as hex after the reply's length.
# The connection stays open until the last slice: %acp deletes every closed
# connection whenever another one opens.
replies='=/  replies  
  %+  skim  messages.queue  
  |=  [@ud @da payload=@t]  
  =/  frame  (de:json:html payload)  
  ?~  frame  |  
  ?.  ?=(%o -.u.frame)  |  
  (~(has by p.u.frame) '"'"'id'"'"')  '
# Given start, the offset of the slice; the last slice closes, acknowledges and
# drops.
slice='=/  reply=@t  payload.i.replies  
=/  total=@ud  (met 3 reply)  
=/  end=@ud  (min total (add start 4.000))  
=/  through  (roll (turn messages.queue |=([seq=@ud @da @t] seq)) max)  
;<  ~  bind:m  
  =/  n  (strand ,~)  
  ?:  (lth end total)  (pure:n ~)  
  ;<  ~  bind:n  (poke [our.bowl %acp] acp-action-1+!>([%close conn '"'"'done'"'"']))  
  ;<  ~  bind:n  (poke [our.bowl %acp] acp-action-1+!>([%ack conn %client through]))  
  (poke [our.bowl %acp] acp-action-1+!>([%drop conn]))  
=/  hex  (en:base16:mimes:html [(sub end start) (rev 3 (sub end start) (cut 3 [start (sub end start)] reply))])  
(pure:m !>((rap 3 (crip (a-co:co total)) '"'"':'"'"' hex ~)))  '

run() { "${click[@]}" -t 120 -i - -kp "$pier" | tr -d '[:space:]'; }

# Once the request may have reached the ship, any exit short of the last slice
# removes the connection, whose queues can hold credentials and which nothing
# else removes. This never sends the request again.
function cleanup
{
  local result
  result=$(run <<EOF || true
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
=/  conn=@t  ~.$connection  
=/  all=@ud  (dec (bex 64))  
;<  ~  bind:m  (raw-poke [our.bowl %acp] acp-action-1+!>([%close conn 'abandoned']))  
;<  ~  bind:m  (raw-poke [our.bowl %acp] acp-action-1+!>([%ack conn %client all]))  
;<  ~  bind:m  (raw-poke [our.bowl %acp] acp-action-1+!>([%ack conn %agent all]))  
;<  ~  bind:m  (poke [our.bowl %acp] acp-action-1+!>([%drop conn]))  
(pure:m !>(%harness-acp-dropped))  
EOF
)
  [[ $result == *"[0%avow0%noun%harness-acp-dropped]"* ]] ||
    echo "$method: could not remove ACP connection $connection from the ship: $result" >&2
}
pending=1
trap 'if (( pending )); then cleanup; fi' EXIT
trap 'exit 130' INT TERM

output=$(run <<EOF
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
$replies
?:  &(=(~ replies) (lth tries 75))  
  \$(tries +(tries))  
?~  replies  
  (pure:m !>(%harness-acp-timeout))  
=/  start=@ud  0  
$slice
EOF
)
hex='' start=0
while :; do
  page=$(sed -nE "s/.*\[0%avow0%noun'([0-9]+):([0-9a-f]+)'\].*/\1:\2/p" <<<"$output")
  if [[ -z $page ]]; then
    [[ $output == *harness-acp-timeout* ]] && echo "$method: the ship did not reply" >&2 ||
      echo "$method: thread failed: $output" >&2
    exit 1
  fi
  total=${page%%:*} chunk=${page#*:}
  (( ${#chunk} % 2 == 0 )) || { echo "$method: odd-length reply slice: $output" >&2; exit 1; }
  hex+=$chunk start=$(( start + ${#chunk} / 2 ))
  (( start < total )) || break
  output=$(run <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
=/  conn=@t  ~.$connection  
=/  start=@ud  (rash '$start' dem)  
;<  queue=[%messages @t @t messages=(list [@ud @da payload=@t])]  bind:m  
  (scry ,[%messages @t @t messages=(list [@ud @da payload=@t])] /gx/acp/v1/[conn]/client/acp-update-1)  
$replies
?~  replies  ~|(%harness-acp-reply-gone !!)  
$slice
EOF
)
done
(( start == total )) || { echo "$method: got $start of the reply's $total bytes" >&2; exit 1; }
# shellcheck disable=SC2034 # the EXIT trap reads it
pending=0

reply=$(printf '%b' "$(sed 's/../\\x&/g' <<<"$hex")")
if jq -e 'has("error")' <<<"$reply" >/dev/null; then
  echo "$method: $(jq -r '.error.message' <<<"$reply")" >&2
  exit 1
fi
jq -c '.result' <<<"$reply"
