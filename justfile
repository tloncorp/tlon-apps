# Where the %groups desk is assembled.
out := "desk-out"

# Assemble the %groups desk: the files fetched from desk-deps.yaml, then desk/ on top.
build: fetch (assemble "." out)
    #!/usr/bin/env bash
    set -euo pipefail
    # Stamp the build commit. A checkout without git metadata (a Docker build
    # context that .dockerignore strips .git from) keeps desk/commit.txt.
    commit=$(git rev-parse --short HEAD 2>/dev/null || true)
    if [ -n "$commit" ]; then
      printf '%s\n' "$commit" > {{ quote(out / "commit.txt") }}
    fi
    echo "Assembled the groups desk into {{ out }}"

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
    rsync -a --delete --checksum {{ quote(out) }}/ "$mount/"

# A file with no Clay mark fails the desk commit outright, so Finder's
# .DS_Store must stay out. The desk's own files go second and win on any overlap.
# Lay SRC/desk-deps, then SRC/desk, into a fresh OUT. Harness's justfile uses it too.
[private]
assemble src out:
    rm -rf {{ quote(out) }}
    mkdir -p {{ quote(out) }}
    rsync -aL --exclude=.DS_Store {{ quote(src / "desk-deps") }}/ {{ quote(out) }}/
    rsync -aL --exclude=.DS_Store {{ quote(src / "desk") }}/ {{ quote(out) }}/

# Fetch the files listed in MANIFEST, at their pinned commits, into desk-deps/ beside it.
fetch manifest="desk-deps.yaml":
    scripts/backend/fetch-deps.sh {{ quote(manifest) }}

# Remove the assembled desk.
clean:
    rm -rf {{ quote(out) }}

# Remove everything generated: the assembled desk, fetched files and fetch cache.
distclean: clean
    rm -rf desk-deps .deps-cache
