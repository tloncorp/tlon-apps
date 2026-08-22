---
id: TASK-28
title: Fix openclaw's dependency on the unpublished @tloncorp/tlon-kits
status: To Do
assignee: []
created_date: '2026-08-20 19:04'
updated_date: '2026-08-22 13:01'
labels:
  - openclaw
  - packaging
  - workspaces
dependencies: []
priority: high
type: bug
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-2 added `@tloncorp/tlon-kits` to `packages/openclaw`'s dependencies as `workspace:^`. Unlike its siblings, that package has never been published: `@tloncorp/api` and `@tloncorp/tlon-skill` both return 200 from the npm registry, `@tloncorp/tlon-kits` returns 404.

This breaks openclaw wherever its package.json is consumed outside the pnpm workspace. `scripts/resolve-workspace-deps.mjs --registry` rewrites `workspace:^` specs to registry ranges for the Docker dev container and for `.publish/` staging; for tlon-kits there is no registry version, so `pnpm install` fails with E404 and the container never starts. Found while standing up the local walkthrough rig — openclaw could not boot at all.

Note the ordering that makes it unrecoverable in the container: `dev/entrypoint.sh` runs `pnpm install` BEFORE `build-local-api-override.sh` and `build-local-skill-override.sh`, so the existing local-override pattern cannot rescue it. Those overrides work for api and tlon-skill precisely because those packages install successfully first and are then swapped for local builds.

The single import site is `packages/openclaw/src/kits/group-config.ts`, which needs `parseGroupKitConfig` and `KITS_BLOB_VERSION` as runtime values. Its own comment explains why it must be shared rather than duplicated: "The parse lives in @tloncorp/tlon-kits so the harness and the client read the blob identically. They used to have separate implementations that disagreed about what a malformed payload means." So re-inlining the parser would reintroduce the bug that motivated extracting it.

A stopgap keeps the dev container working: `resolve-workspace-deps.mjs` now falls back to a `file:` spec against the mounted monorepo (`TLON_APPS_DIR`) when a workspace dep has no registry version, and only in `--registry` mode so `.publish/` staging still fails loudly. That unblocks local dev but does not fix the published plugin, which is the actual decision this task carries: publish `@tloncorp/tlon-kits`, or bundle it into openclaw's build output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 openclaw's Docker dev container installs and boots from a clean state with no manual intervention
- [ ] #2 The published openclaw plugin resolves its tlon-kits dependency without a file: spec or a mounted monorepo
- [ ] #3 `.publish/` staging still fails loudly on a workspace dep that cannot be resolved, rather than emitting a package.json that is broken for installers
- [ ] #4 The blob parser remains shared between the harness and the client — no duplicated parse implementation
- [ ] #5 A check fails in CI if a workspace dependency is added to openclaw that is not resolvable outside the workspace
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-21: Still open; the dev rig papers over it — every container start logs the npm E404 for @tloncorp/tlon-kits and the entrypoint falls back to installing from the mounted monorepo (visible in each dev-openclaw-1 boot today). Works locally, still breaks any environment without the monorepo mount.
<!-- SECTION:NOTES:END -->
