# Parallel E2E Testing

## Overview

The parallel test runner speeds up E2E tests by running them in multiple isolated Docker containers simultaneously. Instead of running all tests sequentially (~48+ minutes), we split them into "shards" that run in parallel.

**What is a shard?** An isolated test environment (Docker container) that:

-   Runs a subset of your test files
-   Has its own Urbit ships (~zod, ~ten, and optionally ~bus, ~mug)
-   Has its own Vite dev servers
-   Runs completely independently from other shards

**Configuration:**

-   **Local development**: 2 shards (default) - completes in ~24 minutes
-   **CI**: 4 shards - completes in ~12 minutes

## When to Use

-   **Use `pnpm e2e:parallel`** when:

    -   Running full test suite locally (faster than sequential)
    -   Running tests in CI (already configured)
    -   You have Docker/Podman installed and 16GB+ RAM available

-   **Use regular `pnpm e2e`** when:
    -   Debugging a specific test (simpler, no containers)
    -   Running a single test file with `pnpm e2e:test <file>`
    -   Your machine doesn't have Docker or sufficient RAM

## Quick Start

**First time setup:**

```bash
cd apps/tlon-web

# 1. Build the Docker image (takes ~5 minutes)
pnpm e2e:parallel:build

# 2. Run tests in parallel (default: 2 shards)
pnpm e2e:parallel

# 3. View results when done
npx playwright show-report test-results/merged-report
```

**What happens during a run:**

1. Script builds/pulls Docker image (ships are pre-extracted in the image)
2. Starts 2 containers in parallel (Shard 1, Shard 2)
3. Each container:
    - Copies pre-extracted ships from image to tmpfs (~30 seconds)
    - Starts Urbit ships and Vite servers
    - Runs its subset of tests via Playwright `--shard` flag
    - Saves results to `test-results/shard-N/`
4. Script merges all shard results into unified HTML report
5. Containers are automatically cleaned up

## Prerequisites

-   Docker or Podman installed
-   At least 16GB of RAM available for 2 shards, 32GB for 4 shards
-   ~20GB of free disk space (automatically cleaned after each run)

## Commands

```bash
# Build the test container (required first time and after code changes)
pnpm e2e:parallel:build

# Run all tests in parallel (default: 2 shards, 2 ships each)
pnpm e2e:parallel

# Run with 4 shards (requires more CPU/RAM, faster completion)
TOTAL_SHARDS=4 pnpm e2e:parallel

# Run with optional ships (~bus, ~mug) for full test coverage
# Note: Adds invite-service and protocol-mismatch tests
INCLUDE_OPTIONAL_SHIPS=true pnpm e2e:parallel

# Debug a specific shard interactively (opens bash inside container)
pnpm e2e:parallel:debug test 1  # Debug shard 1
pnpm e2e:parallel:debug test 2  # Debug shard 2

# Check logs from all running containers
pnpm e2e:parallel:debug logs

# Clean up stuck containers (use if script fails to cleanup)
pnpm e2e:parallel:cleanup

# View merged test results from all shards
npx playwright show-report test-results/merged-report
```

## How It Works

### High-Level Flow

```
parallel-runner.sh
├─> Shard 1 Container
│   ├─> Copy pre-extracted ships to tmpfs (~zod, ~ten)
│   ├─> Boot ships & start Vite servers (port 3000, 3002)
│   ├─> Run tests (--shard 1/2)
│   └─> Save results → test-results/shard-1/
│
├─> Shard 2 Container
│   ├─> Copy pre-extracted ships to tmpfs (~zod, ~ten)
│   ├─> Boot ships & start Vite servers (port 3000, 3002)
│   ├─> Run tests (--shard 2/2)
│   └─> Save results → test-results/shard-2/
│
└─> Merge reports → test-results/merged-report/
```

### Container Isolation

Each shard runs in an isolated Docker container with:

-   **Own Urbit ships**: Ships are pre-extracted in the Docker image, copied to tmpfs at runtime for isolation
-   **Own Vite servers**: Each shard runs its own dev servers on standard internal ports
-   **Own test subset**: Playwright's `--shard N/TOTAL` splits tests evenly across shards
-   **Tmpfs storage**: 16GB in-memory filesystem at `/tmp` for fast ship copying and runtime (~2.7GB used by default, ~7.2GB with optional ships)
-   **CPU affinity** (Linux only): Pins each shard to dedicated CPU cores if 4+ cores per shard available

### Port Mapping (for Debugging)

Ports are exposed to the host for debugging via browser (e.g., http://localhost:3020 to see Shard 2's UI). Tests run inside containers and use internal ports directly.

**Internal ports (same in all containers):**

-   ~zod: web 3000, ship 35453
-   ~bus: web 3001, ship 36963 (optional)
-   ~ten: web 3002, ship 38473
-   ~mug: web 3003, ship 39983 (optional)

**Host ports (offset by 20 per shard):**

-   Shard 1: Host 3000-3003, 35453, 36963, 38473, 39983
-   Shard 2: Host 3020-3023, 35473, 36983, 38493, 40003
-   Shard 3: Host 3040-3043, 35493, 37003, 38513, 40023
-   Shard 4: Host 3060-3063, 35513, 37023, 38533, 40043

### Optional Ships

All 4 ships (~zod, ~ten, ~bus, ~mug) are pre-extracted in the Docker image. By default, only ~zod and ~ten are started at runtime to minimize resource usage and test time.

**`INCLUDE_OPTIONAL_SHIPS=true` starts:**

-   **~bus** (1.3GB): Outdated ship for protocol mismatch tests (intentionally kept at older version)
-   **~mug** (3.2GB): Invite service provider for invite-related tests

Tests requiring optional ships are automatically skipped when `INCLUDE_OPTIONAL_SHIPS=false`.

## Troubleshooting

### How do I know if it's working?

**Successful output looks like:**

```
=== E2E Parallel Test Runner ===
Total shards: 2
Using container runtime: docker

Building test container image...
Container image built successfully

Starting all 2 shards in parallel...
Starting shard 1/2 (port offset: 0)
Launching container for shard 1...
Started container for shard 1

Starting shard 2/2 (port offset: 20)
Launching container for shard 2...
Started container for shard 2

Waiting for all shards to complete...
You can check container logs with: docker logs tlon-e2e-shard-N
.....

All shards completed!
Capturing container logs...
  Saving logs for shard 1...
  Saving logs for shard 2...

Merging test results...
Test execution complete!
```

**Container logs show ship setup and test execution:**

-   Ships copy from image to tmpfs
-   `SHIP_SETUP_COMPLETE` printed when ships are ready
-   Playwright runs test subset with `--shard N/TOTAL`

**If tests hang:**

-   Ships take ~30 seconds to copy from image to tmpfs, then ~2 minutes to boot
-   If "SHIP_SETUP_COMPLETE" doesn't appear after 5 minutes, check logs: `pnpm e2e:parallel:debug logs`

### Container name already exists

```bash
# Clean up stuck containers
pnpm e2e:parallel:cleanup
```

This happens if a previous run was interrupted (Ctrl+C, crash). The cleanup script removes all `tlon-e2e-shard-*` containers.

### ENOSPC: no space left on device

**Container tmpfs is full (16GB limit)**:

-   Default ships (~zod 1.4GB, ~ten 1.3GB) use ~2.7GB total - well within limit
-   With optional ships (~bus 1.3GB, ~mug 3.2GB) use ~7.2GB total - still within limit
-   If hitting 16GB limit, likely caused by test artifacts or ship pier growth during long runs
-   Check usage inside container: `pnpm e2e:parallel:debug test 1` then `df -h /tmp`
-   Solution: Clear test results or increase tmpfs size in `rube/parallel-runner.sh` line 249

**Docker disk space full**:

-   Check: `docker system df`
-   Docker build cache is automatically cleaned after each test run
-   Manual cleanup: `docker system prune -a` (removes all unused images/build cache)

### Tests not running

```bash
# Debug a shard interactively (opens bash inside container)
pnpm e2e:parallel:debug test 1

# Inside container, check:
df -h /tmp                          # Disk space
ls -la ./rube/dist/                 # Compiled scripts exist
echo $RUBE_WORKSPACE                # Should be /workspace
echo $SHARD $TOTAL_SHARDS           # Shard config
node ./rube/dist/index.js --help    # Test script help
```

### Port conflicts

**Error**: `Port 3000 is already in use`

Ensure no other services use test ports:

-   Web: 3000-3063
-   Ships: 35453-40043

Check what's using a port: `lsof -i :3000`

### Permission denied errors on cleanup

Files created by Docker containers are owned by root. The cleanup script automatically handles this using Docker.

**Manual cleanup if needed**:

```bash
docker run --rm -v "$(pwd)/test-results:/cleanup" alpine:latest rm -rf /cleanup/shard-*
```

### Tests fail in parallel but pass individually

**Possible causes:**

1. **Test pollution**: One test affects another (fix cleanup in `e2e/test-fixtures.ts`)
2. **Timing issues**: Cross-ship operations may need longer timeouts
3. **Resource contention**: Try reducing `TOTAL_SHARDS` or increasing RAM

**Debug**:

```bash
# Run just the failing test in isolation
pnpm e2e:test failing-test.spec.ts

# Run with 1 shard to eliminate parallelism
TOTAL_SHARDS=1 pnpm e2e:parallel
```

## CI Configuration

Our CI runs all shards in a single self-hosted job:

```yaml
e2e-parallel:
    runs-on: self-hosted # Fedora runner with Podman
    steps:
        - name: Build E2E Docker Image
          run: |
              cd apps/tlon-web
              pnpm e2e:parallel:build

        - name: Run E2E Tests (Parallel)
          env:
              TOTAL_SHARDS: 4
              INCLUDE_OPTIONAL_SHIPS: false
          run: |
              cd apps/tlon-web
              pnpm e2e:parallel

        - name: Upload Test Results
          if: always()
          uses: actions/upload-artifact@v4
          with:
              name: e2e-test-results
              path: |
                  apps/tlon-web/test-results/merged-report/
                  apps/tlon-web/test-results/junit-merged.xml
```

**Why self-hosted?** Parallel E2E requires significant resources (32GB RAM for 4 shards, Docker/Podman).

## Performance

-   **2 shards (default local)**: ~24 minutes
-   **4 shards (CI)**: ~12 minutes (requires 32GB RAM, 16+ CPU cores)
-   **With optional ships**: Adds ~5 minutes (larger ships, more tests)

**Timing breakdown per shard:**

-   Copy ships to tmpfs: ~30 seconds
-   Boot ships: ~2 minutes
-   Run tests: varies by shard (test distribution)

**Optimization tips:**

-   2 shards best for local development (sufficient parallelism, lower resource usage)
-   4 shards best for CI with powerful self-hosted runner
-   Optional ships only needed for full test coverage (invite, protocol tests)

## Implementation Details

**Key files:**

-   `rube/parallel-runner.sh`: Orchestrates container lifecycle, manages ports, handles cleanup
-   `rube/Dockerfile`: Ubuntu 22.04 base with Node 20, pnpm, Playwright, pre-baked ship archives
-   `rube/index.ts`: Test runner modified to support `RUBE_WORKSPACE` env var and optional ships
-   `rube/merge-reports.js`: Combines blob reports and JUnit XML from all shards
-   `playwright.config.ts`: Blob reporter for sharded runs, filters optional ships from webServers
-   `e2e/auth.setup.ts`: Filters optional ships during authentication
-   `e2e/shipManifest.json`: Ship configuration with URLs, ports, auth codes

**Technical details:**

-   **Storage**: 16GB tmpfs at `/tmp` for fast ship copying and runtime (~2.7GB default, ~7.2GB with optional ships)
-   **Ship preparation**: Ships are downloaded, extracted, and pre-baked into Docker image at build time (see Dockerfile lines 64-82)
-   **Ship sizes**: ~zod 1.4GB, ~ten 1.3GB, ~bus 1.3GB, ~mug 3.2GB (extracted)
-   **CPU Affinity**: Enabled on Linux with ≥4 cores per shard, disabled on macOS (Docker VM handles scheduling)
-   **Cleanup**: Automatic Docker build cache cleanup after test completion
-   **Ship archives**: Downloaded from GCS at `gs://bootstrap.urbit.org/` during Docker build
