#!/bin/bash
# Run the native Hoon tests on a fake ~zod and summarize. Exits non-zero if anything
# fails. Logs are kept in .test-run/hoon/logs. scripts/test-js.sh runs the rest.
#
#   scripts/test-hoon.sh            every test, on a fresh ship that is then removed
#   scripts/test-hoon.sh PATTERN    tests whose name matches this regex, for example
#                                   harness-context. Ships stay running between runs,
#                                   and get the working tree each time.
#   scripts/test-hoon.sh --stop     stop the ships left running and remove them

suite=hoon
tools="tmux just"
source "$(dirname "$0")/test-lib.sh" "$1"

# Run a directory of native tests on a ship, as the repository's
# scripts/backend/run-tests.sh does.
# click joins the thread's lines into one, so they must end in a two-space gap.
function native
{
  ship=$1
  desk=$2
  tests=$3
  label=$4
  log=$logs/$label.log
  before=$(pane $ship | wc -l)

  result_line=$( scripts/click -t 1800 -i - -kp "$piers/$ship" <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
=/  tests=path  
  [(scot %p our.bowl) %$desk (scot %da now.bowl) $tests ~]  
;<  =thread-result  bind:m  
  (await-thread %test !>(\`tests))  
?:  ?=(%| -.thread-result)  
  %-  (slog %thread-fail p.thread-result)  
  (pure:m !>(|))  
=+  !<(ok=? p.thread-result)  
(pure:m !>(ok))  
EOF
  )
  result_code=`echo $result_line | sed 's/\[0 %avow 0 %noun \(.*\)\]/\1/'`

  # Give the ship a moment to finish printing.
  sleep 2
  pane $ship | tail -n +$((before+1)) > "$log"
  ok=$(grep -c '^OK ' "$log")
  failed=$(grep -c '^FAILED ' "$log")
  crashed=$(grep -c '^CRASHED ' "$log")

  if [[ $result_code == "0" && $ok -gt 0 ]]
  then
    result "$label" "pass ($ok)"
  else
    result "$label" "FAILED ($ok ok, $failed failed, $crashed crashed)"
    grep -E '^(FAILED|CRASHED) ' "$log" | sed -E 's/^(FAILED|CRASHED) +/    /' | tee -a "$results"
  fi
}

# Is anything left that needs a ship?
ship_tests=$( { ls desk/tests desk/tests-integration mcp/desk/tests; echo native-harness native-mcp native-integration; } | sed 's/\.hoon$//' )
if [ -n "$pattern" ] && ! grep -qE "$pattern" <<<"$ship_tests"
then
  ship_tests=
fi

if [ -n "$ship_tests" ]
then
  needs_ship zod 9190 zod || exit 1
  [ -z "$pattern" ] || deploy zod

  echo "Native tests"
  if [ -z "$pattern" ]
  then
    native zod harness %tests native-harness
    native zod mcp %tests native-mcp
  else
    for file in desk/tests/*.hoon
    do
      name=$(basename "$file" .hoon)
      matches "$name" && native zod harness "%tests %$name" "native-$name"
    done
    for file in desk/tests-integration/*.hoon
    do
      name=$(basename "$file" .hoon)
      matches "$name" && native zod harness "%tests-integration %$name" "integration-$name"
    done
    matches native-harness && native zod harness %tests native-harness
    matches native-integration && native zod harness %tests-integration native-integration
    matches native-mcp && native zod mcp %tests native-mcp
  fi

  if [ -z "$pattern" ]
  then
    echo "Integration tests"
    just heavy=true commit "$piers/zod/harness" > "$logs/heavy-commit.log" 2>&1
    sleep 30
    native zod harness %tests-integration native-integration
  fi
fi

summarize
