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

# The number of the revision the desk $1 is at.
function desk_revision
{
result=$( $run_click $pier <<EOF
=/  m  (strand ,vase)  
;<  =cass:clay  bind:m  (scry cass:clay /cw/$1)  
(pure:m !>(ud.cass))  
EOF
)
echo $result | sed -n 's/\[0 %avow 0 %noun \([0-9]*\)\]/\1/p'
}

# A gate, for the threads below, that renders a tang as one cord. click shows a
# cord as text only if every byte is printable, so lines end in a backslash and
# an n, and other bytes become ?.
render_tang='=/  render  |=(err=tang ^-(@t (rap 3 (turn (flop err) |=(t=tank (rap 3 (turn (wash [0 160] t) |=(l=tape (cat 3 (rap 3 (turn l |=(c=@ ?:(&((gte c 32) (lte c 126)) c 63)))) (cat 3 92 %n))))))))))'

# Print the lines of a refusal to stderr, each starting "refused: ", so that a
# caller that kept them in a log can find them: $1 says what was refused and $2
# is click's output, a thread's tag and the cord its render made. Clay's own
# stack frames are left out.
function refused
{
  echo "refused: $1" >&2
  sed -n "s/.*%avow 0 %noun %[a-z-]* '\\(.*\\)'\\].*/\\1/p" <<<"$2" |
    awk '{ gsub(/\\n/, "\n"); print }' |
    grep -v -e '^/sys/' -e '^ *$' | sed 's/^/refused:   /' >&2
}

# Make hood run $2, a poke that starts the agents of the desk $1, in the wake of
# a timer rather than in the event that starts the thread. Clay builds the
# agents in that event, and a build error rolls it back. In the thread's first
# event that would leave click waiting on its socket; in the wake, behn hands
# the error to the timer's owner, and the thread returns it. Fails, printing
# the error, if the desk did not build.
function start_agents
{
  local result
  result=$( $run_click $pier <<EOF
=/  m  (strand ,vase)  
$render_tang  
;<  =bowl  bind:m  get-bowl  
;<  ~  bind:m  (send-raw-card [%pass /start/(scot %da now.bowl) %arvo %b %wait now.bowl])  
|-  ^-  form:m  
;<  [=wire =sign-arvo]  bind:m  take-sign-arvo  
?.  ?=([%behn %wake *] sign-arvo)  \$  
?^  error.sign-arvo  
  (pure:m !>([%start-refused (render u.error.sign-arvo)]))  
;<  ~  bind:m  (poke [our.bowl %hood] $2)  
(pure:m !>(%agents-started))  
EOF
  ) || { echo "Failed to start the agents of %$1: click failed: $result" >&2; return 1; }
  # Only the whole receipt is success: a refusal's text can contain anything.
  result=${result%"${result##*[![:space:]]}"}
  case $result in
    "[0 %avow 0 %noun %start-refused '"*) refused "the agents of %$1 did not build" "$result" ;;
    "[0 %avow 0 %noun %agents-started]") return 0 ;;
    *) echo "Failed to start the agents of %$1: $result" >&2 ;;
  esac
  return 1
}

function install_desk
{
  start_agents $1 "kiln-install+!>([%$1 our.bowl %$1])"
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
  install_desk $desk || { echo "Failed to install $desk"; exit 1; }

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

# Have the runtime read the mounted desk $1. Nothing in the mount differs from
# Clay, so this makes no revision.
function scan_desk
{
  $run_click $pier > /dev/null <<EOF
=/  m  (strand ,vase)  
;<  our=ship  bind:m  get-our  
;<  ~  bind:m  (poke [our %hood] kiln-commit+!>([%$1 |]))  
;<  ~  bind:m  (sleep ~s0)  
(pure:m !>(%ok))  
EOF
}

# Replace the mounted desk $1 with the build output $2, a path where the ship
# runs, deleting the files it does not contain, as `just install` does, and
# commit it. The runtime reports a file as deleted only if it has read it since
# it started, and a restarted ship has read none, so the mount is read first.
function replace_desk
{
  scan_desk "$1" &&
    $in_ship find "${pier_dir:-$pier}/$1" -mindepth 1 -delete &&
    $in_ship cp -R "$2/." "${pier_dir:-$pier}/$1/" && commit_desk "$1"
}

# Ask the ship to commit its mounted desk $1, and fail, printing the error, if
# Clay refuses it. Kiln only passes the commit on: Clay takes it in a later
# event, which a build error rolls back, giving the error only to %logs
# subscribers. So the thread watches for the next revision and for that error.
# A fresh commit-nonce.txt makes every commit a change, so it ends in one of
# them; the timer only bounds a ship that never answers. Cleanup is on the
# original wires, since a thread that click gives up on keeps running.
function commit_desk
{
  local result
  $in_ship sh -c "echo $(date +%s)-$RANDOM > '${pier_dir:-$pier}/$1/commit-nonce.txt'" || return 1
  result=$( $run_click $pier <<EOF
=/  m  (strand ,vase)  
$render_tang  
;<  =bowl  bind:m  get-bowl  
=/  rev  ud:.^(cass:clay %cw /(scot %p our.bowl)/$1/(scot %da now.bowl))  
=/  until  (add now.bowl ~m10)  
;<  ~  bind:m  (send-raw-card [%pass /logs %arvo %d %logs \`~])  
;<  ~  bind:m  (send-raw-card [%pass /next %arvo %c %warp our.bowl %$1 \`[%sing %w [%ud +(rev)] /]])  
;<  ~  bind:m  (send-raw-card [%pass /bound %arvo %b %wait until])  
;<  ~  bind:m  (poke [our.bowl %hood] kiln-commit+!>([%$1 |]))  
|-  ^-  form:m  
;<  [=wire =sign-arvo]  bind:m  take-sign-arvo  
=/  verdict=(unit vase)  
  ?:  ?=([%dill %logs %crud %into *] sign-arvo)  
    \`!>([%commit-refused (render q.told.sign-arvo)])  
  ?:  ?=([%clay %writ *] sign-arvo)  \`!>(%desk-committed)  
  ?:  ?=([%behn %wake *] sign-arvo)  \`!>(%commit-timed-out)  
  ~  
?~  verdict  \$  
;<  ~  bind:m  (send-raw-card [%pass /logs %arvo %d %logs ~])  
;<  ~  bind:m  (send-raw-card [%pass /next %arvo %c %warp our.bowl %$1 ~])  
;<  ~  bind:m  (send-raw-card [%pass /bound %arvo %b %rest until])  
(pure:m u.verdict)  
EOF
  ) || { echo "Clay commit of %$1 did not finish: click failed: $result" >&2; return 1; }
  # Only the whole receipt is success: a refusal's text can contain anything.
  result=${result%"${result##*[![:space:]]}"}
  case $result in
    "[0 %avow 0 %noun %commit-refused '"*) refused "Clay refused the commit of %$1" "$result" ;;
    "[0 %avow 0 %noun %desk-committed]") return 0 ;;
    *) echo "Clay commit of %$1 did not finish: $result" >&2 ;;
  esac
  return 1
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
