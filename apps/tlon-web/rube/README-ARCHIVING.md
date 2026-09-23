# Pier Archiving and Upload Documentation

This document describes the automated process for archiving and uploading e2e test piers to Google Cloud Storage.

## Overview

The e2e test infrastructure uses pre-configured Urbit ships (piers) that are periodically updated and archived. These archives are stored in Google Cloud Storage and referenced in `shipManifest.json`.

## Scripts

### `archive-piers.sh`

Main script that automates the entire pier archiving and upload process.

**What it does:**
1. Starts the playwright-dev environment to boot all ships
2. Applies latest desk updates to ships
3. Gracefully stops the environment
4. Archives each pier (except ~bus and ~bud, which are hand-built — see below)
5. **Validates archives locally** before upload (structure and essential files)
6. Uploads archives to `gs://bootstrap.urbit.org/`
7. Updates `shipManifest.json` with new URLs
8. Optionally runs full verification of uploaded archives
9. Optionally cleans up local archives

**Usage:**

```bash
# Normal run - archives, uploads, and updates manifest
./archive-piers.sh

# Run with automatic verification after upload (recommended for releases)
./archive-piers.sh --verify

# Dry run - shows what would be done without making changes
DRY_RUN=true ./archive-piers.sh

# Create archives but skip GCS upload
SKIP_UPLOAD=true ./archive-piers.sh

# Keep local archives after upload
SKIP_CLEANUP=true ./archive-piers.sh

# Combine flags
DRY_RUN=true SKIP_CLEANUP=true ./archive-piers.sh

# Show help
./archive-piers.sh --help
```

**New Features:**
- **Local validation**: Archives are now validated locally before upload to catch issues early
- **--verify flag**: Automatically runs full verification after upload
- **Better error handling**: Script exits with proper codes for CI/CD integration

**Prerequisites:**
- `gcloud` CLI installed and authenticated
- `gsutil` available
- `jq` for JSON manipulation
- `pnpm` for running e2e infrastructure
- Write access to `gs://bootstrap.urbit.org/` bucket

### `verify-archives.sh`

Helper script to verify that uploaded archives work correctly.

**What it does:**
1. Downloads archives from URLs in `shipManifest.json`
2. Extracts and verifies pier structure
3. Verifies essential desk files are present
4. Tests that each pier can boot successfully

**Usage:**

```bash
# Verify all ships (zod, ten, mug)
./verify-archives.sh

# Verify specific ships
SHIPS_TO_VERIFY="zod ten" ./verify-archives.sh
```

### `build-n1-pier.sh`

Builds the pinned N-1 desk pier, `~bud`. Boots a fresh fakeship, merges and
commits the `%groups` desk from the git tag named by the ship's `deskVersion` in
`shipManifest.json`, verifies the ship reports that version, then hands off to
`archive-piers.sh --skip-prepare --ship bud` to produce `rube-bud<n>.tgz`.
`--ship` requires `--skip-prepare`: the prep pass drives rube, which never builds
a hand-built pier, so without it the archiver would package whatever stale pier is
already in `dist/`.

It does not upload. Publishing the archive to `gs://bootstrap.urbit.org/` is a
maintainer step; the script prints the two `gsutil` commands. `n1-e2e.yml`
checks that the object is published before it boots anything, so an un-uploaded
archive fails the job with that message rather than inside rube.

**What decides the pier's contents**, so a rebuild on another machine matches:

| input | pinned where |
| ----- | ------------ |
| vere | `VERE_VERSION` in the script (currently `v4.6`), fetched from `bootstrap.urbit.org/vere/live/` and verified with `urbit --version`. rube itself resolves an unpinned `latest`; this does not. |
| boot pill | Implicit — whatever `urbit -F` fetches for that vere. At v4.6 that is a %brass pill with %base + %landscape + %groups, building `zuse: 0v1b.4qafq` (kelvin 408), matching `desk/sys.kelvin`. |
| desk | The git tag named by the ship's `deskVersion`, assembled with that tag's own `peru.yaml`. |

The repo's test pill (`backend/run-tests.sh`, `groups-v11-3-0-408k.pill`) is the
same kernel but installs no `%docket`/`%settings`/`%storage`/`%landscape`, so the
web client cannot run on a pier booted from it. That is why this uses `-F` and
not `-B <pill>`. If a future vere bundles a pill on a different kelvin from
`desk/sys.kelvin`, the desk commit will fail to build — bump `VERE_VERSION`
deliberately.

Re-run it whenever `MIN_GROUPS_VERSION`
(`packages/shared/src/logic/deskPolicy.ts`) moves — the `N-1 Desk E2E` workflow
fails fast when the pin and the constant disagree. See
`docs/tlon-apps/desk-compatibility.md`.

```bash
# after setting ~bud's deskVersion and the next rube-bud<n>.tgz in the manifest
./build-n1-pier.sh
```

## Best Practices

### When to Use Each Tool

**archive-piers.sh**:
- Creating new archives after desk updates
- Preparing releases
- Monthly maintenance updates

**verify-archives.sh**:
- After uploading new archives (if not using --verify flag)
- When e2e tests fail unexpectedly (to rule out archive issues)
- Before major releases
- In CI/CD pipelines to validate manifest integrity

### Recommended Workflows

#### For Regular Updates
```bash
# Complete workflow with automatic verification
./archive-piers.sh --verify
```

#### For Quick Testing
```bash
# Create and upload without verification (faster, less safe)
./archive-piers.sh
# Verify manually later if needed
./verify-archives.sh
```

#### For CI/CD Integration
```bash
# In your CI pipeline
./verify-archives.sh || exit 1  # Fail fast if archives are broken
```

### Safety Features

1. **Local Validation**: Every archive is validated locally before upload
   - Checks archive can be extracted
   - Verifies pier structure
   - Confirms essential files exist

2. **Upload Verification**: Use `--verify` flag for end-to-end validation
   - Downloads from GCS
   - Tests pier booting
   - Ensures manifest URLs are correct

3. **Dry Run Mode**: Test the process without making changes
   - See what would be uploaded
   - Check version increments
   - Validate prerequisites

## Process Workflow

### When to Archive New Piers

Archive new piers when:
- Significant backend changes have been made to the groups desk
- New apps or features need to be included in test piers
- Pier state needs to be reset or cleaned up
- Monthly maintenance (recommended)

### Step-by-Step Process

1. **Ensure latest desk changes are committed**
   ```bash
   cd desk/
   git status  # Check for uncommitted changes
   ```

2. **Run the archive script with verification (recommended)**
   ```bash
   cd apps/tlon-web/rube/
   ./archive-piers.sh --verify
   ```
   
   Or without automatic verification:
   ```bash
   ./archive-piers.sh
   # Then manually verify:
   ./verify-archives.sh
   ```

3. **Commit the updated manifest**
   ```bash
   git add ../e2e/shipManifest.json
   git commit -m "Update e2e pier archives to version X"
   ```

5. **Create a PR with the changes**

## Archive Naming Convention

Archives follow the pattern: `rube-{ship}{version}.tgz`

Examples:
- `rube-zod14.tgz` - zod pier, version 14
- `rube-ten15.tgz` - ten pier, version 15
- `rube-mug12.tgz` - mug pier, version 12

Version numbers auto-increment based on the current version in `shipManifest.json`.

## Ships

| Ship | Purpose | Updated |
|------|---------|---------|
| ~zod | Primary test ship | Yes - with each archive run |
| ~ten | Secondary test ship | Yes - with each archive run |
| ~mug | Additional test ship | Yes - with each archive run |
| ~bus | Protocol mismatch testing | No - intentionally outdated |
| ~bud | Pinned N-1 desk (E2E compatibility) | No - rebuilt by `build-n1-pier.sh` at every N-1 change |

## GCS Bucket Structure

Archives are stored at:
```
gs://bootstrap.urbit.org/rube-{ship}{version}.tgz
```

Public URLs:
```
https://bootstrap.urbit.org/rube-{ship}{version}.tgz
```

## Troubleshooting

### Authentication Issues

If you see authentication errors:
```bash
# Login to GCP
gcloud auth login

# Set the correct project
gcloud config set project tlon-groups-mobile

# Verify access
gsutil ls gs://bootstrap.urbit.org/
```

### Ships Won't Boot

If archived ships fail to boot during verification:
1. Check that desk files were properly updated before archiving
2. Ensure no corruption during upload (verify checksums)
3. Try manual extraction and boot to debug

### Port Conflicts

If you see port conflict errors:
```bash
# Kill any existing e2e processes (preferred method)
./stop-playwright-dev.sh

# Or use the emergency cleanup script
./apps/tlon-web/rube-cleanup.sh

# Or manually kill processes on e2e ports
for port in 3000 3001 3002 35453 36963 38473; do
  lsof -ti:$port | xargs kill -9 2>/dev/null || true
done
```

Note: The infrastructure now includes improved cleanup handling that automatically terminates all processes (including Urbit serf sub-processes) when scripts are interrupted with Ctrl+C.

## Manual Archive Process (Fallback)

If the automated script fails, you can manually archive:

1. Start playwright-dev environment:
   ```bash
   pnpm e2e:playwright-dev
   # Wait for "Environment ready" message
   # Press Ctrl+C to stop
   ```

2. Archive each pier:
   ```bash
   cd apps/tlon-web/rube/dist/
   tar -czf rube-zod15.tgz zod/
   tar -czf rube-ten15.tgz ten/
   tar -czf rube-mug15.tgz mug/
   ```

3. Upload to GCS:
   ```bash
   gsutil cp rube-*.tgz gs://bootstrap.urbit.org/
   gsutil acl ch -u AllUsers:R gs://bootstrap.urbit.org/rube-*.tgz
   ```

4. Update shipManifest.json with new URLs

## Notes

- The ~bus pier is intentionally kept at an older version for protocol mismatch testing
- The ~bud pier carries the previous %groups release and is rebuilt only when `MIN_GROUPS_VERSION` moves
- Archives are publicly readable once uploaded
- Each archive is approximately 100-200MB compressed
- The archiving process takes about 5-10 minutes total
- Always verify archives work before committing manifest changes