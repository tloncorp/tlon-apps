# Where the %groups desk is assembled.
out := "desk-out"

# The build commit. Empty in a checkout without git metadata (a Docker build
# context that .dockerignore strips .git from), which keeps desk/commit.txt.
commit := `git rev-parse --short HEAD 2>/dev/null || true`

# Assemble the %groups desk: the files fetched from desk-deps.yaml, then desk/ on top.
build: fetch (assemble "." out commit)
    @echo "Assembled the groups desk into {{ out }}"

# Replace a mounted desk with the assembled one, deleting everything else there.
install desk: build
    #!/usr/bin/env bash
    set -euo pipefail
    # just runs recipes from this directory; the path is relative to the caller's.
    mount=$(cd {{ quote(invocation_directory()) }} && cd {{ quote(desk) }} 2>/dev/null && pwd) ||
      { echo "desk mount '{{ desk }}' does not exist" >&2; exit 1; }
    # Everything else in the target is deleted, so it has to be a desk mount:
    # a directory in a pier, named as a desk (which rules out the pier's .urb).
    [[ $(basename "$mount") =~ ^[a-z][a-z0-9-]*$ && -d $mount/../.urb ]] ||
      { echo "'{{ desk }}' is not a desk mounted in a pier" >&2; exit 1; }
    # Under the build lock, so that no other build changes the desk mid-copy.
    exec 9>>.deps-cache/lock
    python3 -c 'import fcntl; fcntl.flock(9, fcntl.LOCK_EX)'
    rsync -a --delete --checksum {{ quote(out) }}/ "$mount/"

# Copy the assembled desk into a mounted desk. Files it does not contain are kept.
install-dev desk: build
    #!/usr/bin/env bash
    set -euo pipefail
    desk={{ quote(desk) }}
    # just runs recipes from this directory; the path is relative to the caller's.
    mount=$(cd {{ quote(invocation_directory()) }} && cd "$desk" 2>/dev/null && pwd) ||
      { echo "desk mount '$desk' does not exist" >&2; exit 1; }
    # Files there with the desk's names are overwritten, so it has to be a desk
    # mount: a directory in a pier, named as a desk.
    [[ $(basename "$mount") =~ ^[a-z][a-z0-9-]*$ && -d $mount/../.urb ]] ||
      { echo "'$desk' is not a desk mounted in a pier" >&2; exit 1; }
    # Under the build lock, so that no other build changes the desk mid-copy.
    exec 9>>.deps-cache/lock
    python3 -c 'import fcntl; fcntl.flock(9, fcntl.LOCK_EX)'
    rsync -a --checksum {{ quote(out) }}/ "$mount/"

# A file with no Clay mark fails the desk commit outright, so Finder's
# .DS_Store must stay out. The desk's own files go second and win on any overlap.
# Lay SRC/desk-deps, then SRC/desk, into OUT, stamping commit.txt with STAMP
# if it is given. RSYNC_ARGS go to both copies. Harness's justfile uses it too.
[private]
assemble src out stamp="" *rsync_args:
    #!/usr/bin/env bash
    set -euo pipefail
    # Builds of one SRC take turns, under the lock that fetch-deps.sh takes to
    # write SRC/desk-deps. The lock is on the descriptor, which the kernel
    # closes when this exits.
    mkdir -p {{ quote(src / ".deps-cache") }}
    exec 9>>{{ quote(src / ".deps-cache/lock") }}
    python3 -c 'import fcntl; fcntl.flock(9, fcntl.LOCK_EX)'
    # Whoever ran an earlier build may still be reading OUT, which is not under
    # the lock, so the desk is built aside and OUT updated in place: rsync
    # leaves files that have not changed untouched.
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    mkdir "$tmp/desk"
    rsync -aL --exclude=.DS_Store {{ rsync_args }} {{ quote(src / "desk-deps") }}/ "$tmp/desk/"
    rsync -aL --exclude=.DS_Store {{ rsync_args }} {{ quote(src / "desk") }}/ "$tmp/desk/"
    {{ if stamp == "" { "" } else { "echo " + quote(stamp) + ' > "$tmp/desk/commit.txt"' } }}
    mkdir -p {{ quote(out) }}
    rsync -a --delete --checksum "$tmp/desk/" {{ quote(out) }}/

# Fetch the files listed in MANIFEST, at their pinned commits, into desk-deps/ beside it.
fetch manifest="desk-deps.yaml":
    scripts/backend/fetch-deps.sh {{ quote(manifest) }}

# Remove the assembled desk.
clean:
    rm -rf {{ quote(out) }}

# Remove everything generated: the assembled desk, fetched files and fetch cache.
distclean: clean
    rm -rf desk-deps .deps-cache
