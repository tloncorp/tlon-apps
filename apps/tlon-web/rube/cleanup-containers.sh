#!/bin/bash

# E2E Container Cleanup Script
# Use this to forcefully clean up any stuck containers from parallel tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== E2E Container Cleanup ===${NC}"

# Check container runtime
if command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
elif command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
else
    echo -e "${RED}Error: Neither Docker nor Podman is installed${NC}"
    exit 1
fi

echo "Using container runtime: $CONTAINER_CMD"

# Find all e2e containers
echo -e "${YELLOW}Looking for e2e test containers...${NC}"
containers=$($CONTAINER_CMD ps -a --filter "name=tlon-e2e" --format "{{.Names}}" 2>/dev/null)

if [ -z "$containers" ]; then
    echo -e "${GREEN}No e2e containers found${NC}"
else
    echo "Found containers:"
    echo "$containers"
    echo ""

    # Stop all containers first
    for container in $containers; do
        echo -e "${YELLOW}Stopping $container...${NC}"
        $CONTAINER_CMD stop $container 2>/dev/null || true
    done

    # Wait for containers to stop
    sleep 1

    # Now remove them
    for container in $containers; do
        echo -e "${YELLOW}Removing $container...${NC}"
        $CONTAINER_CMD rm -f $container 2>/dev/null || true
    done

    # Wait for network cleanup
    sleep 2

    # Verify all containers are gone
    remaining=$($CONTAINER_CMD ps -a --filter "name=tlon-e2e" --format "{{.Names}}" 2>/dev/null | wc -l)
    if [ "$remaining" -eq 0 ]; then
        echo -e "${GREEN}All e2e containers cleaned up${NC}"
    else
        echo -e "${RED}Warning: $remaining containers still remain${NC}"
        $CONTAINER_CMD ps -a --filter "name=tlon-e2e" --format "table {{.Names}}\t{{.Status}}"
    fi
fi

# Clean up any dangling networks
echo -e "${YELLOW}Cleaning up dangling networks...${NC}"
$CONTAINER_CMD network prune -f 2>/dev/null || true

echo -e "${GREEN}Cleanup complete!${NC}"