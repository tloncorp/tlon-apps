#!/bin/bash
set -euo pipefail

# Assemble the %groups desk inside an extracted rube pier.
#
# Delegates to scripts/assemble-desk.sh, which layers the peru-vendored deps
# (desk-deps/, see ../../../../peru.yaml) in with --delete, then our own source
# (desk/) on top. We `peru sync` once up front, then assemble each pier with
# SKIP_SYNC=true.
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
peru sync's the vendored deps once, then assembles each pier's %$DESK from
desk-deps/ (--delete) + desk/. Defaults to: ${DEFAULT_SHIPS[*]}

Options:
  --pier PATH      Construct directly into this pier dir (the one containing
                   .urb), bypassing the DIST_DIR/<ship> lookup. Single pier.
  --skip-sync      Don't run peru sync; assume desk-deps/ is already populated.

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

ASSEMBLE="$PROJECT_ROOT/scripts/assemble-desk.sh"
if [ ! -x "$ASSEMBLE" ]; then
    print_error "assemble-desk.sh not found at $ASSEMBLE"
    exit 1
fi

# Vendor desk dependencies into desk-deps/ via peru once, up front. Each pier is
# then assembled with SKIP_SYNC=true so we don't re-sync per ship.
if [ "$SKIP_SYNC" = "false" ]; then
    print_info "Syncing desk dependencies (peru sync)..."
    "$PROJECT_ROOT/scripts/sync-deps.sh"
else
    print_info "Skipping peru sync (--skip-sync); using desk-deps/ as-is"
fi

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

    # assemble-desk.sh layers desk-deps/ (--delete) then desk/ on top, and
    # stamps commit.txt. We synced once above, so skip the per-pier sync.
    SKIP_SYNC=true "$ASSEMBLE" "$groups"

    print_status "Assembled %$DESK for ~$ship"
}

print_info "Assembling %$DESK for: ${SHIPS[*]} (desk-deps/ + desk/)"
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
