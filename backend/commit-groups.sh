#!/bin/bash
# Helper script to commit %groups desk and show any errors with line numbers

PIER_PATH="${1:-$HOME/zod}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLICK="$SCRIPT_DIR/backend/click"

# Extract ship name from pier path
SHIP_NAME=$(basename "$PIER_PATH")

echo "Committing %groups desk on ~$SHIP_NAME ($PIER_PATH)..."

# Execute the commit using rube/click
# -k for khan thread, -p for pretty errors
"$CLICK" -b "$PIER_PATH/.run" -i - -kp "$PIER_PATH" <<EOF
=/  m  (strand ,vase)
;<  our=ship  bind:m  get-our
;<  ~  bind:m  (poke [our %hood] kiln-commit+!>([%groups |]))
(pure:m !>(%ok))
EOF

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✓ Commit successful"
else
    echo "✗ Commit failed - see errors above"
    exit 1
fi
