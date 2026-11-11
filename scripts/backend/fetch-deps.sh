#!/usr/bin/env bash
# scripts/backend/fetch-deps.sh [manifest]
# Fetch the files a desk imports but does not own, listed in a manifest
# (default: desk-deps.yaml, the %groups desk's), into desk-deps/ beside it.
# A source whose url is file://<dir> is a directory, relative to the manifest,
# whose files are copied as they are. Any other url is a git remote, fetched at
# its pinned commit.
set -euo pipefail
manifest=${1:-$(dirname "$0")/../../desk-deps.yaml}
cd "$(dirname "$manifest")"

deps=$(basename "$manifest") out=desk-deps cache=.deps-cache

# Two unrelated tools are called yq; this needs the Go one.
yq --version 2>/dev/null | grep -q mikefarah ||
  { echo "fetch needs yq v4 (https://github.com/mikefarah/yq)" >&2; exit 1; }

dupes=$(yq '.[].files[]' "$deps" | sort | uniq -d)
[[ -z $dupes ]] ||
  { echo "$deps: listed by more than one entry:" $dupes >&2; exit 1; }

fetch_one() {
  local name=$1 url rev export_dir file repo files=()
  url=$(name=$name yq '.[strenv(name)].url' "$deps")
  rev=$(name=$name yq '.[strenv(name)].rev' "$deps")
  export_dir=$(name=$name yq '.[strenv(name)].export' "$deps")
  while IFS= read -r file; do files+=("$file"); done \
    < <(name=$name yq '.[strenv(name)].files[]' "$deps")
  [[ $url != null && $export_dir != null && ${#files[@]} -gt 0 ]] ||
    { echo "$deps: $name needs url, export and files" >&2; exit 1; }

  if [[ $url == file://* ]]; then
    tar -c -C "${url#file://}/$export_dir" "${files[@]}" | tar -x -C "$out"
    echo "$name: ${#files[@]} files from ${url#file://}/$export_dir"
    return
  fi

  [[ $rev =~ ^[0-9a-f]{40}$ ]] ||
    { echo "$deps: $name: rev must be a full commit hash" >&2; exit 1; }
  # Shallow clone at commit and only fetch listed files
  repo=$cache/$name
  git init --quiet "$repo"
  git -C "$repo" cat-file -e "$rev^{commit}" 2>/dev/null ||
    git -C "$repo" fetch --quiet --depth 1 --filter=blob:none "$url" "$rev"
  git -C "$repo" archive "$rev:$export_dir" "${files[@]}" | tar -x -C "$out"
  echo "$name: ${#files[@]} files at ${rev:0:12}"
}

rm -rf "$out" && mkdir -p "$out"
# Each remote costs two round trips, so fetch all the sources at once.
pids=()
for name in $(yq 'keys | .[]' "$deps"); do
  fetch_one "$name" &
  pids+=($!)
done
failed=0
for pid in "${pids[@]}"; do wait "$pid" || failed=1; done
exit "$failed"
