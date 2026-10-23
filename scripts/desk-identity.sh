#!/bin/bash
# scripts/desk-identity.sh docket <file>
# scripts/desk-identity.sh tree <rev>
#
# Whether the %groups desk "changed", ignoring the glob bot: it rewrites the
# glob-http line of desk/desk.docket-0 several times a day, and that line
# never changes the Hoon a ship runs. Every other docket line (version, base,
# ...) still counts. A glob line in an unrecognized format is left in place,
# so a format change costs a spurious refresh/commit, never a missed one.
#
#   docket <file>  print <file> with the glob-http line removed
#   tree <rev>     print a hash identifying <rev>:desk with its docket
#                  normalized as above (not a git tree hash; deterministic)
#
# Used by pier-archive-refresh.yml and archive-piers.sh (tree), and by the bot
# E2E harness on both the host and the ship container (docket).

set -euo pipefail

# Kept in step with DOCKET_GLOB_LINE in apps/tlon-web/rube/deskManifest.ts.
DOCKET_GLOB_LINE='^ *glob-http\+\[[^ ]+ +0v[0-9a-v.]+] *$'

normalize_docket() {
    sed -E "/$DOCKET_GLOB_LINE/d"
}

case "${1:-}" in
docket)
    normalize_docket < "$2"
    ;;
tree)
    cd "$(dirname "$0")/.."
    rev=$2
    docket=desk.docket-0
    git rev-parse --verify --quiet "$rev:desk" > /dev/null
    normalized=""
    if git cat-file -e "$rev:desk/$docket" 2> /dev/null; then
        normalized=$(git show "$rev:desk/$docket" | normalize_docket |
            git hash-object --stdin)
    fi
    # ls-tree lines are "<mode> <type> <blob>\t<path>"; swap in the
    # normalized docket's blob hash.
    git ls-tree -r "$rev:desk" |
        awk -F '\t' -v path="$docket" -v blob="$normalized" '
            $2 == path { sub(/[0-9a-f]+$/, blob, $1) }
            { print $1 "\t" $2 }' |
        git hash-object --stdin
    ;;
*)
    echo "usage: $0 docket <file> | tree <rev>" >&2
    exit 2
    ;;
esac
