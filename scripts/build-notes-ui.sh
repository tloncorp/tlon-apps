#!/bin/sh
# Regenerate the +index arm of desk/lib/notes-ui.hoon from the current
# desk/app/notes-ui/index.html. The +manifest, +service-worker, +favicon-svg,
# and +icon-svg arms are hand-edited and left untouched.
set -e

INDEX=desk/app/notes-ui/index.html
LIB=desk/lib/notes-ui.hoon

if [ ! -f "$INDEX" ] || [ ! -f "$LIB" ]; then
  echo "error: run from the repo root (need $INDEX and $LIB)" >&2
  exit 1
fi

# Hoon triple-quote cords can't contain ''' anywhere in the body.
if grep -q "'''" "$INDEX"; then
  echo "error: $INDEX contains a triple-quote ('''), which would break the cord wrapper" >&2
  exit 2
fi

awk -v html_file="$INDEX" '
  BEGIN { state = 0 }
  state == 0 {
    print
    if ($0 ~ /^\+\+  index$/) state = 1
    next
  }
  state == 1 {
    print
    if ($0 ~ /^\^-  @t$/) state = 2
    next
  }
  state == 2 {
    if ($0 ~ /^'\''{3}$/) {
      print
      while ((getline line < html_file) > 0) print line
      close(html_file)
      state = 3
    } else {
      print
    }
    next
  }
  state == 3 {
    if ($0 ~ /^'\''{3}$/) {
      print
      state = 4
    }
    next
  }
  state == 4 { print }
' "$LIB" > "$LIB.tmp"

mv "$LIB.tmp" "$LIB"
echo "regenerated +index arm in $LIB ($(wc -l < $INDEX) lines from $INDEX)"
