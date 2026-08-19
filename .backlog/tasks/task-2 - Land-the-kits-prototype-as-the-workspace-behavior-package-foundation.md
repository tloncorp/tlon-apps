---
id: TASK-2
title: Land the kits prototype as the workspace behavior-package foundation
status: In Progress
assignee:
  - james@tlon.io
created_date: '2026-08-19 13:46'
updated_date: '2026-08-19 15:48'
labels:
  - workspaces
  - kits
milestone: m-1
dependencies: []
references:
  - PLAN.md
  - commit 0f5ebfc28
  - commit 12c2ae54b
priority: high
type: feature
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md designates the unmerged kits prototype work (commits 0f5ebfc28 and 12c2ae54b) as the foundation of the workspace shift. It already models behavior packages, abstract places, schedules, setup, policy, group-blob configuration, installation, and sharing.

Bring this work onto develop as a reviewed, tested foundation: rebase/extract the kit model, installation flow, and group-blob configuration so later tasks (workspace descriptor, meal-planning kit, provisioning) can build on it. Discard prototype-only scaffolding that does not serve the workspace model.

This is infrastructure only — no user-facing onboarding or navigation changes belong in this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Kit model (behavior package, places, schedules, setup, policy) is available on develop as importable shared code
- [ ] #2 A kit can be installed into a group and its configuration persists in the group blob
- [ ] #3 Unit tests cover kit parsing, installation, and configuration persistence including malformed input
- [ ] #4 A docs/ page describes the kit format and installation lifecycle
- [ ] #5 No user-facing UI changes ship in this task
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

### Headline recommendation

**Land this as six sequenced PRs, and treat the group-blob protocol work as the real body of the task.** The kits agent, kit format, and runtime are comparatively easy; the blob's mark-version cascade against 621 commits of drift is where the risk and effort sit. A single 142-file PR against this much drift is neither reviewable nor safely revertable.

Two structural facts drive the ordering. The kit format package has **zero backend coupling**, so it can land immediately and unblock TASK-13 without waiting for any of the risky work. The group blob, by contrast, is a **hard cutover with no feature flag**: desk and client must ship together, because the client pokes only `group-action-5` and every tracked poke watches `/v3/groups`. Against an old backend every group mutation hangs until timeout.

This is realistically multi-day work. If you want it smaller, cut PR 6 and the invite work — not PR 3 or PR 4.

### Sequencing

**PR 1 — Kit format package and docs.** Zero risk, no backend dependency, unblocks TASK-13 authoring immediately. Land first.
`61ca96305`, `9212850d8`. `packages/tlon-kits` (loader, manifest, zod schemas, book-club example), `kits/SCHEMA.md`, `docs/kits.md`, the `tlon-skill` kits CLI, and the openclaw tool-guard vocabulary.
**Fix before landing:** `tlon kits card` is absent from `ACTION_OPERATIONS_BY_SUBCOMMAND.get('kits')` and from `summarizeKitsOperation`, so the one kits command that posts a message is classified against a set that omits it. Add loader tests for the missing-file throws, the invalid-JSON throw, and `resolvePackagedKitsDir` fallback. Add the package to the workspace build graph and confirm `pnpm -r tsc` and `build:packages` pick it up.

**PR 2 — Independent cleanup.** Low risk, shrinks everything downstream, revertable on its own.
`b79526477`, `4bbbf62ee`, `b108ad2b7`, `6017cf983`, `7c59ccb23`, `e53d1aba8`, `22f441a2e`, plus the `mark-warmer.hoon` deletion carved out of `f3d6e73fc`. None of this touches the blob. The mark-warmer removal rests on a claim about kelvin 408 building all marks by default; if that is wrong the symptom is a cold-start latency regression rather than a crash, so it needs to be independently revertable.

**PR 3 — The group blob.** Desk plus client plumbing plus migration, landing atomically. This is what TASK-8 presumes exists.
`2b0ac5cba`, `27b80d0f2`, `b7ec149ba`, `46ea9d990`, `a08500774`, `35c8461ba`, `55debe178`, plus the remainder of `f3d6e73fc`. Keep `a13c04e60`'s fallbacks (see Decisions).
Work beyond replaying commits:
1. **Re-derive `init-10` on top of develop's `init-9`.** Flip `activity:v8:av` to `activity:v10:av` at the three sites the branch author named: `desk/sur/ui.hoon` `init-10`, `desk/app/groups-ui.hoon` `/v4/activity` in *both* the `/x/v10/init` and `/x/v11/changes` arms, and `desk/mar/ui/init-10.hoon`'s enjs call. Mandatory — skipping it compiles cleanly and silently drops every note unread. Add a regression test asserting a `%note`/`%notebook` unread survives an init round-trip.
2. Resolve conflicts in `desk/app/groups-ui.hoon`, `desk/sur/ui.hoon`, `desk/desk.bill`, and the api client trio (`changesApi`, `initApi`, `postsApi`).
3. Verify the conv downgraders still return `~` for `%blob` on the v10 and v9 lanes, keeping v2/v1/v0 blob-free, and that `group-action-4` stays frozen at v8.
4. Measure `state-11-to-12` `on-load` time on a fat pier before merging. It re-walks every published group's log and there is no `%12 → %11` downgrade — a one-way door.
5. Keep `a08500774` paired with the Hoon: the no-op guard (`?: =(blob.group blob.c-group) se-core`) is what makes an unchanged-blob `trackedPoke` hang 20s and roll back.
6. The migration is a **baseline rewrite in place**, not a new file, so it conflicts with any other migration landing on develop first. Rebase it last and regenerate rather than hand-merging.
7. Preserve the `groupsApi.test.ts` invariant that tracked group pokes watch the lane `subscribeGroups` subscribes to — it catches exactly the bug class PR 4 introduces.

**PR 4 — Lane collapse, cutover, and pier regeneration.** Gated on the minimum-backend decision.
`e8bfb47cc`, `c8a873316`, the fallback-removal half of `ab016dba8`, and `643ea9aea`. The `trackedPoke` repointing half of `ab016dba8` is **required by `e8bfb47cc`** and must ride with it regardless of the policy call.
Regenerate piers from current develop plus the group-blob desk and update **all three** pin sites: `apps/tlon-web/e2e/shipManifest.json`, `apps/tlon-web/rube/Dockerfile`, and `packages/tlon-bot-e2e/docker/docker-compose.base.yml` (pinned md5 *and* byte size per ship). Restore `rube-{ship}{version}.tgz` naming rather than the branch's `rube-*-group-blob.tgz`; `archive-piers.sh` now requires an `ARCHIVE_TAG`. Archives must be published to the bucket before merge or CI breaks on the first run.

**PR 5 — `%kits` agent and its client surface.** Depends on PR 3 (install writes the blob through `%group-action-5`).
`96472404c`, plus the client-side kits surface from `c47030fec` and `9067f6051`: `kitsApi.ts`, `parseGroupKitConfig`, and the post-blob `kit` entry type. Excludes the `BlockRenderer` registration and all UI.
**Fix before merging:** the public `/v1/preview` and `/v1/full` watch arms are unauthenticated and `/v1/full` returns every file's contents; both use `~(got by kits)`, making an unknown kit id a remotely-triggerable crash. Add tests for both arms and for `+peek`. Consider wrapping the agent in `discipline`.
**Unify the two blob parsers** into `packages/tlon-kits` rather than landing both. They currently disagree on the `setup` default in opposite directions (`'pending'` in api, `'done'` in openclaw), on `installedAt`'s type, and on strict-versus-loose objects. Add tests for `kitsApi` poke shapes and `getKit`'s 404-to-null behavior, which are currently untested.

**PR 6 — OpenClaw kits runtime.** `0f5ebfc28`. Depends on PR 3 (reads the blob) and PR 5 (scries and pokes `%kits`).
Watch the `packages/openclaw/src/monitor/index.ts` conflict (+107 lines on a file develop also moved). Check whether the plugin registration is config-gated before landing. Build `packages/api` before running openclaw tests or they fail against a stale `dist`.

**Excluded (AC #5).** All of `12c2ae54b` — `KitCard/`, `KitDetailSheet.tsx`, fixtures, `chatDetails.tsx`, `BlockRenderer.tsx`, `channel.tsx`, `ui/index.tsx`, `InviteFriendsToTlonButton.tsx`, `ReserveShipScreen.tsx` — plus `dbHooks.ts` and `lure.ts`, which are data hooks but would be dead code without consumers, and the `INSTALLING_KIT` boot phase. These belong to a follow-up UI task. Two known defects to carry into it: `useKitManifest`'s `requestedFetchAt` ref is never reset across `queryKey` changes, and `KitCard` mounts `useKitInstalls()` unconditionally so it sits behind a permanently failing query on a node without `%kits`.

### Verification

Per PR: `pnpm -r tsc`, `pnpm test` for touched packages, and the relevant Hoon tests. PR 3 additionally needs the note-unread regression test and an `on-load` timing measurement. PR 4 needs a full e2e run against regenerated piers plus confirmation that an old client still reads groups through the downgraded v2 lane. PR 5 needs install exercised end to end on a dev ship (assemble-desk, rsync, `|commit` — never hand-editing the pier). PR 6 needs `tlon-bot-e2e` run locally, since the shared mute contract is sensitive to gateway changes.

### Risks

- **Group replication stalls during the OTA window.** `%group-update` and `%group-log` are unversioned marks whose shape changed, so the `~.groups %2 → %3` negotiate bump gates them — and on mismatch negotiate reports `%clash` and closes the group subscription outright. Members on an old desk stop receiving updates from a new-desk host until the OTA propagates. `channels`/`channels-server` also now require `%groups` at `%3`, so a partial desk sync breaks negotiation on a single ship.
- **Irreversible state migration.** No `%12 → %11` path; a desk rollback after users have loaded is not clean.
- **Blob has no concurrency control.** Last-write-wins on the whole cord, admin-only, 256 KB cap. Bounded today by one-kit-per-group, but the schema already models `kits` as an array. TASK-8 needs to know this before designing the workspace descriptor.
- **Every user pays a full local re-sync**, since the blob column arrives via a baseline migration rewrite.
- **Pier regeneration needs GCS credentials** (`gcloud auth login`, project `tlon-groups-mobile`). Without access this blocks PR 4 and you would need to run it.
- **Local build environment.** Dependencies are not installed in this worktree and this volume hits the TCC/EPERM problem, so the scratchpad-clone plus npx-pnpm workaround is needed before I can build or test anything.

### Decisions needed before I code

1. **Minimum-backend policy.** `ab016dba8` makes the client hard-require the new desk: `getGroups`, `getGroup`, `subscribeGroups`, `fetchInitData`, and `fetchChangesSince` read v3/v10/v11 with no fallback, so a user whose app updated before their ship OTA'd gets a non-functional groups experience rather than a degraded one. Mobile is the sharp edge, since app-store updates and desk OTAs are not coordinated. The branch itself added these fallbacks (`a13c04e60`) and then removed them. **I recommend keeping the fallbacks and deferring the removal until hosting is updated** — but this is a rollout call. The branch's stated rationale is that the desk always ships ahead of the app; if that invariant genuinely holds for mobile, the cutover is defensible.
2. **Kit-bearing invites (`467c2676a`, reel/bait plus OG tags).** Sharing, not foundation. I propose deferring it out of TASK-2.
3. **Scope.** All six PRs, or PR 1–5 now with the OpenClaw runtime deferred to sit alongside TASK-13?
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research findings, part 1 — branch survey and the group-blob protocol (read-only, no checkout).

**The source branches.** `origin/hunter/tlon-6323-kits-client-ui-v1-...` (tip `12c2ae54b`) is a strict superset of `origin/hunter/tlon-6316-kits-v1-...` (tip `0f5ebfc28`): 30 commits, 142 files, +8288/-527 vs develop. Treat 6323 as the single source of truth; 6316 is an earlier cut of the same stack.

**Drift is the dominant cost.** Merge-base is `b25565766` (2026-07-29); develop has moved **621 commits** since, and **43 files are touched on both sides**. Hot conflict areas: `desk/app/groups-ui.hoon`, `desk/sur/ui.hoon`, `desk/desk.bill`, `packages/api/src/client/{changesApi,initApi,postsApi}.ts`, `packages/openclaw/{index.ts,src/monitor/index.ts,src/config-schema.ts}`, `packages/shared/src/{db/queries.ts,store/sync/sync.ts,store/dbHooks.ts}`.

**The group-protocol churn is REQUIRED, not opportunistic refactoring.** This was my main open question and commit `2b0ac5cba` settles it. Adding `blob=(unit @t)` to `$group` changes the wire shape of every group update/command/response, which under Urbit's versioned-mark discipline forces the whole cascade. Per its own commit message: new v11 types carry `%blob` on a-group/c-group/u-group/r-group; responses ride a new `/v3/groups` lane with conv downgraders keeping v2/v1/v0 blob-free; actions ride a new strict `group-action-5` (group-action-4 frozen at v8); agent state bumps `%11 → %12`; groups negotiate version `%2 → %3`. New marks: `group-3`, `groups-3`, `group-ui-3`, `group/action-5`, `group/response-3`, `group/changed-groups-3`, `ui/init-10`. There is no cheap "just the blob field" subset — the versioning is the work.

**Documented rebase hazard with a silent-data-loss failure mode.** Commit `27b80d0f2` already anticipated colliding with develop's activity work and moved the blob arms to init-10/changes-v11 to sit above it. Develop has since merged that work (`0ca48e689`, `mar/ui/init-9.hoon`, using `activity:v10:av`). The branch's `init-10` is still on `activity:v8:av` because v10 did not exist when it was written. The branch author names the fix and the consequence verbatim: `v9:source:v10:ac` returns `~` for `%note` and `%notebook`, so a v8-sourced init or changes **silently drops every note unread**. Three sites must flip on rebase — `sur/ui.hoon` `init-10`, `groups-ui.hoon` `/v4/activity` in both arms, and `mar/ui/init-10.hoon`'s enjs call. A naive replay compiles fine and loses unreads.

**e2e piers are broken by convention violation plus staleness.** The branch repointed `apps/tlon-web/e2e/shipManifest.json` to `rube-{zod,ten,mug}-group-blob.tgz`, abandoning the documented `rube-{ship}{version}.tgz` scheme; develop is now at `rube-*27`. Piers must be regenerated from current develop plus the group-blob desk and renamed to the next version number. Needs `gcloud auth login` and `./apps/tlon-web/rube/archive-piers.sh` (GCS `bootstrap.urbit.org`, project `tlon-groups-mobile`).

Research findings, part 2 — kits proper, tests, and the UI boundary.

**%kits agent.** New and self-contained: `desk/app/kits.hoon`, `desk/sur/kits.hoon`, `desk/lib/kits-json.hoon`, `desk/mar/kits/{action-1,update-1}.hoon`, registered in `desk.bill`, tested in `desk/tests/app/kits.hoon` (201 lines). Registry and installer only — it stores packages, orchestrates installs, records ledgers, and runs no inference. Install is instantiate-only in v1: creates the group, creates each abstract place as a channel, writes config JSON into the group blob via `%group-action-5`, records a ledger entry. One kit per group; no update flow; optimistic (nacks logged, not unwound). `docs/kits.md` (49 lines) already covers purpose, poke/watch/scry surface, state model, and lifecycle invariants — it satisfies the repo's new-agent spec-doc convention and most of AC #4 as written. No peru changes needed; these are repo-owned, not vendored.

**Kit format.** `kits/SCHEMA.md` (96 lines) specifies three shapes: the authoring format (`kit.json` plus files), the wire format (what %kits stores and speaks), and the group install config (the blob payload). `packages/tlon-kits` holds the loader, manifest, zod schemas, and the `book-club` example kit (`kit.json`, `card/summary.md`, `instructions/*.md`, `scaffolds/*.md`). PLAN.md's concepts map cleanly onto it: places are abstract channel templates typed chat/notebook/gallery; schedules are `{id, cron, description}` realized at install; setup is a binding with trigger `install.setup`; policy is `{required[], recommended[]}` labeled patches. This is the artifact TASK-13 copies.

**OpenClaw runtime** (`0f5ebfc28`, six modules plus six test files, ~2700 lines): `group-config.ts` parses the blob (zod `looseObject`, skips malformed entries rather than throwing); `package-store.ts` fetches packages by scrying `/kits/v1/kits/<id>.json` and poking `kits-action-1 fetch` with backoff; `runtime.ts` binds configs to behavior via the `before_prompt_build` hook; `ambient.ts` assembles prompt material; `schedules.ts` reconciles `schedules[]` into gateway cron jobs named `tlon:kit:<groupFlag>:<scheduleId>`; `setup.ts` fires the setup conversation once when `setup: "pending"`. Strictly depends on both the group blob and the %kits agent. The `openclaw` core pin is **2026.5.28 on both develop and the branch**, so `PluginHookGatewayCronService` availability is not a version risk — verify at build rather than planning around it.

**Test coverage is already strong.** 28 test files changed, +2387 lines: `desk/tests/app/kits.hoon`, all six openclaw kits modules, `packages/tlon-kits/src/kits.test.ts`, `packages/api/src/__tests__/{groupKitConfig,postContent.kit}.test.ts`, `packages/shared/src/store/groupActions.test.ts`, plus updates to the groups, groups-server, and groups-json Hoon tests. AC #3 is mostly a matter of preserving and re-running these through the rebase rather than writing them.

**UI boundary for AC #5.** Commit `12c2ae54b` is cleanly separable and should be excluded wholesale: `KitCard/`, `KitDetailSheet.tsx`, two fixtures, plus edits to `chatDetails.tsx`, `BlockRenderer.tsx`, `channel.tsx`, `ui/index.tsx`, `InviteFriendsToTlonButton.tsx`, `ReserveShipScreen.tsx`. It also carries `dbHooks.ts` (+73) and `lure.ts` (+7), which are data hooks rather than UI but would be dead code without consumers — exclude them too and let the UI task bring them.

Research findings, part 3 — deep backend pass. Confirms the part-1 read and adds material corrections.

**Correction to my earlier framing: `ab016dba8` cannot be accepted or rejected wholesale.** It bundles two unrelated things. Its removal of the old-backend fallbacks is the policy call; but its repointing of five `trackedPoke`s from `/v2/groups` to `/v3/groups` is a **hard requirement** of the lane collapse in `e8bfb47cc` — after that collapse those pokes watch a path nothing subscribes to, so every group mutation hangs 20s then throws. The commit must be split, not chosen.

**The OTA window is worse than "rollout ordering."** `%group-update` and `%group-log` are *unversioned* marks carrying `update:g`/`log:g`, and `$group` inside `%create` changed shape. The `~.groups %2 → %3` negotiate bump is what gates this, and its effect is not graceful: while a group host and a member are on different desk versions, negotiate reports `%clash` and **closes the group subscription entirely**. Members on an old desk stop receiving updates from a new-desk host until the OTA propagates. Additionally `desk/app/channels.hoon` and `channels-server.hoon` now require `%groups` at `%3`, so a partial desk sync breaks channel↔group negotiation on a single ship.

**The state migration is expensive and irreversible.** `state-11-to-12` runs `(~(run by groups) v11:net-group:v9:gc)`, which re-walks the entire `$log` mop of every published group, mapping each `%create` entry. Slow `on-load` on fat piers — measure before shipping. There is no `%12 → %11` downgrade, so once users load it, a desk rollback is not clean.

**`a08500774` is caused by the Hoon, not the client.** The write arm has `?: =(blob.group blob.c-group) se-core` — a no-op on unchanged value emits no event, so a `trackedPoke` on an unchanged blob times out after 20s and rolls back a correct write. The client early-return is the fix. Keep them together.

**`f3d6e73fc` smuggles in an unrelated deletion**: it removes `desk/lib/mark-warmer.hoon` (121 lines) plus its importers in `groups-ui.hoon` and `contacts.hoon`, on the claim that kelvin 408 builds all marks by default. Fully independent of the blob. If the claim is wrong the symptom is a cold-start latency regression, not a crash — hard to attribute later. Land it separately so it can be reverted on its own.

**Pier archives have three pin sites, not one**: `apps/tlon-web/e2e/shipManifest.json`, `apps/tlon-web/rube/Dockerfile`, and `packages/tlon-bot-e2e/docker/docker-compose.base.yml` (which carries pinned md5 **and byte size** per ship, and which `archive-piers.sh` does not touch). A fourth, openclaw's dev compose, stays on the old rube-27 archives deliberately. Easy to land a partial update. Also `archive-piers.sh` now requires an `ARCHIVE_TAG` override and errors rather than silently minting `rube-zod1.tgz` against a non-numeric manifest entry.

**Blob semantics to know before TASK-8 designs on top of it.** `blob=(unit @t)` is an opaque cord — no structure in Hoon. Admin-only write, 256 KB cap on `(jam blob)`. **No concurrency control**: SCHEMA.md accepts last-write-wins and requires read-modify-write of the whole payload, so two concurrent writers silently lose one. %kits v1 bounds this by enforcing one kit per group, but the JSON already models `kits` as an array, so the multi-writer case is anticipated and unhandled. Note also that the blob rides in every `$group` sent to every member on join, on every `/v3` init, and in every changes response — a large blob multiplies across the membership.

**Client cost:** the blob column is added by rewriting the baseline SQLite migration, so every user pays a full local re-sync on first launch after update.

Research findings, part 4 — %kits agent review notes (from the deep backend pass).

**Two issues that should be fixed before %kits merges, not after.**

1. **The public watch surface is unauthenticated.** `/v1/preview/<id>` and `/v1/full/<id>` are open to any ship on the network — no `?> from-self`, no allow-list, no privacy flag on a kit. `/v1/full` returns the entire package including every file's contents. Exposure is zero at rest because the library starts empty, but it becomes a live leak the moment anyone `%add`s a private kit. Since `%kits` is registered in `desk.bill` it starts on every OTA'd ship.
2. **Remotely-triggerable crash path.** Both public arms use `~(got by kits)`, so a watch for an unknown kit id crashes the arm. It nacks the watch rather than killing the agent, but `%kits` is wrapped in neither `discipline` nor `negotiate`, so there is no mark guardrail and no version negotiation on the ship-to-ship fetch either.

**Install is not transactional.** `+install` emits the group-create poke, the per-place channel-create pokes, and the blob write in one event, then records the ledger entry unconditionally; nacks are only slogged. Reachable states: a group with no channels, channels in a group that failed to create, a ledger entry and blob for a half-built group. `%uninstall` clears the blob and ledger but does not delete the group or its channels — recovery is manual. Also `?< (~(has by installs) flag)` crashes the poke on reinstall rather than erroring cleanly, and `(~(got by kits) id)` crashes if the kit was never fetched.

**Test gaps in `desk/tests/app/kits.hoon`** (6 tests, correct `/+ *test-agent` convention): nothing exercises `%del`, the public `/v1/preview` or `/v1/full` watch arms, or the `+peek` scries. The public arms are exactly what needs coverage given the two issues above.

**State has no migration path.** `on-load` does a bare `!<(state-0 ole)`; any future state change requires introducing a real `any-state` union first.

**Type model detail for TASK-13.** Places map abstract names to channel kinds at install via `+place-kind` (`%chat→%chat`, `%notebook→%diary`, `%gallery→%heap`). `policy=(unit @t)` is deliberately opaque and harness-interpreted. A fetched kit ships its whole markdown payload inline as `files=(map @t @t)` over a single `%fact`.

Research findings, part 5 — deep client pass. Adds a live bug, a security-guard gap, and a reordering opportunity.

**Two zod parsers read the same group blob and they disagree.** `packages/api/src/client/groupKitConfig.ts` and `packages/openclaw/src/kits/group-config.ts` independently implement SCHEMA.md §2. Divergences: `setup` is `z.enum(['pending','done'])` defaulting to **`'pending'`** in api, but `z.string()` defaulting to **`'done'`** in openclaw; `installedAt` is a required number in api, `z.union([number, string])` in openclaw; api uses strict objects, openclaw uses `looseObject` throughout. The `setup` default is behaviorally meaningful in opposite directions — on an unparseable value openclaw never fires the setup conversation while the client shows the install as pending. Fix by unifying into `packages/tlon-kits`, which also gives that package a second consumer.

**The kit manifest type is declared three times**: zod in `packages/tlon-kits/src/manifest.ts`, hand-written TS interfaces in `packages/api/src/client/kitsApi.ts` (no zod, no import from tlon-kits), and Hoon in `desk/sur/kits.hoon`. `packages/openclaw` imports `Kit`/`KitBinding` from `@tloncorp/api` rather than tlon-kits. The `kitVersion` ↔ `version` rename now happens at three separate boundaries (loader, post-blob entry to block, manifest scry).

**Security-guard gap: `tlon kits card` is missing from the openclaw tool guard's operation map.** `ACTION_OPERATIONS_BY_SUBCOMMAND.get('kits')` contains `list, show, add, fetch, install, installs, uninstall` but not `card`, and `summarizeKitsOperation` has no case for it. That map is the source of `validOperations`, so the one kits command that **posts a message** is classified against a set that does not contain it. `card` was added in the later UI commit than the guard, so this reads as an oversight. Posting is precisely the intent class the guard exists to police — fix before landing the CLI.

**Live bug in `useKitManifest`** (`packages/shared/src/store/dbHooks.ts`): the `requestedFetchAt` ref is never reset across `queryKey` changes, so switching between two kits in one mounted component skips the `fetchKit` poke for the second.

**The post-blob `kit` entry is genuinely backend-independent.** Post blobs are a client-side convention over an opaque field that already exists on develop, so the `kit` entry type, the `kit-card` block, and `parseGroupKitConfig` can all land ahead of any Hoon. Caveat: `KitCard` mounts `useKitInstalls()` unconditionally, so on a node without `%kits` the card renders fine but sits behind a permanently failing install query — needs a graceful-degradation pass if the card lands before the agent.

**Migration detail.** There is no new migration file; the branch **rewrites baseline 0000 in place** (`0000_unique_texas_twister.sql` → `0000_late_micromacro.sql`, snapshot and journal regenerated). That is this repo's established pattern for its single-migration setup, but it is a guaranteed conflict if any other migration lands on develop first.

**Loader behavior worth knowing for TASK-13.** `loadKit` sweeps exactly three subdirectories — `instructions`, `scaffolds`, `card` — and silently drops anything else. It does enforce referential integrity: every `binding.file` and `scaffold.file` must exist in the collected files or it throws. `card/summary.md` is not required, just swept up if present.

**Dead or missing client surface**: `subscribeKitUpdates` is exported with no caller (the UI polls via react-query instead), and the agent's `%del` poke has no client binding at all.

**Client test gaps** (on top of the Hoon gaps in part 4): nothing covers `kitsApi.ts` itself — no poke-shape assertions, no test for `getKit`'s 404-to-null behavior — nothing covers the `INSTALLING_KIT` boot branch, and the loader's missing-file throws, invalid-JSON throw, and `resolvePackagedKitsDir` fallback are untested despite the injectable options built for it. One nice existing invariant test to preserve: `groupsApi.test.ts` asserts that tracked group pokes watch the same lane `subscribeGroups` subscribes to, which catches the exact bug class the lane collapse introduces.

Execution log — commits 1 and 2 landed on james/agentic-workspace.

**Environment.** Worktree had no node_modules; `pnpm install --ignore-scripts` works fine (the TCC/EPERM problem from the older memory did not reappear this session, so no scratchpad clone was needed). `packages/api` must be built before openclaw tests run, and `node scripts/generate-version.js` must run in openclaw before its tsc passes — both confirmed again.

**Hoon verification loop, now working.** Recipe for the remaining commits: `./scripts/sync-deps.sh` (peru) to populate desk-deps; extract `rube-zod27.tgz` into the scratchpad; boot with the urbit binary at `/Volumes/External/src/tlon-apps/apps/tlon-web/rube/dist/urbit_extracted/urbit`; `SKIP_SYNC=true ./scripts/assemble-desk.sh <target>`; rsync into the pier's mounted desk; `|commit`. Gotchas found: `click` needs `ASDF_PYTHON_VERSION=3.12.13`, and the scratchpad path is too long for AF_UNIX so the pier needs a short symlink (`ln -s <pier> /tmp/kz`). click's shell quoting is unreliable for anything nontrivial — **verify over HTTP instead**: log in at `http://localhost:80/~/login` with the ship code, then scry `/~/scry/<app>/<path>.json`. A live agent answering a scry is the decisive signal that the desk compiled.

**Commit 1** (`6028bc519`) — kit format package. `packages/tlon-kits`, `kits/SCHEMA.md`, tlon-skill kits CLI, openclaw guard/telemetry vocabulary. Took `kits.ts` at 61ca96305 (324 lines, no `card` subcommand), which means the guard gap I flagged does not exist yet at this commit — `card` and its guard classification will land together in commit 5, which fixes the bug properly rather than porting it. Added 8 loader tests (invalid JSON, binding/scaffold missing-file throws, the three-packaged-directories rule, and all three `resolvePackagedKitsDir` paths); 20 tests pass, tsc clean.

**Commit 2** (`780b752cc`) — independent Hoon cleanup. **Correction to the plan:** the other five cleanup commits are NOT separable. All seven were tested with `git cherry-pick -n` onto develop and all seven conflict, because they are stacked on the blob commit and reference types (`group-ui-3`, `group-action-5`, `GroupV11`) that do not exist until it lands. Only two things were genuinely independent by content and were hand-ported: the `%group-ui`/`-1`/`-2` strict-list additions and the mark-warmer deletion. `22f441a2e` also turned out to be blob-dependent — it deletes a test the lane collapse creates — so it moves to commit 4. The renames (`6017cf983`, `7c59ccb23`, `e53d1aba8`) and the two orderings (`4bbbf62ee`, `b108ad2b7`) move to commit 3.

Also noted: prettier fails on `packages/tlon-skill/SKILL.md` on develop already (a hard-wrapped LaTeX paragraph). Left as-is rather than reflowing it inside an unrelated commit.

Execution log — commit 3 landed (`806f0c336`), the group blob.

**Decision 1 is resolved, and in a way that removes the dilemma.** Rather than choosing between the branch's hard cutover and its 404-catch fallbacks, I found develop already has the right mechanism and extended it. Develop gates activity endpoint versions on a runtime capability resolved from the backend's desk version (`activityVersionSupportsNotes` → `setActivitySupportsNotes` → endpoint choice in initApi/changesApi). I mirrored it exactly: bumped `desk/desk.docket-0` to **12.2.0**, added `packages/shared/src/logic/groupBlobSupport.ts` with `groupsVersionSupportsBlob`, added a `groupsSupportsBlob` flag to `packages/api/src/client/urbit.ts`, and wired it through `syncAppInfo`/`syncReactionSupport`. `initApi`, `changesApi`, and `groupsApi` now each pick the blob-era path only once app-info confirms the backend carries it.

This is strictly better than the branch's `a13c04e60`, which caught 404s and retried — a wasted round trip on every call against an old backend. It also means **the hard cutover in `ab016dba8` is no longer needed at all**, so commit 4 shrinks to the lane collapse plus pier regeneration.

End-to-end chain verified on the fakezod: `desk.docket-0` → docket charges (`"version":"12.2.0"`) → `settingsApi.ts:304` `groupsVersion` → `groupsVersionSupportsBlob` → endpoint selection.

**The init-10 hazard was real and is handled.** Replaying as-authored would have compiled cleanly and dropped every note unread. init-10 is re-derived on develop's init-9 with `activity:v10:av` at all three named sites. Confirmed by scrying both arms: `/v9/init` and `/v10/init` return **byte-identical activity payloads**, which is only true if the flip took.

**Verification:** desk commits and replays clean; `/x/v3/groups`, `/x/v2/groups`, groups-ui `/v10/init` and `/v9/init` all serve 200 side by side (old and new surfaces coexisting is the whole point of the fallback design). 755 api tests, 102 shared tests pass. Added a test asserting group scries stay on `/v2` until the backend is known to carry the blob — it caught a real regression while I was writing it, since the branch's version of that test assumed the cutover.

**Two environment notes for whoever picks this up.** `pnpm install --ignore-scripts` leaves `better-sqlite3` without its native binding, so all `packages/shared` DB tests fail with "Could not locate the bindings file"; fix with `cd node_modules/better-sqlite3 && ASDF_PYTHON_VERSION=3.12.13 npm run build-release`. And `click` is genuinely unsafe against this urbit binary — it segfaulted the runtime once (`bail: oops`, stacktrace in `uv__drain`), losing nothing but costing a restart. Use it only for the `|commit` poke and verify everything else over HTTP.

**Also pre-existing, not mine:** `packages/app` tsc fails on `@tloncorp/editor/dist/editorHtml` (unbuilt editor package). Confirmed identical with my changes stashed.
<!-- SECTION:NOTES:END -->
