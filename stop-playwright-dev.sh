#!/bin/bash

# Get the script's directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TLON_WEB_DIR="$SCRIPT_DIR/apps/tlon-web"
PID_FILE="$TLON_WEB_DIR/.playwright-dev.pid"

echo "🛑 Stopping Playwright MCP development environment..."

# Function to clean up all processes
cleanup_all() {
    local cleaned=false
    
    # Try to stop the main process gracefully first
    if [ -f "$PID_FILE" ]; then
        MAIN_PID=$(cat "$PID_FILE")
        echo "Found main process PID: $MAIN_PID"
        
        if kill -0 "$MAIN_PID" 2>/dev/null; then
            echo "Sending SIGTERM to main process (it has built-in cleanup)..."
            kill -TERM "$MAIN_PID" 2>/dev/null
            
            # Give it time to clean up gracefully (playwright-dev.ts has cleanup handlers)
            echo "Waiting for graceful shutdown..."
            for i in {1..10}; do
                if ! kill -0 "$MAIN_PID" 2>/dev/null; then
                    echo "✅ Main process shut down gracefully"
                    cleaned=true
                    break
                fi
                sleep 1
                echo -n "."
            done
            echo ""
            
            # Force kill if still running
            if kill -0 "$MAIN_PID" 2>/dev/null; then
                echo "Force killing main process..."
                kill -9 "$MAIN_PID" 2>/dev/null
                cleaned=true
            fi
        else
            echo "Main process not running"
        fi
        
        rm -f "$PID_FILE"
    else
        echo "No PID file found at $PID_FILE"
    fi
    
    # Comprehensive cleanup: kill any remaining processes on e2e ports
    echo "Checking for remaining processes on e2e ports..."
    local found_processes=false
    
    for port in 3000 3001 3002 35453 36963 38473; do
        pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            found_processes=true
            echo "Found processes on port $port: $pids"
            echo "$pids" | xargs kill -9 2>/dev/null || true
            cleaned=true
        fi
    done
    
    if [ "$found_processes" = false ]; then
        echo "No processes found on e2e ports"
    fi
    
    # Clean up log file if requested
    if [ "$1" = "--clean-logs" ]; then
        echo "Removing log file..."
        rm -f "$TLON_WEB_DIR/playwright-dev.log"
    fi
    
    if [ "$cleaned" = true ]; then
        echo "✅ Cleanup complete!"
    else
        echo "ℹ️  No cleanup was necessary"
    fi
}

# Show usage if help requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [--clean-logs]"
    echo ""
    echo "Stop the Playwright MCP development environment."
    echo ""
    echo "Options:"
    echo "  --clean-logs    Also remove the log file"
    echo "  --help, -h      Show this help message"
    exit 0
fi

# Run the cleanup
cleanup_all "$1"

# Verify all processes are gone
remaining=$(lsof -ti:3000,3001,3002,35453,36963,38473 2>/dev/null || true)
if [ -n "$remaining" ]; then
    echo "⚠️  Warning: Some processes may still be running on e2e ports:"
    echo "$remaining"
    echo "You may need to kill them manually: kill -9 $remaining"
else
    echo "✅ All e2e processes have been stopped"
fi