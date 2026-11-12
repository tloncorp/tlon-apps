# Sourced by the scripts that boot fake ships or reach a ship through its socket.

# A socket path must fit sun_path with its terminating NUL: 104 bytes on macOS and
# 108 on Linux. socat truncates a longer one, and then cannot reach the ship.
case $(uname -s) in
  Darwin) socket_limit=104 ;;
  *) socket_limit=108 ;;
esac

# Fail if the socket path of the pier at $1 is too long for this platform.
function check_socket
{
  # Count bytes, not characters.
  local LC_ALL=C
  local socket=$1/.urb/conn.sock
  local over=$(( ${#socket} - socket_limit + 1 ))
  if (( over > 0 ))
  then
    echo "The ship's socket path is ${#socket} bytes, $over more than $(uname -s) allows: $socket" >&2
    echo "Reach the pier through a shorter path, such as a symlink; see packages/harness/docs-refs/development.md" >&2
    return 1
  fi
}

# Run the ship command $2 in a new detached tmux session named $1. The test scripts
# read ship output back from the pane by line offset, so it needs a longer history
# than tmux's default, without changing the user's tmux settings. history-limit
# applies only to panes created after it is set, so the session starts with a
# placeholder window, which goes once the ship's window exists. Every command
# names the session, window or pane by its ID: inside tmux, an untargeted command
# would act on the caller's session. Given as separate arguments, the placeholder
# runs without a shell, and it never exits by itself.
function new_ship_session
{
  local limit=500000 ids pane found
  ids=$(tmux new-session -d -P -F '#{session_id} #{window_id}' -s "$1" -x 180 -y 50 \
    tail -f /dev/null) &&
    tmux set-option -t "${ids% *}" history-limit "$limit" &&
    pane=$(tmux new-window -P -F '#{pane_id}' -t "${ids% *}:" "$2") || return 1
  # Window IDs are never reused, so this cannot remove the ship's window.
  tmux kill-window -t "${ids#* }" 2>/dev/null
  # A short history would drop test output without failing the tests.
  found=$(tmux display-message -p -t "$pane" '#{history_limit}')
  if ! [[ $found =~ ^[0-9]+$ ]] || (( found < limit ))
  then
    echo "tmux session $1 has a history limit of '$found' lines, not $limit; stopping it" >&2
    tmux kill-session -t "${ids% *}"
    return 1
  fi
}
