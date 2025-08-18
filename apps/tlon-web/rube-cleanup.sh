#!/bin/bash

# Emergency cleanup script for rube e2e test infrastructure
# 
# Purpose: Forcefully terminate all rube-related processes when normal cleanup fails
# 
# Usage: ./rube-cleanup.sh
# 
# What it does:
# - Kills all Node.js processes running rube scripts
# - Terminates Urbit ships and their serf sub-processes
# - Cleans up processes on all e2e ports (3000-3003, 35453, 36963, 38473, 39983)
# - Removes PID and lock files that might prevent scripts from running
# - Verifies all processes are terminated
#
# When to use:
# - When Ctrl+C doesn't properly clean up processes
# - When you see "port already in use" errors
# - When ships or web servers are stuck running
# - After a script crashes without cleanup

echo "🧹 Rube Emergency Cleanup Script"
echo "================================"
echo ""

# Get the script's directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUBE_DIR="$SCRIPT_DIR/rube"
DIST_DIR="$SCRIPT_DIR/rube/dist"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to kill processes on a specific port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}  Killing processes on port $port: $pids${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        return 0
    fi
    return 1
}

echo "🔍 Step 1: Looking for running rube/node processes..."
echo ""

# Kill node processes running rube scripts
RUBE_PIDS=$(ps aux | grep -E "node.*rube/(dist/)?index\.js|node.*rube/(dist/)?playwright-dev\.js|node.*rube/(dist/)?run-selected-tests\.js" | grep -v grep | awk '{print $2}' || true)
if [ -n "$RUBE_PIDS" ]; then
    echo -e "${YELLOW}Found rube node processes:${NC}"
    echo "$RUBE_PIDS"
    echo "$RUBE_PIDS" | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✅ Killed rube node processes${NC}"
else
    echo "  No rube node processes found"
fi

echo ""
echo "🔍 Step 2: Looking for Urbit binary processes..."
echo ""

# Kill Urbit binary processes
URBIT_BINARY="$DIST_DIR/urbit_extracted/urbit"
if [ -f "$URBIT_BINARY" ]; then
    URBIT_PIDS=$(ps aux | grep "$URBIT_BINARY" | grep -v grep | awk '{print $2}' || true)
    if [ -n "$URBIT_PIDS" ]; then
        echo -e "${YELLOW}Found Urbit processes:${NC}"
        echo "$URBIT_PIDS"
        echo "$URBIT_PIDS" | xargs kill -9 2>/dev/null || true
        echo -e "${GREEN}✅ Killed Urbit processes${NC}"
    else
        echo "  No Urbit processes found"
    fi
else
    # Try to find any urbit process from rube directory
    URBIT_PIDS=$(ps aux | grep -E "urbit.*rube/dist" | grep -v grep | awk '{print $2}' || true)
    if [ -n "$URBIT_PIDS" ]; then
        echo -e "${YELLOW}Found Urbit processes (fallback):${NC}"
        echo "$URBIT_PIDS"
        echo "$URBIT_PIDS" | xargs kill -9 2>/dev/null || true
        echo -e "${GREEN}✅ Killed Urbit processes${NC}"
    else
        echo "  No Urbit processes found"
    fi
fi

echo ""
echo "🔍 Step 3: Cleaning up processes on e2e ports..."
echo ""

# Kill processes on known e2e ports
# Web server ports
WEB_PORTS="3000 3001 3002 3003"
# Urbit HTTP ports
URBIT_PORTS="35453 36963 38473 39983"
# Urbit loopback ports (from shipManifest)
LOOPBACK_PORTS="34543 36053 37563 39073"

FOUND_PROCESSES=false
for port in $WEB_PORTS $URBIT_PORTS $LOOPBACK_PORTS; do
    if kill_port $port; then
        FOUND_PROCESSES=true
    fi
done

if [ "$FOUND_PROCESSES" = false ]; then
    echo "  No processes found on e2e ports"
fi

echo ""
echo "🔍 Step 4: Killing Vite dev server processes..."
echo ""

# Kill vite dev server processes
VITE_PIDS=$(ps aux | grep "vite dev" | grep -v grep | awk '{print $2}' || true)
if [ -n "$VITE_PIDS" ]; then
    echo -e "${YELLOW}Found Vite dev server processes:${NC}"
    echo "$VITE_PIDS"
    echo "$VITE_PIDS" | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✅ Killed Vite processes${NC}"
else
    echo "  No Vite dev server processes found"
fi

echo ""
echo "🔍 Step 5: Cleaning up PID and lock files..."
echo ""

# Clean up PID files
PID_FILES=(
    "$DIST_DIR/.rube.pid"
    "$DIST_DIR/.rube-children.json"
    "$DIST_DIR/.run-selected-tests.pid"
    "$SCRIPT_DIR/.playwright-dev.pid"
    "$SCRIPT_DIR/playwright-dev.log"
)

FOUND_FILES=false
for file in "${PID_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${YELLOW}  Removing: $file${NC}"
        rm -f "$file"
        FOUND_FILES=true
    fi
done

# Clean up ship lock files
for ship_dir in "$DIST_DIR"/zod "$DIST_DIR"/bus "$DIST_DIR"/ten "$DIST_DIR"/mug; do
    if [ -d "$ship_dir" ]; then
        LOCK_FILE="$ship_dir/.vere.lock"
        HTTP_PORTS_FILE="$ship_dir/.http.ports"
        
        if [ -f "$LOCK_FILE" ]; then
            echo -e "${YELLOW}  Removing: $LOCK_FILE${NC}"
            rm -f "$LOCK_FILE"
            FOUND_FILES=true
        fi
        
        if [ -f "$HTTP_PORTS_FILE" ]; then
            echo -e "${YELLOW}  Removing: $HTTP_PORTS_FILE${NC}"
            rm -f "$HTTP_PORTS_FILE"
            FOUND_FILES=true
        fi
    fi
done

if [ "$FOUND_FILES" = false ]; then
    echo "  No PID or lock files found"
fi

echo ""
echo "🔍 Step 6: Final verification..."
echo ""

# Check if any processes are still running on e2e ports
REMAINING=$(lsof -ti:3000,3001,3002,35453,36963,38473 2>/dev/null || true)
if [ -n "$REMAINING" ]; then
    echo -e "${RED}⚠️  Warning: Some processes may still be running:${NC}"
    echo "$REMAINING"
    echo "You may need to kill them manually: kill -9 $REMAINING"
else
    echo -e "${GREEN}✅ All e2e processes have been cleaned up successfully!${NC}"
fi

echo ""
echo "🎉 Cleanup complete!"
echo ""
echo "You can now safely run:"
echo "  pnpm e2e"
echo "  pnpm e2e:test <test-file>"
echo "  pnpm e2e:playwright-dev"
echo ""