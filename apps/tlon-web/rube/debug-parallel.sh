#!/bin/bash

# Debug script for parallel test runner
# This helps diagnose issues with container execution

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Parallel E2E Debug Tool ===${NC}"

# Check container runtime
if command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
elif command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
else
    echo -e "${RED}Error: Neither Docker nor Podman is installed${NC}"
    exit 1
fi

# Function to test a single shard
test_shard() {
    local shard=${1:-1}
    echo -e "${YELLOW}Testing shard $shard in interactive mode...${NC}"

    # Force clean up any existing container
    $CONTAINER_CMD stop tlon-e2e-shard-test 2>/dev/null || true
    $CONTAINER_CMD rm -f tlon-e2e-shard-test 2>/dev/null || true

    # Wait for Docker to release network resources
    sleep 1

    # Create test results directory
    mkdir -p test-results/debug

    echo -e "${BLUE}Starting container...${NC}"

    # Port offset for the shard
    local port_offset=$((($shard - 1) * 10))

    # Port mappings - map host ports with offset to standard container ports
    local web_ports=(
        -p $((3000 + $port_offset)):3000
        -p $((3001 + $port_offset)):3001
        -p $((3002 + $port_offset)):3002
    )

    local ship_ports=(
        -p $((35453 + $port_offset)):35453
        -p $((36963 + $port_offset)):36963
        -p $((38473 + $port_offset)):38473
    )

    # Run container interactively with tmpfs for ship extraction
    $CONTAINER_CMD run \
        --name tlon-e2e-shard-test \
        -it \
        --rm \
        --tmpfs /tmp:rw,size=4g,exec \
        --shm-size=2g \
        "${web_ports[@]}" \
        "${ship_ports[@]}" \
        -e SHARD=$shard \
        -e TOTAL_SHARDS=4 \
        -e CI=true \
        -e FORCE_EXTRACTION=true \
        -e RUBE_WORKSPACE=/tmp/rube-workspace \
        -v "$PWD/test-results/debug:/workspace/apps/tlon-web/test-results" \
        -v "$PWD/test-results/debug-report:/workspace/apps/tlon-web/playwright-report" \
        -v "$PWD/test-results/debug-workspace:/tmp/rube-workspace" \
        tlon-e2e-runner \
        bash -c "
            echo '=== Container Environment ==='
            echo 'Node version:' && node --version
            echo 'NPM version:' && npm --version
            echo 'PNPM version:' && pnpm --version
            echo 'TypeScript version:' && tsc --version || echo 'TypeScript not found'
            echo ''
            echo '=== Disk Space ==='
            df -h /tmp
            df -h /workspace
            echo ''
            echo '=== Creating workspace directory ==='
            mkdir -p /tmp/rube-workspace
            echo \"Created \$RUBE_WORKSPACE\"
            echo ''
            echo '=== Checking rube compilation ==='
            ls -la /workspace/apps/tlon-web/rube/dist/ 2>/dev/null || echo 'No dist directory'
            echo ''
            echo '=== Environment Variables ==='
            echo \"SHARD=\$SHARD\"
            echo \"TOTAL_SHARDS=\$TOTAL_SHARDS\"
            echo \"RUBE_WORKSPACE=\$RUBE_WORKSPACE\"
            echo ''
            echo '=== Testing rube script ==='
            cd /workspace/apps/tlon-web
            echo 'Running: node ./rube/dist/index.js --help'
            node ./rube/dist/index.js --help 2>&1 || echo 'Rube script failed'
            echo ''
            echo '=== You can now run commands manually ==='
            echo 'Try: cd /workspace/apps/tlon-web && node ./rube/dist/index.js'
            echo 'Or: cd /workspace/apps/tlon-web && pnpm e2e:shard'
            echo ''
            exec bash
        "
}

# Function to check logs
check_logs() {
    echo -e "${BLUE}Checking container logs...${NC}"

    for shard in 1 2 3 4; do
        container_name="tlon-e2e-shard-$shard"
        echo -e "${YELLOW}Shard $shard logs:${NC}"

        if $CONTAINER_CMD ps -a | grep -q $container_name; then
            echo "Last 20 lines:"
            $CONTAINER_CMD logs --tail 20 $container_name 2>&1 || echo "No logs available"

            # Check exit code
            exit_code=$($CONTAINER_CMD inspect $container_name --format='{{.State.ExitCode}}' 2>/dev/null || echo "unknown")
            echo "Exit code: $exit_code"
        else
            echo "Container not found"
        fi
        echo ""
    done
}

# Function to clean up
cleanup() {
    echo -e "${YELLOW}Cleaning up all test containers...${NC}"
    for shard in 1 2 3 4; do
        container_name="tlon-e2e-shard-$shard"
        $CONTAINER_CMD stop $container_name 2>/dev/null || true
        $CONTAINER_CMD rm -f $container_name 2>/dev/null || true
    done
    # Also clean up debug container
    $CONTAINER_CMD stop tlon-e2e-shard-test 2>/dev/null || true
    $CONTAINER_CMD rm -f tlon-e2e-shard-test 2>/dev/null || true
    echo -e "${GREEN}Cleanup complete${NC}"
}

# Main menu
case "${1:-help}" in
    test)
        test_shard ${2:-1}
        ;;
    logs)
        check_logs
        ;;
    cleanup)
        cleanup
        ;;
    *)
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  test [shard]  - Run a shard interactively for debugging (default: 1)"
        echo "  logs          - Check logs from all shard containers"
        echo "  cleanup       - Stop and remove all test containers"
        echo ""
        echo "Example:"
        echo "  $0 test 2     - Debug shard 2 interactively"
        echo "  $0 logs       - Check what went wrong in containers"
        ;;
esac