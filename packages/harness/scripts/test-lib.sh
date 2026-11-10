# Shared by test-hoon.sh and test-js.sh, which set `suite` and `tools` and then
# source this with their argument. Both use the same fake ships, kept in
# .test-run/piers, so a ship one of them keeps is reused by the other; each keeps
# its results and logs in .test-run/$suite.

pattern=$1
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root" || exit 1
run=$root/.test-run
# Keep pier paths short: Unix limits socket paths to 108 bytes.
piers=$run/piers
out=$run/$suite
logs=$out/logs
results=$out/results.txt

for tool in $tools; do
  command -v $tool > /dev/null || { echo "$tool is not installed"; exit 1; }
done
if [ "$pattern" != "--stop" ]
then
  for ship in zod lux nec; do
    # A session with a pier here is ours, and a PATTERN run reuses it.
    if tmux has-session -t "=fake-$ship" 2>/dev/null
    then
      if [ -z "$pattern" ] || [ ! -d "$piers/$ship" ]
      then
        echo "tmux session fake-$ship is running; stop it first (just test --stop if it is ours)"
        exit 1
      fi
    fi
  done
fi

if [ -z "$pattern" ]
then
  rm -rf "$out" "$piers"
fi
mkdir -p "$piers" "$logs"
: > "$results"

function result
{
  printf '%-48s %s\n' "$1" "$2" | tee -a "$results"
}

function stop_ship
{
  tmux has-session -t "=fake-$1" 2>/dev/null || return 0
  pid=$(tmux display-message -p -t "=fake-$1:" '#{pane_pid}')
  tmux send-keys -t "=fake-$1:" -- '|exit' Enter
  for attempt in $(seq 1 60)
  do
    kill -0 $pid 2>/dev/null || break
    sleep 1
  done
}

function clean_up
{
  stop_ship zod
  stop_ship lux
  stop_ship nec
  rm -rf "$piers"
}

if [ "$pattern" == "--stop" ]
then
  clean_up
  echo "Stopped the test ships"
  exit 0
fi

if [ -z "$pattern" ]
then
  trap clean_up EXIT
fi

function matches
{
  [ -z "$pattern" ] || [[ $1 =~ $pattern ]]
}

function needs_ship
{
  if tmux has-session -t "=fake-$1" 2>/dev/null
  then
    return 0
  fi
  rm -rf "$piers/$1"
  boot "$1" "$2" "$3"
}

# Give the named running ships the working tree, with the integration tests.
function deploy
{
  for ship in "$@"
  do
    just heavy=true commit "$piers/$ship/harness" > "$logs/deploy-$ship.log" 2>&1 ||
      { echo "Failed to deploy to ~$ship; see $logs/deploy-$ship.log"; exit 1; }
  done
  sleep 5
}

function pane
{
  tmux capture-pane -p -t "=fake-$1:" -S -200000 | sed 's/\x1b\[[0-9;]*m//g'
}

# The Hoon tests don't need the login cookie, but test-js.sh may reuse the ship.
function boot
{
  echo "Booting ~$1..."
  HTTP_PORT=$2 just fake-dev "~$1" "$piers" "~$3" > "$logs/boot-$1.log" 2>&1
  if [ "$?" -ne 0 ]
  then
    result "boot ~$1" "FAILED (see $logs/boot-$1.log)"
    return 1
  fi
  tmux send-keys -t "=fake-$1:" -- '+code' Enter
  sleep 5
  code=$(pane $1 | grep -oE '^[a-z]{6}(-[a-z]{6}){3}$' | tail -1)
  curl -sS -m 15 -o /dev/null -c "$run/$1.cookie" -d "password=$code" "http://127.0.0.1:$2/~/login"
  chmod 600 "$run/$1.cookie"
}

# Print the counts and exit non-zero if anything failed.
function summarize
{
  echo
  echo "Summary:"
  echo "  passed:     $(grep -c ' pass' "$results")"
  echo "  skipped:    $(grep -c ' skipped:' "$results")"
  echo "  incomplete: $(grep -c ' incomplete:' "$results")"
  echo "  failed:     $(grep -c ' FAILED' "$results")"
  echo "Logs are in $logs"
  [ -z "$pattern" ] || echo "The test ships are still running; stop them with: just test --stop"
  ! grep -q ' FAILED' "$results"
}
