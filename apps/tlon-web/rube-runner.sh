#!/bin/bash
#
# Wrapper script for proper signal forwarding to the rube e2e test infrastructure
#
# Purpose: Ensures signals (like Ctrl+C) are properly forwarded to the Node.js process
#
# Why this exists:
# - pnpm/npm don't properly forward signals through command chains (e.g., "tsc && node")
# - Without proper signal forwarding, cleanup handlers don't run when you hit Ctrl+C
# - This causes Urbit ships and web servers to keep running after script termination
#
# How it works:
# - Compiles TypeScript first
# - Uses 'exec' to replace the shell process with Node.js
# - This ensures Node.js receives signals directly, not through shell intermediaries
# - Cleanup handlers in index.ts can then properly terminate all child processes

# Compile TypeScript
echo "Compiling rube..."
npx tsc --isolatedModules --skipLibCheck ./rube/index.ts --outDir ./rube/dist

if [ $? -ne 0 ]; then
    echo "TypeScript compilation failed"
    exit 1
fi

# Run the Node.js process and forward all signals
echo "Starting rube..."
exec node ./rube/dist/index.js "$@"