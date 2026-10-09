# AGENTS.md

Tlon Messenger: a group chat and collaboration app whose backend is a set of
Urbit agents (Hoon, in `desk/`) running on each user's ship, and whose client
is one TypeScript codebase serving web, iOS and Android. (`apps/tlon-desktop`,
an Electron wrapper of the web app, has not been released since April 2025.)

`CLAUDE.md` files are symlinks to these `AGENTS.md` files, so Codex and Claude
read the same guidance. This file covers the whole repository. Each area has
its own `AGENTS.md` with its conventions and review rules; read it before
changing code there:

| Area | Guidance |
| --- | --- |
| Hoon backend | `desk/AGENTS.md` |
| Talking to the ship, desk request registry | `packages/api/AGENTS.md` |
| Local db, sync, React Query, store actions | `packages/shared/AGENTS.md` |
| Screens, navigation, UI | `packages/app/AGENTS.md` |
| Web app and E2E tests | `apps/tlon-web/AGENTS.md` |
| OpenClaw plugin | `packages/openclaw/AGENTS.md` |
| Hermes adapter | `packages/hermes-tlon-adapter/AGENTS.md` |

## System map

```
desk/ agents (%groups %channels %chat %activity %contacts …)
      │  scry · poke · SSE subscribe · thread   (Eyre HTTP)
      ▼
packages/api      transport and wire ↔ model conversion; no db, no React
      ▼
packages/shared   sync ingests → SQLite (Drizzle) → React Query invalidation
                  store actions: optimistic write + api call + rollback
      ▼
packages/ui       Tamagui primitives
packages/app      screens, navigation (mobile tree + desktop tree), hooks
      ▼
apps/tlon-web (Vite) · apps/tlon-mobile (Expo) · [apps/tlon-desktop (Electron)]
```

- Data reaches the UI one way: ship → api → sync handler → SQLite → table
  invalidation → hook refetch → render. The UI reads the db, not api
  responses (transient, display-only values excepted). Writes go through a store action.
- Packages depend downward only: `api < shared < ui < app < apps/*`. Lint
  enforces it, and `import/no-cycle` is an error.
- Two versions are always live. A client may talk to a desk one release older
  (N-1), and a user's ship talks to group hosts and DM peers on other
  versions. Changing anything on the wire (marks, paths, scry shapes, protocol
  versions) is a compatibility decision; see
  `docs/tlon-apps/desk-compatibility.md`.
- The local SQLite db is a disposable cache of ship state; the ship is the
  source of truth.

Where a typical change goes:

- New backend data or behavior: desk (a new mark or path version, tests) →
  api (wire type, registry entry, wrapper, update variant) → shared (schema
  and migration, sync handler case, query, action with rollback) → app (hook
  and UI) → E2E. Each layer has its own tests; split commits by subsystem.
- Client-only feature: shared (query, logic) and app only.
- A new desk dependency the N-1 desk lacks: a guard in the api registry and a
  capability check in shared `logic/*Support.ts`.

## How we build

These are the corrections reviewers make most often. Follow them before a
reviewer has to.

- **Reuse before adding.** Grep for an existing helper, type, parser or
  constant before writing one. This is the most-violated rule in review: a
  third `@ud` formatter, a third nest parser, a fifth copy of one helper. If
  the new one is better, replace the old one in the same PR.
- **Find the root cause.** Don't ship a fix for a failure you can't explain,
  and don't add automatic recovery for a bug nobody has confirmed. Verify a
  diagnosis against the code (and, for kernel behavior, the urbit source)
  before acting on it. Instrument and investigate instead.
- **Trust the typed contract.** The backend is ours and typed. Don't build
  defensive parsers, guards or `try/catch` towers for states the other side
  cannot produce. Handle real failures (network, permission, old versions)
  explicitly.
- **Fix bad data at its source**: the backend's ingress (with a migration) or
  the read layer. A client-side sweep is at most a temporary band-aid.
- **Choose the simplest mechanism.** Prefer removing a branch over adding one,
  one queue over per-item tracking, a native dialog over stacked modals. Test
  what matters; don't write hundreds of lines of tests that restate the code.
- **Keep scope tight.** Unrelated refactors, deletions, renames and doc
  rewrites go in their own PR. Don't rewrite existing comments or docs that
  aren't wrong.
- **Comments explain why**, only where it isn't obvious, in the house style of
  the file. No narration of what the code does, no planning notes, no history.
  Every comment must match the code it sits on.
- **Never swallow errors.** Report them (`logger.trackError` in TS, `+fail` in
  Hoon), once, after retries are exhausted. New user-facing flows ship with
  lifecycle telemetry.
- **Keep mocks and fixtures out of production modules.**
- **Patches:** every `patches/` entry gets a `patches/README.md` entry (why,
  upstream issue, when to remove it). Prefer an upstream fix over owning a
  patch or native module.
- **Docs describe what exists.** No proposals, design notes or agent TODO
  lists in `docs/`.

## Decisions already made

Don't re-propose these without new information.

- Bots are identified as `[host ship, id]` on their owner's ship; virtual or
  "pretend" bot ships were rejected.
- The client subscribes to firehoses and filters locally; no per-entity
  subscriptions. New startup data rides in the versioned init payload.
- Strict marks never become relaxed again; a new shape is a new mark version.
- Spider threads are versioned by copying with a version tag (`create-1`).
- Desk dependencies are vendored by peru into `desk-deps/`, not copied in.
- A review finding may be declined when it needs an uncommon concurrent
  failure and the worst outcome is not data loss, corruption or a permission
  leak. Those three are always fixed.

## Commands

- Install: `pnpm install` (`pnpm run deps` adds iOS pods). Use the Node in
  `.nvmrc`.
- Build: `pnpm run build:packages` (api, shared, ui, editor), `build:web`,
  `build:mobile`, `build:desktop`, `build:all`.
- Develop: `pnpm run dev:web` (needs `apps/tlon-web/.env.local` with
  `VITE_SHIP_URL`), `dev:ios`, `dev:android`, `dev:desktop`; `pnpm run cosmos`
  for components.
- Check: `pnpm -r tsc`, `pnpm run lint:all` (`pnpm lint:fix` per package),
  `pnpm run test` (`test:ci` in CI). Unit tests are vitest, except Jest in
  `apps/tlon-mobile`. E2E: see `apps/tlon-web/AGENTS.md`.
- Format before every commit: `pnpm format` (oxfmt) at the root, or
  `pnpm lint:format` in a package. Passing tsc and lint does not mean the
  formatter is satisfied, and CI checks it.
- Desk: `./scripts/sync-deps.sh` (peru) after cloning or editing `peru.yaml`;
  `./scripts/assemble-desk.sh <target>` builds a full desk. See
  `desk/AGENTS.md`.

Shell scripts must run on macOS and Linux: `#!/bin/bash`, no `declare -A`,
portable flags (`grep -E`), and care with BSD vs GNU `sed`/`tar`. On Windows,
pnpm scripts run through `$TLON_SHELL`, which must point at Git for Windows'
bash, not WSL's.

## Workflows

Skills live in `.agents/skills/<name>/SKILL.md`. Codex discovers them; Claude
should read the `SKILL.md` by path when the task matches.

- `tlon-workflow`: a task from a fresh worktree to a merged PR, including the
  mobile app on EAS simulators and evidence capture. Use it before running the
  mobile app on a simulator or emulator. Set a machine up once
  with `tlon-workflow-doctor`.
- `pr-review-loop`: follow a PR's review rounds (Codex, CI, humans) to a clean
  state without a person relaying comments, then request a human reviewer.

## Pull requests and commits

- Fill in `.github/pull_request_template.md` explicitly (Summary / Changes /
  How did I test? / Risks and impact / Rollback plan / Screenshots);
  `gh pr create` does not apply it.
- Commit subjects use kernel style, `subsystem: imperative summary`
  (`api: guard buckets requests`, `groups: add blob mark`). Required for
  backend changes.
- For an OpenSpec change: commit the spec files first, then one commit per
  completed task including its checkbox update, only after its validation
  passes, with no unrelated working-tree changes.
- Before opening the PR, review your own diff:
  - Remove compat shims, fallbacks or migration steps that only bridge state
    from earlier commits of this branch; production never had it.
  - Remove debug output, commented-out code and stale TODOs; fix or delete
    comments that describe an earlier version of the code.
  - Justify added network, sync, render or disk work in the description or a
    comment.

## Code Review Rules

These apply to every change; the area files add their own. Before reviewing,
read the PR description (especially "Risks and impact") and the `AGENTS.md`
files covering the changed paths. Report findings in priority order, and name
the rule a finding relies on.

Skip promotion PRs between long-lived branches (`staging`, `develop`,
`master`) entirely: that code was reviewed in its original PR.

A finding must name a concrete, reachable trigger: the input or sequence that
causes it, and what the user or system sees. If you cannot name one, don't
report it.

Flag:

- **Compatibility.** Changes to marks, paths, scry shapes, protocol versions
  or released persisted state that break an N-1 client or a remote ship on
  another version. Claims about what an older desk sent must cite the released
  code, not inference from type names.
- **Data loss and state corruption.** A server-authoritative watermark moving
  backward, optimistic state not rolled back on failure, an unintended purge
  of the local db or pending posts, a migration that drops released state.
- **Permissions and data exposure**, reachable by a foreign ship or another
  user.
- **Retries and duplicates** that apply state twice; pending-request cleanup
  that isn't deterministic.
- **Wired but unreachable**: an action never dispatched, a handler never
  passed, a field read at the wrong nesting level.
- **Races with a single-user trigger** (double submit, an action during a
  load).
- **Shared-code changes** (a component's defaults, a helper's signature)
  without checking every consumer.
- **Platform splits.** A `.native`/`.web`/`.ios`/`.android` sibling that
  shadows the file being edited; platform-conditional code that breaks a
  platform; a removed platform file whose replacement doesn't cover it.
- **Dependency upgrades** that change globals or defaults (`fetch`, `Blob`,
  navigation): grep the call sites that depend on them. **Newly mounted
  components** in shared layouts (composer, chat pane): check every screen
  that hosts them.
- **Checks that silently stop enforcing**: CI or lint that passes while doing
  the wrong thing.
- **Errors swallowed**, or the same operation failing differently on different
  paths (an Alert on one, silence on another).
- **Duplication** of an existing helper, type or pattern. Point to it.
- **Over-engineering**: guards, parsers, retries or flags for states that
  cannot occur; a large mechanism for a small problem. Suggest the simpler
  design.
- **Missing coverage**: a user-facing flow change with no E2E update and no
  stated reason; a new native dependency without a regenerated Android Gradle
  lockfile.
- **Scope**: unrelated churn, doc or comment rewrites outside the PR's goal.

Do not flag:

- A race or failure that needs two or more independent unlikely events
  (another client editing concurrently, a restart inside a specific `await`, a
  double failure, manual dojo edits), unless the result is persistent data
  loss or a state the user can't recover from. If it self-heals on the next
  sync or refresh, don't flag it.
- Missing guards for values whose producer is this repo or the desk and whose
  type already excludes the case. Validate only at trust boundaries: content
  from other ships, user input, deep links.
- On re-review, new edge cases in code added only to address an earlier bot
  finding, unless they meet the bar above. Prefer proposing the simpler design
  that removes the edge case.
- A tradeoff the PR description says it accepts, or behavior a comment says
  is deliberate, unless you can show the stated reason is wrong.
- Migrations or compat shims for state that only existed on earlier commits of
  the same branch. Check `develop`, not the branch history.
- "Make X consistent with Y" when Y is itself an unexplained restriction. Ask
  whether Y is justified instead of propagating it.
- Claims about build, codegen or tooling behavior (svgr, Gradle, patches,
  vendored files, proxies) without citing the config that proves them.
- Eyre HTTP scry URLs for missing `/x`: Eyre applies the `%x` care itself
  (`/~/scry/<app>/v1/foo.json`). Do flag a URL that includes the care.
- Electron-only behavior: `apps/tlon-desktop` is not currently released.
  Supported clients are iOS, Android and web.
- Rare failure branches, cleanup or timing in maintainer-run scripts
  (`scripts/`, `backend/`, `apps/tlon-web/rube/`, `.agents/`) and fixtures.
  Flag only a tool that reports success while doing the wrong thing.
- Sub-second visual transients, or telemetry imprecision unless telemetry is
  the PR's goal.
- Formatting, imports, unused exports, or anything lint and the formatter
  enforce; generic "add tests" requests that don't name the regression a test
  would catch.
- Style preferences not written down in an `AGENTS.md`.
- Anything an area's `AGENTS.md` lists under "Do not flag".
