#!/bin/bash
# Run the JavaScript tests that need no credentials, the offline ones and then the
# live scripts on fake ships, and summarize. Exits non-zero if anything fails. Logs
# are kept in .test-run/js/logs. scripts/test-hoon.sh
# runs the native tests.
#
#   scripts/test-js.sh              every test, on fresh ships that are then removed
#   scripts/test-js.sh PATTERN      tests whose name matches this regex, for example
#                                   tlon-groups. Ships stay running between runs, and
#                                   get the working tree each time.
#   scripts/test-js.sh --stop       stop the ships left running and remove them

suite=js
tools="node timeout tmux just socat curl jq yq rsync python3"
source "$(dirname "$0")/test-lib.sh" "$1"

# Live scripts this run can't do, and why.
function skip_reason
{
  case $1 in
    openai-auth-conformance) echo "tests a real OpenAI login" ;;
    tlon-media-conformance) echo "needs %storage, which the groups pill lacks, and a real download" ;;
  esac
}

# Opt-ins for scripts that post test messages. All of this runs on throwaway fake ships,
# with local providers in place of real inference.
export CONTROLLED_MODEL=1 CONTEXT_TEST_MESSAGES=1 CONTINUITY_TEST_MESSAGES=1
export HISTORY_TEST_MESSAGES=1 MEMORY_TEST_MESSAGES=1 THREAD_TEST_TRUST=1

# Wipe Harness's agent state, as on a fresh install, so the script sets up what it
# needs. State in other desks, such as DMs and groups, stays. Reviving a live desk does
# nothing, so a nuked desk has to be suspended first.
function reset_ship
{
  scripts/click -t 60 -i - -kp "$piers/$1" > "$logs/reset-$1.log" 2>&1 <<EOF
=/  m  (strand ,vase)  
;<  our=ship  bind:m  get-our  
;<  ~  bind:m  (poke [our %hood] kiln-nuke+!>([%harness &]))  
;<  ~  bind:m  (sleep ~s1)  
;<  ~  bind:m  (poke [our %hood] kiln-suspend+!>(%harness))  
;<  ~  bind:m  (sleep ~s1)  
;<  ~  bind:m  (poke [our %hood] kiln-revive+!>(%harness))  
(pure:m !>(%test-reset-sent))  
EOF
  for attempt in $(seq 1 60)
  do
    result_line=$( scripts/click -t 30 -i - -kp "$piers/$1" 2>/dev/null <<EOF
=/  m  (strand ,vase)  
;<  live=?  bind:m  (scry ? /gu/harness-tlon/\$)  
(pure:m !>(live))  
EOF
    )
    [[ $result_line == *"[0 %avow 0 %noun 0]"* ]] && break
    sleep 1
  done
}

function use_ship
{
  current_ship=$1
  current_port=$2
  export SHIP_URL=http://127.0.0.1:$2 SHIP_COOKIE=$run/$1.cookie SOAK_EXPECT_SHIP="~$1"
  export TEST_PANE=fake-$1: SHIP_DOJO_PANE=fake-$1: HOSTED_CONTENT_TEST_SHIP=$1
}

function use_peer
{
  export PEER_URL=http://127.0.0.1:$2 PEER_COOKIE=$run/$1.cookie PEER_SHIP="~$1" TEST_PEER="~$1"
  export TEST_PEER_PANE=fake-$1:
}

# Stop a running ship and start it again from its pier.
function restart_ship
{
  stop_ship $1
  vere=$(echo "$root"/.deps-cache/vere-v*)
  tmux new-session -d -s "fake-$1" -x 180 -y 50 "exec $vere --loom 33 --http-port $2 $piers/$1"
  for attempt in $(seq 1 120)
  do
    curl -s -o /dev/null "http://127.0.0.1:$2/~/login" && return 0
    sleep 1
  done
  return 1
}

function run_script
{
  if [ "$1" == "hosting-lifecycle-conformance" ]
  then
    # It seeds durable evidence, then checks that the evidence outlives a restart.
    export LIFECYCLE_ID=hosting-life-$(date +%s)
    timeout 120 node "$2" seed && restart_ship $current_ship $current_port && timeout 120 node "$2" check
  else
    timeout 300 node "$2"
  fi
}

function live
{
  name=$1
  file=$2
  matches "$name" || return
  reason=$(skip_reason "$name")
  if [ -n "$reason" ]
  then
    result "$name" "skipped: $reason"
    return
  fi
  # Each script starts clean, so results don't depend on the order they run in.
  reset_ship $current_ship
  run_script "$name" "$file" > "$logs/$name.log" 2>&1
  code=$?
  if [ "$code" -eq 0 ]
  then
    result "$name" "pass"
  elif grep -q '^INCOMPLETE' "$logs/$name.log"
  then
    result "$name" "incomplete: $(grep -m1 '^INCOMPLETE' "$logs/$name.log" | cut -c1-60)"
  elif [ "$code" -eq 124 ]
  then
    result "$name" "FAILED (timed out)"
  else
    result "$name" "FAILED (see $logs/$name.log)"
  fi
}

echo "Offline tests"
for file in tests-js/*.test.mjs acp/*.test.mjs
do
  name=$(basename "$file" .test.mjs)
  matches "$name" || continue
  [ "$name" == "distribution" ] && just build > "$logs/build.log" 2>&1
  timeout 300 node --test "$file" > "$logs/$name.log" 2>&1
  if [ "$?" -eq 0 ]
  then
    result "$name" "pass"
  else
    result "$name" "FAILED (see $logs/$name.log)"
  fi
done

# Is anything left that needs a ship?
ship_tests=$( ls tests-js | grep -E 'conformance|reliability-soak' | sed 's/\.mjs$//' )
if [ -n "$pattern" ] && ! grep -qE "$pattern" <<<"$ship_tests"
then
  ship_tests=
fi

if [ -n "$ship_tests" ]
then
  # Each ship owns itself: with each as the other's owner, their bots could keep
  # answering each other's DMs.
  needs_ship zod 9190 zod || exit 1
  needs_ship lux 9191 lux || exit 1
  [ -z "$pattern" ] || deploy zod lux

  echo "Live tests on ~zod"
  use_ship zod 9190
  use_peer lux 9191
  # A channel on ~lux that ~zod has joined. It lives outside %harness, so resets keep it.
  TEST_NEST=$(node tests-js/lib/test-channel.mjs 2> "$logs/test-channel.log") ||
    result test-channel "FAILED (see $logs/test-channel.log)"
  export TEST_NEST
  for file in tests-js/*-conformance.mjs tests-js/conformance.mjs
  do
    name=$(basename "$file" .mjs)
    case $name in
      tlon-notes-conformance|tlon-completion-conformance|tlon-hooks-publishing-conformance|tlon-permissions-conformance)
        continue ;;
    esac
    live "$name" "$file"
  done
  HARNESS_HEAVY_TESTS=1 live reliability-soak tests-js/reliability-soak.mjs

  echo "Live tests restricted to ~lux"
  use_ship lux 9191
  use_peer zod 9190
  for name in tlon-notes-conformance tlon-completion-conformance tlon-hooks-publishing-conformance
  do
    live "$name" "tests-js/$name.mjs"
  done

  if [ -z "$pattern" ]
  then
    stop_ship lux
  fi

  if matches tlon-permissions-conformance
  then
    echo "Live tests restricted to ~nec"
    if needs_ship nec 9192 nec
    then
      use_ship nec 9192
      live tlon-permissions-conformance tests-js/tlon-permissions-conformance.mjs
      [ -n "$pattern" ] || stop_ship nec
    fi
  fi
fi

summarize
