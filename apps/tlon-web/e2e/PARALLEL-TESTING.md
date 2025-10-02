# Parallel E2E Testing

## Overview

The parallel test runner allows running Playwright E2E tests in parallel using Docker containers. Each shard runs in its own container with isolated Urbit ships.

**Default configuration**: 2 shards with 2 ships each (~zod, ~ten) - completes in ~24 minutes
**With optional ships**: 2 or 4 shards with 4 ships each (~zod, ~ten, ~bus, ~mug)

## Prerequisites

- Docker or Podman installed
- At least 16GB of RAM available for 2 shards, 32GB for 4 shards
- ~20GB of free disk space (automatically cleaned after each run)

## Commands

```bash
# Build the test container (required first time and after code changes)
pnpm e2e:parallel:build

# Run all tests in parallel (default: 2 shards, 2 ships each)
pnpm e2e:parallel

# Run with 4 shards (requires more CPU/RAM)
TOTAL_SHARDS=4 pnpm e2e:parallel

# Run with optional ships (~bus, ~mug) for full test coverage
INCLUDE_OPTIONAL_SHIPS=true pnpm e2e:parallel

# Debug a specific shard interactively
pnpm e2e:parallel:debug test 1  # Debug shard 1
pnpm e2e:parallel:debug test 2  # Debug shard 2

# Clean up stuck containers
pnpm e2e:parallel:cleanup

# Check container logs
pnpm e2e:parallel:debug logs

# View merged test results from all shards
npx playwright show-report test-results/merged-report
```

## Architecture

- **Configurable shards** (default: 2) run in parallel, each with:
  - Isolated Docker container
  - Own set of Urbit ships (default: ~zod, ~ten only)
  - Unique port ranges (offset by 20 per shard)
  - 16GB tmpfs for ship extraction and runtime
  - Playwright test subset based on `--shard` flag
  - CPU affinity disabled on macOS (Docker VM handles scheduling)

- **Port allocation** (offset by 20 per shard):
  - Shard 1: Web 3000-3002, Ships 35453, 38473 (default) or add 36963 (~bus), 39983 (~mug)
  - Shard 2: Web 3020-3022, Ships 35473, 38493 (default) or add 36983 (~bus), 40003 (~mug)
  - Shard 3: Web 3040-3042, Ships 35493, 38513 (default) or add 37003 (~bus), 40023 (~mug)
  - Shard 4: Web 3060-3062, Ships 35513, 38533 (default) or add 37023 (~bus), 40043 (~mug)

- **Optional ships** (`INCLUDE_OPTIONAL_SHIPS=true`):
  - Adds ~bus (outdated ship for protocol mismatch tests)
  - Adds ~mug (invite service provider)
  - Enables additional test files that require these ships

## Troubleshooting

### Container name already exists
```bash
# Clean up stuck containers
pnpm e2e:parallel:cleanup
```

### ENOSPC: no space left on device
- Container tmpfs is full (16GB limit)
- Check Docker disk space: `docker system df`
- Note: Docker build cache is automatically cleaned after each run
- Manual cleanup: `docker system prune -a`

### Tests not running
```bash
# Debug a shard interactively
pnpm e2e:parallel:debug test 1

# Inside container, check:
df -h /tmp                          # Disk space
ls -la ./rube/dist/                 # Compiled scripts
echo $RUBE_WORKSPACE                # Workspace location
node ./rube/dist/index.js --help    # Test script
```

### Port conflicts
- Ensure no other services are using ports 3000-3032
- Check: `lsof -i :3000` (repeat for other ports)

### Permission denied errors on cleanup
- Files created by Docker containers are owned by root
- The script automatically uses Docker to clean up these files
- Manual cleanup if needed: `docker run --rm -v "$(pwd)/test-results:/cleanup" alpine:latest rm -rf /cleanup/shard-*`

## CI Configuration

Add to GitHub Actions (adjust shard count based on available resources):

```yaml
e2e-parallel:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      shard: [1, 2]  # Use [1, 2, 3, 4] for 4 shards if runners have enough resources
  steps:
    - uses: actions/checkout@v4
    - name: Run E2E Tests (Shard ${{ matrix.shard }})
      env:
        TOTAL_SHARDS: 2  # Must match matrix size
        INCLUDE_OPTIONAL_SHIPS: false  # Set to true for full test coverage
      run: |
        pnpm e2e:parallel:build
        ./e2e/parallel-test-runner.sh --shard ${{ matrix.shard }}/${{ env.TOTAL_SHARDS }}
    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: test-results-shard-${{ matrix.shard }}
        path: apps/tlon-web/test-results/shard-${{ matrix.shard }}*
```

## Performance Notes

- **Test distribution**: Each shard runs approximately equal number of test files
- **Timing**: ~24 minutes for 2 shards with 2 ships (default configuration)
- **Ship boot time**: Ships boot in parallel within each container (~2 minutes with `FORCE_EXTRACTION=true`)
- **Test skipping**: Tests requiring optional ships (~bus, ~mug) are automatically skipped when `INCLUDE_OPTIONAL_SHIPS=false`

## Implementation Details

- **Dockerfile**: Ubuntu 22.04 base with Node 20, pnpm, Playwright, pre-baked ship archives
- **parallel-test-runner.sh**: Orchestrates container lifecycle, manages port allocation, handles cleanup
- **rube/index.ts**: Modified to support `RUBE_WORKSPACE` env var and `INCLUDE_OPTIONAL_SHIPS`
- **playwright.config.ts**: Blob reporter for sharded runs, filters optional ships from webServers
- **auth.setup.ts**: Filters optional ships during authentication
- **merge-reports.js**: Combines blob reports and JUnit XML from all shards into unified HTML report
- **Storage**: Uses 16GB tmpfs at `/tmp` for fast ship extraction and runtime
- **CPU Affinity**: Disabled on macOS (Docker VM), enabled on Linux with ≥4 cores per shard
- **Cleanup**: Automatic Docker build cache cleanup after test completion