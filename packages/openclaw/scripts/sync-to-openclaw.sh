#!/bin/bash
# Sync this plugin to an OpenClaw fork for creating PRs
#
# Usage: ./scripts/sync-to-openclaw.sh [openclaw-path] [branch-name]
#
# Example:
#   ./scripts/sync-to-openclaw.sh ~/Projects/openclaw-fork tlon-feature-xyz

set -e

OPENCLAW_PATH="${1:-$HOME/Projects/openclaw}"
BRANCH_NAME="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"

if [ ! -d "$OPENCLAW_PATH" ]; then
    echo "Error: OpenClaw path not found: $OPENCLAW_PATH"
    echo "Usage: $0 [openclaw-path] [branch-name]"
    exit 1
fi

TARGET_DIR="$OPENCLAW_PATH/extensions/tlon"

# Create branch if specified
if [ -n "$BRANCH_NAME" ]; then
    echo "Creating branch: $BRANCH_NAME"
    cd "$OPENCLAW_PATH"
    git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
    cd -
fi

echo "Syncing plugin to: $TARGET_DIR"

# Sync files (excluding repo-specific stuff)
rsync -av --delete \
    --include='package.json' \
    --include='openclaw.plugin.json' \
    --include='src/***' \
    --include='dist/***' \
    --include='README.md' \
    --include='index.ts' \
    --include='scripts/' \
    --include='scripts/generate-version.js' \
    --exclude='*' \
    "$PLUGIN_DIR/" "$TARGET_DIR/"

# Transform package.json: use workspace:* for openclaw in monorepo
echo "Transforming package.json for monorepo..."
if command -v jq &> /dev/null; then
    jq '.devDependencies.openclaw = "workspace:*"' "$TARGET_DIR/package.json" > "$TARGET_DIR/package.json.tmp" \
        && mv "$TARGET_DIR/package.json.tmp" "$TARGET_DIR/package.json"
else
    # Fallback to sed if jq not available
    sed -i.bak 's/"openclaw": "[^"]*"/"openclaw": "workspace:*"/' "$TARGET_DIR/package.json" \
        && rm -f "$TARGET_DIR/package.json.bak"
fi

echo ""
echo "✅ Sync complete!"
echo ""
echo "Next steps:"
echo "  cd $OPENCLAW_PATH"
echo "  git add extensions/tlon"
echo "  git commit -m 'tlon: your changes here'"
echo "  git push origin $BRANCH_NAME"
echo "  # Then create PR on GitHub"
