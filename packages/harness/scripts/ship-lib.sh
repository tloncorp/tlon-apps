# Sourced by the scripts that run fake ships or reach one through click.
#
# Each ship runs in its own container, from the image built from the
# repository's scripts/backend/container/, with the repository mounted
# read-only at /repo. Fake ships reach each other at fixed Ames ports on their
# loopback, so the ships of one network share the network namespace of a holder
# container, which does nothing else and can publish their HTTP ports on the
# host's 127.0.0.1, each on a port the runtime finds free. Ports can be
# published only when a container is created, so the holder publishes the whole
# range up front, and the ships can be stopped and started on their own.
#
# The piers of a network's ships are /piers/<ship> in a named volume of the
# network, which its ships and its holder mount, so a pier outlives its ship's
# container. On macOS the containers run in a Linux VM, and a pier on a bind
# mount from the host would sit on the VM's file-sharing layer, which does not
# reliably support the socket urbit makes in the pier or the files it maps into
# memory there. A volume is on the VM's own filesystem.
#
# FAKE_NET names the holder, fake-dev-N by default, where N stands for the
# checkout, and prefixes its ships' containers, fake-dev-N-zod, and its volume,
# fake-dev-N-piers. FAKE_NET_PORTS is the range of the ships' HTTP ports that
# the holder publishes when it is created, 9090-9099 by default; set empty, it
# publishes none. Networks share nothing on the host, so any number can run at
# once. Functions here take a ship without its ~.

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd -P)
source "$repo/scripts/backend/container/runtime.sh"
net=${FAKE_NET:-fake-dev-$checkout}
net_ports=${FAKE_NET_PORTS-9090-9099}
volume=$net-piers

# Rootless podman maps the container's root to the host user. Rootful docker
# would write test-js.sh's output as root, so test-js.sh runs its container as
# the host user. The ship containers here write only to their volume, so they
# run as the image's root, which can write a fresh volume.
case $runtime in
  docker) user_args="--user $(id -u):$(id -g)" ;;
  *) user_args= ;;
esac

function build_image
{
  $runtime build -q -t $image "$repo/scripts/backend/container" > /dev/null && prune_images
}

function running
{
  [ "$($runtime inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" == true ]
}

# Was the container $1 started from this checkout? It is the checkout mounted
# at its /repo, which desks are copied from.
function from_here
{
  [ "$($runtime inspect -f '{{index .Config.Labels "fakeship.repo"}}' "$1" 2>/dev/null)" == "$repo" ]
}

# Start the holder unless it is running. Ships booted at once may race to
# create it, and the loser finds it running. A stopped holder, as after a
# reboot, is started again: its ships' containers are tied to it.
function start_net
{
  running "$net" && return 0
  $runtime start "$net" > /dev/null 2>&1 && return 0
  $runtime rm -f "$net" > /dev/null 2>&1
  # As process 1, sleep ignores SIGTERM, so a stop would wait out its timeout.
  # shellcheck disable=SC2086
  $runtime run -d --name "$net" --stop-signal KILL -v "$volume:/piers" \
    ${net_ports:+-p 127.0.0.1::$net_ports} --entrypoint sleep $image infinity > /dev/null ||
    running "$net"
}

# Print the host's address, as 127.0.0.1:PORT, for the ships' HTTP port $1, or
# nothing if the holder does not publish it.
function address
{
  $runtime port "$net" "$1/tcp" 2> /dev/null | head -n 1
}

# Does ~$1 have a pier? The holder must be running.
function has_pier
{
  $runtime exec "$net" test -e "/piers/$1"
}

# Start ~$1 from its pier, which the image boots from its pill if it does not
# exist, with HTTP on port $2 and the extra urbit options $3. A stopped
# container of the ship is replaced.
function start_ship
{
  $runtime rm -f "$net-$1" > /dev/null 2>&1
  $runtime run -d --name "$net-$1" --network "container:$net" \
    --label "fakeship.net=$net" --label "fakeship.repo=$repo" \
    -v "$volume:/piers" -v "$repo:/repo:ro" \
    -e HTTP_PORT="$2" -e URBIT_ARGS="--loom 33${3:+ $3}" $image "$1" > /dev/null
}

# Wait for the HTTP server of ~$1 on port $2. Fail if the ship stops first.
function await_ship
{
  until $runtime exec "$net-$1" wget -q -O /dev/null "http://127.0.0.1:$2/~/login" 2>/dev/null
  do
    if ! running "$net-$1"
    then
      echo "~$1 exited; see: $runtime logs $net-$1" >&2
      return 1
    fi
    sleep 1
  done
}

# Remove the holder, every ship on it and their volume. A volume in use, even
# by a stopped container, cannot be removed, so it goes last.
function remove_net
{
  local ships
  ships=$($runtime ps -aq --filter "label=fakeship.net=$net")
  # shellcheck disable=SC2086
  [ -z "$ships" ] || $runtime rm -f $ships > /dev/null
  $runtime rm -f "$net" > /dev/null 2>&1
  $runtime volume rm -f "$volume" > /dev/null 2>&1
  return 0
}

# Print the output of ~$1, from all of its runs.
function ship_log
{
  $runtime logs "$net-$1" 2>&1
}

# Set what setup-lib.sh needs to reach ~$1, given with or without its ~, and
# $ship, without it. click is scripts/ship-click, which takes the ship in place
# of a pier, and the desks are copied in the ship's container.
function select_ship
{
  ship=${1#\~}
  [[ $ship =~ ^[a-z-]+$ ]] || { echo "'$1' is not a ship name such as ~zod" >&2; return 1; }
  container=$net-$ship
  click=$repo/packages/harness/scripts/ship-click
  pier=$ship
  pier_dir=/piers/$ship
  in_ship="$runtime exec $container"
}
