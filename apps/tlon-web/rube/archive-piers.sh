#!/bin/bash
set -euo pipefail

# Archive and upload e2e test piers to GCP
# This script automates the process of preparing, archiving, and uploading test piers

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
RUBE_DIR="$SCRIPT_DIR"
DIST_DIR="$RUBE_DIR/dist"
MANIFEST_FILE="$PROJECT_ROOT/apps/tlon-web/e2e/shipManifest.json"

# Security: Expected GCP configuration
EXPECTED_PROJECT="tlon-groups-mobile"
EXPECTED_BUCKET="gs://bootstrap.urbit.org"
GCS_BUCKET="$EXPECTED_BUCKET"

# Configuration flags
DRY_RUN=${DRY_RUN:-false}
SKIP_UPLOAD=${SKIP_UPLOAD:-false}
SKIP_CLEANUP=${SKIP_CLEANUP:-false}
VERIFY_AFTER_UPLOAD=${VERIFY_AFTER_UPLOAD:-false}

# Parse command line arguments
for arg in "$@"; do
    case $arg in
        --verify)
            VERIFY_AFTER_UPLOAD=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --verify              Run verify-archives.sh after successful upload"
            echo "  --help                Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  DRY_RUN=true          Show what would be done without making changes"
            echo "  SKIP_UPLOAD=true      Create archives but skip GCS upload"
            echo "  SKIP_CLEANUP=true     Keep local archives after upload"
            echo ""
            exit 0
            ;;
        *)
            # Unknown option
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ships to archive (bus is intentionally excluded as it's kept outdated)
SHIPS_TO_ARCHIVE=("zod" "ten" "mug")

# Valid ships for input validation
VALID_SHIPS=("zod" "ten" "mug" "bus")

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Function to extract current version from manifest
get_current_version() {
    local ship=$1
    local url=$(jq -r ".\"~$ship\".downloadUrl" "$MANIFEST_FILE")
    # Extract version number from URL (e.g., rube-zod14.tgz -> 14)
    echo "$url" | sed -n 's/.*rube-'"$ship"'\([0-9]*\)\.tgz/\1/p'
}

# Function to increment version
get_next_version() {
    local ship=$1
    local current_version=$(get_current_version "$ship")
    echo $((current_version + 1))
}

# Cleanup function
cleanup() {
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        print_error "Script failed with exit code $exit_code"
        
        # On failure, restore manifest from backup if it exists
        if [ -n "${manifest_backup:-}" ] && [ -f "$manifest_backup" ]; then
            print_info "Restoring manifest from backup due to failure..."
            cp "$manifest_backup" "$MANIFEST_FILE"
            rm -f "$manifest_backup"
            print_status "Manifest restored"
        fi
    fi
    
    # Stop any running playwright-dev processes
    if [ -f "$PROJECT_ROOT/apps/tlon-web/.playwright-dev.pid" ]; then
        print_info "Stopping playwright-dev environment..."
        "$PROJECT_ROOT/stop-playwright-dev.sh" >/dev/null 2>&1 || true
    fi
    
    # Additional cleanup of e2e ports if needed
    for port in 3000 3001 3002 3003 35453 36963 38473 39983; do
        pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
    done
    
    # Clean up the playwright-dev log file
    if [ -f "$PROJECT_ROOT/apps/tlon-web/playwright-dev-archive.log" ]; then
        rm -f "$PROJECT_ROOT/apps/tlon-web/playwright-dev-archive.log"
    fi
}

trap cleanup EXIT

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check for required tools
    local missing_tools=()
    
    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi
    
    if ! command -v gsutil &> /dev/null; then
        missing_tools+=("gsutil")
    fi
    
    if ! command -v gcloud &> /dev/null; then
        missing_tools+=("gcloud")
    fi
    
    if ! command -v pnpm &> /dev/null; then
        missing_tools+=("pnpm")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_info "Please install missing tools and try again"
        exit 1
    fi
    
    # Check GCP authentication
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        print_error "No active GCP authentication found"
        print_info "Please run: gcloud auth login"
        exit 1
    fi
    
    # Check GCP project - SECURITY: Validate against expected project
    local project=$(gcloud config get-value project 2>/dev/null)
    if [ -z "$project" ]; then
        print_error "No GCP project configured"
        print_info "Please run: gcloud config set project $EXPECTED_PROJECT"
        exit 1
    fi
    
    if [ "$project" != "$EXPECTED_PROJECT" ]; then
        print_error "Wrong GCP project configured: $project"
        print_info "Expected project: $EXPECTED_PROJECT"
        print_info "Please run: gcloud config set project $EXPECTED_PROJECT"
        print_warning "Refusing to continue with wrong project to prevent accidental uploads"
        exit 1
    fi
    
    # SECURITY: Verify bucket access and permissions
    print_info "Verifying GCS bucket access..."
    if ! gsutil ls "$GCS_BUCKET" >/dev/null 2>&1; then
        print_error "Cannot access bucket: $GCS_BUCKET"
        print_info "Please check your authentication and permissions"
        exit 1
    fi
    
    # Test write permissions (create and remove a test file)
    local test_file="test-write-permission-$$-$(date +%s).txt"
    if [ "$DRY_RUN" = "false" ] && [ "$SKIP_UPLOAD" = "false" ]; then
        echo "test" | gsutil -q cp - "$GCS_BUCKET/$test_file" 2>/dev/null
        if [ $? -eq 0 ]; then
            gsutil -q rm "$GCS_BUCKET/$test_file" 2>/dev/null
            print_status "Bucket write permissions verified"
        else
            print_error "No write permissions to bucket: $GCS_BUCKET"
            print_info "Please check your IAM permissions"
            exit 1
        fi
    fi
    
    print_status "Prerequisites check passed (project: $project, bucket: $GCS_BUCKET)"
}

# Start ships and update to latest desk code
prepare_ships() {
    print_info "Starting ships with latest desk code..."
    
    cd "$PROJECT_ROOT/apps/tlon-web"
    
    # The playwright-dev script runs rube which:
    # 1. Nukes state on each ship
    # 2. Sets up ~mug as the reel provider
    # 3. Applies desk updates
    # This is essential for proper test setup
    
    # However, the rube script has a 30-second timeout that's too short when applying desk updates
    # We'll need to work around this by retrying or modifying the timeout
    
    print_info "Starting playwright-dev environment (this may take several minutes)..."
    
    # Try to run playwright-dev, but if it fails due to timeout, we'll retry
    local max_retries=3
    local retry_count=0
    local success=false
    
    while [ $retry_count -lt $max_retries ] && [ "$success" = "false" ]; do
        if [ $retry_count -gt 0 ]; then
            print_warning "Retrying... (attempt $((retry_count + 1))/$max_retries)"
            # Clean up any existing processes first
            for port in 3000 3001 3002 3003 35453 36963 38473 39983; do
                pids=$(lsof -ti:$port 2>/dev/null || true)
                if [ -n "$pids" ]; then
                    echo "$pids" | xargs kill -9 2>/dev/null || true
                fi
            done
            sleep 5
        fi
        
        # Start the playwright-dev script with FORCE_EXTRACTION to give more time
        print_info "Running playwright-dev with desk updates..."
        
        # Start playwright-dev in background so we can monitor and kill it when ships are ready
        cd "$PROJECT_ROOT/apps/tlon-web"
        FORCE_EXTRACTION=true pnpm e2e:playwright-dev > "$PROJECT_ROOT/apps/tlon-web/playwright-dev-archive.log" 2>&1 &
        local playwright_pid=$!
        
        # Monitor for SHIP_SETUP_COMPLETE signal which indicates ships are fully ready
        local wait_counter=0
        local max_wait=600  # 10 minutes to allow for desk updates
        local ships_ready=false
        
        print_info "Waiting for ship setup to complete (watching for SHIP_SETUP_COMPLETE signal)..."
        
        while [ $wait_counter -lt $max_wait ] && [ "$ships_ready" = "false" ]; do
            # Check if process died
            if ! kill -0 $playwright_pid 2>/dev/null; then
                print_warning "Playwright-dev process ended unexpectedly"
                # Check the log for errors
                if grep -q "SHIP_SETUP_COMPLETE" "$PROJECT_ROOT/apps/tlon-web/playwright-dev-archive.log"; then
                    print_status "Ships setup completed before process ended"
                    ships_ready=true
                    success=true
                fi
                break
            fi
            
            # Check for SHIP_SETUP_COMPLETE signal in the log
            if grep -q "SHIP_SETUP_COMPLETE" "$PROJECT_ROOT/apps/tlon-web/playwright-dev-archive.log"; then
                print_status "SHIP_SETUP_COMPLETE signal detected - ships are fully ready!"
                ships_ready=true
                success=true
                
                # Kill the playwright-dev process now that ships are ready
                # We don't need the web servers to start
                print_info "Stopping playwright-dev (ships are ready, don't need web servers)..."
                kill -TERM $playwright_pid 2>/dev/null || true
                sleep 2
                kill -9 $playwright_pid 2>/dev/null || true
                break
            fi
            
            # Also check ship readiness via HTTP as a fallback
            if [ $((wait_counter % 30)) -eq 0 ] && [ $wait_counter -gt 60 ]; then
                print_info "Checking ship readiness via HTTP..."
                local all_ships_responding=true
                for ship in "${SHIPS_TO_ARCHIVE[@]}"; do
                    local port=$(jq -r ".\"~$ship\".httpPort" "$MANIFEST_FILE")
                    if ! curl -s -f -m 5 "http://localhost:$port/~/scry/hood/kiln/pikes.json" >/dev/null 2>&1; then
                        all_ships_responding=false
                        break
                    fi
                done
                
                if [ "$all_ships_responding" = "true" ]; then
                    print_status "All ships responding to HTTP requests"
                    ships_ready=true
                    success=true
                    kill -TERM $playwright_pid 2>/dev/null || true
                    sleep 2
                    kill -9 $playwright_pid 2>/dev/null || true
                    break
                fi
            fi
            
            sleep 2
            wait_counter=$((wait_counter + 2))
            
            if [ $((wait_counter % 10)) -eq 0 ]; then
                echo -n "."
            fi
        done
        
        # Make sure playwright-dev is stopped
        if kill -0 $playwright_pid 2>/dev/null; then
            print_info "Stopping playwright-dev..."
            kill -9 $playwright_pid 2>/dev/null || true
        fi
        
        if [ "$ships_ready" = "false" ]; then
            print_warning "Ships not ready after timeout"
            print_info "Check playwright-dev-archive.log for details"
        fi
        
        retry_count=$((retry_count + 1))
    done
    
    if [ "$success" = "false" ]; then
        print_error "Failed to prepare ships after $max_retries attempts"
        print_info "Check playwright-dev-archive.log for details"
        exit 1
    fi
    
    # Stop all ships gracefully
    print_info "Stopping all ships..."
    for port in 35453 36963 38473 39983; do
        pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            echo "$pids" | xargs kill -TERM 2>/dev/null || true
        fi
    done
    
    # Give them time to shut down gracefully
    sleep 5
    
    # Force kill any remaining processes
    for port in 35453 36963 38473 39983; do
        pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
    done
    
    print_status "Ships prepared and stopped"
}

# Quick local validation of archive
validate_archive_locally() {
    local archive_path=$1
    local ship=$2
    local temp_extract=$(mktemp -d)
    
    print_info "Quick validation of $ship archive..." >&2
    
    # Extract archive to temp directory
    if ! tar -xzf "$archive_path" -C "$temp_extract" 2>/dev/null; then
        print_error "Failed to extract archive for validation" >&2
        rm -rf "$temp_extract"
        return 1
    fi
    
    # Check essential structure
    if [ ! -d "$temp_extract/$ship" ]; then
        print_error "Invalid structure: missing $ship directory" >&2
        rm -rf "$temp_extract"
        return 1
    fi
    
    # Check for essential files
    local essential_files=(
        "$ship/groups/sys.kelvin"
        "$ship/groups/desk.bill"
        "$ship/.urb"
    )
    
    for file_path in "${essential_files[@]}"; do
        if [ ! -e "$temp_extract/$file_path" ]; then
            print_error "Missing essential: $file_path" >&2
            rm -rf "$temp_extract"
            return 1
        fi
    done
    
    print_status "Local validation passed" >&2
    rm -rf "$temp_extract"
    return 0
}

# Clean pier before archiving
clean_pier() {
    local ship=$1
    local pier_path="$DIST_DIR/$ship/$ship"
    
    print_info "Cleaning $ship pier..." >&2
    
    # Remove temporary files that shouldn't be archived
    rm -f "$pier_path/.http.ports" 2>/dev/null || true
    rm -f "$pier_path/.vere.lock" 2>/dev/null || true
    rm -rf "$pier_path/.urb/put" 2>/dev/null || true
    
    # Remove socket files that can't be archived
    rm -f "$pier_path/.urb/conn.sock" 2>/dev/null || true
    rm -f "$pier_path/.urb/"*.sock 2>/dev/null || true
    
    # Clean any core dumps or large unnecessary files
    find "$pier_path" -name "core.*" -delete 2>/dev/null || true
    find "$pier_path" -name "*.swp" -delete 2>/dev/null || true
    find "$pier_path" -name "*.sock" -delete 2>/dev/null || true
    
    print_status "Cleaned $ship pier" >&2
}

# Archive a pier
archive_pier() {
    local ship=$1
    local version=$2
    local archive_name="rube-${ship}${version}.tgz"
    local archive_path="$DIST_DIR/$archive_name"
    
    print_info "Archiving $ship as $archive_name..." >&2
    
    # Check the pier directory exists
    if [ ! -d "$DIST_DIR/$ship" ]; then
        print_error "Pier directory not found: $DIST_DIR/$ship" >&2
        echo ""
        return 1
    fi
    
    # Check if archive already exists
    if [ -f "$archive_path" ]; then
        print_warning "Archive already exists: $archive_name" >&2
        print_info "Removing existing archive..." >&2
        rm -f "$archive_path"
    fi
    
    # Clean the pier first
    clean_pier "$ship"
    
    # Create comprehensive exclude file to prevent race conditions
    local exclude_file=$(mktemp /tmp/tar-exclude.XXXXXX)
    cat > "$exclude_file" <<EOF
*.sock
*.lock
.vere.lock
.http.ports
core.*
*.swp
.urb/put/*
.urb/dev-*
EOF
    
    # Create the archive (exclude problematic files using exclude file)
    # Use subshell to avoid affecting parent directory
    (
        cd "$DIST_DIR/$ship"
        
        # Archive just the inner ship directory (e.g., zod/zod becomes just zod in archive)
        # Try different tar options based on what's available
        # Redirect stderr to suppress extended attributes warnings
        if tar --version 2>/dev/null | grep -q "GNU tar"; then
            # GNU tar
            tar --exclude-from="$exclude_file" --format=gnu -czf "../$archive_name" "$ship/" 2>/dev/null
        elif command -v gtar &> /dev/null; then
            # GNU tar as gtar (common on macOS with homebrew)
            gtar --exclude-from="$exclude_file" --format=gnu -czf "../$archive_name" "$ship/" 2>/dev/null
        else
            # BSD tar (macOS default) - use -X flag for exclude file
            tar -X "$exclude_file" -czf "../$archive_name" "$ship/" 2>/dev/null
        fi
    )
    
    # Clean up exclude file
    rm -f "$exclude_file"
    
    # Verify archive was created
    if [ ! -f "$archive_path" ]; then
        print_error "Failed to create archive: $archive_path" >&2
        echo ""  # Return empty string on failure
        return 1
    fi
    
    local size=$(du -h "$archive_path" | cut -f1)
    print_status "Created $archive_name ($size)" >&2
    
    # Validate archive locally before considering it successful
    if ! validate_archive_locally "$archive_path" "$ship"; then
        print_error "Archive validation failed for $ship" >&2
        rm -f "$archive_path"
        echo ""  # Return empty string on validation failure
        return 1
    fi
    
    # Return the full path
    echo "$archive_path"
}

# Upload archive to GCP
upload_archive() {
    local archive_path=$1
    local archive_name=$(basename "$archive_path")
    
    if [ "$SKIP_UPLOAD" = "true" ]; then
        print_warning "Skipping upload (SKIP_UPLOAD=true)"
        return 0
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        print_info "[DRY RUN] Would upload: $archive_name to $GCS_BUCKET/"
        return 0
    fi
    
    print_info "Uploading $archive_name to GCS..."
    
    # Upload with public-read ACL (same as existing archives)
    if gsutil -h "Cache-Control:public, max-age=3600" cp "$archive_path" "$GCS_BUCKET/"; then
        # Make it publicly readable
        gsutil acl ch -u AllUsers:R "$GCS_BUCKET/$archive_name"
        print_status "Uploaded $archive_name to $GCS_BUCKET/"
    else
        print_error "Failed to upload $archive_name"
        return 1
    fi
}

# Update manifest with new URLs
update_manifest() {
    local ship=$1
    local version=$2
    local archive_name="rube-${ship}${version}.tgz"
    local new_url="https://bootstrap.urbit.org/$archive_name"
    
    if [ "$DRY_RUN" = "true" ]; then
        print_info "[DRY RUN] Would update manifest for ~$ship with URL: $new_url"
        return 0
    fi
    
    print_info "Updating manifest for ~$ship..."
    
    # Update the manifest using jq
    local tmp_manifest=$(mktemp)
    jq ".\"~$ship\".downloadUrl = \"$new_url\"" "$MANIFEST_FILE" > "$tmp_manifest"
    mv "$tmp_manifest" "$MANIFEST_FILE"
    
    print_status "Updated manifest for ~$ship"
}

# Main execution
main() {
    print_info "Starting pier archive and upload process"
    
    if [ "$DRY_RUN" = "true" ]; then
        print_warning "Running in DRY RUN mode - no actual uploads or manifest changes"
    fi
    
    if [ "$SKIP_UPLOAD" = "true" ]; then
        print_warning "SKIP_UPLOAD is set - archives will be created but not uploaded"
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Backup manifest for potential rollback
    local manifest_backup=""
    if [ "$DRY_RUN" = "false" ] && [ "$SKIP_UPLOAD" = "false" ]; then
        manifest_backup="$MANIFEST_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$MANIFEST_FILE" "$manifest_backup"
        print_info "Created manifest backup: $manifest_backup"
    fi
    
    # Prepare ships with latest desk code
    prepare_ships
    
    # Archive and upload each ship
    local archived_files=()
    local uploaded_ships=()  # Track successful uploads for potential rollback
    
    for ship in "${SHIPS_TO_ARCHIVE[@]}"; do
        # Validate ship name
        if ! printf '%s\n' "${VALID_SHIPS[@]}" | grep -qx "$ship"; then
            print_error "Invalid ship name: $ship"
            print_info "Valid ships: ${VALID_SHIPS[*]}"
            continue
        fi
        
        print_info "Processing $ship..."
        
        # Check if pier exists
        if [ ! -d "$DIST_DIR/$ship" ]; then
            print_error "Pier not found: $DIST_DIR/$ship"
            print_info "Run 'pnpm e2e' first to download and extract piers"
            exit 1
        fi
        
        # Get next version number
        local next_version=$(get_next_version "$ship")
        print_info "Next version for $ship: $next_version"
        
        # Archive the pier
        local archive_path
        archive_path=$(archive_pier "$ship" "$next_version")
        
        if [ -z "$archive_path" ] || [ ! -f "$archive_path" ]; then
            print_error "Failed to archive $ship"
            continue
        fi
        
        archived_files+=("$archive_path")
        
        # Upload to GCS with transaction tracking
        if upload_archive "$archive_path"; then
            uploaded_ships+=("$ship:rube-${ship}${next_version}.tgz")
            
            # Update manifest with rollback on failure
            if ! update_manifest "$ship" "$next_version"; then
                print_error "Manifest update failed for $ship"
                print_warning "Archive uploaded but manifest not updated!"
                print_info "Manual fix required:"
                echo "  1. Update manifest manually with URL: https://bootstrap.urbit.org/rube-${ship}${next_version}.tgz"
                echo "  2. Or delete uploaded archive: gsutil rm $GCS_BUCKET/rube-${ship}${next_version}.tgz"
                
                # Optional: Could implement automatic rollback here
                # gsutil rm "$GCS_BUCKET/rube-${ship}${next_version}.tgz" 2>/dev/null
            fi
        else
            print_error "Failed to upload $ship, skipping manifest update"
        fi
        
        echo ""
    done
    
    # Cleanup local archives if requested
    if [ ${#archived_files[@]} -gt 0 ]; then
        if [ "$SKIP_CLEANUP" = "false" ] && [ "$DRY_RUN" = "false" ]; then
            print_info "Cleaning up local archives..."
            for archive in "${archived_files[@]}"; do
                if [ -f "$archive" ]; then
                    rm -f "$archive"
                    print_status "Removed $(basename "$archive")"
                fi
            done
        else
            print_info "Keeping local archives (SKIP_CLEANUP=true or DRY_RUN=true)"
            print_info "Archives created:"
            for archive in "${archived_files[@]}"; do
                echo "  - $archive"
            done
        fi
    fi
    
    print_status "Archive and upload process complete!"
    
    # Run verification if requested
    if [ "$VERIFY_AFTER_UPLOAD" = "true" ] && [ "$DRY_RUN" = "false" ] && [ "$SKIP_UPLOAD" = "false" ]; then
        print_info "Running verification of uploaded archives..."
        echo ""
        if "$SCRIPT_DIR/verify-archives.sh"; then
            print_status "Verification successful!"
        else
            print_error "Verification failed! Check the archives before committing."
            exit 1
        fi
    fi
    
    # Clean up manifest backup on success
    if [ "$DRY_RUN" = "false" ] && [ "$SKIP_UPLOAD" = "false" ] && [ -n "$manifest_backup" ] && [ -f "$manifest_backup" ]; then
        print_info "Cleaning up manifest backup..."
        rm -f "$manifest_backup"
        print_status "Removed backup: $(basename "$manifest_backup")"
    fi
    
    # Clean up playwright-dev log file
    if [ -f "$PROJECT_ROOT/apps/tlon-web/playwright-dev-archive.log" ]; then
        rm -f "$PROJECT_ROOT/apps/tlon-web/playwright-dev-archive.log"
    fi
    
    if [ "$DRY_RUN" = "false" ] && [ "$SKIP_UPLOAD" = "false" ]; then
        if [ "$VERIFY_AFTER_UPLOAD" = "false" ]; then
            print_info "Next steps:"
            echo "  1. Verify the new archives work: ./verify-archives.sh"
            echo "  2. Commit the updated shipManifest.json"
            echo "  3. Create a PR with the changes"
            echo ""
            print_info "Tip: Use --verify flag to automatically verify after upload"
        else
            print_info "Next steps:"
            echo "  1. Commit the updated shipManifest.json"
            echo "  2. Create a PR with the changes"
        fi
    fi
    
    # Exit with success
    exit 0
}

# Run main function
main "$@"