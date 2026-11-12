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
#   scripts/test-js.sh --list       print the tests a run would take, without ships
#
# TEST_SHARD=I/N, without a PATTERN, runs or lists the Ith of N parts of the full run,
# as CI does.

# Scripts that check they run on ~lux.
lux_tests="tlon-notes-conformance tlon-completion-conformance tlon-hooks-publishing-conformance"

# A group's test files, in the order the full run takes them: the offline tests, the
# live scripts on ~zod, with ~lux as their peer, and those on ~lux and on ~nec.
function tests
{
  case $1 in
    offline) printf '%s\n' tests-js/*.test.mjs acp/*.test.mjs ;;
    zod)
      for file in tests-js/*-conformance.mjs tests-js/conformance.mjs tests-js/reliability-soak.mjs
      do
        name=${file#tests-js/}
        case " $lux_tests tlon-permissions-conformance " in
          *" ${name%.mjs} "*) ;;
          *) echo "$file" ;;
        esac
      done ;;
    lux) for name in $lux_tests; do echo "tests-js/$name.mjs"; done ;;
    nec) echo tests-js/tlon-permissions-conformance.mjs ;;
  esac
}

shard=$TEST_SHARD
if [ -n "$shard" ]
then
  if ! [[ $shard =~ ^([1-9][0-9]*)/([1-9][0-9]*)$ ]] || [ "${BASH_REMATCH[1]}" -gt "${BASH_REMATCH[2]}" ]
  then
    echo "TEST_SHARD must be I/N, with I from 1 to N, not $shard"
    exit 1
  fi
  shard_index=${BASH_REMATCH[1]} shard_count=${BASH_REMATCH[2]}
  if [ -n "$1" ] && [ "$1" != "--stop" ] && [ "$1" != "--list" ]
  then
    echo "TEST_SHARD runs part of the full run on fresh ships; it takes no PATTERN"
    exit 1
  fi
fi

# Is the test file of this group in this shard? The last shard takes the offline tests
# and the ~lux and ~nec scripts, so it boots no ~zod. The others deal out the ~zod
# scripts in turn, sorted bytewise so that every machine deals them alike; that also
# spreads the slow tlon- scripts, which sort together.
function in_shard
{
  if [ -z "$shard" ] || [ "$shard_count" -eq 1 ]
  then
    return 0
  elif [ "$1" != "zod" ]
  then
    [ "$shard_index" -eq "$shard_count" ]
  else
    [ -n "$zod_order" ] || zod_order=$(tests zod | LC_ALL=C sort)
    position=$(grep -nxF "$2" <<<"$zod_order" | cut -d: -f1)
    [ $(( (position - 1) % (shard_count - 1) + 1 )) -eq "$shard_index" ]
  fi
}

function shard_has
{
  for file in $(tests "$1")
  do
    in_shard "$1" "$file" && return 0
  done
  return 1
}

if [ "$1" == "--list" ]
then
  cd "$(dirname "$0")/.." || exit 1
  for group in offline zod lux nec
  do
    for file in $(tests $group)
    do
      name=$(basename "$file" .mjs)
      in_shard $group "$file" && echo "$group ${name%.test}"
    done
  done
  exit 0
fi

suite=js
tools="node tmux just"
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

# Boot the ships, given as SHIP PORT pairs, that aren't running yet, all at once: each
# boot takes minutes. Each ship owns itself: with each as the other's owner, their bots
# could keep answering each other's DMs.
function boot_ships
{
  pids=
  while [ $# -gt 0 ]
  do
    needs_ship $1 $2 $1 &
    pids="$pids $!"
    shift 2
  done
  booted=0
  for pid in $pids
  do
    wait $pid || booted=1
  done
  return $booted
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
  elif [ "$1" == "reliability-soak" ]
  then
    HARNESS_HEAVY_TESTS=1 timeout 300 node "$2"
  else
    timeout 300 node "$2"
  fi
}

function live
{
  name=$1
  file=$2
  matches "$name" && in_shard $current_ship "$file" || return
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
for file in $(tests offline)
do
  name=$(basename "$file" .test.mjs)
  matches "$name" && in_shard offline "$file" || continue
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
  if shard_has zod
  then
    boot_ships zod 9190 lux 9191 || exit 1
    [ -z "$pattern" ] || deploy zod lux

    echo "Live tests on ~zod"
    use_ship zod 9190
    use_peer lux 9191
    # A channel on ~lux that ~zod has joined. It lives outside %harness, so resets keep it.
    TEST_NEST=$(node tests-js/lib/test-channel.mjs 2> "$logs/test-channel.log") ||
      result test-channel "FAILED (see $logs/test-channel.log)"
    export TEST_NEST
    for file in $(tests zod)
    do
      live "$(basename "$file" .mjs)" "$file"
    done
  fi

  if shard_has lux
  then
    # Already running, unless this shard runs no ~zod scripts.
    boot_ships lux 9191 || exit 1
    echo "Live tests restricted to ~lux"
    use_ship lux 9191
    use_peer zod 9190
    for file in $(tests lux)
    do
      live "$(basename "$file" .mjs)" "$file"
    done
  fi

  if [ -z "$pattern" ]
  then
    stop_ship lux
  fi

  if matches tlon-permissions-conformance && shard_has nec
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
