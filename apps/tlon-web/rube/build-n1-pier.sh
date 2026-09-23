#!/bin/bash
set -euo pipefail

# Build the pinned N-1 pier from scratch.
#
# The N-1 ship (~bud) carries the *previous* %groups release, so the E2E suite
# can prove the current client still works across a desk-version boundary
# (docs/tlon-apps/desk-compatibility.md). It is `skipCommit: true` in
# shipManifest.json, which means rube never builds a desk on it — this script is
# the only thing that does, and it must be re-run at every N-1 change.
#
# The procedure is rube's own FRESH_BOOT path (rube/index.ts: installGroupsDesk
# -> mountDesks -> copyDesks -> commitDesks), with one difference: the desk
# source is the N-1 *tag* rather than the working tree. So the pier comes out
# the same shape as ~zod's and ~ten's — %docket, %settings, %storage, %landscape
# and the rest of %base, which the web client needs.
#
# Reproducibility — the three inputs that decide what the pier contains:
#
#   1. vere, PINNED below to $VERE_VERSION and verified with `urbit --version`.
#      rube resolves an unpinned `latest`; this does not, so two rebuilds of the
#      same tag agree.
#   2. the boot pill: IMPLICIT, whatever `urbit -F` fetches for that vere. At
#      v4.6 that is a %brass pill carrying %base + %landscape + %groups, and it
#      builds `zuse: 0v1b.4qafq` (kelvin 408), matching desk/sys.kelvin. The
#      repo's own test pill (backend/run-tests.sh, groups-v11-3-0-408k.pill) is
#      the same kernel but installs no %docket/%settings/%storage/%landscape, so
#      the web client cannot run on a pier booted from it — that is why this
#      uses `-F` and not `-B <pill>`.
#   3. the desk: the git tag named by the ship's `deskVersion`, assembled with
#      that tag's own peru.yaml.
#
# If a future vere bundles a pill on a different kelvin from desk/sys.kelvin the
# commit will fail to build; bump $VERE_VERSION deliberately, not by drifting.
#
# The desk is assembled the way deploy.sh does it: a git worktree of the tag,
# `peru sync` against that tag's peru.yaml, then scripts/assemble-desk.sh
# (desk-deps/ with --delete, then desk/ on top).
#
# Usage:
#   ./build-n1-pier.sh                     # ~bud at the manifest's deskVersion
#   ./build-n1-pier.sh --ship bud --desk-tag v12.2.0
#   ./build-n1-pier.sh --skip-archive      # build the pier, don't tar it
#
# Uploading is NOT part of this script. It prints the archive path; publishing
# it to gs://bootstrap.urbit.org/ is a maintainer step (rube/README-ARCHIVING.md).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
RUBE_DIR="$SCRIPT_DIR"
DIST_DIR="${DIST_DIR:-$RUBE_DIR/dist}"
MANIFEST_FILE="$RUBE_DIR/../e2e/shipManifest.json"

SHIP="bud"
DESK_TAG=""
HTTP_PORT=""
# Pinned, not `latest`: see the header. Same host/layout backend/run-tests.sh
# uses for its own pinned vere.
VERE_VERSION="${VERE_VERSION:-v4.6}"
# A fakeship binds ames on a port derived from its @p, so two fake ~buds cannot
# run at once. This is only the build's port — rube boots the archived pier with
# no -p and gets the derived one — but a developer machine often already has a
# fakeship of the same name running, and the bind failure kills the boot.
AMES_PORT="${AMES_PORT:-31999}"
ARCHIVE_TAG="${ARCHIVE_TAG:-}"
SKIP_ARCHIVE=false
KEEP_RUNNING=false

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
print_status()  { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error()   { echo -e "${RED}✗${NC} $1" >&2; }
print_info()    { echo -e "${BLUE}ℹ${NC} $1"; }

usage() {
    cat <<EOF
Usage: $0 [options]

Boot a fresh fakeship, commit the N-1 %groups desk to it, and archive the pier
as rube-<ship><tag>.tgz.

Options:
  --ship NAME          Ship to build (default: $SHIP). Must be in the manifest.
  --desk-tag TAG       Git tag to build the desk from (default: v<deskVersion>
                       from the ship's shipManifest.json entry).
  --http-port PORT     Eyre port to boot on (default: the manifest's httpPort).
  --ames-port PORT     Ames port to boot on (default: $AMES_PORT). Only used
                       while building; the archived pier carries no port.
  --archive-tag TAG    Archive suffix, e.g. 1 -> rube-bud1.tgz (default: the
                       number in the manifest's downloadUrl).
  --skip-archive       Build the pier only; leave it in DIST_DIR/<ship>/<ship>.
  --keep-running       Leave the ship booted when the build finishes.
  -h, --help           Show this help.

Environment:
  DIST_DIR             Where piers live (default: $RUBE_DIR/dist)
  BUILD_ROOT           Where the pier is built before being moved into place
  VERE_VERSION         Pinned vere release (default: $VERE_VERSION)
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        --ship) SHIP="${2:?--ship requires a name}"; shift 2 ;;
        --ship=*) SHIP="${1#*=}"; shift ;;
        --desk-tag) DESK_TAG="${2:?--desk-tag requires a tag}"; shift 2 ;;
        --desk-tag=*) DESK_TAG="${1#*=}"; shift ;;
        --http-port) HTTP_PORT="${2:?--http-port requires a port}"; shift 2 ;;
        --http-port=*) HTTP_PORT="${1#*=}"; shift ;;
        --ames-port) AMES_PORT="${2:?--ames-port requires a port}"; shift 2 ;;
        --ames-port=*) AMES_PORT="${1#*=}"; shift ;;
        --archive-tag) ARCHIVE_TAG="${2:?--archive-tag requires a tag}"; shift 2 ;;
        --archive-tag=*) ARCHIVE_TAG="${1#*=}"; shift ;;
        --skip-archive) SKIP_ARCHIVE=true; shift ;;
        --keep-running) KEEP_RUNNING=true; shift ;;
        *) print_error "unknown argument: $1"; usage >&2; exit 1 ;;
    esac
done

for tool in jq curl rsync git peru; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        print_error "$tool is required but not installed"
        [ "$tool" = "peru" ] && print_info "install with: pipx install peru"
        exit 1
    fi
done

entry="$(jq -r --arg s "~$SHIP" '.[$s] // empty' "$MANIFEST_FILE")"
if [ -z "$entry" ]; then
    print_error "~$SHIP is not in $MANIFEST_FILE"
    exit 1
fi

desk_version="$(jq -r '.deskVersion // empty' <<<"$entry")"
if [ -z "$DESK_TAG" ]; then
    if [ -z "$desk_version" ] || [ "$desk_version" = "current" ]; then
        print_error "~$SHIP has no pinned deskVersion in the manifest; pass --desk-tag"
        exit 1
    fi
    DESK_TAG="v$desk_version"
fi
[ -n "$HTTP_PORT" ] || HTTP_PORT="$(jq -r '.httpPort' <<<"$entry")"
SHIP_CODE="$(jq -r '.code' <<<"$entry")"
if [ -z "$ARCHIVE_TAG" ]; then
    ARCHIVE_TAG="$(jq -r '.downloadUrl' <<<"$entry" | sed -n 's/.*rube-'"$SHIP"'\([0-9]*\)\.tgz/\1/p')"
    if [ -z "$ARCHIVE_TAG" ]; then
        print_error "cannot derive an archive tag from ~$SHIP's downloadUrl; pass --archive-tag"
        exit 1
    fi
fi

# The pier is built somewhere short and only moved under DIST_DIR at the end.
# click talks to the ship over <pier>/.urb/conn.sock, and a unix socket path is
# capped at ~104 bytes on macOS: a checkout a few directories deep already
# overruns it, and click then fails with "AF_UNIX path too long" while still
# exiting 0, so the merge, mount and commit would be silent no-ops.
BUILD_ROOT="${BUILD_ROOT:-/tmp/n1-pier-$$}"
PIER="$BUILD_ROOT/$SHIP"
FINAL_PIER="$DIST_DIR/$SHIP/$SHIP"
VERE="$DIST_DIR/urbit_extracted/urbit"
CLICK="$RUBE_DIR/click"
COOKIES="$BUILD_ROOT/cookies.txt"
TAG_TREE=""
SHIP_PID=""

print_info "ship        ~$SHIP"
print_info "desk tag    $DESK_TAG"
print_info "build at    $PIER"
print_info "pier        $FINAL_PIER"
print_info "http port   $HTTP_PORT"
print_info "ames port   $AMES_PORT"
print_info "archive     rube-${SHIP}${ARCHIVE_TAG}.tgz"
echo ""

cleanup() {
    # First statement: the kill/rm below would otherwise clobber the status
    # this trap was entered with.
    local code=$?
    if [ -n "$SHIP_PID" ] && [ "$KEEP_RUNNING" = "false" ]; then
        kill -TERM "$SHIP_PID" 2>/dev/null || true
        # Give the serf time to checkpoint; a hard kill mid-write leaves an
        # event log the next boot has to replay (or cannot).
        for _ in $(seq 1 60); do
            kill -0 "$SHIP_PID" 2>/dev/null || break
            sleep 1
        done
        kill -KILL "$SHIP_PID" 2>/dev/null || true
    fi
    if [ -n "$TAG_TREE" ] && [ -d "$TAG_TREE" ]; then
        git -C "$PROJECT_ROOT" worktree remove --force "$TAG_TREE" 2>/dev/null || rm -rf "$TAG_TREE"
        git -C "$PROJECT_ROOT" worktree prune 2>/dev/null || true
    fi
    exit "$code"
}
trap cleanup EXIT
# Signals get their own traps rather than sharing cleanup's. Entering cleanup
# directly as the INT/TERM handler leaves $? at the last *successful* command's
# status, so an interrupted build exits 0 with no archive -- and cleanup's own
# `exit` then re-enters it through the EXIT trap, killing and removing twice.
# Re-raising as an explicit non-zero exit runs the EXIT trap once, with the
# conventional 128+signo status.
trap 'exit 130' INT
trap 'exit 143' TERM

# ------------------------------------------------------------------ vere
# Pinned, and checked even when a binary is already there: rube downloads an
# unpinned `latest` into this same path, so an existing file says nothing about
# which vere it is.
case "$(uname -s)" in
    Darwin) plat=macos ;;
    Linux)  plat=linux ;;
    *) print_error "unsupported platform $(uname -s)"; exit 1 ;;
esac
case "$(uname -m)" in
    arm64|aarch64) machine=aarch64 ;;
    x86_64)        machine=x86_64 ;;
    *) print_error "unsupported arch $(uname -m)"; exit 1 ;;
esac

vere_is_pinned() {
    [ -x "$VERE" ] || return 1
    "$VERE" --version 2>/dev/null | head -1 | grep -qx "urbit ${VERE_VERSION#v}"
}

if ! vere_is_pinned; then
    if [ -x "$VERE" ]; then
        print_warning "urbit at $VERE is $("$VERE" --version 2>/dev/null | head -1), not $VERE_VERSION; replacing it"
    fi
    print_info "Downloading urbit $VERE_VERSION ($plat-$machine)..."
    mkdir -p "$(dirname "$VERE")"
    # A bare binary, not a tarball -- the layout backend/run-tests.sh pins too.
    # mktemp needs an explicit XXXXXX template to be portable to GNU coreutils.
    tmp_bin="$(mktemp -t urbit-bin.XXXXXX)"
    curl -fsSL \
        "https://bootstrap.urbit.org/vere/live/$VERE_VERSION/vere-$VERE_VERSION-$plat-$machine" \
        -o "$tmp_bin"
    chmod +x "$tmp_bin"
    mv "$tmp_bin" "$VERE"
fi
if ! vere_is_pinned; then
    print_error "urbit at $VERE reports $("$VERE" --version 2>/dev/null | head -1), expected urbit ${VERE_VERSION#v}"
    exit 1
fi
print_status "urbit: $VERE ($("$VERE" --version 2>/dev/null | head -1))"

# ------------------------------------------------------------------ boot
print_info "Booting a fresh ~$SHIP (this takes a few minutes)..."
rm -rf "$BUILD_ROOT" "$DIST_DIR/$SHIP"
mkdir -p "$BUILD_ROOT"
"$VERE" -F "$SHIP" -c "$PIER" --http-port "$HTTP_PORT" -p "$AMES_PORT" -t \
    >"$BUILD_ROOT/boot.log" 2>&1 &
SHIP_PID=$!

await_ship() {
    local i
    for i in $(seq 1 900); do
        if curl -fsS "http://localhost:$HTTP_PORT/~/login" >/dev/null 2>&1; then
            return 0
        fi
        kill -0 "$SHIP_PID" 2>/dev/null || { print_error "ship died; see $BUILD_ROOT/boot.log"; return 1; }
        sleep 1
    done
    print_error "ship never answered on port $HTTP_PORT (see $BUILD_ROOT/boot.log)"
    return 1
}
await_ship
print_status "~$SHIP is up on http://localhost:$HTTP_PORT"

# Each command is a SINGLE line of Hoon. click -i joins input lines with one
# space, which is not a gap, so a multi-line thread arrives as a syntax error --
# and click exits 0 regardless, which would make the merge, mount and commit
# below silent no-ops. `[0 %avow 0 ...]` is success; `[0 %avow 1]` is a crash.
run_click() {
    local hoon="$1"
    local out
    out="$(printf '%s\n' "$hoon" | "$CLICK" -b "$VERE" -i - -kp "$PIER")"
    if [[ "$out" != *'%avow 0'* ]]; then
        print_error "thread failed on ~$SHIP: $hoon"
        echo "$out" >&2
        return 1
    fi
    printf '%s' "$out"
}

run_click '=/  m  (strand ,vase)  ;<  our=ship  bind:m  get-our  (pure:m !>(our))' >/dev/null
print_status "click reaches ~$SHIP over $PIER/.urb/conn.sock"

# The manifest carries the ship's +code for auth.setup.ts; a mismatch would
# otherwise only surface much later, as a failed Playwright login against an
# already-published pier.
code="$(run_click '=/  m  (strand ,vase)  ;<  =bowl  bind:m  get-bowl  (pure:m !>((scot %p .^(@p %j /(scot %p our.bowl)/code/(scot %da now.bowl)/(scot %p our.bowl)))))' \
    | sed -n "s/.*%noun '~\\([a-z-]*\\)'.*/\\1/p")"
if [ "$code" != "$SHIP_CODE" ]; then
    print_error "~$SHIP's +code is '${code:-<unread>}' but the manifest says '$SHIP_CODE'"
    print_info "update the \"code\" field of ~$SHIP in $MANIFEST_FILE"
    exit 1
fi
print_status "+code matches the manifest"

# ------------------------------------------------------------------ desk
# The boot pill this vere fetches already carries a %groups desk, so there is
# usually nothing to create — and `%init` against an existing desk fails
# (`%merge-failed` on the ship's console, while the poke still acks). Only merge
# it out of %base when kiln has no %groups at all, which is rube's FRESH_BOOT
# case (rube/index.ts installGroupsDesk).
curl -fsS -c "$COOKIES" -X POST -d "password=$SHIP_CODE" \
    "http://localhost:$HTTP_PORT/~/login" -o /dev/null
if curl -fsS -b "$COOKIES" "http://localhost:$HTTP_PORT/~/scry/hood/kiln/pikes.json" \
    | jq -e '.groups' >/dev/null 2>&1; then
    print_status "%groups already exists in kiln; skipping the merge"
else
    print_info "Creating the %groups desk (merge %groups our %base)..."
    run_click '=/  m  (strand ,vase)  ;<  =bowl  bind:m  get-bowl  ;<  ~  bind:m  (poke [our.bowl %hood] kiln-merge+!>([%groups our.bowl %base da+now.bowl %init]))  ;<  ~  bind:m  (sleep ~s10)  (pure:m !>(%ok))' >/dev/null
fi

# ORDER MATTERS: mount writes clay's current desk OUT over the directory, so the
# desk must be assembled *after* the mount and committed after that.
print_info "Mounting %groups..."
run_click '=/  m  (strand ,vase)  ;<  =bowl  bind:m  get-bowl  =/  =path  [(scot %p our.bowl) %groups (scot %da now.bowl) ~]  ;<  ~  bind:m  (poke [our.bowl %hood] kiln-mount+!>([path %groups]))  ;<  ~  bind:m  (sleep ~s5)  (pure:m !>(%ok))' >/dev/null
if [ ! -d "$PIER/groups" ]; then
    print_error "%groups did not appear at $PIER/groups after the mount"
    exit 1
fi
print_status "%groups mounted at $PIER/groups"

print_info "Assembling the %groups desk from $DESK_TAG..."
if ! git -C "$PROJECT_ROOT" rev-parse --verify --quiet "$DESK_TAG^{commit}" >/dev/null; then
    print_error "$DESK_TAG is not in this checkout"
    print_info "fetch it: git fetch --no-tags origin refs/tags/$DESK_TAG:refs/tags/$DESK_TAG"
    exit 1
fi
TAG_TREE="$BUILD_ROOT/$DESK_TAG"
git -C "$PROJECT_ROOT" worktree add --detach --quiet "$TAG_TREE" "$DESK_TAG"
print_status "$DESK_TAG checked out at $TAG_TREE ($(git -C "$TAG_TREE" rev-parse --short HEAD))"

# peru sync + assemble against the TAG's peru.yaml and desk/, not this
# checkout's — the pier must carry the N-1 desk exactly as it shipped. peru
# caches in the tree it runs from, which is a throwaway worktree, so point it at
# the main checkout's cache: otherwise every rebuild re-clones urbit/urbit.
export PERU_CACHE_DIR="${PERU_CACHE_DIR:-$PROJECT_ROOT/.peru/cache}"
"$TAG_TREE/scripts/sync-deps.sh"
"$TAG_TREE/scripts/assemble-desk.sh" "$PIER/groups"

# %cz is the desk hash. A kiln commit that changes nothing still reports
# success, so the hash is the only proof the desk actually landed.
desk_hash() {
    run_click '=/  m  (strand ,vase)  ;<  hash=@uvI  bind:m  (scry @uvI %cz /groups)  (pure:m !>(hash))' \
        | sed -n 's/.*%noun \([^]]*\)\].*/\1/p'
}

hash_before="$(desk_hash)"
if [ -z "$hash_before" ]; then
    print_error "could not read the %groups desk hash before the commit"
    exit 1
fi
print_info "desk hash before: $hash_before"

print_info "Committing %groups (compiles the whole desk; several minutes)..."
run_click '=/  m  (strand ,vase)  ;<  our=ship  bind:m  get-our  ;<  ~  bind:m  (poke [our %hood] kiln-commit+!>([%groups |]))  (pure:m !>(%ok))' >/dev/null

# ------------------------------------------------------------------ verify
# The committed docket version is what this pier exists to carry, so wait for
# it rather than for the commit poke's ack, which returns before anything is
# compiled.
print_info "Waiting for ~$SHIP to report %groups ${DESK_TAG#v}..."
reported=""
for _ in $(seq 1 450); do
    reported="$(curl -fsS -b "$COOKIES" "http://localhost:$HTTP_PORT/~/scry/docket/charges.json" 2>/dev/null \
        | jq -r '.initial.groups.version // empty')"
    [ "$reported" = "${DESK_TAG#v}" ] && break
    sleep 2
done
if [ "$reported" != "${DESK_TAG#v}" ]; then
    print_error "~$SHIP reports %groups '${reported:-<none>}', expected ${DESK_TAG#v}"
    tail -40 "$BUILD_ROOT/boot.log" >&2 || true
    exit 1
fi
print_status "~$SHIP reports %groups $reported"

hash_after="$(desk_hash)"
print_info "desk hash after:  ${hash_after:-<none>}"
if [ -z "$hash_after" ] || [ "$hash_before" = "$hash_after" ]; then
    print_error "the %groups commit was a no-op — the desk did not change"
    exit 1
fi

# kiln has to be running the desk, not merely holding it: a desk that failed
# to build sits there with zest %dead and the ship serves nothing.
pikes="$(curl -fsS -b "$COOKIES" "http://localhost:$HTTP_PORT/~/scry/hood/kiln/pikes.json")"
zest="$(jq -r '.groups.zest // empty' <<<"$pikes")"
if [ "$zest" != "live" ]; then
    print_error "~$SHIP's %groups desk is zest '${zest:-<none>}', expected live"
    jq '{groups: .groups}' <<<"$pikes" >&2 || true
    exit 1
fi
print_status "%groups is live in kiln"
jq '{groups: .groups}' <<<"$pikes"

if [ "$KEEP_RUNNING" = "true" ]; then
    print_warning "Leaving ~$SHIP running (pid $SHIP_PID) — stop it before archiving"
    exit 0
fi

# The pier must be at rest before it is moved or tarred: a live serf is still
# writing to the event log and the snapshot, and an archive taken underneath it
# is a torn one. So this waits for the process to actually be gone, escalates,
# and gives up loudly rather than carrying on.
print_info "Stopping ~$SHIP..."
stop_ship() {
    local signal
    for signal in TERM KILL; do
        kill -"$signal" "$SHIP_PID" 2>/dev/null || true
        local _i
        for _i in $(seq 1 120); do
            kill -0 "$SHIP_PID" 2>/dev/null || return 0
            sleep 1
        done
        print_warning "~$SHIP did not exit on SIG$signal after 120s"
    done
    return 1
}
if ! stop_ship; then
    print_error "~$SHIP (pid $SHIP_PID) is still running; refusing to move or archive a live pier"
    exit 1
fi
SHIP_PID=""
print_status "~$SHIP stopped"

# ------------------------------------------------------------------ install
# Move the finished pier where rube and archive-piers.sh look for it. The socket
# that forced the short build path is gone once the ship is stopped.
print_info "Moving the pier to $FINAL_PIER..."
rm -f "$PIER/.vere.lock" "$PIER/.urb/conn.sock" 2>/dev/null || true
mkdir -p "$(dirname "$FINAL_PIER")"
rm -rf "$FINAL_PIER"
mv "$PIER" "$FINAL_PIER"
print_status "Pier at $FINAL_PIER ($(du -sh "$FINAL_PIER" | cut -f1))"

# ------------------------------------------------------------------ archive
if [ "$SKIP_ARCHIVE" = "true" ]; then
    print_status "Pier built at $FINAL_PIER (not archived)"
    exit 0
fi

print_info "Archiving..."
# DIST_DIR goes through too, so a caller's override actually reaches the
# archiver rather than being silently replaced by its own default.
SKIP_UPLOAD=true SKIP_CLEANUP=true ARCHIVE_TAG="$ARCHIVE_TAG" DIST_DIR="$DIST_DIR" \
    URBIT_BINARY="$VERE" "$RUBE_DIR/archive-piers.sh" --skip-prepare --ship "$SHIP"

archive="$DIST_DIR/rube-${SHIP}${ARCHIVE_TAG}.tgz"
if [ ! -f "$archive" ]; then
    print_error "expected archive not found at $archive"
    exit 1
fi
print_status "Archive: $archive ($(du -h "$archive" | cut -f1))"
echo ""
print_info "Publish it (maintainer step, needs gs://bootstrap.urbit.org write access):"
echo "    gsutil cp $archive gs://bootstrap.urbit.org/"
echo "    gsutil acl ch -u AllUsers:R gs://bootstrap.urbit.org/$(basename "$archive")"
