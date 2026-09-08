#!/bin/sh
set -eu
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
out=${1:?supply a fresh absolute output directory}
case "$out" in /*) ;; *) echo 'output must be absolute' >&2; exit 2;; esac
mkdir -p "$out"
clang++ -std=c++20 -fobjc-arc -framework Foundation -Wall -Wextra -Werror \
  "$here/../TlonReadDescriptors.mm" "$here/read-descriptor-controls.mm" \
  -o "$out/read-descriptor-controls"
"$out/read-descriptor-controls"
