# Sourced by test-hoon.sh, which sets `suite` and `tools` and then sources this
# with its argument. Its fake ship runs on a network of this checkout's, as
# ship-lib.sh describes, and it keeps its results and logs in .test-run/$suite.
# test-js.sh runs its ships in a container of its own.

pattern=$1
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
cd "$root" || exit 1
source ../../scripts/backend/container/runtime.sh
# The network is this checkout's and publishes no ports, the tests reaching the
# ship in its container, so checkouts can run their tests at once.
export FAKE_NET=fake-test-$checkout FAKE_NET_PORTS=
source scripts/ship-lib.sh
out=$root/.test-run/$suite
logs=$out/logs
results=$out/results.txt

for tool in $runtime $tools; do
  command -v $tool > /dev/null || { echo "$tool is not installed"; exit 1; }
done
# A PATTERN run reuses the ship; a full run boots a fresh one.
if [ -z "$pattern" ] && running "$net-zod"
then
  echo "container $net-zod is running; stop it first (just test --stop)"
  exit 1
fi

if [ "$pattern" == "--stop" ]
then
  remove_net
  echo "Stopped the test ships"
  exit 0
fi

if [ -z "$pattern" ]
then
  rm -rf "$out"
fi
mkdir -p "$logs"
: > "$results"

source scripts/results-lib.sh

# The suite lists %mcp's tests and the ship installs %mcp, from mcp/.
just fetch > "$logs/fetch.log" 2>&1 || { echo "Failed to fetch; see $logs/fetch.log"; exit 1; }

# The ship's log goes with its container, so keep it: it says why a boot failed.
function clean_up
{
  ship_log zod > "$logs/ship-zod.log" 2>&1
  remove_net
}

# A full run starts from an empty volume and removes it after.
if [ -z "$pattern" ]
then
  remove_net
  trap clean_up EXIT
fi

build_image || { echo "Failed to build the fake ship image"; exit 1; }
start_net || { echo "Failed to start container $net"; exit 1; }

function needs_ship
{
  if running "$net-$1"
  then
    return 0
  fi
  $runtime exec "$net" rm -rf "/piers/$1"
  boot "$1" "$2" "$3"
}

# Give the named running ships the working tree, with the integration tests, and
# %mcp at the commit now pinned, which the fetch checks out.
function deploy
{
  for ship in "$@"
  do
    (
      just fetch && just --justfile mcp/justfile build &&
        select_ship "$ship" && source scripts/setup-lib.sh &&
        update_desk mcp /repo/packages/harness/mcp/desk-out &&
        just heavy=true push "~$ship"
    ) > "$logs/deploy-$ship.log" 2>&1 ||
      { echo "Failed to deploy to ~$ship; see $logs/deploy-$ship.log"; exit 1; }
  done
  sleep 5
}

function boot
{
  echo "Booting ~$1..."
  HTTP_PORT=$2 just fake-dev "~$1" "~$3" > "$logs/boot-$1.log" 2>&1
  if [ "$?" -ne 0 ]
  then
    result "boot ~$1" "FAILED (see $logs/boot-$1.log)"
    return 1
  fi
}
