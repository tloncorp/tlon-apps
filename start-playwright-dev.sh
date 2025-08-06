#!/bin/bash

# Get the script's directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TLON_WEB_DIR="$SCRIPT_DIR/apps/tlon-web"
LOG_FILE="$TLON_WEB_DIR/playwright-dev.log"
PID_FILE="$TLON_WEB_DIR/.playwright-dev.pid"

# Function to clean up all processes
cleanup_all() {
    echo "🧹 Cleaning up all processes..."
    
    if [ -f "$PID_FILE" ]; then
        MAIN_PID=$(cat "$PID_FILE")
        echo "Sending SIGTERM to main process group: $MAIN_PID"
        
        # Send SIGTERM to the main process - it has built-in cleanup logic
        if kill -0 "$MAIN_PID" 2>/dev/null; then
            kill -TERM "$MAIN_PID" 2>/dev/null
            
            # Give it time to clean up gracefully
            sleep 3
            
            # Force kill if still running
            if kill -0 "$MAIN_PID" 2>/dev/null; then
                echo "Force killing main process..."
                kill -9 "$MAIN_PID" 2>/dev/null
            fi
        fi
        
        rm -f "$PID_FILE"
    fi
    
    # Additional cleanup: kill any remaining processes on e2e ports
    echo "Cleaning up any remaining processes on e2e ports..."
    for port in 3000 3001 3002 35453 36963 38473; do
        pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            echo "Killing processes on port $port: $pids"
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
    done
    
    echo "✅ Cleanup complete!"
}

# Set up trap for cleanup on script exit
trap cleanup_all EXIT INT TERM

# Check if already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        echo "❌ Playwright dev environment already running (PID: $OLD_PID)"
        echo ""
        echo "To stop it, run one of:"
        echo "  kill $OLD_PID"
        echo "  $SCRIPT_DIR/stop-playwright-dev.sh"
        exit 1
    else
        echo "⚠️  Found stale PID file, cleaning up..."
        rm -f "$PID_FILE"
    fi
fi

# Start playwright dev environment in background
echo "Starting Playwright MCP development environment in background..."

# Change to the correct directory
cd "$TLON_WEB_DIR"

# Clean up any existing files
rm -f "$LOG_FILE" "$PID_FILE"

# Ensure we can create the log file
touch "$LOG_FILE" || {
    echo "❌ Cannot create log file at $LOG_FILE"
    exit 1
}

# Start the dev environment in background with unbuffered output
# Use process group for easier cleanup
if command -v setsid >/dev/null 2>&1 && command -v stdbuf >/dev/null 2>&1; then
    # Start in new process group with unbuffered output
    setsid stdbuf -oL -eL pnpm e2e:playwright-dev > "$LOG_FILE" 2>&1 &
    PLAYWRIGHT_PID=$!
elif command -v setsid >/dev/null 2>&1; then
    # Use setsid without stdbuf
    setsid pnpm e2e:playwright-dev > "$LOG_FILE" 2>&1 &
    PLAYWRIGHT_PID=$!
else
    # Fallback: simple background process (macOS doesn't have setsid by default)
    pnpm e2e:playwright-dev > "$LOG_FILE" 2>&1 &
    PLAYWRIGHT_PID=$!
fi

# Save PID for cleanup
echo "$PLAYWRIGHT_PID" > "$PID_FILE"

echo "Started playwright-dev with PID: $PLAYWRIGHT_PID (saved to $PID_FILE)"
echo "Log output: $LOG_FILE"
echo ""
echo "To stop the environment later, run one of:"
echo "  kill $PLAYWRIGHT_PID                    # Graceful shutdown"
echo "  $SCRIPT_DIR/stop-playwright-dev.sh      # Comprehensive cleanup"
echo ""
echo "Waiting for environment to be ready..."

# Give the process a moment to start
sleep 2

# Wait for the ready message in the log
timeout=300  # 5 minutes
counter=0
while [ $counter -lt $timeout ]; do
    # Check if process is still running
    if ! kill -0 $PLAYWRIGHT_PID 2>/dev/null; then
        echo "❌ Process died unexpectedly. Check the log file for errors:"
        echo "  tail -50 $LOG_FILE"
        exit 1
    fi
    
    # Look for the success message in the log file
    if grep -q "Environment ready for Playwright MCP development!" "$LOG_FILE" 2>/dev/null; then
        echo ""
        echo "✅ Environment is ready!"
        echo ""
        echo "You can now use Claude Code with the Playwright MCP server."
        echo ""
        echo "Ship URLs (manual authentication required):"
        echo "  ~zod: http://localhost:3000/apps/groups/ (auth: lidlut-tabwed-pillex-ridrup)"
        echo "  ~ten: http://localhost:3002/apps/groups/ (auth: lapseg-nolmel-riswen-hopryc)"
        echo "  ~bus: http://localhost:3001/apps/groups/ (auth: riddec-bicrym-ridlev-pocsef)"
        echo ""
        echo "Management commands:"
        echo "  View logs: tail -f $LOG_FILE"
        echo "  Stop all:  kill $PLAYWRIGHT_PID"
        echo "  Force stop: $SCRIPT_DIR/stop-playwright-dev.sh"
        
        # Don't run cleanup on successful exit - let the process keep running
        trap - EXIT INT TERM
        exit 0
    fi
    
    # Show progress
    if [ $((counter % 10)) -eq 0 ]; then
        echo -n "."
    fi
    
    sleep 1
    counter=$((counter + 1))
done

echo ""
echo "❌ Timeout waiting for environment to be ready. Check the log file:"
echo "  tail -50 $LOG_FILE"
exit 1