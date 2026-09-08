#!/bin/sh
set -eu
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
out=${1:?supply an absolute output directory}
case "$out" in /*) ;; *) echo 'output must be absolute' >&2; exit 2;; esac
mkdir -p "$out"
status=0
for group in descriptor lifetime capture-diagnostic; do
  sh "$here/run-read-$group-controls.sh" "$out/$group" || status=1
done
exit "$status"
