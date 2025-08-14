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
4. Archives each pier (except ~bus which is intentionally kept outdated)
5. Uploads archives to `gs://bootstrap.urbit.org/`
6. Updates `shipManifest.json` with new URLs
7. Optionally cleans up local archives

**Usage:**

```bash
# Normal run - archives, uploads, and updates manifest
./archive-piers.sh

# Dry run - shows what would be done without making changes
DRY_RUN=true ./archive-piers.sh

# Create archives but skip GCS upload
SKIP_UPLOAD=true ./archive-piers.sh

# Keep local archives after upload
SKIP_CLEANUP=true ./archive-piers.sh

# Combine flags
DRY_RUN=true SKIP_CLEANUP=true ./archive-piers.sh
```

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

2. **Run the archive script**
   ```bash
   cd apps/tlon-web/rube/
   ./archive-piers.sh
   ```

3. **Verify the new archives**
   ```bash
   ./verify-archives.sh
   ```

4. **Commit the updated manifest**
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
# Kill any existing e2e processes
./stop-playwright-dev.sh

# Or manually kill processes on e2e ports
for port in 3000 3001 3002 35453 36963 38473; do
  lsof -ti:$port | xargs kill -9 2>/dev/null || true
done
```

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
- Archives are publicly readable once uploaded
- Each archive is approximately 100-200MB compressed
- The archiving process takes about 5-10 minutes total
- Always verify archives work before committing manifest changes