#!/bin/bash
# Run the JavaScript tests that need no credentials, the offline ones and then the
# live scripts on fake ships, and summarize. Exits non-zero if anything fails. Logs
# are kept in .test-run/js/logs. scripts/test-hoon.sh runs the native tests.
#
#   scripts/test-js.sh              every test, in a fresh container that is then removed
#   scripts/test-js.sh PATTERN      tests whose name matches this regex, for example
#                                   tlon-groups. The container and its ships stay
#                                   running between runs, and the ships get the
#                                   working tree each time.
#   scripts/test-js.sh --stop       remove the container left running
#   scripts/test-js.sh --list       print the tests a run would take, without ships
#
# TEST_SHARD=I/N, without a PATTERN, runs or lists the Ith of N parts of the full run,
# as CI does.
#
# The tests start local servers that the ships call, so the tests and the ships run
# in one container, from the image built from scripts/test-js/, with the repository
# mounted read-only at its own path and .test-run/js writable. On the host this
# script builds the desks and the image, starts the container and runs itself in it;
# there it boots the ships, as processes with their piers in the container, and runs
# the tests.

# Scripts that check they run on ~lux.
lux_tests="tlon-notes-conformance tlon-completion-conformance tlon-hooks-publishing-conformance"
# Scripts that need ~nec: one on ~nec alone, and one with ~zod as the bot, ~lux as its
# owner and ~nec as a guest in the same channel.
nec_tests="tlon-permissions-conformance tlon-shared-channel-conformance"

# A group's test files, in the order the full run takes them: the offline tests, the
# live scripts on ~zod, with ~lux as their peer, those on ~lux and those needing ~nec.
function tests
{
  case $1 in
    offline) printf '%s\n' tests-js/*.test.mjs acp/*.test.mjs ;;
    zod)
      for file in tests-js/*-conformance.mjs tests-js/conformance.mjs tests-js/reliability-soak.mjs
      do
        name=${file#tests-js/}
        case " $lux_tests $nec_tests " in
          *" ${name%.mjs} "*) ;;
          *) echo "$file" ;;
        esac
      done ;;
    lux) for name in $lux_tests; do echo "tests-js/$name.mjs"; done ;;
    nec) for name in $nec_tests; do echo "tests-js/$name.mjs"; done ;;
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
# and the ~lux and ~nec scripts; it boots ~zod only for the shared channel script. The
# others deal out the ~zod scripts in turn, sorted bytewise so that every machine deals
# them alike; that also spreads the slow tlon- scripts, which sort together.
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

pattern=$1
root=$(cd "$(dirname "$0")/.." && pwd -P)
cd "$root" || exit 1

if [ "$pattern" == "--list" ]
then
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

out=$root/.test-run/js
logs=$out/logs
results=$out/results.txt

# On the host: set up the container and run this script in it.
if [ -z "$TEST_JS_CONTAINER" ]
then
  source scripts/ship-lib.sh
  # This checkout's, so that checkouts can run their tests at once.
  container=fake-test-js-$checkout
  test_image=harness-test-js:$checkout
  for tool in $runtime just yq rsync python3
  do
    command -v $tool > /dev/null || { echo "$tool is not installed"; exit 1; }
  done

  if [ "$pattern" == "--stop" ]
  then
    $runtime rm -f "$container" > /dev/null 2>&1
    echo "Stopped the JavaScript test ships"
    exit 0
  fi

  # A PATTERN run reuses the container; a full run starts a fresh one.
  if running "$container"
  then
    if [ -z "$pattern" ]
    then
      echo "container $container is running; stop it first (just test --stop)"
      exit 1
    fi
  else
    $runtime rm -f "$container" > /dev/null 2>&1
  fi

  if [ -z "$pattern" ]
  then
    rm -rf "${out:?}"
    trap '$runtime rm -f "$container" > /dev/null 2>&1' EXIT
  fi
  mkdir -p "$logs"

  # The ships install %harness and %mcp from their build output, and the offline
  # tests check the first; the container has neither just nor the network.
  echo "Building the desks..."
  { just build && just --justfile mcp/justfile build; } > "$logs/build.log" 2>&1 ||
    { echo "Failed to build the desks; see $logs/build.log"; exit 1; }
  { build_image &&
    $runtime build -q -t "$test_image" --build-arg SHIP_IMAGE="$image" scripts/test-js > /dev/null &&
    prune_images; } ||
    { echo "Failed to build the test image"; exit 1; }

  if ! running "$container"
  then
    # --init adopts the ships, which outlive the script that starts them, and reaps
    # them when they stop; as process 1, sleep would not.
    # shellcheck disable=SC2086
    $runtime run -d --name "$container" --init $user_args \
      -v "$repo:$repo:ro" -v "$out:$out" --entrypoint sleep "$test_image" infinity > /dev/null ||
      { echo "Failed to start container $container"; exit 1; }
  fi
  # Pass on the variables the tests read, so that a switch set here, such as
  # COMPACTION_WATCHDOG_TEST=1, reaches them. -e NAME leaves an unset one unset.
  env_args=$(grep -rhoE 'process\.env\.[A-Z_0-9]+' tests-js | sort -u |
    sed -e 's/process\.env\./-e /' -e '/^-e PATH$/d')
  # shellcheck disable=SC2086
  $runtime exec -w "$root" $env_args -e TEST_JS_CONTAINER="$container" -e TEST_SHARD="$TEST_SHARD" \
    "$container" scripts/test-js.sh "$pattern"
  exit
fi

# In the container: the ships' piers, and their login cookies, on its own filesystem.
piers=/piers
container=$TEST_JS_CONTAINER
click="$root/scripts/click -b urbit"
source scripts/results-lib.sh
source scripts/setup-lib.sh
: > "$results"

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

function running
{
  [ -f "$piers/$1.pid" ] && kill -0 "$(cat "$piers/$1.pid")" 2> /dev/null
}

# Start ~$1 from its pier, which the image's entrypoint boots from the pill if it does
# not exist, with HTTP on port $2. The subshell exits at once, so the ship is not this
# script's child: --init adopts it, and reaps it when it stops.
function start_ship
{
  ( HTTP_PORT=$2 URBIT_ARGS="--loom 33" entrypoint.sh "$1" >> "$logs/ship-$1.log" 2>&1 < /dev/null &
    echo $! > "$piers/$1.pid" )
}

# Wait for the HTTP server of ~$1 on port $2. Fail if the ship stops first.
function await_ship
{
  until curl -s -o /dev/null "http://127.0.0.1:$2/~/login"
  do
    running "$1" || { echo "~$1 exited; see $logs/ship-$1.log" >&2; return 1; }
    sleep 1
  done
}

# Stop ~$1 as a container stop would: SIGTERM, then SIGKILL after a minute.
function stop_ship
{
  running "$1" || return 0
  kill "$(cat "$piers/$1.pid")"
  for attempt in $(seq 1 60)
  do
    running "$1" || return 0
    sleep 1
  done
  kill -KILL "$(cat "$piers/$1.pid")"
  while running "$1"; do sleep 1; done
}

# Boot ~$1 with HTTP on port $2, install everything with ~$3 as Harness's owner and
# log in. setup-lib.sh exits on a failure, so the boot runs in a subshell.
function boot
{
  echo "Booting ~$1..."
  if ! (
    pier=$piers/$1 http_port=$2
    start_ship "$1" "$2" && await_ship "$1" "$2" &&
      setup_ship "$root/mcp/desk-out" "$root/desk-out" "~$3"
  ) > "$logs/boot-$1.log" 2>&1
  then
    result "boot ~$1" "FAILED (see $logs/boot-$1.log)"
    return 1
  fi
  # Eyre answers a wrong code with 400, which -f makes a failure.
  if ! curl -sSf -m 15 -o /dev/null -c "$piers/$1.cookie" \
    -d "password=$(login_code "$piers/$1")" "http://127.0.0.1:$2/~/login"
  then
    result "login ~$1" "FAILED"
    return 1
  fi
}

function needs_ship
{
  running "$1" && return 0
  rm -rf "${piers:?}/${1:?}"
  boot "$1" "$2" "$3"
}

# Give the named running ships the working tree, which the host has just built.
function deploy
{
  for ship in "$@"
  do
    (
      pier=$piers/$ship
      update_desk mcp "$root/mcp/desk-out" && update_desk harness "$root/desk-out"
    ) > "$logs/deploy-$ship.log" 2>&1 ||
      { echo "Failed to deploy to ~$ship; see $logs/deploy-$ship.log"; exit 1; }
  done
  sleep 5
}

# Wipe Harness's agent state, as on a fresh install, so the script sets up what it
# needs. State in other desks, such as DMs and groups, stays. Reviving a live desk does
# nothing, so a nuked desk has to be suspended first.
function reset_ship
{
  $click -t 60 -i - -kp "$piers/$1" > "$logs/reset-$1.log" 2>&1 <<EOF
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
    result_line=$( $click -t 30 -i - -kp "$piers/$1" 2>/dev/null <<EOF
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
  export SHIP_URL=http://127.0.0.1:$2 SHIP_COOKIE=$piers/$1.cookie SOAK_EXPECT_SHIP="~$1"
  export SHIP_PIER=$piers/$1 HOSTED_CONTENT_TEST_SHIP=$1
}

function use_peer
{
  export PEER_URL=http://127.0.0.1:$2 PEER_COOKIE=$piers/$1.cookie PEER_SHIP="~$1" TEST_PEER="~$1"
  export PEER_PIER=$piers/$1
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
  start_ship $1 $2 || return 1
  # Bounded, unlike a boot: a ship that stays up without serving fails the
  # script that restarted it, not the run.
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
  elif [ "$1" == "tlon-tools-conformance" ]
  then
    # It waits on three once-a-minute schedules in turn.
    timeout 480 node "$2"
  else
    timeout 300 node "$2"
  fi
}

# NAME FILE [GROUP]: GROUP, by default the current ship, is the group FILE is dealt in.
function live
{
  name=$1
  file=$2
  matches "$name" && in_shard "${3:-$current_ship}" "$file" || return
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

  if matches tlon-permissions-conformance && shard_has nec
  then
    echo "Live tests restricted to ~nec"
    if needs_ship nec 9192 nec
    then
      use_ship nec 9192
      live tlon-permissions-conformance tests-js/tlon-permissions-conformance.mjs nec
    fi
  fi

  if matches tlon-shared-channel-conformance && shard_has nec
  then
    echo "Live tests on ~zod with ~lux and ~nec in one channel"
    if boot_ships zod 9190 lux 9191 nec 9192
    then
      use_ship zod 9190
      use_peer lux 9191
      export GUEST_URL=http://127.0.0.1:9192 GUEST_COOKIE=$piers/nec.cookie
      # ~zod joins the channel on ~lux, as for the ~zod scripts, and so does ~nec.
      if TEST_NEST=$(node tests-js/lib/test-channel.mjs 2> "$logs/test-channel.log") &&
        SHIP_URL=$GUEST_URL SHIP_COOKIE=$GUEST_COOKIE node tests-js/lib/test-channel.mjs > /dev/null 2>> "$logs/test-channel.log"
      then
        export TEST_NEST
        live tlon-shared-channel-conformance tests-js/tlon-shared-channel-conformance.mjs nec
      else
        result test-channel "FAILED (see $logs/test-channel.log)"
      fi
    fi
  fi

  if [ -z "$pattern" ]
  then
    stop_ship lux
    stop_ship nec
  fi
fi

summarize
