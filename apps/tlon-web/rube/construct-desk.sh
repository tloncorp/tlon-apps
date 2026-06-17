#!/bin/bash
set -euo pipefail

# Reconstruct the %groups desk inside an extracted rube pier by layering desk
# sources the same way the deploy pipeline does (.github/helpers/deploy.sh and
# ops/sync.sh), rather than rube's naive overlay copy.
#
# rube's copyDesks() does a single overwrite-copy of this repo's desk/ on top of
# the pier's committed groups desk, with NO --delete and NO fresh base-dev. That
# leaves the OLD-kelvin base-dev files (zuse/lull/etc.) and any since-removed
# files in place -- which is exactly what fails to compile under 408.
#
# This script rebuilds groups/ from scratch by layering, with --delete on the
# base-dev pass so stale files are removed:
#   1. base-dev/        from urbit/urbit  (--delete: clears stale, sets kelvin)
#   2. desk-dev/        from tloncorp/landscape
#   3. landscape-dev/   from this repo
#   4. desk/            from this repo
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

Reconstruct the %$DESK desk inside extracted rube pier(s) under $DIST_DIR by
layering desk sources (base-dev, landscape desk-dev, this repo) with --delete,
the way the deploy pipeline does. Defaults to: ${DEFAULT_SHIPS[*]}

Required environment variables:
  URBIT_PATH       Path to a urbit/urbit checkout at the TARGET kelvin
                   (provides pkg/base-dev/)
  LANDSCAPE_PATH   Path to a tloncorp/landscape checkout (provides desk-dev/)

Options:
  --pier PATH      Construct directly into this pier dir (the one containing
                   .urb), bypassing the DIST_DIR/<ship> lookup. Single pier.

Optional environment variables:
  DIST_DIR         Where extracted piers live (default: $RUBE_DIR/dist)
  DESK             Desk name to construct (default: groups)

Pier location: for each ship, looks for the pier dir containing .urb at either
  \$DIST_DIR/<ship>/<ship>   (rube's double-nested extract), or
  \$DIST_DIR/<ship>          (a tarball extracted directly)
Use --pier to point somewhere else entirely.

Examples:
  URBIT_PATH=~/src/urbit LANDSCAPE_PATH=~/src/landscape $0
  URBIT_PATH=~/src/urbit LANDSCAPE_PATH=~/src/landscape $0 zod
  URBIT_PATH=~/src/urbit LANDSCAPE_PATH=~/src/landscape $0 --pier /tmp/zod
EOF
}

# Optional explicit pier path (overrides DIST_DIR/<ship> resolution)
PIER_OVERRIDE=""
POSITIONAL=()
while [ "$#" -gt 0 ]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        --pier)
            if [ "$#" -lt 2 ]; then print_error "--pier requires a path"; exit 1; fi
            PIER_OVERRIDE="$2"; shift 2 ;;
        --pier=*) PIER_OVERRIDE="${1#*=}"; shift ;;
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

# Validate prerequisites
if ! command -v rsync >/dev/null 2>&1; then
    print_error "rsync is required but not installed"
    exit 1
fi

if [ -z "${URBIT_PATH:-}" ]; then
    print_error "URBIT_PATH is not set (path to urbit/urbit checkout at the target kelvin)"
    usage
    exit 1
fi

if [ -z "${LANDSCAPE_PATH:-}" ]; then
    print_error "LANDSCAPE_PATH is not set (path to tloncorp/landscape checkout)"
    usage
    exit 1
fi

BASE_DEV="$URBIT_PATH/pkg/base-dev"
DESK_DEV="$LANDSCAPE_PATH/desk-dev"
LANDSCAPE_DEV="$PROJECT_ROOT/landscape-dev"
REPO_DESK="$PROJECT_ROOT/desk"

for src in "$BASE_DEV" "$DESK_DEV" "$LANDSCAPE_DEV" "$REPO_DESK"; do
    if [ ! -d "$src" ]; then
        print_error "Source directory not found: $src"
        exit 1
    fi
done

# Show what kelvin base-dev declares so mismatches are caught early
if [ -f "$BASE_DEV/sys.kelvin" ]; then
    print_info "base-dev sys.kelvin: $(cat "$BASE_DEV/sys.kelvin")"
fi
if [ -f "$REPO_DESK/sys.kelvin" ]; then
    print_info "repo desk sys.kelvin: $(cat "$REPO_DESK/sys.kelvin")"
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

    print_info "Reconstructing %$DESK for ~$ship at $groups"

    mkdir -p "$groups"

    # 1. base-dev with --delete: clears stale files, installs new-kelvin
    #    kernel-dev sources. Trailing slashes copy directory CONTENTS.
    rsync -aL --delete "$BASE_DEV/" "$groups/"
    # 2. landscape desk-dev
    rsync -aL "$DESK_DEV/" "$groups/"
    # 3. this repo's landscape-dev (lib + sur overrides)
    rsync -aL "$LANDSCAPE_DEV/" "$groups/"
    # 4. this repo's desk (app files; its sys.kelvin wins, setting the kelvin)
    rsync -aL "$REPO_DESK/" "$groups/"

    # Stamp the build commit, matching deploy.sh
    echo "$COMMIT_HASH" > "$groups/commit.txt"

    print_status "Constructed %$DESK for ~$ship (commit $COMMIT_HASH)"
}

print_info "Constructing %$DESK for: ${SHIPS[*]}"
print_info "  base-dev:      $BASE_DEV"
print_info "  desk-dev:      $DESK_DEV"
print_info "  landscape-dev: $LANDSCAPE_DEV"
print_info "  desk:          $REPO_DESK"
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

print_status "All desks constructed"
print_warning "These files are on disk only -- not yet in clay."
print_info "Apply with this ORDER (mount clobbers disk, commit captures it):"
print_info "  1. boot the pier"
print_info "  2. mount %$DESK"
print_info "  3. re-run this script (mount overwrote the dir with the old desk)"
print_info "  4. commit %$DESK"
print_info "Then run archive-piers.sh --skip-prepare to roll/chop and upload."
