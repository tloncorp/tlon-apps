#!/bin/bash
# Boot a fake ship from the image's pill, install %mcp and %harness, and set
# Harness up with OWNER as its owner. The ship keeps running in its container,
# with its pier in its network's volume, as scripts/ship-lib.sh describes. Desk
# updates follow tlon-apps' scripts/backend/run-tests.sh.
#
#   scripts/setup-fake-dev.sh [SHIP] [OWNER]
#
# SHIP defaults to ~zod and OWNER to SHIP. The ship joins the network $FAKE_NET,
# this checkout's by default, and serves HTTP on port $HTTP_PORT of it, 9090 by
# default, which the network's holder publishes on a free port of the host.

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root" || exit 1
source scripts/ship-lib.sh
select_ship "${1:-~zod}" || exit 1
owner=${2:-~$ship}
source scripts/setup-lib.sh
http_port=${HTTP_PORT:-9090}

if [ ! -f mcp/justfile ]
then
  echo "mcp is missing; run: just fetch"
  exit 1
fi

if running "$container"
then
  echo "container $container is already running"
  exit 1
fi

# The ship installs both desks from their build output, through /repo.
echo "Building the desks"
{ just build && just --justfile mcp/justfile build; } ||
  { echo "Failed to build the desks"; exit 1; }
build_image || { echo "Failed to build the fake ship image"; exit 1; }
start_net || { echo "Failed to start container $net"; exit 1; }
web=$(address "$http_port")
if [ -n "$net_ports" ] && [ -z "$web" ]
then
  echo "container $net does not publish port $http_port; use one of $net_ports," \
    "or remove $net while none of its ships runs"
  exit 1
fi
if has_pier "$ship"
then
  echo "~$ship already has a pier in volume $volume; start it with" \
    "$runtime start $container, or remove its network with just fake-remove"
  exit 1
fi

# Fake ships reach each other on default ports derived from their names.
echo "Booting ~$ship"
start_ship "$ship" "$http_port" "${AMES_PORT:+-p $AMES_PORT}" || exit 1
await_ship "$ship" "$http_port" || exit 1

setup_ship /repo/packages/harness/mcp/desk-out /repo/packages/harness/desk-out "$owner"

if [ "$?" -ne 0 ]
then
  echo "Failed to set up Harness; the ship is running in container $container"
  exit 1
fi

[ -z "$FAKE_NET" ] || env="FAKE_NET=$net "
# The commands name the ship without its ~, which zsh would expand.
echo
echo "~$ship is running in container $container, with its pier in volume $volume."
echo "From packages/harness:"
[ -z "$web" ] || echo "  web:      http://$web"
echo "  login:    ~$(login_code "$ship")"
echo "  log:      $runtime logs -f $container"
echo "  hoon:     ${env}scripts/ship-click -p $ship '(add 2 2)'"
echo "  thread:   ${env}scripts/ship-click -i - -kp $ship < thread.hoon"
echo "  desk:     ${env}just push $ship          (build desk/ and commit it as %harness)"
echo "  provider: ${env}just provider $ship chatgpt"
echo "  stop:     $runtime stop $container"
echo "  start:    $runtime start $container"
echo "  remove:   ${env}just fake-remove        (every ship of $net, $net and $volume)"
