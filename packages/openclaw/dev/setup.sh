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

# Clone tlonbot for config and prompts
clone_if_missing ../tlonbot tlonbot

# Clone tlon-apps for the dev-only local @tloncorp/api override flow.
# If your local checkout uses a different name (for example "homestead"),
# set TLON_APPS_DIR when running dev/link commands instead.
clone_if_missing ../tlon-apps tlon-apps

# Clone tlon-skill for the dev-only local @tloncorp/tlon-skill override flow.
# Set TLON_SKILL_DIR if your local checkout is not named ../tlon-skill.
clone_if_missing ../tlon-skill tlon-skill

# Create .env if missing
if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> Created .env from template - please fill in values"
fi

echo "==> Setup complete. Run: docker compose -f dev/docker-compose.yml up --build"
