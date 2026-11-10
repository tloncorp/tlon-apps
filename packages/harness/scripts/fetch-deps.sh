#!/usr/bin/env bash
# Fetch the files listed in deps.yaml, at their pinned commits, into desk-deps/.
set -euo pipefail
cd "$(dirname "$0")/.."

deps=deps.yaml out=desk-deps cache=.deps-cache

# Two unrelated tools are called yq; this needs the Go one.
yq --version 2>/dev/null | grep -q mikefarah ||
  { echo "fetch needs mikefarah/yq v4 (https://github.com/mikefarah/yq)" >&2; exit 1; }

rm -rf "$out" && mkdir -p "$out"
for name in $(yq 'keys | .[]' "$deps"); do
  url=$(name=$name yq '.[strenv(name)].url' "$deps")
  rev=$(name=$name yq '.[strenv(name)].rev' "$deps")
  export_dir=$(name=$name yq '.[strenv(name)].export' "$deps")
  files=()
  while IFS= read -r file; do files+=("$file"); done \
    < <(name=$name yq '.[strenv(name)].files[]' "$deps")
  [[ $url != null && $export_dir != null && ${#files[@]} -gt 0 ]] ||
    { echo "$deps: $name needs url, rev, export and files" >&2; exit 1; }
  [[ $rev =~ ^[0-9a-f]{40}$ ]] ||
    { echo "$deps: $name: rev must be a full commit hash" >&2; exit 1; }
  for file in "${files[@]}"; do
    [[ ! -e $out/$file ]] ||
      { echo "$deps: $name: $file is already provided by an earlier entry" >&2; exit 1; }
  done

  # Shallow clone at commit and only fetch listed files
  repo=$cache/$name
  git init --quiet "$repo"
  git -C "$repo" cat-file -e "$rev^{commit}" 2>/dev/null ||
    git -C "$repo" fetch --quiet --depth 1 --filter=blob:none "$url" "$rev"
  git -C "$repo" archive "$rev:$export_dir" "${files[@]}" | tar -x -C "$out"
  echo "$name: ${#files[@]} files at ${rev:0:12}"
done
