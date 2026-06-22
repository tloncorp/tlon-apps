#!/bin/bash
# Run this on your host machine before docker compose up
set -e
cd "$(dirname "$0")/.."

clone_if_missing() {
  local dir=$1
  local repo=$2
  if [ ! -d "$dir" ]; then
    echo "==> Cloning $repo..."
    gh repo clone "tloncorp/$repo" "$dir"
  else
    echo "==> $repo already exists"
  fi
}

# Clone tlonbot for config and prompts. Default location: sibling of the
# tlon-apps monorepo root (this package lives at packages/openclaw). Set
# TLONBOT_DIR when running dev commands if your checkout lives elsewhere.
clone_if_missing ../../../tlonbot tlonbot

# @tloncorp/api and @tloncorp/tlon-skill live in this monorepo
# (packages/api, packages/tlon-skill) — nothing to clone for the dev-only
# override flows; the compose file mounts them from the containing repo.

# Create .env if missing
if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> Created .env from template - please fill in values"
fi

echo "==> Setup complete. Run: docker compose -f dev/docker-compose.yml up --build"
