#!/bin/sh
# Regenerate the +json arm of desk/lib/notes-openapi.hoon from
# docs/notes/openapi.yaml. YAML is the source of truth (human-edited),
# JSON is what %mcp-proxy consumes (it parses with de:json:html
# and rejects YAML).
set -e

YAML=docs/notes/openapi.yaml
LIB=desk/lib/notes-openapi.hoon

if [ ! -f "$YAML" ] || [ ! -f "$LIB" ]; then
  echo "error: run from the repo root (need $YAML and $LIB)" >&2
  exit 1
fi

# Convert YAML → JSON via node using the repo's js-yaml dependency. (Avoids
# npx, which breaks against this repo's .npmrc `script-shell` setting.) Emits
# 2-space-indented JSON to match the existing +json cord.
TMP_JSON=$(mktemp -t notes-openapi-XXXX).json
trap 'rm -f "$TMP_JSON"' EXIT
node -e 'const y=require("js-yaml"),fs=require("fs");process.stdout.write(JSON.stringify(y.load(fs.readFileSync(process.argv[1],"utf8")),null,2)+"\n")' "$YAML" > "$TMP_JSON"

if grep -q "'''" "$TMP_JSON"; then
  echo "error: generated JSON contains a triple-quote ('''), which would break the cord wrapper" >&2
  exit 2
fi

awk -v json_file="$TMP_JSON" '
  BEGIN { state = 0 }
  state == 0 {
    print
    if ($0 ~ /^\+\+  json$/) state = 1
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
      while ((getline line < json_file) > 0) print line
      close(json_file)
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
echo "regenerated +json arm in $LIB ($(wc -c < "$TMP_JSON") bytes from $YAML)"
