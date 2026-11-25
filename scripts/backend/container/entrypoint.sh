#!/bin/bash
# Runs the fake ship named as the argument, without a terminal, as the
# container's main process.
#
#   entrypoint.sh zod
#
# The ship's pier is /piers/<ship>; an existing pier is resumed, otherwise the
# ship is booted from $URBIT_PILL. It serves HTTP on $HTTP_PORT (default 8080).
# $URBIT_ARGS is added to the urbit invocation.

if [ $# -ne 1 ]; then
    echo "usage: entrypoint.sh <ship>" >&2
    exit 2
fi

ship=${1#\~}
pier=/piers/$ship
http_port=${HTTP_PORT:-8080}

if [ -d "$pier" ]; then
    # shellcheck disable=SC2086
    exec urbit -t --http-port "$http_port" ${URBIT_ARGS:-} "$pier"
else
    # shellcheck disable=SC2086
    exec urbit -F "$ship" -B "$URBIT_PILL" -c "$pier" -t \
        --http-port "$http_port" ${URBIT_ARGS:-}
fi
