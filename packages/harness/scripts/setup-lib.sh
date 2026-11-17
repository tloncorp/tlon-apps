# Sourced by the scripts that install %mcp and %harness on a running fake ship
# and set Harness up: setup-fake-dev.sh and `just push`, which reach a ship in
# its own container from the host, and test-js.sh, which runs inside the
# container of its ships. Each runs threads through click; the caller sets
#
#   click      the click command, without options, before sourcing this
#   pier       the ship as click takes it: its pier, or for ship-click the ship
#   pier_dir   the ship's pier where it runs, if pier is not that
#   in_ship    a command prefix that runs a command where the ship runs, if
#              that is not here
#   http_port  the ship's HTTP port
#   container  the container the ship runs in, for messages
#
# ship-lib.sh's select_ship sets all but http_port for a ship in its own
# container. The caller defines `await_ship SHIP PORT`, which waits for the
# ship's HTTP server.

# Allow 10m for longest running operations
TIMEOUT=600

run_click="$click -t $TIMEOUT -i - -kp"

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

# Create a desk, fill it and start its agents. Takes the desk, the source that
# update_desk fills it from and the last agent in its desk.bill.
function setup_desk
{
  desk=$1
  source=$2
  last_agent=$3

  echo "Creating $desk desk..."
  new_desk $desk

  echo "Mounting $desk..."
  for attempt in 1 2 3 4 5 6 7 8 9 10
  do
    mount_desk $desk
    $in_ship test -d "${pier_dir:-$pier}/$desk" && break
    sleep 3
  done

  if ! $in_ship test -d "${pier_dir:-$pier}/$desk"
  then
    echo "Failed to mount $desk; the ship is running in container $container"
    exit 1
  fi

  desk_hash_a=`desk_hash $desk`

  if [ -z "$desk_hash_a" ]
  then
    echo "Invalid empty desk hash (a)"
    exit 1
  fi

  echo "Updating $desk desk"
  update_desk "$desk" "$source"

  if [ "$?" -ne 0 ]
  then
    echo "Failed to update $desk; the ship is running in container $container"
    exit 1
  fi

  sleep 3
  echo "Awaiting desk update..."
  await_ship "$(basename "$pier")" "$http_port" || exit 1

  desk_hash_b=`desk_hash $desk`

  if [ -z "$desk_hash_b" ]
  then
    echo "Invalid empty desk hash (b)"
    exit 1
  fi

  if [ "$desk_hash_a" == "$desk_hash_b" ]
  then
    echo "Desk upgrade failed ❌; the ship is running in container $container"
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

  echo "%$last_agent did not start; the ship is running in container $container"
  exit 1
}

# Install %mcp from $1 and %harness from $2, as update_desk takes them, and set
# Harness up with $3 as its owner. %mcp goes first so Harness finds its proxy
# when it starts.
function setup_ship
{
  setup_desk mcp "$1" oauth
  setup_desk harness "$2" harness-tlon
  CLICK=$click "$(dirname "${BASH_SOURCE[0]}")/harness/setup.sh" "$pier" "$3"
}

# Fill the mounted desk $1 from the build output $2, a path where the ship runs,
# keeping the files it does not contain, as `just install-dev` does, and commit
# it.
function update_desk
{
  $in_ship cp -R "$2/." "${pier_dir:-$pier}/$1/" && commit_desk "$1"
}

# Ask the ship to commit its mounted desk $1. click exits zero even when the
# thread fails, so this requires its receipt, a long term because short atoms
# come back as numbers.
function commit_desk
{
  result=$( $click -t 120 -i - -kp "$pier" <<EOF
=/  m  (strand ,vase)  
;<  our=ship  bind:m  get-our  
;<  ~  bind:m  (poke [our %hood] kiln-commit+!>([%$1 |]))  
(pure:m !>(%desk-commit-sent))  
EOF
  )
  [[ $result == *"[0 %avow 0 %noun %desk-commit-sent]"* ]] ||
    { echo "Clay commit failed for %$1: $result" >&2; return 1; }
}

# Print the +code of the ship that click takes as $1, without its ~.
function login_code
{
  $click -t 30 -i - -kp "$1" <<EOF | sed -n "s/.*%noun '~\([a-z-]*\)'.*/\1/p"
=/  m  (strand ,vase)  
;<  our=ship  bind:m  get-our  
;<  code=@p  bind:m  (scry @p /j/code/(scot %p our))  
(pure:m !>((scot %p code)))  
EOF
}
