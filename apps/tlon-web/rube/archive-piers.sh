#!/bin/bash
set -euo pipefail

# Archive and upload e2e test piers to GCP
# This script automates the process of preparing, archiving, and uploading test piers

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
RUBE_DIR="$SCRIPT_DIR"
DIST_DIR="$RUBE_DIR/dist"
MANIFEST_FILE="$PROJECT_ROOT/apps/tlon-web/e2e/shipManifest.json"
GCS_BUCKET="gs://bootstrap.urbit.org"
DRY_RUN=${DRY_RUN:-false}
SKIP_UPLOAD=${SKIP_UPLOAD:-false}
SKIP_CLEANUP=${SKIP_CLEANUP:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ships to archive (bus is intentionally excluded as it's kept outdated)
SHIPS_TO_ARCHIVE=("zod" "ten" "mug")

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
    
    # Check GCP project
    local project=$(gcloud config get-value project 2>/dev/null)
    if [ -z "$project" ]; then
        print_error "No GCP project configured"
        print_info "Please run: gcloud config set project YOUR_PROJECT"
        exit 1
    fi
    
    print_status "Prerequisites check passed (project: $project)"
}

# Start ships and update to latest desk code
prepare_ships() {
    print_info "Starting ships with latest desk code..."
    
    cd "$PROJECT_ROOT/apps/tlon-web"
    
    # Use the start-playwright-dev.sh script to prepare ships
    print_info "Starting playwright-dev environment..."
    "$PROJECT_ROOT/start-playwright-dev.sh" &
    local start_pid=$!
    
    # Wait for environment to be ready
    local timeout=300  # 5 minutes
    local counter=0
    while [ $counter -lt $timeout ]; do
        if grep -q "Environment ready for Playwright MCP development!" "$PROJECT_ROOT/apps/tlon-web/playwright-dev.log" 2>/dev/null; then
            print_status "Ships are ready with latest desk code"
            break
        fi
        
        if ! kill -0 $start_pid 2>/dev/null; then
            print_error "Failed to start ships. Check playwright-dev.log for details"
            exit 1
        fi
        
        sleep 2
        counter=$((counter + 2))
        
        if [ $((counter % 10)) -eq 0 ]; then
            echo -n "."
        fi
    done
    
    if [ $counter -ge $timeout ]; then
        print_error "Timeout waiting for ships to be ready"
        exit 1
    fi
    
    # Give it a moment to stabilize
    sleep 5
    
    # Stop the environment gracefully
    print_info "Stopping ships gracefully..."
    if [ -f "$PROJECT_ROOT/apps/tlon-web/.playwright-dev.pid" ]; then
        local pid=$(cat "$PROJECT_ROOT/apps/tlon-web/.playwright-dev.pid")
        kill -TERM "$pid" 2>/dev/null || true
        
        # Wait for graceful shutdown
        local shutdown_counter=0
        while [ $shutdown_counter -lt 30 ] && kill -0 "$pid" 2>/dev/null; do
            sleep 1
            shutdown_counter=$((shutdown_counter + 1))
        done
        
        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
        fi
    fi
    
    print_status "Ships prepared and stopped"
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
    
    # Remove socket files one more time right before archiving (they may be recreated)
    find "$DIST_DIR/$ship" -name "*.sock" -type s -delete 2>/dev/null || true
    
    # Create the archive (exclude socket files and extended attributes)
    # Use subshell to avoid affecting parent directory
    (
        cd "$DIST_DIR/$ship"
        
        # Archive just the inner ship directory (e.g., zod/zod becomes just zod in archive)
        # Try different tar options based on what's available
        # Redirect stderr to suppress extended attributes warnings
        if tar --version 2>/dev/null | grep -q "GNU tar"; then
            # GNU tar
            tar --exclude='*.sock' --format=gnu -czf "../$archive_name" "$ship/" 2>/dev/null
        elif command -v gtar &> /dev/null; then
            # GNU tar as gtar (common on macOS with homebrew)
            gtar --exclude='*.sock' --format=gnu -czf "../$archive_name" "$ship/" 2>/dev/null
        else
            # BSD tar (macOS default) - suppress extended attributes warnings
            tar --exclude='*.sock' -czf "../$archive_name" "$ship/" 2>/dev/null
        fi
    )
    
    # Verify archive was created
    if [ ! -f "$archive_path" ]; then
        print_error "Failed to create archive: $archive_path" >&2
        echo ""  # Return empty string on failure
        return 1
    fi
    
    local size=$(du -h "$archive_path" | cut -f1)
    print_status "Created $archive_name ($size)" >&2
    
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
    
    # Prepare ships with latest desk code
    prepare_ships
    
    # Archive and upload each ship
    local archived_files=()
    
    for ship in "${SHIPS_TO_ARCHIVE[@]}"; do
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
        
        # Upload to GCS
        if upload_archive "$archive_path"; then
            # Update manifest
            update_manifest "$ship" "$next_version"
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
    
    if [ "$DRY_RUN" = "false" ] && [ "$SKIP_UPLOAD" = "false" ]; then
        print_info "Next steps:"
        echo "  1. Verify the new archives work: ./verify-archives.sh"
        echo "  2. Commit the updated shipManifest.json"
        echo "  3. Create a PR with the changes"
    fi
}

# Run main function
main "$@"