#!/bin/bash
# Brings the product guide's feature map up to date with a newer store build
# and opens a pull request for a person to review and merge.
#
#   scripts/feature-map-update.sh [--to <tag>] [--base <ref>] [--prepare | --no-pr]
#
# With no --to it asks `feature-map.mjs next` whether a store build newer than
# the one in docs/feature-map/release.json has been tagged, and stops if there
# is none or if a pull request for it is already open. So it is safe to run on
# a schedule.
#
#   --prepare  stop after the commit and say which branch and description to
#              open the pull request with. A scheduled job uses this so the
#              agent never runs alongside the token that can push.
#   --no-pr    for trying it out: touch nothing on the remote at all.
#
# A coding agent does the reading and the edits, in two passes: one to update
# the entries (docs/feature-map/agent/update.md), one to check the first
# (docs/feature-map/agent/review.md). FEATURE_MAP_AGENT is the command for it.
# It must take its instructions on stdin, be allowed to edit this checkout, and
# print its final report on stdout. The default is the Codex CLI.
#
# Run it from a clean checkout. On success it returns to where it started. On
# failure it stays on the work branch, with the agent's edits in place.
set -euo pipefail

to=""
base="origin/develop"
check_remote=1
push=1
while [ $# -gt 0 ]; do
  case "$1" in
    --to)
      to="$2"
      shift 2
      ;;
    --base)
      base="$2"
      shift 2
      ;;
    --prepare)
      push=0
      shift
      ;;
    --no-pr)
      check_remote=0
      push=0
      shift
      ;;
    *)
      echo "usage: feature-map-update.sh [--to <tag>] [--base <ref>] [--prepare | --no-pr]" >&2
      exit 2
      ;;
  esac
done

agent=${FEATURE_MAP_AGENT:-'codex exec -s workspace-write -c model_reasoning_effort="high" -'}
guide=packages/openclaw/skills/tlon-product-guide
map=docs/feature-map

cd "$(git rev-parse --show-toplevel)"
if [ -n "$(git status --porcelain)" ]; then
  echo "this checkout has uncommitted changes; run from a clean one" >&2
  exit 1
fi
# Where to return to: a branch, or a bare commit when the checkout started
# detached, as a scheduled job's does.
started_branch=$(git symbolic-ref --quiet --short HEAD || true)
started_commit=$(git rev-parse HEAD)
go_back() {
  if [ -n "$started_branch" ]; then
    git switch --quiet "$started_branch"
  else
    git switch --quiet --detach "$started_commit"
  fi
}

# A build's tag can be moved, so take the remote's word for where each one is.
git fetch --quiet --tags --force origin
git switch --quiet --detach "$base"
base_commit=$(git rev-parse HEAD)

target=${to:-$(node scripts/feature-map.mjs next)}
if [ -z "$target" ]; then
  echo "the map already describes the newest store build"
  go_back
  exit 0
fi

branch="feature-map/$(printf '%s' "$target" | tr -c 'A-Za-z0-9._-' '-')"
if [ "$check_remote" = 1 ]; then
  if [ -n "$(gh pr list --head "$branch" --state open --json number --jq '.[].number')" ]; then
    echo "a pull request for $target is already open"
    go_back
    exit 0
  fi
  # A branch with no open pull request is a run that pushed and then failed,
  # or a pull request someone closed. Either needs a person, and skipping it
  # quietly would leave the map on the old build for good.
  if git ls-remote --exit-code --heads origin "$branch" > /dev/null 2>&1; then
    echo "$branch is on the remote with no open pull request." >&2
    echo "Open one from it, or delete the branch to run the update again." >&2
    go_back
    exit 1
  fi
fi

old=$(node -p "require('./$map/release.json').app")
old_commit=$(node -p "require('./$map/release.json').commit")
work=$(mktemp -d)
git switch --quiet -C "$branch"
echo "updating the map from $old to $target on $branch"

node scripts/feature-map.mjs affected --since "$old_commit" --until "$target" > "$work/worklist.md"

# Fills in a brief's placeholders and hands it to the agent. The agent's
# report, its final message, is kept for the pull request.
run_agent() {
  sed -e "s|{{new}}|$target|g" -e "s|{{old}}|$old|g" -e "s|{{old_commit}}|$old_commit|g" \
    "$map/agent/$1.md" | bash -c "$agent" > "$work/$1-report.md"

  # The agent has write access to the checkout. Hold it to the guide.
  if [ "$(git rev-parse HEAD)" != "$base_commit" ]; then
    echo "the agent made commits; it must only edit files" >&2
    exit 1
  fi
  local stray
  stray=$(git status --porcelain | cut -c4- | grep -v -E "^($map/|$guide/)" || true)
  if [ -n "$stray" ]; then
    echo "the agent changed files outside the guide:" >&2
    echo "$stray" >&2
    exit 1
  fi
}

# `publish` refuses unless the map passes its check against the new build, so
# each pass has to leave the map in a state that holds.
run_agent update
node scripts/feature-map.mjs publish --app "$target"
run_agent review
node scripts/feature-map.mjs publish --app "$target"
node --test scripts/feature-map.test.mjs > /dev/null
checked=$(node scripts/feature-map.mjs check | tail -n 1)

title="product guide: describe $target"
git add -A -- "$map" "$guide"
git commit --quiet -m "$title"

body="$work/body.md"
write_body() {
  cat << EOF
## Summary

Brings the product guide's feature map up to date with \`$target\`. It described \`$old\`.

A coding agent made these edits by following \`docs/feature-map/README.md\`, and a second one checked them. Nothing was tried on a device. Read the diff as a draft: each changed entry should match what \`$target\` shows.

## Changes

$(cat "$work/update-report.md")

### Second read

$(cat "$work/review-report.md")

## How did I test?

- \`node scripts/feature-map.mjs check\`: $checked
- \`node --test scripts/feature-map.test.mjs\` passes.
- The copy bots read was written by \`publish\` from the map.

$1

## Risks and impact

- Safe to rollback without consulting PR author? Yes
- Affects important code area:
  - [ ] Onboarding
  - [ ] State / providers
  - [ ] Message sync
  - [ ] Channel display
  - [ ] Notifications
  - [x] Other: what Tlonbot tells people about the app. No app code changes.

Merging restarts the internal bot fleet, because the guide is on \`bot-harness-deploy.yml\`'s path filter.

## Rollback plan

Revert this PR. The guide goes back to describing \`$old\`.

## Screenshots / videos

None. No app UI changes.
EOF
}
worklist="<details><summary>Entries whose code changed between the two builds</summary>

Those not in this diff were judged still true.

$(cat "$work/worklist.md")

</details>"
write_body "$worklist" > "$body"
# GitHub rejects a description over 65,536 characters.
if [ "$(wc -c < "$body")" -gt 60000 ]; then
  write_body "The list of entries whose code changed is too long to fit here: \`node scripts/feature-map.mjs affected --since $old_commit --until $target\`" > "$body"
fi

if [ "$push" = 0 ]; then
  echo "committed on $branch; nothing pushed"
  echo "description: $body"
  # For a scheduled job's next step.
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    {
      echo "branch=$branch"
      echo "title=$title"
      echo "body=$body"
    } >> "$GITHUB_OUTPUT"
  fi
  go_back
  exit 0
fi

git push --quiet origin "$branch"
gh pr create --base develop --head "$branch" --title "$title" --body-file "$body"
go_back
