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
