#!/bin/bash

# E2E Parallel Test Runner
# This script orchestrates parallel test execution using containers

set -e

# Configuration
TOTAL_SHARDS=${TOTAL_SHARDS:-2}  # Reduced from 4 to 2 for better resource management
CONTAINER_NAME="tlon-e2e"
IMAGE_NAME="tlon-e2e-runner"
RESULTS_DIR="test-results"
PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

# Parse arguments
FORCE_BUILD=false
DEBUG=false
SPECIFIC_SHARD=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --build)
            FORCE_BUILD=true
            shift
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        --shard)
            SPECIFIC_SHARD="$2"
            shift 2
            ;;
        --total-shards)
            TOTAL_SHARDS="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== E2E Parallel Test Runner ===${NC}"
echo "Total shards: $TOTAL_SHARDS"

# Check if Docker or Podman is available
if command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
elif command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
else
    echo -e "${RED}Error: Neither Docker nor Podman is installed${NC}"
    exit 1
fi

echo "Using container runtime: $CONTAINER_CMD"

# Check for any existing e2e containers
existing_containers=$($CONTAINER_CMD ps -a --filter "name=${CONTAINER_NAME}-shard" --format "{{.Names}}" 2>/dev/null | wc -l)
if [ "$existing_containers" -gt 0 ]; then
    echo -e "${YELLOW}Found $existing_containers existing test container(s)${NC}"
fi

# Build the container image if needed
build_image() {
    echo -e "${YELLOW}Building test container image...${NC}"
    cd "$PROJECT_ROOT/apps/tlon-web/e2e"
    # Enable BuildKit for cache mounts and parallel downloads
    if [ "$CONTAINER_CMD" = "docker" ]; then
        DOCKER_BUILDKIT=1 $CONTAINER_CMD build -t $IMAGE_NAME -f Dockerfile "$PROJECT_ROOT"
    else
        # Podman supports BuildKit syntax by default
        $CONTAINER_CMD build -t $IMAGE_NAME -f Dockerfile "$PROJECT_ROOT"
    fi
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Container image built successfully${NC}"
    else
        echo -e "${RED}Failed to build container image${NC}"
        exit 1
    fi
}

# Check if image exists or force build
if [ "$FORCE_BUILD" = true ] || ! $CONTAINER_CMD images | grep -q $IMAGE_NAME; then
    build_image
fi

# If only building, exit here
if [ "$FORCE_BUILD" = true ] && [ -z "$SPECIFIC_SHARD" ]; then
    echo -e "${GREEN}Build complete. Run 'pnpm e2e:parallel' to execute tests.${NC}"
    exit 0
fi

# Create results directory
mkdir -p "$PROJECT_ROOT/apps/tlon-web/$RESULTS_DIR"

# Clean up previous test results using Docker (to handle root-owned files)
if [ -d "$PROJECT_ROOT/apps/tlon-web/$RESULTS_DIR" ] && [ "$(ls -A "$PROJECT_ROOT/apps/tlon-web/$RESULTS_DIR" 2>/dev/null | grep -c "^shard-")" -gt 0 ]; then
    echo -e "${YELLOW}Cleaning up previous test results...${NC}"
    # Use a lightweight container to remove root-owned files
    $CONTAINER_CMD run --rm \
        -v "$PROJECT_ROOT/apps/tlon-web/$RESULTS_DIR:/cleanup" \
        alpine:latest \
        sh -c "rm -rf /cleanup/shard-* /cleanup/blob-reports-temp /cleanup/merged-report /cleanup/artifacts 2>/dev/null || true"
fi

# Clean up any existing containers with retries
echo -e "${YELLOW}Cleaning up any existing containers...${NC}"
cleanup_containers() {
    for shard in $(seq 1 $TOTAL_SHARDS); do
        container_name="${CONTAINER_NAME}-shard-${shard}"
        # Force stop and remove to ensure cleanup
        if $CONTAINER_CMD ps -a --format "{{.Names}}" | grep -q "^${container_name}$"; then
            echo "Removing container: $container_name"
            $CONTAINER_CMD stop $container_name 2>/dev/null || true
            $CONTAINER_CMD rm -f $container_name 2>/dev/null || true
        fi
        # Also try to disconnect from network
        $CONTAINER_CMD network disconnect bridge $container_name 2>/dev/null || true
    done
}

# Try cleanup twice to ensure everything is removed
cleanup_containers
sleep 1
cleanup_containers

# Force network cleanup for stuck endpoints
echo -e "${YELLOW}Cleaning up network endpoints...${NC}"
for shard in $(seq 1 $TOTAL_SHARDS); do
    container_name="${CONTAINER_NAME}-shard-${shard}"
    $CONTAINER_CMD network disconnect -f bridge $container_name 2>/dev/null || true
done

# Wait for Docker to fully release network endpoints
sleep 3

# Double-check that all containers are gone
remaining=$($CONTAINER_CMD ps -a --filter "name=${CONTAINER_NAME}-shard" --format "{{.Names}}" 2>/dev/null | wc -l)
if [ "$remaining" -gt 0 ]; then
    echo -e "${RED}Warning: Found $remaining containers still present after cleanup${NC}"
    $CONTAINER_CMD ps -a --filter "name=${CONTAINER_NAME}-shard" --format "table {{.Names}}\t{{.Status}}"
fi

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to run a single shard
run_shard() {
    local shard=$1
    # Larger port offset for 2 shards to avoid any potential conflicts
    local port_offset=$((($shard - 1) * 20))

    echo -e "${BLUE}Starting shard $shard/$TOTAL_SHARDS (port offset: $port_offset)${NC}"

    # Check if ports are available
    local ports_to_check=(
        $((3000 + port_offset))
        $((3001 + port_offset))
        $((3002 + port_offset))
    )

    for port in "${ports_to_check[@]}"; do
        if check_port $port; then
            echo -e "${RED}Error: Port $port is already in use${NC}"
            echo "Please stop any services using these ports or use a different shard"
            return 1
        fi
    done

    # Create result directories
    mkdir -p "$PROJECT_ROOT/apps/tlon-web/$RESULTS_DIR/shard-${shard}"
    mkdir -p "$PROJECT_ROOT/apps/tlon-web/$RESULTS_DIR/shard-${shard}-report"

    # Container name for this shard
    local container_name="${CONTAINER_NAME}-shard-${shard}"

    # Force stop and remove any existing container with this name (redundant but safe)
    $CONTAINER_CMD stop $container_name 2>/dev/null || true
    $CONTAINER_CMD rm -f $container_name 2>/dev/null || true

    # Environment variables for the shard
    local env_vars=(
        -e "SHARD=$shard"
        -e "TOTAL_SHARDS=$TOTAL_SHARDS"
        -e "CI=true"
        -e "IN_CONTAINER=true"
        -e "SKIP_DOWNLOAD=true"
        -e "FORCE_EXTRACTION=true"
    )

    # Add storage configuration if available
    if [ -n "$E2E_S3_ENDPOINT" ]; then
        env_vars+=(
            -e "E2E_S3_ENDPOINT=$E2E_S3_ENDPOINT"
            -e "E2E_S3_ACCESS_KEY_ID=$E2E_S3_ACCESS_KEY_ID"
            -e "E2E_S3_SECRET_ACCESS_KEY=$E2E_S3_SECRET_ACCESS_KEY"
            -e "E2E_S3_BUCKET_NAME=$E2E_S3_BUCKET_NAME"
            -e "E2E_S3_REGION=${E2E_S3_REGION:-us-east-1}"
        )
    fi

    # Pass INCLUDE_OPTIONAL_SHIPS flag if set
    if [ -n "$INCLUDE_OPTIONAL_SHIPS" ]; then
        env_vars+=(-e "INCLUDE_OPTIONAL_SHIPS=$INCLUDE_OPTIONAL_SHIPS")
    fi

    # Create directories for workspace and downloads
    mkdir -p "$PROJECT_ROOT/apps/tlon-web/$RESULTS_DIR/shard-${shard}-workspace"
    mkdir -p "$PROJECT_ROOT/apps/tlon-web/$RESULTS_DIR/shared-downloads"

    # Volume mounts for results and workspace
    # Ships will stay inside container to avoid Unix socket path issues
    local volumes=(
        -v "$PROJECT_ROOT/apps/tlon-web/$RESULTS_DIR/shard-${shard}:/workspace/apps/tlon-web/test-results"
        -v "$PROJECT_ROOT/apps/tlon-web/$RESULTS_DIR/shard-${shard}-report:/workspace/apps/tlon-web/playwright-report"
        -v "$PROJECT_ROOT/apps/tlon-web/$RESULTS_DIR/shard-${shard}-workspace:/tmp/rube-workspace"
    )

    # Storage options and performance optimizations
    local storage_opts=(
        --shm-size=4g  # Increased shared memory for better browser performance
        # Use tmpfs for entire /tmp to improve I/O performance
        --tmpfs /tmp:rw,size=16g,exec
    )

    # Add CPU affinity if system has enough cores
    # Note: CPU affinity is disabled on macOS because Docker runs in a VM
    # and the VM's scheduler does better load balancing than manual affinity
    local cpu_affinity=""
    local num_cores=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
    local cores_per_shard=$((num_cores / TOTAL_SHARDS))
    local is_macos=false
    if [[ "$OSTYPE" == "darwin"* ]]; then
        is_macos=true
    fi

    # Only set CPU affinity on Linux with at least 4 cores per shard
    # macOS: Docker runs in VM, affinity doesn't work reliably
    # Linux: Requires >= 4 cores per shard for heavy workload (ships + vite servers)
    if [ "$is_macos" = false ] && [ "$cores_per_shard" -ge 4 ]; then
        local start_cpu=$(( (shard - 1) * cores_per_shard ))
        local end_cpu=$(( start_cpu + cores_per_shard - 1 ))
        cpu_affinity="--cpuset-cpus=${start_cpu}-${end_cpu}"
        echo -e "${GREEN}CPU affinity enabled: Shard $shard using ${cpu_affinity}${NC}"
    else
        if [ "$is_macos" = true ]; then
            echo -e "${YELLOW}CPU affinity disabled on macOS (Docker VM will handle scheduling)${NC}"
        else
            echo -e "${YELLOW}Insufficient cores for CPU affinity (${num_cores} cores / ${TOTAL_SHARDS} shards, need >= 4 per shard)${NC}"
        fi
    fi

    # Port mappings for this shard
    # Map host ports with offset to standard container ports
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

    # Run the container
    if [ "$DEBUG" = true ]; then
        # Interactive mode for debugging
        $CONTAINER_CMD run \
            --name $container_name \
            -it \
            --rm \
            $cpu_affinity \
            "${storage_opts[@]}" \
            "${web_ports[@]}" \
            "${ship_ports[@]}" \
            "${env_vars[@]}" \
            "${volumes[@]}" \
            $IMAGE_NAME \
            "bash -c 'cd /workspace/apps/tlon-web && export RUBE_WORKSPACE=/tmp/rube-workspace && mkdir -p \$RUBE_WORKSPACE && pnpm e2e:shard 2>&1 | tee /workspace/apps/tlon-web/test-results/shard-${shard}.log'"
    else
        # Background mode for parallel execution
        # Run container in detached mode
        echo -e "${YELLOW}Launching container for shard $shard...${NC}"

        # Build the command to run in the container
        # Note: image has ENTRYPOINT ["/bin/bash", "-c"] so we pass the entire command as a string
        local container_cmd="cd /workspace/apps/tlon-web && \
export RUBE_WORKSPACE=/tmp/rube-workspace && \
mkdir -p \$RUBE_WORKSPACE && \
echo 'Starting shard ${shard} tests...' && \
df -h /tmp && \
echo \"Workspace: \$RUBE_WORKSPACE\" && \
node ./rube/dist/index.js 2>&1 | tee test-results/shard-${shard}.log; \
exit_code=\$?; \
echo \"Shard ${shard} finished with exit code: \$exit_code\"; \
exit \$exit_code"

        # Run container with the command directly
        $CONTAINER_CMD run \
            --name $container_name \
            -d \
            $cpu_affinity \
            "${storage_opts[@]}" \
            "${web_ports[@]}" \
            "${ship_ports[@]}" \
            "${env_vars[@]}" \
            "${volumes[@]}" \
            $IMAGE_NAME \
            "$container_cmd"

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}Started container for shard $shard${NC}"
        else
            echo -e "${RED}Failed to start container for shard $shard${NC}"
            return 1
        fi
    fi
}

# Run specific shard or all shards
if [ -n "$SPECIFIC_SHARD" ]; then
    # Run a specific shard (for debugging)
    if [[ ! "$SPECIFIC_SHARD" =~ ^([0-9]+)/([0-9]+)$ ]]; then
        echo -e "${RED}Invalid shard format. Use: --shard N/M (e.g., --shard 2/4)${NC}"
        exit 1
    fi

    shard_num="${BASH_REMATCH[1]}"
    total="${BASH_REMATCH[2]}"

    if [ "$total" != "$TOTAL_SHARDS" ]; then
        echo -e "${YELLOW}Warning: Shard total ($total) doesn't match TOTAL_SHARDS ($TOTAL_SHARDS)${NC}"
        TOTAL_SHARDS=$total
    fi

    run_shard $shard_num

    if [ "$DEBUG" = false ]; then
        echo "Waiting for shard $shard_num to complete..."
        wait
    fi
else
    # Run all shards in parallel
    echo -e "${GREEN}Starting all $TOTAL_SHARDS shards in parallel...${NC}"

    for shard in $(seq 1 $TOTAL_SHARDS); do
        run_shard $shard
        # Small delay between container starts to avoid Docker network race conditions
        sleep 0.5
    done

    # Wait for all containers to complete
    echo -e "${YELLOW}Waiting for all shards to complete...${NC}"
    echo -e "${YELLOW}You can check container logs with: docker logs tlon-e2e-shard-N${NC}"

    # Monitor container status
    all_done=false
    check_count=0
    max_checks=360  # 30 minutes maximum (360 * 5 seconds)
    failed_early=""

    while [ "$all_done" = false ] && [ $check_count -lt $max_checks ]; do
        all_done=true
        for shard in $(seq 1 $TOTAL_SHARDS); do
            container_name="${CONTAINER_NAME}-shard-${shard}"

            # Check if container is still running
            if $CONTAINER_CMD ps | grep -q $container_name; then
                all_done=false
            else
                # Check if container exists but stopped (potential failure)
                if $CONTAINER_CMD ps -a | grep -q $container_name; then
                    exit_code=$($CONTAINER_CMD inspect $container_name --format='{{.State.ExitCode}}' 2>/dev/null || echo "unknown")
                    if [ "$exit_code" != "0" ] && [ "$exit_code" != "unknown" ]; then
                        if [[ ! "$failed_early" =~ "$shard" ]]; then
                            echo ""
                            echo -e "${RED}Shard $shard exited early with code $exit_code${NC}"
                            echo "Last 20 lines of logs:"
                            $CONTAINER_CMD logs --tail 20 $container_name 2>&1 || true
                            echo "---"
                            failed_early="$failed_early $shard"
                        fi
                    fi
                fi
            fi
        done

        if [ "$all_done" = false ]; then
            sleep 5
            check_count=$((check_count + 1))

            # Show progress and container status every 30 seconds
            if [ $((check_count % 6)) -eq 0 ]; then
                echo ""
                echo "Still running (${check_count} checks, $((check_count * 5)) seconds elapsed)..."
                $CONTAINER_CMD ps | grep $CONTAINER_NAME || true
            else
                echo -n "."
            fi
        fi
    done

    if [ $check_count -ge $max_checks ]; then
        echo -e "${RED}Timeout: Tests took longer than 30 minutes${NC}"
        # Kill all containers
        for shard in $(seq 1 $TOTAL_SHARDS); do
            container_name="${CONTAINER_NAME}-shard-${shard}"
            $CONTAINER_CMD stop $container_name 2>/dev/null || true
        done
    fi

    echo ""
    echo -e "${GREEN}All shards completed!${NC}"

    # Check for failures
    failed_shards=""
    for shard in $(seq 1 $TOTAL_SHARDS); do
        container_name="${CONTAINER_NAME}-shard-${shard}"

        # Check if container exists before inspecting
        if $CONTAINER_CMD ps -a | grep -q $container_name; then
            exit_code=$($CONTAINER_CMD inspect $container_name --format='{{.State.ExitCode}}' 2>/dev/null || echo "1")

            # Show container logs if failed
            if [ "$exit_code" != "0" ]; then
                failed_shards="$failed_shards $shard"
                echo -e "${RED}Shard $shard failed with exit code $exit_code${NC}"
                echo "Last 10 lines of logs:"
                $CONTAINER_CMD logs --tail 10 $container_name 2>&1 || true
                echo "---"
            fi
        else
            echo -e "${YELLOW}Warning: Container $container_name not found${NC}"
            failed_shards="$failed_shards $shard"
        fi
    done

    if [ -n "$failed_shards" ]; then
        echo -e "${RED}Failed shards:$failed_shards${NC}"
    fi

    # Merge test results
    echo -e "${BLUE}Merging test results...${NC}"
    cd "$PROJECT_ROOT/apps/tlon-web"
    TOTAL_SHARDS=$TOTAL_SHARDS node e2e/merge-reports.js

    echo -e "${GREEN}Test execution complete!${NC}"

    # Clean up containers
    echo -e "${YELLOW}Cleaning up containers...${NC}"
    for shard in $(seq 1 $TOTAL_SHARDS); do
        container_name="${CONTAINER_NAME}-shard-${shard}"
        $CONTAINER_CMD stop $container_name 2>/dev/null || true
        $CONTAINER_CMD rm -f $container_name 2>/dev/null || true
    done

    # Clean up Docker build cache to prevent disk space issues
    echo -e "${YELLOW}Cleaning up Docker build cache...${NC}"
    $CONTAINER_CMD builder prune -af > /dev/null 2>&1 || true
    echo -e "${GREEN}Docker cleanup complete${NC}"

    # Exit with failure if any shards failed
    if [ -n "$failed_shards" ]; then
        exit 1
    fi
fi