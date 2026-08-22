---
id: TASK-28
title: Fix openclaw's dependency on the unpublished @tloncorp/tlon-kits
status: To Do
assignee: []
created_date: '2026-08-20 19:04'
updated_date: '2026-08-22 19:32'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan (researched 2026-08-22)

**Decision: publish @tloncorp/tlon-kits to npm, mirroring the existing tlon-skill/openclaw release pattern.** Not bundling.

Why publish wins over bundling:
- The plugin's package.json is consumed in two places that can only resolve registry deps: the `.publish/` tarball (npm consumers) and the upstream openclaw repo's `extensions/tlon` (sync-to-openclaw.sh copies package.json verbatim, only rewriting the `openclaw` dep). `@tloncorp/api` and `@tloncorp/tlon-skill` are published for exactly this reason; tlon-kits is the odd one out, not a different kind of thing.
- Bundling would add a bundler to openclaw's tsc-only build to special-case one dep. AC #4 (shared parser) is satisfied either way — publishing keeps one convention.
- tlon-kits is already publish-shaped: proper `exports`/`files` (dist/, src/, kits/), MIT, `repository.directory`, only dep is zod. Note: publishing ships the kit content (instructions, templates) publicly on npm — that is the package's stated purpose ("shareable kit packages") and it is MIT.
- Runtime blast radius is small: openclaw imports only `parseGroupKitConfig` + `KITS_BLOB_VERSION` from it (src/kits/group-config.ts). Kit FILES reach bots from the ship's %kits, and the dev rig overrides the package via the TLON_APPS_DIR file: fallback — so npm version churn stays low (schema/parser changes only).

### Steps

1. **New workflow `.github/workflows/tlon-kits-publish.yml`** cloned from tlon-skill-publish.yml's shape: triggers on tag `tlon-kits-v*` + `workflow_dispatch` with `dry_run` (default true); quality job = frozen-lockfile install, tag-matches-package-version guard, `pnpm --filter @tloncorp/tlon-kits test` + build + `npm pack` artifact; publish job = npm Trusted Publishing (OIDC + provenance), `permissions: id-token: write`, publishes `packages/tlon-kits`.
2. **Ops step (needs npm org rights — cannot be done from the repo):** register the trusted publisher for `@tloncorp/tlon-kits` on npmjs.com → tloncorp/tlon-apps + `tlon-kits-publish.yml`. Then dispatch a dry run; then push tag `tlon-kits-v0.1.0` to publish for real. **AC #2 closes only after this lands.**
3. **AC #5 — CI guard:** new `packages/openclaw/scripts/check-publishable-deps.mjs`: for every `workspace:` dep in openclaw's package.json, `npm view <name> version` must succeed; exit 1 naming the offender. Wire as a step in openclaw-ci.yml's unit job. Sequencing: merge this only after step 2's publish, or the check itself is red on arrival.
4. **Verification:** (a) `pnpm pack:publish` → `.publish/package.json` shows a semver range for tlon-kits; `npm install` the tarball in a scratch dir outside the workspace installs clean (AC #2/#3). (b) Recreate the dev container with `TLON_APPS_DIR` unset → boots from the registry version (AC #1 without the crutch); keep the file: fallback for local dev of unpublished parser changes.

### Not changing
- `resolve-workspace-deps.mjs` — its staging mode already fails loudly (AC #3 by construction) and its dev fallback stays useful.
- No runtime code changes anywhere.

Estimated diff: 1 new workflow, 1 new check script, 1 CI step.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-21: Still open; the dev rig papers over it — every container start logs the npm E404 for @tloncorp/tlon-kits and the entrypoint falls back to installing from the mounted monorepo (visible in each dev-openclaw-1 boot today). Works locally, still breaks any environment without the monorepo mount.
<!-- SECTION:NOTES:END -->
