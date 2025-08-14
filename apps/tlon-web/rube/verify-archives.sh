#!/bin/bash
set -euo pipefail

# Verify that uploaded pier archives work correctly
# This script downloads and tests the archives to ensure they boot properly

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MANIFEST_FILE="$PROJECT_ROOT/apps/tlon-web/e2e/shipManifest.json"
TEMP_DIR=$(mktemp -d)
URBIT_BINARY="$SCRIPT_DIR/dist/urbit_extracted/urbit"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ships to verify
SHIPS_TO_VERIFY=${SHIPS_TO_VERIFY:-"zod ten mug"}

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

# Cleanup function
cleanup() {
    print_info "Cleaning up..."
    
    # Kill any test urbit processes
    pkill -f "$TEMP_DIR" 2>/dev/null || true
    
    # Remove temp directory
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}

trap cleanup EXIT

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check for urbit binary
    if [ ! -f "$URBIT_BINARY" ]; then
        print_warning "Urbit binary not found at $URBIT_BINARY"
        print_info "Downloading urbit binary..."
        
        # Use the same logic from rube to download urbit
        cd "$SCRIPT_DIR"
        pnpm rube --help >/dev/null 2>&1 || true
        
        if [ ! -f "$URBIT_BINARY" ]; then
            print_error "Failed to download urbit binary"
            exit 1
        fi
    fi
    
    print_status "Prerequisites check passed"
}

# Download and extract archive
download_archive() {
    local ship=$1
    local url=$(jq -r ".\"~$ship\".downloadUrl" "$MANIFEST_FILE")
    local archive_name=$(basename "$url")
    local archive_path="$TEMP_DIR/$archive_name"
    
    print_info "Downloading $archive_name..."
    
    if ! curl -L -o "$archive_path" "$url"; then
        print_error "Failed to download $url"
        return 1
    fi
    
    print_status "Downloaded $archive_name"
    
    # Extract archive
    print_info "Extracting $archive_name..."
    cd "$TEMP_DIR"
    if ! tar -xzf "$archive_name"; then
        print_error "Failed to extract $archive_name"
        return 1
    fi
    
    print_status "Extracted $archive_name"
    
    # Verify pier structure
    if [ ! -d "$TEMP_DIR/$ship" ]; then
        print_error "Invalid pier structure in $archive_name"
        print_error "Expected: $ship/ directory"
        return 1
    fi
    
    print_status "Pier structure verified"
}

# Test booting a pier
test_pier_boot() {
    local ship=$1
    local pier_path="$TEMP_DIR/$ship"
    local test_port=$((40000 + RANDOM % 10000))
    
    print_info "Testing $ship boot on port $test_port..."
    
    # Remove any existing lock files
    rm -f "$pier_path/.vere.lock" 2>/dev/null || true
    rm -f "$pier_path/.http.ports" 2>/dev/null || true
    
    # Start urbit in background
    timeout 30 "$URBIT_BINARY" -t -p "$test_port" "$pier_path" > "$TEMP_DIR/$ship.log" 2>&1 &
    local urbit_pid=$!
    
    # Wait for boot (check for .http.ports file)
    local counter=0
    local max_wait=25
    while [ $counter -lt $max_wait ]; do
        if [ -f "$pier_path/.http.ports" ]; then
            print_status "$ship booted successfully"
            
            # Try to kill gracefully
            kill -TERM $urbit_pid 2>/dev/null || true
            sleep 2
            kill -KILL $urbit_pid 2>/dev/null || true
            
            return 0
        fi
        
        # Check if process died
        if ! kill -0 $urbit_pid 2>/dev/null; then
            print_error "$ship boot process died unexpectedly"
            print_info "Last 20 lines of log:"
            tail -20 "$TEMP_DIR/$ship.log"
            return 1
        fi
        
        sleep 1
        counter=$((counter + 1))
        
        if [ $((counter % 5)) -eq 0 ]; then
            echo -n "."
        fi
    done
    
    # Timeout reached
    kill -KILL $urbit_pid 2>/dev/null || true
    print_error "$ship failed to boot within ${max_wait} seconds"
    print_info "Last 20 lines of log:"
    tail -20 "$TEMP_DIR/$ship.log"
    return 1
}

# Verify desk content
verify_desk_content() {
    local ship=$1
    local pier_path="$TEMP_DIR/$ship"
    
    print_info "Verifying desk content for $ship..."
    
    # Check for groups desk
    if [ ! -d "$pier_path/groups" ]; then
        print_error "Groups desk not found in $ship"
        return 1
    fi
    
    # Check for essential files
    local essential_files=(
        "groups/sys.kelvin"
        "groups/desk.bill"
        "groups/app/groups.hoon"
        "groups/app/channels.hoon"
        "groups/app/chat.hoon"
    )
    
    for file in "${essential_files[@]}"; do
        if [ ! -f "$pier_path/$file" ]; then
            print_error "Missing essential file: $file"
            return 1
        fi
    done
    
    print_status "Desk content verified for $ship"
}

# Main verification function for a ship
verify_ship() {
    local ship=$1
    
    echo ""
    print_info "========================================="
    print_info "Verifying $ship"
    print_info "========================================="
    
    # Download and extract
    if ! download_archive "$ship"; then
        print_error "Failed to download/extract $ship"
        return 1
    fi
    
    # Verify desk content
    if ! verify_desk_content "$ship"; then
        print_error "Desk content verification failed for $ship"
        return 1
    fi
    
    # Test boot
    if ! test_pier_boot "$ship"; then
        print_error "Boot test failed for $ship"
        return 1
    fi
    
    print_status "All verification passed for $ship"
    return 0
}

# Main execution
main() {
    print_info "Starting archive verification process"
    print_info "Temp directory: $TEMP_DIR"
    
    # Check prerequisites
    check_prerequisites
    
    # Validate ship names
    for ship in $SHIPS_TO_VERIFY; do
        if ! printf '%s\n' "${VALID_SHIPS[@]}" | grep -qx "$ship"; then
            print_error "Invalid ship name: $ship"
            print_info "Valid ships: ${VALID_SHIPS[*]}"
            exit 1
        fi
    done
    
    # Track results
    local failed_ships=()
    local passed_ships=()
    
    # Verify each ship
    for ship in $SHIPS_TO_VERIFY; do
        if verify_ship "$ship"; then
            passed_ships+=("$ship")
        else
            failed_ships+=("$ship")
        fi
    done
    
    # Print summary
    echo ""
    print_info "========================================="
    print_info "Verification Summary"
    print_info "========================================="
    
    if [ ${#passed_ships[@]} -gt 0 ]; then
        print_status "Passed: ${passed_ships[*]}"
    fi
    
    if [ ${#failed_ships[@]} -gt 0 ]; then
        print_error "Failed: ${failed_ships[*]}"
        exit 1
    else
        print_status "All ships verified successfully!"
    fi
}

# Run main function
main "$@"