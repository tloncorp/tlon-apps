#!/bin/bash
set -euo pipefail

# Assemble the %groups desk inside an extracted rube pier.
#
# Desk dependencies (base-dev + landscape picks) are vendored into desk/ by peru
# (see ../../../../peru.yaml and ../../../../scripts/sync-deps.sh). After a sync,
# desk/ is self-contained, so assembling a pier's groups desk is just:
#   1. peru sync           -> populate desk/lib,mar,sur with pinned upstream files
#   2. rsync desk/ -> groups (with --delete to clear the pier's stale files)
#
# This replaces the old approach of rsyncing ALL of pkg/base-dev (~119 files,
# many unused and some that don't compile on the target kelvin) on top of the
# pier's committed desk. peru picks only the transitively-required subset.
#
# It only constructs files on disk. ORDER MATTERS: 'mount %groups' writes clay's
# current desk OUT to the dir on first mount (clobbering disk), and the files
# only enter clay on 'commit'. So the desk is applied by running this BETWEEN
# mount and commit against a live ship:
#   boot -> mount %groups -> construct-desk.sh -> commit %groups
# Constructing on a cold pier and skipping commit changes nothing in clay.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
RUBE_DIR="$SCRIPT_DIR"
DIST_DIR="${DIST_DIR:-$RUBE_DIR/dist}"

# Desk to construct (the rube piers only use %groups)
DESK="${DESK:-groups}"

# Default ships, matching archive-piers.sh's SHIPS_TO_ARCHIVE
DEFAULT_SHIPS=("zod" "ten" "mug")

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
print_status()  { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error()   { echo -e "${RED}✗${NC} $1"; }
print_info()    { echo -e "${BLUE}ℹ${NC} $1"; }

usage() {
    cat <<EOF
Usage: $0 [SHIP ...]

Assemble the %$DESK desk inside extracted rube pier(s) under $DIST_DIR:
runs peru sync to vendor desk dependencies, then rsync's desk/ into each pier's
%$DESK directory with --delete. Defaults to: ${DEFAULT_SHIPS[*]}

Options:
  --pier PATH      Construct directly into this pier dir (the one containing
                   .urb), bypassing the DIST_DIR/<ship> lookup. Single pier.
  --skip-sync      Don't run peru sync; assume desk/ is already populated.

Optional environment variables:
  DIST_DIR         Where extracted piers live (default: $RUBE_DIR/dist)
  DESK             Desk name to construct (default: groups)

Pier location: for each ship, looks for the pier dir containing .urb at either
  \$DIST_DIR/<ship>/<ship>   (rube's double-nested extract), or
  \$DIST_DIR/<ship>          (a tarball extracted directly)
Use --pier to point somewhere else entirely.

Examples:
  $0
  $0 zod
  $0 --pier /tmp/zod
EOF
}

# Optional explicit pier path (overrides DIST_DIR/<ship> resolution)
PIER_OVERRIDE=""
SKIP_SYNC=false
POSITIONAL=()
while [ "$#" -gt 0 ]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        --pier)
            if [ "$#" -lt 2 ]; then print_error "--pier requires a path"; exit 1; fi
            PIER_OVERRIDE="$2"; shift 2 ;;
        --pier=*) PIER_OVERRIDE="${1#*=}"; shift ;;
        --skip-sync) SKIP_SYNC=true; shift ;;
        *) POSITIONAL+=("$1"); shift ;;
    esac
done

# Resolve the list of ships to process
if [ "${#POSITIONAL[@]}" -gt 0 ]; then
    SHIPS=("${POSITIONAL[@]}")
else
    SHIPS=("${DEFAULT_SHIPS[@]}")
fi

if [ -n "$PIER_OVERRIDE" ] && [ "${#SHIPS[@]}" -gt 1 ]; then
    print_error "--pier targets a single pier; pass at most one ship label (got: ${SHIPS[*]})"
    exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
    print_error "rsync is required but not installed"
    exit 1
fi

REPO_DESK="$PROJECT_ROOT/desk"
if [ ! -d "$REPO_DESK" ]; then
    print_error "Repo desk not found: $REPO_DESK"
    exit 1
fi

# Vendor desk dependencies into desk/ via peru unless told to skip.
if [ "$SKIP_SYNC" = "false" ]; then
    print_info "Syncing desk dependencies (peru sync)..."
    "$PROJECT_ROOT/scripts/sync-deps.sh"
else
    print_info "Skipping peru sync (--skip-sync); using desk/ as-is"
fi

# Current repo commit, written into the desk like deploy.sh does
COMMIT_HASH="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")"

# Find the pier dir (the one containing .urb) for a ship. Honors --pier, then
# tries rube's double-nested layout, then a directly-extracted single dir.
resolve_pier() {
    local ship="$1"
    if [ -n "$PIER_OVERRIDE" ]; then
        echo "$PIER_OVERRIDE"
        return 0
    fi
    local c
    for c in "$DIST_DIR/$ship/$ship" "$DIST_DIR/$ship"; do
        if [ -d "$c/.urb" ]; then
            echo "$c"
            return 0
        fi
    done
    # Nothing matched; return the canonical path for the error message
    echo "$DIST_DIR/$ship/$ship"
    return 0
}

construct_one() {
    local ship="$1"
    local pier
    pier="$(resolve_pier "$ship")"
    local groups="$pier/$DESK"

    if [ ! -d "$pier/.urb" ]; then
        print_error "Pier not found or invalid: $pier"
        if [ -n "$PIER_OVERRIDE" ]; then
            print_info "--pier must point at the dir containing .urb"
        else
            print_info "Checked $DIST_DIR/$ship/$ship and $DIST_DIR/$ship"
            print_info "Pass --pier PATH if the pier is elsewhere"
        fi
        return 1
    fi

    print_info "Assembling %$DESK for ~$ship at $groups"

    mkdir -p "$groups"

    # desk/ is self-contained after peru sync (app files + vendored picks).
    # --delete clears the pier's stale committed files (old base-dev, removed
    # files) so the result is exactly the assembled desk.
    rsync -aL --delete "$REPO_DESK/" "$groups/"

    # Stamp the build commit, matching deploy.sh
    echo "$COMMIT_HASH" > "$groups/commit.txt"

    print_status "Assembled %$DESK for ~$ship (commit $COMMIT_HASH)"
}

print_info "Assembling %$DESK for: ${SHIPS[*]} from $REPO_DESK"
echo ""

failed=()
for ship in "${SHIPS[@]}"; do
    if ! construct_one "$ship"; then
        failed+=("$ship")
    fi
    echo ""
done

if [ "${#failed[@]}" -gt 0 ]; then
    print_error "Failed for: ${failed[*]}"
    exit 1
fi

print_status "All desks assembled"
print_warning "These files are on disk only -- not yet in clay."
print_info "Apply with this ORDER (mount clobbers disk, commit captures it):"
print_info "  1. boot the pier"
print_info "  2. mount %$DESK"
print_info "  3. re-run this script (mount overwrote the dir with the old desk)"
print_info "  4. commit %$DESK"
print_info "Then run archive-piers.sh --skip-prepare to roll/chop and upload."
