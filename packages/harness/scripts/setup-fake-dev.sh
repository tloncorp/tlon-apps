#!/bin/bash
# Boot a fake ship from the pinned pill, install %mcp and %harness, and set
# Harness up with OWNER as its owner. The ship keeps running in tmux. Boot, click
# and desk updates follow tlon-apps' scripts/backend/run-tests.sh.
#
#   scripts/setup-fake-dev.sh [SHIP] [DIR] [OWNER]
#
# SHIP defaults to ~zod, DIR to the current directory and OWNER to SHIP.

ship=${1:-~zod}
owner=${3:-$ship}
root=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "${2:-.}" || exit 1
cd "${2:-.}" || exit 1
pier_dir=${ship#\~}
pier=$PWD/$pier_dir
session=fake-$pier_dir
click=$root/scripts/click
source "$root/scripts/ship-lib.sh"

urbit_bin_url="https://bootstrap.urbit.org/vere/live/v4.5"
vere_ver="vere-v4.5"
arch=`uname -m`

case $OSTYPE in
  linux* )
    platform=linux
    case $arch in
      x86_64 )
        urbit_bin_url="$urbit_bin_url/$vere_ver-linux-x86_64"
        arch=x86_64
        ;;
      arm64 | aarch64 )
        urbit_bin_url="$urbit_bin_url/$vere_ver-linux-aarch64"
        arch=aarch64
        ;;
    esac ;;
  darwin* )
    platform=macos
    case $arch in
      x86_64 )
        urbit_bin_url="$urbit_bin_url/$vere_ver-macos-x86_64"
        arch=x86_64
        ;;
      arm64  )
        urbit_bin_url="$urbit_bin_url/$vere_ver-macos-aarch64"
        arch=aarch64
        ;;
    esac ;;
esac

if [ -d "$pier" ]
then
  echo "$pier already exists; remove it or choose another directory"
  exit 1
fi

# Find out now, not after the long boot.
check_socket "$pier" || exit 1

if [ ! -f "$root/mcp/justfile" ]
then
  echo "mcp is missing; run: just fetch"
  exit 1
fi

if tmux has-session -t "=$session" 2>/dev/null
then
  echo "tmux session $session is already running"
  exit 1
fi

function find_vere()
{
  vere="$root/.deps-cache/${vere_ver}-${platform}-${arch}"
  echo "our vere: $vere"
}

# Ships set up at once take turns at what they share and no build lock covers: the
# pill and runtime downloads, and %mcp's build in mcp/. The lock is on a descriptor
# only the subshell has, so nothing it leaves running, such as a tmux server, holds it.
function in_turn
{
  (
    exec 8>>"$root/.deps-cache/setup.lock"
    python3 -c 'import fcntl; fcntl.flock(8, fcntl.LOCK_EX)' || exit 1
    "$@"
  )
}

function download
{
  (cd "$root/scripts" && bash get-pill.sh) || return 1
  if [ ! -x $vere ]
  then
    echo "Downloading urbit runtime"
    # Give up on a stalled transfer instead of hanging, and keep a partial
    # binary out of the cache.
    curl -L -f --connect-timeout 20 --speed-limit 1024 --speed-time 30 --retry 3 $urbit_bin_url -o $vere.part &&
      mv $vere.part $vere
    chmod +x $vere
  fi
}

mkdir -p "$root/.deps-cache"
find_vere
in_turn download || exit 1
pill=`echo "$root"/scripts/groups-*.pill`

find_vere

if [ ! -x $vere ]
then
  echo "Failed to find vere binary!"
  exit 1
fi

http_port=${HTTP_PORT:-9090}
# Fake ships reach each other on default ports derived from their names.
ames_args=${AMES_PORT:+-p $AMES_PORT}

echo "Generating test ship $ship"
$vere -F $pier_dir -c $pier_dir -B $pill --http-port $http_port $ames_args -t -x

if [ "$?" -ne 0 ]
then
  echo "Failed to generate test ship $ship"
  exit 1
fi

echo "Booting ship"
new_ship_session "$session" "exec $vere --loom 33 --http-port $http_port $ames_args $pier" || exit 1

function await_ship
{
    while ! curl -s "http://localhost:$http_port/~/login" > /dev/null
    do
        sleep 1
    done
}

await_ship

# Allow 10m for longest running operations
TIMEOUT=600

run_click="$click -t $TIMEOUT -b $vere -i - -kp"

# click joins each thread's lines into one, so they must end in a two-space gap.

function new_desk
{
$run_click $pier <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
=/  files=(list path)  ~[/mar/noun/hoon /mar/hoon/hoon /mar/txt/hoon /mar/kelvin/hoon /sys/kelvin]  
=/  pages=(map path page:clay)  
  %-  ~(gas by *(map path page:clay))  
  %+  turn  files  
  |=(=path [path (rear path) .^(* %cx (scot %p our.bowl) %base (scot %da now.bowl) path)])  
;<  ~  bind:m  (poke [our.bowl %hood] helm-pass+!>((new-desk:cloy %$1 ~ pages)))  
(pure:m !>(%ok))  
EOF
}

function mount_desk
{
$run_click $pier <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
;<  ~  bind:m  (poke [our.bowl %hood] kiln-unmount+!>(%$1))  
;<  ~  bind:m  (sleep ~s0)  
=/  =path  
  [(scot %p our.bowl) %$1 (scot %da now.bowl) ~]  
;<  ~  bind:m  (poke [our.bowl %hood] kiln-mount+!>([path %$1]))  
(pure:m !>(%ok))  
EOF
}

function desk_hash
{
result=$( $run_click $pier <<EOF
=/  m  (strand ,vase)  
;<  hash=@uvI  bind:m  (scry @uvI %cz /$1)  
(pure:m !>(hash))  
EOF
)
echo $result | sed -n 's/\[0 %avow 0 %noun \(.*\)\]/\1/p'
}

function install_desk
{
$run_click $pier <<EOF
=/  m  (strand ,vase)  
;<  our=ship  bind:m  get-our  
;<  ~  bind:m  (poke [our %hood] kiln-install+!>([%$1 our %$1]))  
(pure:m !>(%ok))  
EOF
}

# %.y comes back from click as 0.
function agent_running
{
result=$( $run_click $pier <<EOF
=/  m  (strand ,vase)  
;<  live=?  bind:m  (scry ? /gu/$1/\$)  
(pure:m !>(live))  
EOF
)
result_code=`echo $result | sed 's/\[0 %avow 0 %noun \(.*\)\]/\1/'`
[[ $result_code == "0" ]]
}

# Create a desk, fill it from a checkout and start its agents. Takes the desk,
# its justfile and the last agent in its desk.bill.
function setup_desk
{
  desk=$1
  justfile=$2
  last_agent=$3

  echo "Creating $desk desk..."
  new_desk $desk

  echo "Mounting $desk..."
  for attempt in 1 2 3 4 5 6 7 8 9 10
  do
    mount_desk $desk
    [ -d "$pier/$desk" ] && break
    sleep 3
  done

  if [ ! -d "$pier/$desk" ]
  then
    echo "Failed to mount $desk; the ship is in tmux session $session"
    exit 1
  fi

  desk_hash_a=`desk_hash $desk`

  if [ -z "$desk_hash_a" ]
  then
    echo "Invalid empty desk hash (a)"
    exit 1
  fi

  echo "Updating $desk desk"
  # Harness's build takes its own locks; %mcp's does not.
  turn=
  [ "$desk" == "mcp" ] && turn=in_turn
  $turn just --justfile "$justfile" click="scripts/click -b $vere" commit "$pier/$desk"

  if [ "$?" -ne 0 ]
  then
    echo "Failed to update $desk; the ship is in tmux session $session"
    exit 1
  fi

  sleep 3
  echo "Awaiting desk update..."
  await_ship

  desk_hash_b=`desk_hash $desk`

  if [ -z "$desk_hash_b" ]
  then
    echo "Invalid empty desk hash (b)"
    exit 1
  fi

  if [ "$desk_hash_a" == "$desk_hash_b" ]
  then
    echo "Desk upgrade failed ❌; the ship is in tmux session $session"
    exit 1
  fi

  echo "Installing $desk..."
  install_desk $desk

  echo "Awaiting %$last_agent..."
  for attempt in $(seq 1 200)
  do
    agent_running $last_agent && return 0
    sleep 3
  done

  echo "%$last_agent did not start; the ship is in tmux session $session"
  exit 1
}

# %mcp goes first so Harness finds its proxy when it starts.
setup_desk mcp "$root/mcp/justfile" oauth
setup_desk harness "$root/justfile" harness-tlon

(cd "$root" && just click="scripts/click -b $vere" setup "$pier" "$owner")

if [ "$?" -ne 0 ]
then
  echo "Failed to set up Harness; the ship is in tmux session $session"
  exit 1
fi

echo
echo "$ship is running in tmux session $session"
echo "  attach:   tmux attach -t $session"
echo "  web:      http://localhost:$http_port"
echo "  login:    run +code in Dojo"
echo "  provider: just provider $pier chatgpt"
